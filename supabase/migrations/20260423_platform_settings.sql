-- Migration: Create Platform Settings Table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed Default Settings
INSERT INTO public.platform_settings (key, value) VALUES
('subscription_rates', '[
  {"id": "quarter", "name": "Quarter Power", "price": 5000, "period": "/month", "tagline": "25% of full vendor powers", "color": "#3b82f6"},
  {"id": "half", "name": "Half Power", "price": 10000, "period": "/month", "tagline": "50% of full vendor powers", "color": "var(--primary)", "popular": true},
  {"id": "full", "name": "Full Power", "price": 20000, "period": "/month", "tagline": "100% of full vendor powers", "color": "#f59e0b"}
]'::jsonb),
('boost_rates', '[
  {"id": "boost_week", "name": "1-Week Homepage Boost", "emoji": "📣", "price": 1000, "desc": "Featured on homepage for 7 days", "duration": "7 days"},
  {"id": "boost_month", "name": "1-Month Homepage Boost", "emoji": "🔥", "price": 3000, "desc": "Top featured placement for 30 days", "duration": "30 days", "popular": true},
  {"id": "boost_top", "name": "Priority Top Slot", "emoji": "🏆", "price": 5000, "desc": "Pin your store at #1 position for 7 days", "duration": "7 days (prime)"}
]'::jsonb),
('activation_fee', '{"amount": 2000}'::jsonb),
('platform_fees', '{"delivery_fee": 1500, "commission_rate": 10}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Policies
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings are viewable by everyone." ON public.platform_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings." ON public.platform_settings FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
