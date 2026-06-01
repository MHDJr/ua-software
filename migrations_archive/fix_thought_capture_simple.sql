-- =====================================================
-- SIMPLE THOUGHT CAPTURE FIX
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- Step 1: Check if ideas table exists
SELECT '=== CHECKING IDEAS TABLE EXISTENCE ===' as info;
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'ideas'
) as table_exists;

-- Step 2: Drop ALL existing policies first (ignore if they don't exist)
DROP POLICY IF EXISTS "CEO can view all ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can create ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can update ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can delete ideas" ON ideas;
DROP POLICY IF EXISTS "Staff can create ideas" ON ideas;
DROP POLICY IF EXISTS "Staff can view own ideas" ON ideas;
DROP POLICY IF EXISTS "Users can view their own ideas" ON ideas;
DROP POLICY IF EXISTS "Users can create their own ideas" ON ideas;
DROP POLICY IF EXISTS "Users can insert own ideas" ON ideas;
DROP POLICY IF EXISTS "Users can update own ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can do everything with ideas" ON ideas;
DROP POLICY IF EXISTS "CEO full access to ideas" ON ideas;

SELECT '=== DROPPED ALL EXISTING POLICIES ===' as info;

-- Step 3: Enable RLS
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

-- Step 4: Create simple, working policies
-- CEO can do everything
CREATE POLICY "CEO full access to ideas"
  ON ideas FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Users can manage their own ideas
CREATE POLICY "Users can manage own ideas"
  ON ideas FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

SELECT '=== CREATED NEW POLICIES ===' as info;

-- Step 5: Grant permissions
GRANT ALL ON ideas TO authenticated;

-- Step 6: Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Step 7: Verify policies
SELECT '=== VERIFYING POLICIES ===' as info;
SELECT policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'ideas';

-- Step 8: Test current user
SELECT '=== TESTING USER ACCESS ===' as info;
SELECT id, email, role, full_name 
FROM profiles 
WHERE id = auth.uid();
