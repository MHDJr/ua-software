-- Drop old select policies if they exist
DROP POLICY IF EXISTS "CEO can view all financial entries" ON financial_entries;
DROP POLICY IF EXISTS "CEO and Managers can view all financial entries" ON financial_entries;
DROP POLICY IF EXISTS "Users can view own daily reports" ON daily_reports;
DROP POLICY IF EXISTS "CEO can view all conversions" ON conversions;
DROP POLICY IF EXISTS "CEO and Managers can view all conversions" ON conversions;

-- Create new select policies allowing both CEO and Managers to view all records
CREATE POLICY "CEO and Managers can view all financial entries" ON financial_entries 
    FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true)));

CREATE POLICY "Users can view own daily reports" ON daily_reports 
    FOR SELECT TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true)));

CREATE POLICY "CEO and Managers can view all conversions" ON conversions
    FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true)));
