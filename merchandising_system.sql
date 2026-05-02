-- Dynamic Merchandising System Tables

-- 1. Homepage Sections
CREATE TABLE IF NOT EXISTS homepage_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('manual', 'automated')),
    auto_rule JSONB DEFAULT '{}', -- Stores rules for automated sections
    layout_type TEXT NOT NULL DEFAULT 'horizontal_scroll' CHECK (layout_type IN ('horizontal_scroll', 'grid', 'banner')),
    banner_url TEXT,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Manual Section Products
CREATE TABLE IF NOT EXISTS section_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES homepage_sections(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    position INTEGER DEFAULT 0,
    UNIQUE(section_id, product_id)
);

-- 3. Merchandising Performance Stats
CREATE TABLE IF NOT EXISTS merchandising_stats (
    section_id UUID NOT NULL REFERENCES homepage_sections(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    PRIMARY KEY (section_id, product_id)
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_sections_active ON homepage_sections(is_active, priority);
CREATE INDEX IF NOT EXISTS idx_section_products_pos ON section_products(section_id, position);

-- Enable RLS (Read-only for public, Full for Admin)
ALTER TABLE homepage_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read active sections" ON homepage_sections
    FOR SELECT USING (is_active = true AND (start_date IS NULL OR start_date <= now()) AND (end_date IS NULL OR end_date >= now()));

CREATE POLICY "Allow public read section products" ON section_products
    FOR SELECT USING (true);

-- 4. RPC for Atomic Increments
CREATE OR REPLACE FUNCTION increment_merchandising_stat(sec_id UUID, prod_id UUID, col_name TEXT)
RETURNS void AS $$
BEGIN
    INSERT INTO merchandising_stats (section_id, product_id, impressions, clicks, conversions)
    VALUES (sec_id, prod_id, 
        CASE WHEN col_name = 'impressions' THEN 1 ELSE 0 END,
        CASE WHEN col_name = 'clicks' THEN 1 ELSE 0 END,
        CASE WHEN col_name = 'conversions' THEN 1 ELSE 0 END
    )
    ON CONFLICT (section_id, product_id)
    DO UPDATE SET
        impressions = merchandising_stats.impressions + (CASE WHEN col_name = 'impressions' THEN 1 ELSE 0 END),
        clicks = merchandising_stats.clicks + (CASE WHEN col_name = 'clicks' THEN 1 ELSE 0 END),
        conversions = merchandising_stats.conversions + (CASE WHEN col_name = 'conversions' THEN 1 ELSE 0 END);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
