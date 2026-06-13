-- =====================================================
-- MIGRATION: ADD V2 READ RECEIPT COLUMNS & RLS POLICIES
-- =====================================================

-- 1. Add delivery_status and read_at columns if not present
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- 2. Add CHECK constraint safely to ensure valid states
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tasks_delivery_status_check'
    ) THEN
        ALTER TABLE tasks ADD CONSTRAINT tasks_delivery_status_check 
        CHECK (delivery_status IN ('sent', 'delivered', 'read'));
    END IF;
END $$;

-- 3. Backfill existing tasks with 'sent' if status is NULL
UPDATE tasks SET delivery_status = 'sent' WHERE delivery_status IS NULL;

-- 4. Recreate task update RLS policy to ensure staff can write read receipts
DROP POLICY IF EXISTS "Authorized users can update tasks" ON tasks;
DROP POLICY IF EXISTS "CEO and assigned users can update tasks" ON tasks;

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

-- 5. Force reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- 6. Re-establish / define reload_schema RPC function
CREATE OR REPLACE FUNCTION public.reload_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    NOTIFY pgrst, 'reload schema';
END;
$$;
