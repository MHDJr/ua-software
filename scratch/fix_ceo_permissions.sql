-- =====================================================
-- FIX CEO DIRECTORY PERMISSIONS & RLS RECURSION
-- =====================================================

-- 1. Create helper functions under SECURITY DEFINER to query profiles without infinite RLS recursion
CREATE OR REPLACE FUNCTION is_ceo()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'ceo'
  );
END;
$$;

CREATE OR REPLACE FUNCTION is_manager()
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND (is_manager = true OR role = 'manager')
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION is_ceo() TO authenticated;
GRANT EXECUTE ON FUNCTION is_manager() TO authenticated;

-- =====================================================
-- RE-ESTABLISH PROFILES UPDATE POLICIES FOR CEO
-- =====================================================

-- Drop existing update policies on profiles
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles are updateable by owners" ON profiles;
DROP POLICY IF EXISTS "CEO can update profiles" ON profiles;

-- Policy A: Standard users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy B: CEO can update any profile (vital for username and department edits!)
CREATE POLICY "CEO can update profiles" ON profiles
  FOR UPDATE
  TO authenticated
  USING (is_ceo())
  WITH CHECK (is_ceo());

-- =====================================================
-- RE-ESTABLISH PROFILES DELETE POLICIES FOR CEO
-- =====================================================

-- Drop existing delete policies
DROP POLICY IF EXISTS "CEO can delete staff" ON profiles;
DROP POLICY IF EXISTS "CEO can delete profiles" ON profiles;
DROP POLICY IF EXISTS "CEO can delete profiles with cascade" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;

-- Policy A: CEO can delete any profile
CREATE POLICY "CEO can delete profiles" ON profiles
  FOR DELETE
  TO authenticated
  USING (is_ceo());

-- Policy B: Standard users can delete their own profile (if applicable)
CREATE POLICY "Users can delete own profile" ON profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = id);
