-- =====================================================
-- DEBUG IDEAS FLOW - CHECK IF EVERYTHING IS WORKING
-- Run this in your Supabase SQL Editor step by step
-- =====================================================

-- STEP 1: Check if ideas table exists and has correct structure
SELECT '=== IDEAS TABLE STRUCTURE ===' as debug_step;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ideas' 
ORDER BY ordinal_position;

-- STEP 2: Check if there are any ideas in the table
SELECT '=== EXISTING IDEAS ===' as debug_step;
SELECT 
    id,
    title,
    description,
    category,
    priority,
    status,
    created_by,
    created_at,
    updated_at
FROM ideas 
ORDER BY created_at DESC;

-- STEP 3: Check RLS policies on ideas table
SELECT '=== RLS POLICIES ===' as debug_step;
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
WHERE tablename = 'ideas';

-- STEP 4: Check if there are any ideas in requests table (should be none)
SELECT '=== IDEAS IN REQUESTS TABLE (SHOULD BE EMPTY) ===' as debug_step;
SELECT id, type, title, description, created_at 
FROM requests 
WHERE type = 'idea' 
ORDER BY created_at DESC;

-- STEP 5: Test inserting a sample idea (this will test if permissions work)
SELECT '=== TESTING IDEA INSERT ===' as debug_step;
-- Uncomment and run this to test if you can insert an idea:
-- INSERT INTO ideas (title, description, category, priority, status, created_by)
-- VALUES (
--     'Test Idea from Debug Script', 
--     'This is a test idea to verify everything is working', 
--     'other', 
--     'medium', 
--     'active', 
--     (SELECT id FROM profiles WHERE role = 'staff' LIMIT 1)
-- );

-- STEP 6: Check if CEO can see ideas (replace with actual CEO user ID if needed)
SELECT '=== CEO VISIBILITY TEST ===' as debug_step;
-- This should return all active ideas if CEO RLS policy works
-- SELECT COUNT(*) as ceo_visible_ideas FROM ideas WHERE status = 'active';

-- =====================================================
-- WHAT TO LOOK FOR:
-- =====================================================

-- 1. If STEP 1 shows missing columns -> run fix_ideas_table_schema.sql
-- 2. If STEP 2 shows no ideas -> ideas aren't being submitted successfully
-- 3. If STEP 3 shows no policies -> run fix_ideas_rls_policies.sql  
-- 4. If STEP 4 shows ideas -> old ideas in requests table need cleaning
-- 5. If STEP 5 fails -> permissions issue, run RLS policies
-- 6. If STEP 6 returns 0 -> CEO can't see ideas, RLS issue

-- =====================================================
-- END OF DEBUG SCRIPT
-- =====================================================
