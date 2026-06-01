-- =====================================================
-- COMPLETE DELETION FIX
-- =====================================================
-- This script handles all constraints and ensures proper deletion

-- 1. First, ensure DELETE policy exists (run if not already done)
DROP POLICY IF EXISTS "CEO can delete profiles" ON profiles;
CREATE POLICY "CEO can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- 2. Handle foreign key constraints by cascading deletions
-- Update tasks to remove references before deleting profile
CREATE OR REPLACE FUNCTION delete_profile_cascade(profile_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Update tasks to remove assignment
    UPDATE tasks 
    SET assigned_to = NULL 
    WHERE assigned_to = profile_uuid;
    
    -- Update requests to remove references
    UPDATE requests 
    SET submitted_by = NULL 
    WHERE submitted_by = profile_uuid;
    
    -- Update knocks to remove references
    UPDATE knocks 
    SET knocked_by = NULL 
    WHERE knocked_by = profile_uuid;
    
    -- Update attendance to remove references
    UPDATE attendance 
    SET user_id = NULL 
    WHERE user_id = profile_uuid;
    
    -- Update activity_feed to remove references
    UPDATE activity_feed 
    SET user_id = NULL 
    WHERE user_id = profile_uuid;
    
    -- Now delete the profile
    DELETE FROM profiles 
    WHERE id = profile_uuid;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Grant execute permission
GRANT EXECUTE ON FUNCTION delete_profile_cascade(UUID) TO authenticated;

-- 4. Create a policy that uses the function
DROP POLICY IF EXISTS "CEO can delete profiles with cascade" ON profiles;
CREATE POLICY "CEO can delete profiles with cascade"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo')
    AND delete_profile_cascade(id)
  );

-- =====================================================
-- TEST THE DELETION
-- =====================================================
-- Replace with actual staff UUID you want to delete
/*
SELECT delete_profile_cascade('STAFF_UUID_HERE');
*/

-- =====================================================
-- VERIFICATION
-- =====================================================
-- Check if function and policies exist
SELECT 
  proname as function_name,
  prosrc as function_definition
FROM pg_proc 
WHERE proname = 'delete_profile_cascade';

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'profiles' AND cmd = 'DELETE';
