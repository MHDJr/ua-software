-- =====================================================
-- IMMEDIATE FIX FOR THOUGHT CAPTURE
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- Step 1: Check if you're a CEO user
SELECT '=== CHECKING YOUR ROLE ===' as info;
SELECT id, email, role, full_name 
FROM profiles 
WHERE role = 'ceo';

-- Step 2: Drop all existing policies (clean slate)
DROP POLICY IF EXISTS "CEO can view all ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can create ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can update ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can delete ideas" ON ideas;
DROP POLICY IF EXISTS "Staff can create ideas" ON ideas;
DROP POLICY IF EXISTS "Staff can view own ideas" ON ideas;
DROP POLICY IF EXISTS "Users can view their own ideas" ON ideas;
DROP POLICY IF EXISTS "Users can create their own ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can do everything with ideas" ON ideas;

-- Step 3: Enable RLS
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

-- Step 4: Create simple CEO policy that allows everything
CREATE POLICY "CEO full access to ideas"
  ON ideas FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Step 5: Create basic policies for other users
CREATE POLICY "Users can view own ideas"
  ON ideas FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can insert own ideas"
  ON ideas FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Step 6: Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Step 7: Verify the fix
SELECT '=== POLICIES AFTER FIX ===' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE tablename = 'ideas';

-- Step 8: Test with your user ID (replace with your actual ID from step 1)
/*
-- Test insert
INSERT INTO ideas (
    title, 
    priority, 
    status, 
    created_by
) VALUES (
    'Test Idea After Fix',
    'medium',
    'reminder',
    'YOUR_USER_ID_HERE'
) 
RETURNING id, title, created_at;
*/

-- =====================================================
-- AFTER RUNNING THIS:
-- 1. Copy your user ID from step 1
-- 2. Try capturing a thought in the app
-- 3. If it still fails, check the browser console for detailed error info
-- =====================================================
