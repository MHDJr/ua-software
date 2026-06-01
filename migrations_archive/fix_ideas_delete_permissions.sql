-- ============================================
-- FIX IDEAS DELETE PERMISSIONS
-- ============================================

-- 1. Check current RLS policies for ideas table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'ideas';

-- 2. Add DELETE policy for CEOs if it doesn't exist
DROP POLICY IF EXISTS "CEOs can delete ideas" ON ideas;
CREATE POLICY "CEOs can delete ideas" ON ideas FOR DELETE
USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ceo')
);

-- 3. Ensure CEOs can also update ideas (for completeness)
DROP POLICY IF EXISTS "CEOs can update ideas" ON ideas;
CREATE POLICY "CEOs can update ideas" ON ideas FOR UPDATE
USING (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ceo')
)
WITH CHECK (
    auth.uid() IN (SELECT id FROM profiles WHERE role = 'ceo')
);

-- 4. Verify all policies are in place
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'ideas'
ORDER BY cmd, policyname;

-- 5. Test query to verify a user's permissions (replace with actual user ID)
-- SELECT * FROM ideas WHERE created_by = 'your-user-id-here';

-- 6. Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'ideas';
