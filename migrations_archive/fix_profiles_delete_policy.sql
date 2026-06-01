-- =====================================================
-- FIX PROFILES DELETE POLICY
-- =====================================================
-- This script adds the missing DELETE policy for the profiles table
-- to allow CEO to delete staff members

-- Add DELETE policy for CEO to delete profiles
CREATE POLICY "CEO can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this to verify the policy was created:
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'DELETE';

-- =====================================================
-- ALTERNATIVE: More restrictive policy (optional)
-- =====================================================
-- If you want to prevent CEO from deleting themselves:
/*
DROP POLICY IF EXISTS "CEO can delete profiles" ON profiles;

CREATE POLICY "CEO can delete other profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo') 
    AND auth.uid() != id
  );
*/
