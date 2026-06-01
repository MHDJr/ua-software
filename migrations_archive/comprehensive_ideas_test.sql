-- =====================================================
-- COMPREHENSIVE IDEAS FLOW TEST
-- Run this step by step to identify the exact issue
-- =====================================================

-- STEP 1: Verify table structure
SELECT '=== STEP 1: TABLE STRUCTURE ===' as test_step;
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ideas' 
ORDER BY ordinal_position;

-- STEP 2: Check if RLS is enabled and policies exist
SELECT '=== STEP 2: RLS STATUS ===' as test_step;
SELECT 
    tablename, 
    rowsecurity
FROM pg_tables 
WHERE tablename = 'ideas';

SELECT '=== RLS POLICIES ===' as info;
SELECT 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'ideas';

-- STEP 3: Check current users and their roles
SELECT '=== STEP 3: USER ROLES ===' as test_step;
SELECT 
    id, 
    email, 
    full_name, 
    role,
    created_at
FROM profiles 
WHERE role IN ('ceo', 'staff', 'tutor', 'manager')
ORDER BY role, created_at;

-- STEP 4: Check existing ideas
SELECT '=== STEP 4: EXISTING IDEAS ===' as test_step;
SELECT 
    i.id,
    i.title,
    i.description,
    i.category,
    i.priority,
    i.status,
    i.created_by,
    p.full_name as creator_name,
    p.role as creator_role,
    i.created_at
FROM ideas i
LEFT JOIN profiles p ON i.created_by = p.id
ORDER BY i.created_at DESC;

-- STEP 5: Test manual idea insertion (this tests permissions)
SELECT '=== STEP 5: TESTING IDEA INSERTION ===' as test_step;
-- First try to insert with a staff user (you'll need to replace with actual user IDs)
-- This tests if staff can create ideas

-- Get a staff user ID for testing
WITH staff_user AS (
    SELECT id, full_name FROM profiles WHERE role = 'staff' LIMIT 1
),
ceo_user AS (
    SELECT id, full_name FROM profiles WHERE role = 'ceo' LIMIT 1
)
SELECT 
    'Staff user for testing:' as info,
    (SELECT id || ' - ' || full_name FROM staff_user) as staff_details,
    'CEO user for testing:' as info,
    (SELECT id || ' - ' || full_name FROM ceo_user) as ceo_details;

-- STEP 6: Test CEO visibility (run this while logged in as CEO)
SELECT '=== STEP 6: CEO VISIBILITY TEST ===' as test_step;
-- This should return all active ideas if CEO can see them
SELECT 
    COUNT(*) as total_active_ideas,
    COUNT(CASE WHEN status = 'active' THEN 1 END) as active_ideas
FROM ideas;

-- STEP 7: Check for any ideas in requests table (should be empty)
SELECT '=== STEP 7: OLD IDEAS IN REQUESTS TABLE ===' as test_step;
SELECT 
    COUNT(*) as old_ideas_in_requests,
    STRING_AGG(title, ', ' ORDER BY created_at DESC) as idea_titles
FROM requests 
WHERE type = 'idea';

-- =====================================================
-- MANUAL TEST INSTRUCTIONS:
-- =====================================================

-- 1. If STEP 1 shows missing columns -> schema issue, run fix_ideas_table_schema.sql
-- 2. If STEP 2 shows no RLS policies -> run fix_ideas_rls_policies.sql
-- 3. If STEP 3 shows no CEO user -> create CEO user first
-- 4. If STEP 4 shows no ideas -> submissions failing, check staff submission
-- 5. If STEP 5 shows no staff users -> create staff user for testing
-- 6. If STEP 6 returns 0 -> CEO can't see ideas, RLS issue
-- 7. If STEP 7 shows ideas -> old data cleanup needed

-- =====================================================
-- QUICK FIXES:
-- =====================================================

-- If you need to create a test idea manually:
-- INSERT INTO ideas (title, description, category, priority, status, created_by)
-- VALUES (
--     'Test Idea ' || now(),
--     'This is a test idea created at ' || now(),
--     'other',
--     'medium',
--     'active',
--     (SELECT id FROM profiles WHERE role = 'staff' LIMIT 1)
-- );

-- =====================================================
-- END OF COMPREHENSIVE TEST
-- =====================================================
