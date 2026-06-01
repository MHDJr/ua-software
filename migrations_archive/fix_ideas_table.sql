-- ============================================
-- SQL QUERIES TO FIX IDEAS TABLE ISSUES
-- ============================================

-- 1. Add reactions field if it doesn't exist (for staff acknowledgments)
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS reactions UUID[] DEFAULT '{}';

-- 2. Ensure all required fields exist with proper defaults
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium';
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS signal_cleared BOOLEAN DEFAULT FALSE;

-- 3. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ideas_reactions ON ideas USING GIN(reactions);
CREATE INDEX IF NOT EXISTS idx_ideas_priority ON ideas(priority);
CREATE INDEX IF NOT EXISTS idx_ideas_created_at ON ideas(created_at);

-- 4. Update any existing records that might have NULL values for required fields
UPDATE ideas SET priority = 'medium' WHERE priority IS NULL;
UPDATE ideas SET signal_cleared = FALSE WHERE signal_cleared IS NULL;
UPDATE ideas SET reactions = '{}' WHERE reactions IS NULL;

-- 5. Verify the table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ideas' 
ORDER BY ordinal_position;

-- 6. Test insert (you can run this to verify the table works)
-- INSERT INTO ideas (title, content, priority, created_by, shared_with, archived, signal_cleared, reactions)
-- VALUES ('Test Idea', 'This is a test idea', 'medium', 'your-user-id-here', ARRAY['staff-id-here'], false, false, ARRAY[]);

-- 7. Check RLS policies are working correctly
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'ideas';
