-- Allow CEO/Managers to delete broadcasts
DROP POLICY IF EXISTS "CEO can delete broadcasts" ON broadcasts;
CREATE POLICY "CEO can delete broadcasts"
  ON broadcasts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true)
    )
  );

-- Allow CEO/Managers to view all broadcasts (active or expired)
DROP POLICY IF EXISTS "CEO can view all broadcasts" ON broadcasts;
CREATE POLICY "CEO can view all broadcasts"
  ON broadcasts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true)
    )
  );
