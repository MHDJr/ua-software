-- =====================================================
-- FIX MONTHLY TARGETS TABLE PERMISSIONS
-- Run this script in Supabase SQL Editor if target setting fails
-- =====================================================

-- Step 1: Check if table exists
SELECT '=== CHECKING TABLE EXISTENCE ===' as info;
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_name = 'monthly_targets';

-- Step 2: Check current policies
SELECT '=== CHECKING CURRENT POLICIES ===' as info;
SELECT policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'monthly_targets';

-- Step 3: Drop all existing policies (clean slate)
DROP POLICY IF EXISTS "Users can view own monthly targets" ON monthly_targets;
DROP POLICY IF EXISTS "Users can insert own monthly targets" ON monthly_targets;
DROP POLICY IF EXISTS "Users can update own monthly targets" ON monthly_targets;
DROP POLICY IF EXISTS "CEOs can view all monthly targets" ON monthly_targets;

-- Step 4: Enable RLS if not already enabled
ALTER TABLE monthly_targets ENABLE ROW LEVEL SECURITY;

-- Step 5: Create simplified policies that work
CREATE POLICY "Users can manage own monthly targets" 
ON monthly_targets FOR ALL 
TO authenticated 
USING (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'))
WITH CHECK (profile_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Step 6: Grant permissions
GRANT ALL ON monthly_targets TO authenticated;

-- Step 7: Test the policies by checking current user
SELECT '=== TESTING USER ACCESS ===' as info;
SELECT id, email, role, full_name 
FROM profiles 
WHERE id = auth.uid();

-- Step 8: Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Step 9: Verify table structure
SELECT '=== VERIFYING TABLE STRUCTURE ===' as info;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'monthly_targets' 
ORDER BY ordinal_position;
