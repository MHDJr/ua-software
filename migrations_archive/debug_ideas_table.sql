-- =====================================================
-- DEBUG IDEAS TABLE - RUN THIS FIRST IN SUPABASE SQL
-- =====================================================

-- 1. Check if ideas table exists
SELECT '=== CHECKING IF IDEAS TABLE EXISTS ===' as info;
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'ideas'
) as table_exists;

-- 2. Show current columns in ideas table
SELECT '=== CURRENT COLUMNS IN IDEAS TABLE ===' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ideas' 
ORDER BY ordinal_position;

-- 3. Check RLS policies
SELECT '=== RLS POLICIES ON IDEAS TABLE ===' as info;
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'ideas';

-- 4. Try a simple test insert (replace YOUR_USER_ID with actual UUID)
-- First, let's get a user ID to test with
SELECT '=== SAMPLE USER IDs FOR TESTING ===' as info;
SELECT id, email, role FROM profiles WHERE role = 'ceo' LIMIT 3;

-- After running this, copy one of the user IDs and run the test insert below:
/*
-- TEST INSERT (replace with actual user ID from above)
-- First check what columns exist, then use only existing ones
INSERT INTO ideas (
    title, 
    priority, 
    status, 
    created_by
) VALUES (
    'Test Thought Capture',
    'medium',
    'reminder',
    'YOUR_USER_ID_HERE'
);
*/

-- 5. Check if insert worked (only select existing columns)
SELECT '=== RECENT IDEAS (AFTER TEST INSERT) ===' as info;
SELECT id, title, status, created_at 
FROM ideas 
ORDER BY created_at DESC 
LIMIT 5;

-- =====================================================
-- INSTRUCTIONS:
-- 1. Run this entire script in Supabase SQL Editor
-- 2. Note what columns exist
-- 3. Copy a user ID from the "SAMPLE USER IDs" section
-- 4. Uncomment and run the TEST INSERT with that user ID
-- 5. Check if the test insert worked
-- 6. Report back the results
-- =====================================================
