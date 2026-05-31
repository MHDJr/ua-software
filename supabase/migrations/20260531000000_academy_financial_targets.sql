-- =====================================================
-- GLOBAL ACADEMY MONTHLY TARGETS TABLE
-- =====================================================
-- Allows the CEO to set monthly target income and expenses for the entire academy

CREATE TABLE IF NOT EXISTS academy_financial_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_month DATE NOT NULL UNIQUE, -- First day of the month (e.g. YYYY-MM-01)
    usthad_target DECIMAL(12,2) NOT NULL DEFAULT 2500000.00,
    uloomx_target DECIMAL(12,2) NOT NULL DEFAULT 3000000.00,
    expense_target DECIMAL(12,2) NOT NULL DEFAULT 1500000.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient date-based target lookups
CREATE INDEX IF NOT EXISTS idx_academy_financial_targets_month ON academy_financial_targets(target_month DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE academy_financial_targets ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view the global academy financial targets
DROP POLICY IF EXISTS "Users can view financial targets" ON academy_financial_targets;
CREATE POLICY "Users can view financial targets" ON academy_financial_targets
    FOR SELECT TO authenticated USING (true);

-- Policy: Only CEOs can insert, update, or delete financial targets
DROP POLICY IF EXISTS "CEOs can manage financial targets" ON academy_financial_targets;
CREATE POLICY "CEOs can manage financial targets" ON academy_financial_targets
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Grant full permission to authenticated roles
GRANT ALL ON academy_financial_targets TO authenticated;

-- Comment describing the table
COMMENT ON TABLE academy_financial_targets IS 'Academy-wide monthly targets set by the CEO';
