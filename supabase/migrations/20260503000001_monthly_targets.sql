-- =====================================================
-- Monthly Targets System Migration
-- Adds support for staff monthly goal tracking
-- =====================================================

-- Create monthly_targets table for staff goal setting
CREATE TABLE IF NOT EXISTS monthly_targets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    target_month DATE NOT NULL, -- First day of the target month
    
    -- Target values based on department
    -- For Sales staff: target number of conversions
    -- For Accounts staff: target revenue amount
    target_value NUMERIC NOT NULL CHECK (target_value > 0),
    
    -- Department to determine metric type
    department VARCHAR(20) NOT NULL CHECK (department IN ('sales', 'accounts')),
    
    -- Current progress (calculated from daily data)
    current_progress NUMERIC NOT NULL DEFAULT 0,
    
    -- Achievement percentage (calculated)
    achievement_percentage NUMERIC NOT NULL DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure one target per staff per month
    CONSTRAINT unique_monthly_target UNIQUE (profile_id, target_month, department)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_monthly_targets_profile_id ON monthly_targets(profile_id);
CREATE INDEX IF NOT EXISTS idx_monthly_targets_target_month ON monthly_targets(target_month);
CREATE INDEX IF NOT EXISTS idx_monthly_targets_department ON monthly_targets(department);
CREATE INDEX IF NOT EXISTS idx_monthly_targets_achievement ON monthly_targets(achievement_percentage);

-- Enable Row Level Security
ALTER TABLE monthly_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Users can view their own targets
CREATE POLICY "Users can view own monthly targets" 
ON monthly_targets FOR SELECT 
TO authenticated 
USING (profile_id = auth.uid() OR 
       EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Policy: Users can insert their own targets
CREATE POLICY "Users can insert own monthly targets" 
ON monthly_targets FOR INSERT 
TO authenticated 
WITH CHECK (profile_id = auth.uid());

-- Policy: Users can update their own targets
CREATE POLICY "Users can update own monthly targets" 
ON monthly_targets FOR UPDATE 
TO authenticated 
USING (profile_id = auth.uid())
WITH CHECK (profile_id = auth.uid());

-- Policy: CEOs can view all targets
CREATE POLICY "CEOs can view all monthly targets" 
ON monthly_targets FOR SELECT 
TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Grant permissions
GRANT ALL ON monthly_targets TO authenticated;

-- Create function to update monthly progress automatically
CREATE OR REPLACE FUNCTION update_monthly_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the current progress and achievement percentage
    -- This will be called by triggers on daily_reports and financial_entries tables
    
    -- For Sales staff: count conversions from daily_reports
    IF NEW.department = 'sales' THEN
        UPDATE monthly_targets 
        SET 
            current_progress = (
                SELECT COALESCE(SUM(conversions), 0) 
                FROM daily_reports 
                WHERE profile_id = NEW.profile_id 
                AND EXTRACT(YEAR FROM report_date) = EXTRACT(YEAR FROM NEW.target_month)
                AND EXTRACT(MONTH FROM report_date) = EXTRACT(MONTH FROM NEW.target_month)
            ),
            achievement_percentage = CASE 
                WHEN target_value > 0 THEN 
                    ROUND((
                        SELECT COALESCE(SUM(conversions), 0) 
                        FROM daily_reports 
                        WHERE profile_id = NEW.profile_id 
                        AND EXTRACT(YEAR FROM report_date) = EXTRACT(YEAR FROM NEW.target_month)
                        AND EXTRACT(MONTH FROM report_date) = EXTRACT(MONTH FROM NEW.target_month)
                    ) * 100.0 / target_value, 2)
                ELSE 0
            END,
            updated_at = NOW()
        WHERE id = NEW.id;
    
    -- For Accounts staff: sum revenue from financial_entries
    ELSIF NEW.department = 'accounts' THEN
        UPDATE monthly_targets 
        SET 
            current_progress = (
                SELECT COALESCE(SUM(revenue), 0) 
                FROM financial_entries 
                WHERE submitted_by = NEW.profile_id 
                AND EXTRACT(YEAR FROM entry_date) = EXTRACT(YEAR FROM NEW.target_month)
                AND EXTRACT(MONTH FROM entry_date) = EXTRACT(MONTH FROM NEW.target_month)
            ),
            achievement_percentage = CASE 
                WHEN target_value > 0 THEN 
                    ROUND((
                        SELECT COALESCE(SUM(revenue), 0) 
                        FROM financial_entries 
                        WHERE submitted_by = NEW.profile_id 
                        AND EXTRACT(YEAR FROM entry_date) = EXTRACT(YEAR FROM NEW.target_month)
                        AND EXTRACT(MONTH FROM entry_date) = EXTRACT(MONTH FROM NEW.target_month)
                    ) * 100.0 / target_value, 2)
                ELSE 0
            END,
            updated_at = NOW()
        WHERE id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update progress when daily reports are added/updated
CREATE OR REPLACE TRIGGER update_sales_monthly_progress
AFTER INSERT OR UPDATE ON daily_reports
FOR EACH ROW
EXECUTE FUNCTION update_monthly_progress();

-- Create trigger to update progress when financial entries are added
CREATE OR REPLACE TRIGGER update_accounts_monthly_progress
AFTER INSERT ON financial_entries
FOR EACH ROW
EXECUTE FUNCTION update_monthly_progress();

-- Add comments for documentation
COMMENT ON TABLE monthly_targets IS 'Monthly goal tracking for sales and accounts staff';
COMMENT ON COLUMN monthly_targets.target_value IS 'For sales: number of conversions, For accounts: revenue amount';
COMMENT ON COLUMN monthly_targets.current_progress IS 'Auto-calculated progress based on daily submissions';
COMMENT ON COLUMN monthly_targets.achievement_percentage IS 'Percentage of target achieved (0-100)';
