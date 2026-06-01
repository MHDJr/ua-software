-- =====================================================
-- COMPREHENSIVE DELETION DEBUG SCRIPT
-- =====================================================
-- Run this in Supabase SQL Editor to debug deletion issues

-- 1. Check current user and role
SELECT 
  auth.uid() as current_user_id,
  p.role as current_user_role,
  p.full_name as current_user_name
FROM profiles p 
WHERE p.id = auth.uid();

-- 2. Check if DELETE policy exists
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
WHERE tablename = 'profiles' AND cmd = 'DELETE';

-- 3. List all profiles to verify staff exists
SELECT 
  id,
  full_name,
  role,
  email,
  status,
  created_at
FROM profiles 
ORDER BY created_at DESC;

-- 4. Check for foreign key constraints that might prevent deletion
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'profiles';

-- 5. Test manual deletion (replace with actual staff ID you want to delete)
-- Uncomment and replace 'STAFF_ID_HERE' with actual staff UUID
/*
DELETE FROM profiles 
WHERE id = 'STAFF_ID_HERE' 
AND EXISTS (
  SELECT 1 FROM profiles 
  WHERE id = auth.uid() AND role = 'ceo'
);
*/

-- 6. Check tasks assigned to staff (might cause FK issues)
SELECT 
  t.id,
  t.title,
  t.assigned_to,
  p.full_name as assigned_to_name,
  t.status
FROM tasks t
LEFT JOIN profiles p ON t.assigned_to = p.id
WHERE t.assigned_to IS NOT NULL
ORDER BY t.created_at DESC;

-- 7. Check requests submitted by staff
SELECT 
  r.id,
  r.type,
  r.submitted_by,
  p.full_name as submitted_by_name,
  r.status
FROM requests r
LEFT JOIN profiles p ON r.submitted_by = p.id
WHERE r.submitted_by IS NOT NULL
ORDER BY r.created_at DESC;

-- 8. Verify RLS is enabled on profiles table
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'profiles';
