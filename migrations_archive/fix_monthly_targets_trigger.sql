-- Fix the monthly_targets trigger function
-- The original function incorrectly tried to access NEW.department and NEW.target_month
-- from daily_reports table, but those fields don't exist there

-- Step 1: Drop existing triggers
DROP TRIGGER IF EXISTS update_sales_monthly_progress ON daily_reports;
DROP TRIGGER IF EXISTS update_accounts_monthly_progress ON financial_entries;

-- Step 2: Drop the broken function
DROP FUNCTION IF EXISTS update_monthly_progress();

-- Step 3: Create corrected function
CREATE OR REPLACE FUNCTION update_monthly_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- For Sales staff: count conversions from daily_reports
    IF TG_TABLE_NAME = 'daily_reports' THEN
        -- Get the staff member's department from profiles
        DECLARE
            staff_dept VARCHAR(20);
        BEGIN
            SELECT role INTO staff_dept
            FROM profiles
            WHERE id = NEW.profile_id;
            
            -- Only update if this is a sales staff member
            IF staff_dept = 'sales' THEN
                UPDATE monthly_targets 
                SET 
                    current_progress = (
                        SELECT COALESCE(SUM(conversions), 0) 
                        FROM daily_reports 
                        WHERE profile_id = NEW.profile_id 
                        AND EXTRACT(YEAR FROM report_date) = EXTRACT(YEAR FROM NEW.report_date)
                        AND EXTRACT(MONTH FROM report_date) = EXTRACT(MONTH FROM NEW.report_date)
                    ),
                    achievement_percentage = CASE 
                        WHEN target_value > 0 THEN 
                            ROUND((
                                SELECT COALESCE(SUM(conversions), 0) 
                                FROM daily_reports 
                                WHERE profile_id = NEW.profile_id 
                                AND EXTRACT(YEAR FROM report_date) = EXTRACT(YEAR FROM NEW.report_date)
                                AND EXTRACT(MONTH FROM report_date) = EXTRACT(MONTH FROM NEW.report_date)
                            ) * 100.0 / target_value, 2)
                        ELSE 0
                    END,
                    updated_at = NOW()
                WHERE profile_id = NEW.profile_id 
                AND department = 'sales'
                AND EXTRACT(YEAR FROM target_month) = EXTRACT(YEAR FROM NEW.report_date)
                AND EXTRACT(MONTH FROM target_month) = EXTRACT(MONTH FROM NEW.report_date);
            END IF;
        END;
    
    -- For Accounts staff: sum revenue from financial_entries
    ELSIF TG_TABLE_NAME = 'financial_entries' THEN
        -- Get the staff member's department from profiles
        DECLARE
            staff_dept VARCHAR(20);
        BEGIN
            SELECT role INTO staff_dept
            FROM profiles
            WHERE id = NEW.submitted_by;
            
            -- Only update if this is an accounts staff member
            IF staff_dept = 'accounts' THEN
                UPDATE monthly_targets 
                SET 
                    current_progress = (
                        SELECT COALESCE(SUM(revenue), 0) 
                        FROM financial_entries 
                        WHERE submitted_by = NEW.submitted_by 
                        AND EXTRACT(YEAR FROM entry_date) = EXTRACT(YEAR FROM NEW.entry_date)
                        AND EXTRACT(MONTH FROM entry_date) = EXTRACT(MONTH FROM NEW.entry_date)
                    ),
                    achievement_percentage = CASE 
                        WHEN target_value > 0 THEN 
                            ROUND((
                                SELECT COALESCE(SUM(revenue), 0) 
                                FROM financial_entries 
                                WHERE submitted_by = NEW.submitted_by 
                                AND EXTRACT(YEAR FROM entry_date) = EXTRACT(YEAR FROM NEW.entry_date)
                                AND EXTRACT(MONTH FROM entry_date) = EXTRACT(MONTH FROM NEW.entry_date)
                            ) * 100.0 / target_value, 2)
                        ELSE 0
                    END,
                    updated_at = NOW()
                WHERE profile_id = NEW.submitted_by 
                AND department = 'accounts'
                AND EXTRACT(YEAR FROM target_month) = EXTRACT(YEAR FROM NEW.entry_date)
                AND EXTRACT(MONTH FROM target_month) = EXTRACT(MONTH FROM NEW.entry_date);
            END IF;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Recreate triggers
CREATE TRIGGER update_sales_monthly_progress
AFTER INSERT OR UPDATE ON daily_reports
FOR EACH ROW
EXECUTE FUNCTION update_monthly_progress();

CREATE TRIGGER update_accounts_monthly_progress
AFTER INSERT ON financial_entries
FOR EACH ROW
EXECUTE FUNCTION update_monthly_progress();

-- Step 5: Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Step 6: Recalculate existing monthly targets based on historical data
-- This will update all monthly_targets with current progress from daily_reports
UPDATE monthly_targets
SET 
    current_progress = (
        SELECT COALESCE(SUM(conversions), 0) 
        FROM daily_reports 
        WHERE daily_reports.profile_id = monthly_targets.profile_id
        AND EXTRACT(YEAR FROM daily_reports.report_date) = EXTRACT(YEAR FROM monthly_targets.target_month)
        AND EXTRACT(MONTH FROM daily_reports.report_date) = EXTRACT(MONTH FROM monthly_targets.target_month)
    ),
    achievement_percentage = CASE 
        WHEN target_value > 0 THEN 
            ROUND((
                SELECT COALESCE(SUM(conversions), 0) 
                FROM daily_reports 
                WHERE daily_reports.profile_id = monthly_targets.profile_id
                AND EXTRACT(YEAR FROM daily_reports.report_date) = EXTRACT(YEAR FROM monthly_targets.target_month)
                AND EXTRACT(MONTH FROM daily_reports.report_date) = EXTRACT(MONTH FROM monthly_targets.target_month)
            ) * 100.0 / target_value, 2)
        ELSE 0
    END,
    updated_at = NOW()
WHERE department = 'sales';

SELECT 'Monthly targets trigger fixed and data recalculated' as status;
