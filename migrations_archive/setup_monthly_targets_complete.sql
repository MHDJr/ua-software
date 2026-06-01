-- =====================================================
-- COMPLETE MONTHLY TARGETS SETUP
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- Step 1: Create the monthly_targets table
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

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_monthly_targets_profile_id ON monthly_targets(profile_id);
CREATE INDEX IF NOT EXISTS idx_monthly_targets_target_month ON monthly_targets(target_month);
CREATE INDEX IF NOT EXISTS idx_monthly_targets_department ON monthly_targets(department);
CREATE INDEX IF NOT EXISTS idx_monthly_targets_profile_month ON monthly_targets(profile_id, target_month);

-- Step 3: Enable Row Level Security
ALTER TABLE monthly_targets ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies (if any)
DROP POLICY IF EXISTS "Users can manage own monthly targets" ON monthly_targets;
DROP POLICY IF EXISTS "Users can view own monthly targets" ON monthly_targets;
DROP POLICY IF EXISTS "Users can insert own monthly targets" ON monthly_targets;
DROP POLICY IF EXISTS "Users can update own monthly targets" ON monthly_targets;
DROP POLICY IF EXISTS "CEOs can view all monthly targets" ON monthly_targets;

-- Step 5: Create RLS policies
CREATE POLICY "Users can manage own monthly targets" 
ON monthly_targets FOR ALL 
TO authenticated 
USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'))
WITH CHECK (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Step 6: Grant permissions
GRANT ALL ON monthly_targets TO authenticated;

-- Step 7: Create function to update monthly progress automatically
CREATE OR REPLACE FUNCTION update_monthly_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the current progress and achievement percentage
    -- This will be called by triggers on daily_reports and financial_entries tables
    
    -- For Sales staff: count conversions from daily_reports
    IF TG_TABLE_NAME = 'daily_reports' THEN
        UPDATE monthly_targets 
        SET 
            current_progress = (
                SELECT COALESCE(SUM(conversions), 0) 
                FROM daily_reports 
                WHERE profile_id = NEW.profile_id 
                AND EXTRACT(YEAR FROM report_date) = EXTRACT(YEAR FROM (SELECT target_month FROM monthly_targets WHERE id = NEW.id))
                AND EXTRACT(MONTH FROM report_date) = EXTRACT(MONTH FROM (SELECT target_month FROM monthly_targets WHERE id = NEW.id))
            ),
            achievement_percentage = CASE 
                WHEN target_value > 0 THEN 
                    ROUND((
                        SELECT COALESCE(SUM(conversions), 0) 
                        FROM daily_reports 
                        WHERE profile_id = NEW.profile_id 
                        AND EXTRACT(YEAR FROM report_date) = EXTRACT(YEAR FROM (SELECT target_month FROM monthly_targets WHERE id = NEW.id))
                        AND EXTRACT(MONTH FROM report_date) = EXTRACT(MONTH FROM (SELECT target_month FROM monthly_targets WHERE id = NEW.id))
                    ) * 100.0 / target_value, 2)
                ELSE 0
            END,
            updated_at = NOW()
        WHERE profile_id = NEW.profile_id 
        AND department = 'sales'
        AND EXTRACT(YEAR FROM target_month) = EXTRACT(YEAR FROM NEW.report_date)
        AND EXTRACT(MONTH FROM target_month) = EXTRACT(MONTH FROM NEW.report_date);
    
    -- For Accounts staff: sum revenue from financial_entries
    ELSIF TG_TABLE_NAME = 'financial_entries' THEN
        UPDATE monthly_targets 
        SET 
            current_progress = (
                SELECT COALESCE(SUM(revenue), 0) 
                FROM financial_entries 
                WHERE submitted_by = NEW.profile_id 
                AND EXTRACT(YEAR FROM entry_date) = EXTRACT(YEAR FROM (SELECT target_month FROM monthly_targets WHERE id = NEW.id))
                AND EXTRACT(MONTH FROM entry_date) = EXTRACT(MONTH FROM (SELECT target_month FROM monthly_targets WHERE id = NEW.id))
            ),
            achievement_percentage = CASE 
                WHEN target_value > 0 THEN 
                    ROUND((
                        SELECT COALESCE(SUM(revenue), 0) 
                        FROM financial_entries 
                        WHERE submitted_by = NEW.profile_id 
                        AND EXTRACT(YEAR FROM entry_date) = EXTRACT(YEAR FROM (SELECT target_month FROM monthly_targets WHERE id = NEW.id))
                        AND EXTRACT(MONTH FROM entry_date) = EXTRACT(MONTH FROM (SELECT target_month FROM monthly_targets WHERE id = NEW.id))
                    ) * 100.0 / target_value, 2)
                ELSE 0
            END,
            updated_at = NOW()
        WHERE submitted_by = NEW.profile_id 
        AND department = 'accounts'
        AND EXTRACT(YEAR FROM target_month) = EXTRACT(YEAR FROM NEW.entry_date)
        AND EXTRACT(MONTH FROM target_month) = EXTRACT(MONTH FROM NEW.entry_date);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 8: Create trigger to update progress when daily reports are added/updated
DROP TRIGGER IF EXISTS update_sales_monthly_progress ON daily_reports;
CREATE TRIGGER update_sales_monthly_progress
AFTER INSERT OR UPDATE ON daily_reports
FOR EACH ROW
EXECUTE FUNCTION update_monthly_progress();

-- Step 9: Create trigger to update progress when financial entries are added
DROP TRIGGER IF EXISTS update_accounts_monthly_progress ON financial_entries;
CREATE TRIGGER update_accounts_monthly_progress
AFTER INSERT ON financial_entries
FOR EACH ROW
EXECUTE FUNCTION update_monthly_progress();

-- Step 10: Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Step 11: Verify table creation
SELECT '=== TABLE CREATED SUCCESSFULLY ===' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'monthly_targets' 
ORDER BY ordinal_position;

-- Step 12: Create function to handle monthly reset
CREATE OR REPLACE FUNCTION handle_monthly_reset()
RETURNS TRIGGER AS $$
BEGIN
    -- This function will be called to reset targets when a new month starts
    -- It ensures that each staff member can set one target per month
    -- and that progress is calculated correctly for the current month
    
    -- For new month, ensure no existing target exists for this month
    -- The unique constraint will handle this automatically
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 13: Create function to get or create monthly target
CREATE OR REPLACE FUNCTION get_or_create_monthly_target(
    p_profile_id UUID,
    p_target_month DATE,
    p_department VARCHAR(20),
    p_target_value NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    profile_id UUID,
    target_month DATE,
    target_value NUMERIC,
    department VARCHAR(20),
    current_progress NUMERIC,
    achievement_percentage NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    existing_target RECORD;
    new_target_id UUID;
BEGIN
    -- Check if target already exists for this month
    SELECT * INTO existing_target
    FROM monthly_targets
    WHERE profile_id = p_profile_id 
    AND target_month = p_target_month 
    AND department = p_department;
    
    IF existing_target.id IS NOT NULL THEN
        -- Target exists, return it
        RETURN QUERY 
        SELECT * FROM monthly_targets 
        WHERE id = existing_target.id;
    ELSIF p_target_value IS NOT NULL THEN
        -- Create new target if value provided
        INSERT INTO monthly_targets (
            profile_id, 
            target_month, 
            target_value, 
            department,
            current_progress,
            achievement_percentage
        ) VALUES (
            p_profile_id,
            p_target_month,
            p_target_value,
            p_department,
            0,
            0
        ) RETURNING *;
        
        RETURN QUERY 
        SELECT * FROM monthly_targets 
        WHERE id = new_target_id;
    ELSE
        -- No target exists and no value provided
        RETURN QUERY 
        SELECT NULL, p_profile_id, p_target_month, 0, p_department, 0, 0, NOW(), NOW();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 14: Test current user access
SELECT '=== TESTING USER ACCESS ===' as info;
SELECT id, email, role, full_name 
FROM profiles 
WHERE id = auth.uid();
