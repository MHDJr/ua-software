-- =====================================================
-- TEST IDEAS TABLE PERMISSIONS AND RLS POLICIES
-- Run this in your Supabase SQL Editor to debug issues
-- =====================================================

-- 1. Check if the ideas table exists and has the right structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ideas' 
ORDER BY ordinal_position;

-- 2. Check existing ideas in the table
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

-- 3. Check RLS policies on ideas table
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

-- 4. Test if CEO can access ideas (replace with actual CEO user ID)
-- SELECT COUNT(*) FROM ideas WHERE status = 'active';

-- 5. Check if there are any ideas submitted by staff
-- SELECT 
--     i.*,
--     p.full_name,
--     p.role,
--     p.email
-- FROM ideas i
-- LEFT JOIN profiles p ON i.created_by = p.id
-- ORDER BY i.created_at DESC;

-- 6. Manually insert a test idea to verify table works
-- INSERT INTO ideas (title, description, category, priority, status, created_by)
-- VALUES (
--     'Test Idea from SQL', 
--     'This is a test idea to verify the table is working', 
--     'other', 
--     'medium', 
--     'active', 
--     (SELECT id FROM profiles WHERE role = 'ceo' LIMIT 1)
-- );

-- =====================================================
-- DEBUGGING NOTES
-- =====================================================

-- If you see no ideas in step 2, then no ideas are being submitted successfully
-- If step 3 shows no policies, then RLS policies need to be applied
-- If step 4 returns 0 for CEO, then CEO RLS policy isn't working
-- If step 5 shows no staff ideas, then staff can't submit ideas

-- =====================================================
-- END OF DEBUG SCRIPT
-- =====================================================
