-- =====================================================
-- FIX CEO IDEAS PERMISSIONS - IMMEDIATE FIX
-- Run this in your Supabase SQL Editor
-- =====================================================

-- First, let's see what policies currently exist
SELECT '=== CURRENT RLS POLICIES ===' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'ideas';

-- Check if RLS is enabled
SELECT '=== RLS STATUS ===' as info;
SELECT relname, relrowsecurity 
FROM pg_class 
WHERE relname = 'ideas';

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "CEO can view all ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can create ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can update ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can delete ideas" ON ideas;
DROP POLICY IF EXISTS "Staff can create ideas" ON ideas;
DROP POLICY IF EXISTS "Staff can view own ideas" ON ideas;

-- Enable RLS if not enabled
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

-- Create comprehensive CEO policies
CREATE POLICY "CEO can do everything with ideas"
  ON ideas FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Create policies for other roles (staff, managers)
CREATE POLICY "Users can view their own ideas"
  ON ideas FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can create their own ideas"
  ON ideas FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('staff', 'manager', 'tutor')
  ));

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Verify policies are set correctly
SELECT '=== UPDATED RLS POLICIES ===' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'ideas';

-- =====================================================
-- TEST THE FIX
-- =====================================================

-- Get your user ID first
SELECT '=== YOUR USER INFO ===' as info;
SELECT id, email, role FROM profiles WHERE email = 'your-email@example.com';

-- Test insert (replace with your actual user ID)
/*
INSERT INTO ideas (
    title, 
    priority, 
    status, 
    created_by
) VALUES (
    'Test CEO Idea',
    'medium',
    'reminder',
    'YOUR_ACTUAL_USER_ID_HERE'
);
*/

-- Check if it worked
SELECT '=== RECENT IDEAS ===' as info;
SELECT id, title, status, created_at, created_by 
FROM ideas 
ORDER BY created_at DESC 
LIMIT 3;

-- =====================================================
-- END OF FIX
-- =====================================================
