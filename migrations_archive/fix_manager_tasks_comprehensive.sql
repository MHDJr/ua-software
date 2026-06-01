-- ============================================
-- COMPREHENSIVE FIX FOR MANAGER TASK ASSIGNMENT
-- This script ensures Managers and CEO can create, view, update, and delete tasks.
-- It also fixes the task_type check constraint to support directives.
-- ============================================

-- 1. Fix CHECK constraints on tasks table
-- Some tasks use 'ceo_directive' which might be blocked by existing constraints
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_task_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_task_type_check CHECK (task_type IN ('assignment', 'daily_task', 'mission', 'ceo_directive', 'directive'));

-- 2. Drop ALL known policies on tasks table to ensure a clean state
DROP POLICY IF EXISTS "CEO can manage all tasks" ON tasks;
DROP POLICY IF EXISTS "CEO can create tasks" ON tasks;
DROP POLICY IF EXISTS "CEO and assigned users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Staff can see own tasks" ON tasks;
DROP POLICY IF EXISTS "Staff can update own tasks" ON tasks;
DROP POLICY IF EXISTS "Staff can view own assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update signal_cleared on tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Authorized users can create tasks" ON tasks;
DROP POLICY IF EXISTS "Authorized users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Authorized users can delete tasks" ON tasks;
DROP POLICY IF EXISTS "Managers and CEO can view all tasks" ON tasks;
DROP POLICY IF EXISTS "Managers and CEO can create tasks" ON tasks;
DROP POLICY IF EXISTS "Managers and CEO can delete tasks" ON tasks;
DROP POLICY IF EXISTS "Staff can view own tasks" ON tasks;

-- 3. Ensure RLS is enabled
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Managers and CEO can manage ALL tasks
-- This covers SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "Managers and CEO can manage all tasks"
  ON tasks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'ceo' OR role = 'manager' OR is_manager = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'ceo' OR role = 'manager' OR is_manager = true)
    )
  );

-- 5. Policy: Staff can view tasks assigned to them or created by them
CREATE POLICY "Staff can view own tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid()
  );

-- 6. Policy: Staff can update tasks assigned to them (e.g., to change status)
CREATE POLICY "Staff can update own tasks" ON tasks
  FOR UPDATE
  TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- 7. Grant permissions
GRANT ALL ON tasks TO authenticated;
GRANT ALL ON tasks TO service_role;

-- 8. Verification: List current policies on tasks
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'tasks';
