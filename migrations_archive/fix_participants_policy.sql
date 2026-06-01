-- Fix meeting_participants RLS policy to allow staff access
-- The issue is staff can't see meeting participants, so meetings show but no staff assignments

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view meeting participants" ON meeting_participants;
DROP POLICY IF EXISTS "Users can view their own meeting participation" ON meeting_participants;

-- Create new policy that allows staff to see all meeting participants
CREATE POLICY "Staff and CEO can view meeting participants"
ON meeting_participants
FOR SELECT
TO authenticated
USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ceo', 'staff'))
    OR auth.uid() = user_id
);

-- CEO can manage meeting participants
CREATE POLICY "CEO can manage meeting participants"
ON meeting_participants
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));
