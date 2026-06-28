-- =========================================================================
-- SUPABASE MIGRATION: RESTRICT STRATEGY TABLES STRICTLY TO CEO ROLE
-- =========================================================================

-- Create helper function to check if active profile is CEO
CREATE OR REPLACE FUNCTION is_ceo()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'ceo'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Reconfigure policies for ideas
DROP POLICY IF EXISTS "Strategy CEO select on ideas" ON ideas;
DROP POLICY IF EXISTS "Strategy CEO insert on ideas" ON ideas;
DROP POLICY IF EXISTS "Strategy CEO update on ideas" ON ideas;
DROP POLICY IF EXISTS "Strategy CEO delete on ideas" ON ideas;

CREATE POLICY "Strategy CEO select on ideas" ON ideas FOR SELECT USING (auth.uid() = created_by AND is_ceo());
CREATE POLICY "Strategy CEO insert on ideas" ON ideas FOR INSERT WITH CHECK (auth.uid() = created_by AND is_ceo());
CREATE POLICY "Strategy CEO update on ideas" ON ideas FOR UPDATE USING (auth.uid() = created_by AND is_ceo()) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Strategy CEO delete on ideas" ON ideas FOR DELETE USING (auth.uid() = created_by AND is_ceo());

-- 2. Reconfigure policies for monthly_plans
DROP POLICY IF EXISTS "Allow CEO select on monthly_plans" ON monthly_plans;
DROP POLICY IF EXISTS "Allow CEO insert on monthly_plans" ON monthly_plans;
DROP POLICY IF EXISTS "Allow CEO update on monthly_plans" ON monthly_plans;
DROP POLICY IF EXISTS "Allow CEO delete on monthly_plans" ON monthly_plans;

CREATE POLICY "Allow CEO select on monthly_plans" ON monthly_plans FOR SELECT USING (auth.uid() = user_id AND is_ceo());
CREATE POLICY "Allow CEO insert on monthly_plans" ON monthly_plans FOR INSERT WITH CHECK (auth.uid() = user_id AND is_ceo());
CREATE POLICY "Allow CEO update on monthly_plans" ON monthly_plans FOR UPDATE USING (auth.uid() = user_id AND is_ceo()) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow CEO delete on monthly_plans" ON monthly_plans FOR DELETE USING (auth.uid() = user_id AND is_ceo());

-- 3. Reconfigure policies for strategic_projects
DROP POLICY IF EXISTS "Allow CEO select on strategic_projects" ON strategic_projects;
DROP POLICY IF EXISTS "Allow CEO insert on strategic_projects" ON strategic_projects;
DROP POLICY IF EXISTS "Allow CEO update on strategic_projects" ON strategic_projects;
DROP POLICY IF EXISTS "Allow CEO delete on strategic_projects" ON strategic_projects;

CREATE POLICY "Allow CEO select on strategic_projects" ON strategic_projects FOR SELECT USING (auth.uid() = user_id AND is_ceo());
CREATE POLICY "Allow CEO insert on strategic_projects" ON strategic_projects FOR INSERT WITH CHECK (auth.uid() = user_id AND is_ceo());
CREATE POLICY "Allow CEO update on strategic_projects" ON strategic_projects FOR UPDATE USING (auth.uid() = user_id AND is_ceo()) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow CEO delete on strategic_projects" ON strategic_projects FOR DELETE USING (auth.uid() = user_id AND is_ceo());

-- 4. Reconfigure policies for business_journal
DROP POLICY IF EXISTS "Allow CEO select on business_journal" ON business_journal;
DROP POLICY IF EXISTS "Allow CEO insert on business_journal" ON business_journal;
DROP POLICY IF EXISTS "Allow CEO update on business_journal" ON business_journal;
DROP POLICY IF EXISTS "Allow CEO delete on business_journal" ON business_journal;

CREATE POLICY "Allow CEO select on business_journal" ON business_journal FOR SELECT USING (auth.uid() = user_id AND is_ceo());
CREATE POLICY "Allow CEO insert on business_journal" ON business_journal FOR INSERT WITH CHECK (auth.uid() = user_id AND is_ceo());
CREATE POLICY "Allow CEO update on business_journal" ON business_journal FOR UPDATE USING (auth.uid() = user_id AND is_ceo()) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow CEO delete on business_journal" ON business_journal FOR DELETE USING (auth.uid() = user_id AND is_ceo());

-- 5. Reconfigure policies for decision_log
DROP POLICY IF EXISTS "Allow CEO select on decision_log" ON decision_log;
DROP POLICY IF EXISTS "Allow CEO insert on decision_log" ON decision_log;
DROP POLICY IF EXISTS "Allow CEO update on decision_log" ON decision_log;
DROP POLICY IF EXISTS "Allow CEO delete on decision_log" ON decision_log;

CREATE POLICY "Allow CEO select on decision_log" ON decision_log FOR SELECT USING (auth.uid() = user_id AND is_ceo());
CREATE POLICY "Allow CEO insert on decision_log" ON decision_log FOR INSERT WITH CHECK (auth.uid() = user_id AND is_ceo());
CREATE POLICY "Allow CEO update on decision_log" ON decision_log FOR UPDATE USING (auth.uid() = user_id AND is_ceo()) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow CEO delete on decision_log" ON decision_log FOR DELETE USING (auth.uid() = user_id AND is_ceo());

-- 6. Reconfigure policies for vision_board
DROP POLICY IF EXISTS "Allow CEO select on vision_board" ON vision_board;
DROP POLICY IF EXISTS "Allow CEO insert on vision_board" ON vision_board;
DROP POLICY IF EXISTS "Allow CEO update on vision_board" ON vision_board;
DROP POLICY IF EXISTS "Allow CEO delete on vision_board" ON vision_board;

CREATE POLICY "Allow CEO select on vision_board" ON vision_board FOR SELECT USING (auth.uid() = user_id AND is_ceo());
CREATE POLICY "Allow CEO insert on vision_board" ON vision_board FOR INSERT WITH CHECK (auth.uid() = user_id AND is_ceo());
CREATE POLICY "Allow CEO update on vision_board" ON vision_board FOR UPDATE USING (auth.uid() = user_id AND is_ceo()) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow CEO delete on vision_board" ON vision_board FOR DELETE USING (auth.uid() = user_id AND is_ceo());

-- 7. Reconfigure policies for resources
DROP POLICY IF EXISTS "Allow CEO select on resources" ON resources;
DROP POLICY IF EXISTS "Allow CEO insert on resources" ON resources;
DROP POLICY IF EXISTS "Allow CEO update on resources" ON resources;
DROP POLICY IF EXISTS "Allow CEO delete on resources" ON resources;

CREATE POLICY "Allow CEO select on resources" ON resources FOR SELECT USING (auth.uid() = user_id AND is_ceo());
CREATE POLICY "Allow CEO insert on resources" ON resources FOR INSERT WITH CHECK (auth.uid() = user_id AND is_ceo());
CREATE POLICY "Allow CEO update on resources" ON resources FOR UPDATE USING (auth.uid() = user_id AND is_ceo()) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow CEO delete on resources" ON resources FOR DELETE USING (auth.uid() = user_id AND is_ceo());

-- Safely clean up old is_ceo_or_manager check function
DROP FUNCTION IF EXISTS is_ceo_or_manager();
