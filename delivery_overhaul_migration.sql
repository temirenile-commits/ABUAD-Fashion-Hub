-- Delivery System Overhaul Migration

-- 1. Update Brands table with Admin-controlled delivery settings
ALTER TABLE public.brands 
ADD COLUMN IF NOT EXISTS delivery_scope TEXT DEFAULT 'in-school' CHECK (delivery_scope IN ('in-school', 'out-school')),
ADD COLUMN IF NOT EXISTS assigned_delivery_system TEXT DEFAULT 'platform' CHECK (assigned_delivery_system IN ('platform', 'vendor'));

-- 2. Update Orders table to store delivery context
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS delivery_scope TEXT DEFAULT 'in-school',
ADD COLUMN IF NOT EXISTS assigned_delivery_system TEXT DEFAULT 'platform';

-- 3. Update existing data to defaults
UPDATE public.brands SET delivery_scope = 'in-school', assigned_delivery_system = 'platform' WHERE delivery_scope IS NULL;
UPDATE public.orders SET delivery_scope = 'in-school', assigned_delivery_system = 'platform' WHERE delivery_scope IS NULL;

-- 4. Add Live Map support to Deliveries
ALTER TABLE public.deliveries
ADD COLUMN IF NOT EXISTS live_location_lat DECIMAL,
ADD COLUMN IF NOT EXISTS live_location_lng DECIMAL,
ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 5. Helper function to get delivery fee based on scope
CREATE OR REPLACE FUNCTION public.get_delivery_fee(p_scope TEXT, p_system TEXT)
RETURNS DECIMAL AS $$
BEGIN
    IF p_system = 'vendor' THEN
        RETURN 0.00;
    ELSIF p_scope = 'in-school' THEN
        RETURN 1500.00;
    ELSE
        RETURN 3000.00; -- Assuming 3k for out-school platform delivery
    END IF;
END;
$$ LANGUAGE plpgsql;
