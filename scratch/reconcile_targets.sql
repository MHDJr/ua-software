-- =====================================================
-- REBUILD ACADEMY FINANCIAL TARGETS TABLE
-- =====================================================
DROP TABLE IF EXISTS academy_financial_targets CASCADE;

CREATE TABLE academy_financial_targets (
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

-- Enable RLS
ALTER TABLE academy_financial_targets ENABLE ROW LEVEL SECURITY;

-- Select policy: All authenticated users can view targets
DROP POLICY IF EXISTS "Users can view financial targets" ON academy_financial_targets;
CREATE POLICY "Users can view financial targets" ON academy_financial_targets
    FOR SELECT TO authenticated USING (true);

-- Manage policy: Only CEOs can insert, update, or delete
DROP POLICY IF EXISTS "CEOs can manage financial targets" ON academy_financial_targets;
CREATE POLICY "CEOs can manage financial targets" ON academy_financial_targets
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Grant permissions to authenticated role
GRANT ALL ON academy_financial_targets TO authenticated;


-- =====================================================
-- REBUILD ACADEMY SALES TARGETS TABLE
-- =====================================================
DROP TABLE IF EXISTS academy_sales_targets CASCADE;

CREATE TABLE academy_sales_targets (
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

-- Enable RLS
ALTER TABLE academy_sales_targets ENABLE ROW LEVEL SECURITY;

-- Select policy: All authenticated users can view targets
DROP POLICY IF EXISTS "Users can view sales targets" ON academy_sales_targets;
CREATE POLICY "Users can view sales targets" ON academy_sales_targets
    FOR SELECT TO authenticated USING (true);

-- Manage policy: Only CEOs can insert, update, or delete
DROP POLICY IF EXISTS "CEOs can manage sales targets" ON academy_sales_targets;
CREATE POLICY "CEOs can manage sales targets" ON academy_sales_targets
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'))
    WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Grant permissions to authenticated role
GRANT ALL ON academy_sales_targets TO authenticated;
