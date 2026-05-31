-- Allow CEO to SELECT all notifications (to see sent messages)
DROP POLICY IF EXISTS "CEO can view all notifications" ON notifications;
CREATE POLICY "CEO can view all notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true)));

-- Allow CEO to DELETE notifications (to delete sent messages)
DROP POLICY IF EXISTS "CEO can delete notifications" ON notifications;
CREATE POLICY "CEO can delete notifications"
  ON notifications FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true)));
