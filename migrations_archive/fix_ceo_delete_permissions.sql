-- =====================================================
-- FIX CEO DELETE PERMISSIONS FOR IDEAS
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Drop and recreate CEO delete policy to ensure it works properly
DROP POLICY IF EXISTS "CEO can delete ideas" ON ideas;
CREATE POLICY "CEO can delete ideas"
  ON ideas FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Also ensure CEO can update ideas (for any future features)
DROP POLICY IF EXISTS "CEO can update ideas" ON ideas;
CREATE POLICY "CEO can update ideas"
  ON ideas FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Verify policies are in place
SELECT policyname, cmd, roles 
FROM pg_policies 
WHERE tablename = 'ideas' AND cmd IN ('DELETE', 'UPDATE');

-- =====================================================
-- TEST CEO DELETE PERMISSIONS
-- =====================================================

-- Test if current user can delete (run while logged in as CEO)
-- This should return the count of ideas the CEO can delete
-- SELECT COUNT(*) as deletable_ideas FROM ideas;

-- =====================================================
-- END OF FIX
-- =====================================================
