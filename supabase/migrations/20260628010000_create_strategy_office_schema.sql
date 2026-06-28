-- =========================================================================
-- SUPABASE MIGRATION: STRATEGY OFFICE SCHEMA (UPDATED FOR EXISTING TABLES)
-- =========================================================================

-- 1. Table 'ideas' already exists in the schema. We alter its check constraints to support both legacy and new values.
ALTER TABLE ideas DROP CONSTRAINT IF EXISTS ideas_priority_check;
ALTER TABLE ideas DROP CONSTRAINT IF EXISTS ideas_status_check;

ALTER TABLE ideas ADD CONSTRAINT ideas_priority_check CHECK (priority IN ('low', 'medium', 'high', 'critical', 'Low', 'Medium', 'High', 'Critical'));
ALTER TABLE ideas ADD CONSTRAINT ideas_status_check CHECK (status IN ('open', 'in_progress', 'completed', 'archived', 'directive', 'active', 'implemented', 'discarded', 'Inbox', 'Planning', 'Executing', 'Completed', 'Archived'));

-- 2. Create monthly_plans table
CREATE TABLE IF NOT EXISTS monthly_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
    month integer NOT NULL CHECK (month BETWEEN 0 AND 12), -- Month 0 represents executive focus configuration
    year integer NOT NULL,
    objective text,
    marketing text,
    academics text,
    operations text,
    finance text,
    events text,
    challenges text,
    notes text,
    completion integer DEFAULT 0 CHECK (completion BETWEEN 0 AND 100),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (user_id, month, year)
);

-- 3. Create strategic_projects table
CREATE TABLE IF NOT EXISTS strategic_projects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title text NOT NULL,
    description text,
    status text NOT NULL DEFAULT 'Planning' CHECK (status IN ('Planning', 'Research', 'Development', 'Testing', 'Completed')),
    progress integer DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    deadline date,
    priority text NOT NULL CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4. Create business_journal table
CREATE TABLE IF NOT EXISTS business_journal (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
    entry_date date NOT NULL DEFAULT CURRENT_DATE,
    wins text,
    problems text,
    ideas text,
    lessons text,
    tomorrow_focus text,
    created_at timestamptz DEFAULT now(),
    UNIQUE (user_id, entry_date)
);

-- 5. Create decision_log table
CREATE TABLE IF NOT EXISTS decision_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title text NOT NULL,
    reason text,
    expected_outcome text,
    actual_outcome text,
    decision_date date NOT NULL DEFAULT CURRENT_DATE,
    review_date date,
    status text NOT NULL DEFAULT 'Pending Review' CHECK (status IN ('Pending Review', 'Successful', 'Needs Improvement'))
);

-- 6. Create vision_board table
CREATE TABLE IF NOT EXISTS vision_board (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title text NOT NULL,
    description text,
    image_url text,
    target_year integer,
    display_order integer DEFAULT 0
);

-- 7. Create resources table
CREATE TABLE IF NOT EXISTS resources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title text NOT NULL,
    category text NOT NULL CHECK (category IN ('Documents', 'Images', 'PDFs', 'Useful Links', 'Notes')),
    file_url text,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

-- Enable RLS on all tables
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE strategic_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_board ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;

-- Helper function to check if the active user is a CEO or Manager
CREATE OR REPLACE FUNCTION is_ceo_or_manager()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND (role = 'ceo' OR role = 'manager' OR is_manager = true)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. Policies for ideas (Uses 'created_by' because table already exists with that column)
DROP POLICY IF EXISTS "Strategy CEO select on ideas" ON ideas;
DROP POLICY IF EXISTS "Strategy CEO insert on ideas" ON ideas;
DROP POLICY IF EXISTS "Strategy CEO update on ideas" ON ideas;
DROP POLICY IF EXISTS "Strategy CEO delete on ideas" ON ideas;

CREATE POLICY "Strategy CEO select on ideas" ON ideas FOR SELECT USING (auth.uid() = created_by AND is_ceo_or_manager());
CREATE POLICY "Strategy CEO insert on ideas" ON ideas FOR INSERT WITH CHECK (auth.uid() = created_by AND is_ceo_or_manager());
CREATE POLICY "Strategy CEO update on ideas" ON ideas FOR UPDATE USING (auth.uid() = created_by AND is_ceo_or_manager()) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Strategy CEO delete on ideas" ON ideas FOR DELETE USING (auth.uid() = created_by AND is_ceo_or_manager());

-- 2. Policies for monthly_plans
DROP POLICY IF EXISTS "Allow CEO select on monthly_plans" ON monthly_plans;
DROP POLICY IF EXISTS "Allow CEO insert on monthly_plans" ON monthly_plans;
DROP POLICY IF EXISTS "Allow CEO update on monthly_plans" ON monthly_plans;
DROP POLICY IF EXISTS "Allow CEO delete on monthly_plans" ON monthly_plans;

CREATE POLICY "Allow CEO select on monthly_plans" ON monthly_plans FOR SELECT USING (auth.uid() = user_id AND is_ceo_or_manager());
CREATE POLICY "Allow CEO insert on monthly_plans" ON monthly_plans FOR INSERT WITH CHECK (auth.uid() = user_id AND is_ceo_or_manager());
CREATE POLICY "Allow CEO update on monthly_plans" ON monthly_plans FOR UPDATE USING (auth.uid() = user_id AND is_ceo_or_manager()) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow CEO delete on monthly_plans" ON monthly_plans FOR DELETE USING (auth.uid() = user_id AND is_ceo_or_manager());

