-- =====================================================
-- MANUAL IDEA TEST - BYPASS FRONTEND
-- Run this to test if the basic flow works
-- =====================================================

-- First, check if we have users to work with
SELECT 'Available users for testing:' as info;
SELECT id, email, full_name, role FROM profiles WHERE role IN ('staff', 'ceo') LIMIT 5;

-- Insert a test idea manually (replace staff_user_id with actual ID from above)
-- Uncomment and run this line:
-- INSERT INTO ideas (title, description, category, priority, status, created_by)
-- VALUES (
--     'Manual Test Idea ' || now(),
--     'This idea was created manually to test the system at ' || now(),
--     'other',
--     'medium', 
--     'active',
--     'staff_user_id_here' -- Replace with actual staff user ID
-- );

-- Check if the idea was inserted
SELECT 'Ideas after manual insertion:' as info;
SELECT 
    i.id,
    i.title,
    i.description,
    i.created_by,
    p.full_name as creator_name,
    p.role as creator_role,
    i.created_at
FROM ideas i
LEFT JOIN profiles p ON i.created_by = p.id
ORDER BY i.created_at DESC;

-- If you can see the manual idea here, then:
-- 1. The table structure is correct
-- 2. RLS policies allow insertion
-- 3. The issue is likely in the frontend submission process

-- If you can't see the manual idea, then:
-- 1. RLS policies are blocking insertion
-- 2. Schema issues still exist
-- 3. User permissions are incorrect
