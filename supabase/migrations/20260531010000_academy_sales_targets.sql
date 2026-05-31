-- =====================================================
-- GLOBAL ACADEMY SALES TARGETS TABLE
-- =====================================================
-- Allows the CEO to set monthly target leads, evaluation rate, and conversion rate for the entire academy

CREATE TABLE IF NOT EXISTS academy_sales_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_month DATE NOT NULL UNIQUE, -- First day of the month (e.g. YYYY-MM-01)
    leads_target INTEGER NOT NULL DEFAULT 1000,
    evaluation_target INTEGER NOT NULL DEFAULT 70, -- 70% evaluation rate
    conversion_target INTEGER NOT NULL DEFAULT 15, -- 15% close rate
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient date-based target lookups
CREATE INDEX IF NOT EXISTS idx_academy_sales_targets_month ON academy_sales_targets(target_month DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE academy_sales_targets ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view the global academy sales targets
DROP POLICY IF EXISTS "Users can view sales targets" ON academy_sales_targets;
CREATE POLICY "Users can view sales targets" ON academy_sales_targets
    FOR SELECT TO authenticated USING (true);

-- Policy: Only CEOs can insert, update, or delete sales targets
DROP POLICY IF EXISTS "CEOs can manage sales targets" ON academy_sales_targets;
CREATE POLICY "CEOs can manage sales targets" ON academy_sales_targets
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Grant full permission to authenticated roles
GRANT ALL ON academy_sales_targets TO authenticated;

-- Comment describing the table
COMMENT ON TABLE academy_sales_targets IS 'Academy-wide monthly sales targets set by the CEO';
