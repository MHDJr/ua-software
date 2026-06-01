-- =====================================================
-- SIMPLE SCHEMA CHECK FOR IDEAS TABLE
-- Run this first to see what actually exists
-- =====================================================

-- Check what columns exist in ideas table
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'ideas' 
ORDER BY ordinal_position;
