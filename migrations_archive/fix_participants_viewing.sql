-- Simple fix: Just update the meeting_participants viewing policy
-- This avoids the "already exists" error for the CEO policy

-- Drop and recreate just the viewing policy
DROP POLICY IF EXISTS "Staff and CEO can view meeting participants" ON meeting_participants;
DROP POLICY IF EXISTS "Users can view meeting participants" ON meeting_participants;
DROP POLICY IF EXISTS "Users can view their own meeting participation" ON meeting_participants;

-- Create the viewing policy that allows staff to see all participants
CREATE POLICY "Staff and CEO can view meeting participants"
ON meeting_participants
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ceo', 'staff'))
    OR auth.uid() = user_id
);
