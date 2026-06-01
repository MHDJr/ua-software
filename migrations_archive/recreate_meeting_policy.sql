-- Simple fix: Drop and recreate the meetings viewing policy
-- This resolves the "already exists" error

-- Drop the existing policy
DROP POLICY IF EXISTS "Staff and CEO can view all meetings" ON meetings;

-- Recreate the policy with correct permissions
CREATE POLICY "Staff and CEO can view all meetings"
ON meetings
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ceo', 'staff'))
);
