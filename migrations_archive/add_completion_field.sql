-- =====================================================
-- ADD COMPLETION FIELD TO IDEAS TABLE
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add completed field to ideas table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'ideas' AND column_name = 'completed'
    ) THEN
        ALTER TABLE ideas ADD COLUMN completed BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added completed column to ideas table';
    ELSE
        RAISE NOTICE 'Completed column already exists in ideas table';
    END IF;
END $$;

-- Update the table structure
SELECT '=== COMPLETION FIELD ADDED ===' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ideas' AND column_name = 'completed';
