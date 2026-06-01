-- =====================================================
-- COMPREHENSIVE DEBUG FOR THOUGHT CAPTURE
-- Run this step by step in Supabase SQL Editor
-- =====================================================

-- STEP 1: Check your user profile and role
SELECT '=== YOUR USER PROFILE ===' as info;
SELECT id, email, role, full_name, created_at 
FROM profiles 
WHERE email = 'your-email@example.com' -- Replace with your actual email
ORDER BY created_at DESC;

-- If you don't know your email, get all CEO users
SELECT '=== ALL CEO USERS ===' as info;
SELECT id, email, role, full_name 
FROM profiles 
WHERE role = 'ceo';

-- STEP 2: Check if ideas table exists and its structure
SELECT '=== IDEAS TABLE STRUCTURE ===' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ideas' 
ORDER BY ordinal_position;

-- STEP 3: Check current RLS policies
SELECT '=== CURRENT RLS POLICIES ===' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'ideas';

-- STEP 4: Check if RLS is enabled
SELECT '=== RLS STATUS ===' as info;
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'ideas';

-- STEP 5: Test basic permissions with your user ID
-- Replace 'YOUR_USER_ID_HERE' with your actual UUID from step 1

/*
-- Test SELECT permission
SELECT '=== TEST SELECT PERMISSIONS ===' as info;
SELECT COUNT(*) as idea_count 
FROM ideas 
WHERE created_by = 'YOUR_USER_ID_HERE';

-- Test INSERT permission
SELECT '=== TEST INSERT PERMISSIONS ===' as info;
INSERT INTO ideas (
    title, 
    priority, 
    status, 
    created_by
) VALUES (
    'Debug Test Idea',
    'medium',
    'reminder',
    'YOUR_USER_ID_HERE'
) 
RETURNING id, title, created_at;
*/

-- STEP 6: If insert fails, apply quick fix
/*
-- QUICK FIX - Drop all policies and create simple CEO policy
DROP POLICY IF EXISTS "CEO can view all ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can create ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can update ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can delete ideas" ON ideas;
DROP POLICY IF EXISTS "Staff can create ideas" ON ideas;
DROP POLICY IF EXISTS "Staff can view own ideas" ON ideas;
DROP POLICY IF EXISTS "Users can view their own ideas" ON ideas;
DROP POLICY IF EXISTS "Users can create their own ideas" ON ideas;

-- Enable RLS
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

-- Create simple CEO policy
CREATE POLICY "CEO can do everything with ideas"
  ON ideas FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Refresh schema
NOTIFY pgrst, 'reload schema';

-- Verify policy created
SELECT '=== POLICY AFTER FIX ===' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'ideas';
*/

-- STEP 7: Test again after fix
/*
SELECT '=== TEST INSERT AFTER FIX ===' as info;
INSERT INTO ideas (
    title, 
    priority, 
    status, 
    created_by
) VALUES (
    'Post-Fix Test Idea',
    'medium',
    'reminder',
    'YOUR_USER_ID_HERE'
) 
RETURNING id, title, created_at;
*/

-- =====================================================
-- INSTRUCTIONS:
-- 1. Run steps 1-4 to understand current state
-- 2. Copy your user ID from step 1
-- 3. Uncomment and run step 5 with your user ID
-- 4. If step 5 fails, uncomment and run step 6 (the fix)
-- 5. Run step 7 to verify the fix worked
-- 6. Try capturing a thought in the app
-- =====================================================
