-- =====================================================
-- CLEANUP OLD IDEAS FROM REQUESTS TABLE
-- Run this to remove old ideas stuck in requests table
-- =====================================================

-- First, let's see what ideas are stuck in requests table
SELECT '=== OLD IDEAS IN REQUESTS TABLE ===' as info;
SELECT 
    id,
    type,
    title,
    description,
    submitted_by,
    created_at,
    status
FROM requests 
WHERE type = 'idea';

-- Now, let's move any old ideas to the proper ideas table before deleting them
-- This preserves the data while fixing the structure
INSERT INTO ideas (title, description, category, priority, status, created_by, created_at)
SELECT 
    r.title,
    r.description,
    'other' as category, -- Default category for old ideas
    'medium' as priority, -- Default priority for old ideas
    'active' as status, -- Default status for old ideas
    r.submitted_by,
    r.created_at
FROM requests r
WHERE r.type = 'idea' 
AND NOT EXISTS (
    SELECT 1 FROM ideas i WHERE i.created_by = r.submitted_by AND i.created_at = r.created_at
);

-- Now delete the old ideas from requests table
DELETE FROM requests WHERE type = 'idea';

-- Verify cleanup was successful
SELECT '=== CLEANUP VERIFICATION ===' as info;
SELECT 
    (SELECT COUNT(*) FROM requests WHERE type = 'idea') as ideas_remaining_in_requests,
    (SELECT COUNT(*) FROM ideas) as total_ideas_in_ideas_table;

-- Show the ideas that were moved
SELECT '=== IDEAS NOW IN PROPER TABLE ===' as info;
SELECT 
    id,
    title,
    description,
    category,
    priority,
    status,
    created_by,
    created_at
FROM ideas 
ORDER BY created_at DESC;

-- =====================================================
-- CLEANUP COMPLETE
-- =====================================================

-- After running this:
-- 1. Old ideas will be moved to the proper ideas table
-- 2. Requests table will be clean (no more ideas)
-- 3. New idea submissions should work properly
-- 4. CEO should be able to see ideas in spark inbox
