-- Update RLS policies for tasks table to allow Managers to assign tasks

-- 1. Drop existing policies to recreate them with proper permissions
DROP POLICY IF EXISTS "CEO can create tasks" ON tasks;
DROP POLICY IF EXISTS "CEO and assigned users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view assigned tasks" ON tasks;

-- 2. Create "Users can view tasks" policy
-- Managers should be able to see all tasks (or at least those in their department, but let's start with all for now like CEO)
-- Staff can only see tasks assigned to them or created by them.
CREATE POLICY "Users can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    auth.uid() = assigned_to OR 
    auth.uid() = created_by OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true))
  );

-- 3. Create "Authorized users can create tasks" policy
-- Allow CEO and Managers to create tasks
CREATE POLICY "Authorized users can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true))
  );

-- 4. Create "Authorized users can update tasks" policy
-- Allow CEO, Managers, and assigned users to update tasks
CREATE POLICY "Authorized users can update tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = assigned_to OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true))
  )
  WITH CHECK (
    auth.uid() = assigned_to OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true))
  );

-- 5. Create "Authorized users can delete tasks" policy
-- Allow CEO and Managers to delete tasks
CREATE POLICY "Authorized users can delete tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true))
  );
