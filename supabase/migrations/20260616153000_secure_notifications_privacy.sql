-- Drop existing SELECT and DELETE policies on notifications to clean up access rights
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Notifications visible to owner" ON notifications;
DROP POLICY IF EXISTS "CEO can view all notifications" ON notifications;
DROP POLICY IF EXISTS "CEO can delete notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;

-- Create strict SELECT privacy policy: 
-- Allow a user to read a notification only if they are the recipient (user_id matches)
-- OR if they are the sender (the message starts with [sender_id:auth.uid()])
CREATE POLICY "Notifications select privacy" ON notifications
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR message LIKE '[sender_id:' || auth.uid()::text || ']%'
  );

-- Create strict DELETE privacy policy:
-- Allow a user to delete a notification only if they are the recipient (user_id matches)
-- OR if they are the sender (the message starts with [sender_id:auth.uid()])
CREATE POLICY "Notifications delete privacy" ON notifications
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id 
    OR message LIKE '[sender_id:' || auth.uid()::text || ']%'
  );
