-- ============================================
-- FINAL FIX FOR TASKS RLS PERMISSIONS
-- This script ensures both CEO and Managers can create and manage tasks.
-- ============================================

-- 1. Drop ALL existing policies on tasks table to start fresh
DROP POLICY IF EXISTS "Users can view assigned tasks" ON tasks;
DROP POLICY IF EXISTS "CEO can create tasks" ON tasks;
DROP POLICY IF EXISTS "CEO and assigned users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Staff can view own assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update signal_cleared on tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Authorized users can create tasks" ON tasks;
DROP POLICY IF EXISTS "Authorized users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Authorized users can delete tasks" ON tasks;
DROP POLICY IF EXISTS "CEO can manage all tasks" ON tasks;
DROP POLICY IF EXISTS "Staff can see own tasks" ON tasks;
DROP POLICY IF EXISTS "Staff can update own tasks" ON tasks;

-- 2. Enable RLS (just in case)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 3. Create "Authorized Users Can View All Tasks" (CEO and Managers)
CREATE POLICY "Managers and CEO can view all tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'ceo' OR role = 'manager' OR is_manager = true)
    )
  );

-- 4. Create "Staff Can View Own Tasks"
CREATE POLICY "Staff can view own tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid() OR
    created_by = auth.uid()
  );

-- 5. Create "Authorized Users Can Create Tasks" (CEO and Managers)
CREATE POLICY "Managers and CEO can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'ceo' OR role = 'manager' OR is_manager = true)
    )
  );

-- 6. Create "Authorized Users Can Update Tasks" (CEO, Managers, and Assignee)
CREATE POLICY "Authorized users can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = assigned_to OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'ceo' OR role = 'manager' OR is_manager = true)
    )
  )
  WITH CHECK (
    auth.uid() = assigned_to OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'ceo' OR role = 'manager' OR is_manager = true)
    )
  );

-- 7. Create "Authorized Users Can Delete Tasks" (CEO and Managers)
CREATE POLICY "Managers and CEO can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND (role = 'ceo' OR role = 'manager' OR is_manager = true)
    )
  );

-- 8. Grant permissions (just in case)
GRANT ALL ON tasks TO authenticated;
GRANT ALL ON tasks TO service_role;

-- 9. Verification query
SELECT policyname, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'tasks';