-- 3. Policies for strategic_projects
DROP POLICY IF EXISTS "Allow CEO select on strategic_projects" ON strategic_projects;
DROP POLICY IF EXISTS "Allow CEO insert on strategic_projects" ON strategic_projects;
DROP POLICY IF EXISTS "Allow CEO update on strategic_projects" ON strategic_projects;
DROP POLICY IF EXISTS "Allow CEO delete on strategic_projects" ON strategic_projects;

CREATE POLICY "Allow CEO select on strategic_projects" ON strategic_projects FOR SELECT USING (auth.uid() = user_id AND is_ceo_or_manager());
CREATE POLICY "Allow CEO insert on strategic_projects" ON strategic_projects FOR INSERT WITH CHECK (auth.uid() = user_id AND is_ceo_or_manager());
CREATE POLICY "Allow CEO update on strategic_projects" ON strategic_projects FOR UPDATE USING (auth.uid() = user_id AND is_ceo_or_manager()) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow CEO delete on strategic_projects" ON strategic_projects FOR DELETE USING (auth.uid() = user_id AND is_ceo_or_manager());

-- 4. Policies for business_journal
DROP POLICY IF EXISTS "Allow CEO select on business_journal" ON business_journal;
DROP POLICY IF EXISTS "Allow CEO insert on business_journal" ON business_journal;
DROP POLICY IF EXISTS "Allow CEO update on business_journal" ON business_journal;
DROP POLICY IF EXISTS "Allow CEO delete on business_journal" ON business_journal;

CREATE POLICY "Allow CEO select on business_journal" ON business_journal FOR SELECT USING (auth.uid() = user_id AND is_ceo_or_manager());
CREATE POLICY "Allow CEO insert on business_journal" ON business_journal FOR INSERT WITH CHECK (auth.uid() = user_id AND is_ceo_or_manager());
CREATE POLICY "Allow CEO update on business_journal" ON business_journal FOR UPDATE USING (auth.uid() = user_id AND is_ceo_or_manager()) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow CEO delete on business_journal" ON business_journal FOR DELETE USING (auth.uid() = user_id AND is_ceo_or_manager());

-- 5. Policies for decision_log
DROP POLICY IF EXISTS "Allow CEO select on decision_log" ON decision_log;
DROP POLICY IF EXISTS "Allow CEO insert on decision_log" ON decision_log;
DROP POLICY IF EXISTS "Allow CEO update on decision_log" ON decision_log;
DROP POLICY IF EXISTS "Allow CEO delete on decision_log" ON decision_log;

CREATE POLICY "Allow CEO select on decision_log" ON decision_log FOR SELECT USING (auth.uid() = user_id AND is_ceo_or_manager());
CREATE POLICY "Allow CEO insert on decision_log" ON decision_log FOR INSERT WITH CHECK (auth.uid() = user_id AND is_ceo_or_manager());
CREATE POLICY "Allow CEO update on decision_log" ON decision_log FOR UPDATE USING (auth.uid() = user_id AND is_ceo_or_manager()) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow CEO delete on decision_log" ON decision_log FOR DELETE USING (auth.uid() = user_id AND is_ceo_or_manager());

-- 6. Policies for vision_board
DROP POLICY IF EXISTS "Allow CEO select on vision_board" ON vision_board;
DROP POLICY IF EXISTS "Allow CEO insert on vision_board" ON vision_board;
DROP POLICY IF EXISTS "Allow CEO update on vision_board" ON vision_board;
DROP POLICY IF EXISTS "Allow CEO delete on vision_board" ON vision_board;

CREATE POLICY "Allow CEO select on vision_board" ON vision_board FOR SELECT USING (auth.uid() = user_id AND is_ceo_or_manager());
CREATE POLICY "Allow CEO insert on vision_board" ON vision_board FOR INSERT WITH CHECK (auth.uid() = user_id AND is_ceo_or_manager());
CREATE POLICY "Allow CEO update on vision_board" ON vision_board FOR UPDATE USING (auth.uid() = user_id AND is_ceo_or_manager()) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow CEO delete on vision_board" ON vision_board FOR DELETE USING (auth.uid() = user_id AND is_ceo_or_manager());

-- 7. Policies for resources
DROP POLICY IF EXISTS "Allow CEO select on resources" ON resources;
DROP POLICY IF EXISTS "Allow CEO insert on resources" ON resources;
DROP POLICY IF EXISTS "Allow CEO update on resources" ON resources;
DROP POLICY IF EXISTS "Allow CEO delete on resources" ON resources;

CREATE POLICY "Allow CEO select on resources" ON resources FOR SELECT USING (auth.uid() = user_id AND is_ceo_or_manager());
CREATE POLICY "Allow CEO insert on resources" ON resources FOR INSERT WITH CHECK (auth.uid() = user_id AND is_ceo_or_manager());
CREATE POLICY "Allow CEO update on resources" ON resources FOR UPDATE USING (auth.uid() = user_id AND is_ceo_or_manager()) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow CEO delete on resources" ON resources FOR DELETE USING (auth.uid() = user_id AND is_ceo_or_manager());
