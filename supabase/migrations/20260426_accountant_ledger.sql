-- Migration: Accountant Ledger, Payouts & Escrow (2026-04-26)

-- 1. ENHANCE VENDOR WALLETS
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(12,2) DEFAULT 0.00;
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS total_withdrawn DECIMAL(12,2) DEFAULT 0.00;

-- 2. CREATE AGENT WALLETS
CREATE TABLE IF NOT EXISTS public.agent_wallets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_id UUID REFERENCES public.delivery_agents(id) ON DELETE CASCADE NOT NULL UNIQUE,
    available_balance DECIMAL(12,2) DEFAULT 0.00,
    pending_balance DECIMAL(12,2) DEFAULT 0.00,
    total_earnings DECIMAL(12,2) DEFAULT 0.00,
    total_withdrawn DECIMAL(12,2) DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.agent_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents view own wallet." ON public.agent_wallets;
CREATE POLICY "Agents view own wallet." ON public.agent_wallets 
FOR SELECT USING (auth.uid() = agent_id);

-- Trigger to auto-create agent wallet
CREATE OR REPLACE FUNCTION public.handle_new_agent_wallet()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.agent_wallets (agent_id, available_balance)
    VALUES (NEW.id, COALESCE(NEW.wallet_balance, 0));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_agent_created ON public.delivery_agents;
CREATE TRIGGER on_agent_created
AFTER INSERT ON public.delivery_agents
FOR EACH ROW EXECUTE FUNCTION public.handle_new_agent_wallet();

-- Initialize existing agents
INSERT INTO public.agent_wallets (agent_id, available_balance)
SELECT id, COALESCE(wallet_balance, 0) FROM public.delivery_agents
ON CONFLICT (agent_id) DO NOTHING;

-- 3. FINANCIAL LEDGER
CREATE TABLE IF NOT EXISTS public.financial_ledger (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    user_role TEXT NOT NULL CHECK (user_role IN ('vendor', 'delivery', 'platform')),
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit', 'payout', 'commission', 'refund')),
    amount DECIMAL(12,2) NOT NULL,
    reference TEXT, -- e.g., order_id or payout_request_id
    status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.financial_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own ledger." ON public.financial_ledger;
CREATE POLICY "Users view own ledger." ON public.financial_ledger 
FOR SELECT USING (auth.uid() = user_id);

-- 4. PAYOUT REQUESTS
CREATE TABLE IF NOT EXISTS public.payout_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('vendor', 'delivery')),
    amount_requested DECIMAL(12,2) NOT NULL,
    bank_details JSONB NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected', 'failed')),
    proof_url TEXT,
    transfer_reference TEXT,
    confirmed_by UUID REFERENCES auth.users(id),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own payouts." ON public.payout_requests;
CREATE POLICY "Users view own payouts." ON public.payout_requests 
FOR SELECT USING (auth.uid() = user_id);

-- 5. ESCROW HOLDS
CREATE TABLE IF NOT EXISTS public.escrow_holds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) NOT NULL UNIQUE,
    vendor_id UUID REFERENCES public.brands(id) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    commission_amount DECIMAL(12,2) DEFAULT 0.00,
    release_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'released', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.escrow_holds ENABLE ROW LEVEL SECURITY;
-- Vendors can view their own escrow holds
DROP POLICY IF EXISTS "Vendors view own escrow holds." ON public.escrow_holds;
CREATE POLICY "Vendors view own escrow holds." ON public.escrow_holds 
FOR SELECT USING (EXISTS (SELECT 1 FROM public.brands WHERE id = vendor_id AND owner_id = auth.uid()));


-- 6. STORAGE BUCKET FOR PROOFS
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payout_proofs', 'payout_proofs', true) 
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Payout proofs are publicly accessible." ON storage.objects;
CREATE POLICY "Payout proofs are publicly accessible." ON storage.objects FOR SELECT USING (bucket_id = 'payout_proofs');

DROP POLICY IF EXISTS "Only admins can upload payout proofs." ON storage.objects;
CREATE POLICY "Only admins can upload payout proofs." ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'payout_proofs' AND 
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
