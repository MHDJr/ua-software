-- Quick fix: Just update the main meetings viewing policy to allow staff access
-- This is a simpler approach if you don't want to drop all policies

-- Drop only the restrictive viewing policy
DROP POLICY IF EXISTS "Users can view relevant meetings" ON meetings;

-- Create a new policy that allows staff to see all meetings
CREATE POLICY "Staff and CEO can view all meetings"
ON meetings
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ceo', 'staff'))
);

-- Also update meeting_participants policy if needed
DROP POLICY IF EXISTS "Users can view their own meeting participation" ON meeting_participants;

CREATE POLICY "Users can view meeting participants"
ON meeting_participants
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ceo', 'staff')));
