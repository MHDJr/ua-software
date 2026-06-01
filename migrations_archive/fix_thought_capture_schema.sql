-- =====================================================
-- FIX THOUGHT CAPTURE SCHEMA FOR IDEAS TABLE
-- Run this in your Supabase SQL Editor
-- =====================================================

-- First, let's see what columns currently exist
SELECT '=== CURRENT IDEAS TABLE SCHEMA ===' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ideas' 
ORDER BY ordinal_position;

-- Add missing columns for thought capture system
DO $$
BEGIN
    -- Add content column (rename from description or add new)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ideas' AND column_name = 'content'
    ) THEN
        -- If content doesn't exist but description does, rename it
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'ideas' AND column_name = 'description'
        ) THEN
            ALTER TABLE ideas RENAME COLUMN description TO content;
            RAISE NOTICE 'Renamed description to content';
        ELSE
            ALTER TABLE ideas ADD COLUMN content TEXT NOT NULL;
            RAISE NOTICE 'Added content column';
        END IF;
    END IF;

    -- Add tags column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ideas' AND column_name = 'tags'
    ) THEN
        ALTER TABLE ideas ADD COLUMN tags TEXT[] DEFAULT '{}';
        RAISE NOTICE 'Added tags column';
    END IF;

    -- Add follow_up_date column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ideas' AND column_name = 'follow_up_date'
    ) THEN
        ALTER TABLE ideas ADD COLUMN follow_up_date DATE;
        RAISE NOTICE 'Added follow_up_date column';
    END IF;

    -- Add auto_tagged column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ideas' AND column_name = 'auto_tagged'
    ) THEN
        ALTER TABLE ideas ADD COLUMN auto_tagged BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added auto_tagged column';
    END IF;

    -- Add shared_with column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ideas' AND column_name = 'shared_with'
    ) THEN
        ALTER TABLE ideas ADD COLUMN shared_with UUID[] DEFAULT '{}';
        RAISE NOTICE 'Added shared_with column';
    END IF;

    -- Add archived column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ideas' AND column_name = 'archived'
    ) THEN
        ALTER TABLE ideas ADD COLUMN archived BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added archived column';
    END IF;

    -- Add signal_cleared column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ideas' AND column_name = 'signal_cleared'
    ) THEN
        ALTER TABLE ideas ADD COLUMN signal_cleared BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added signal_cleared column';
    END IF;

    -- Update status column to support new values
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'ideas' AND column_name = 'status'
    ) THEN
        -- Check if status column needs to be updated to support new values
        -- The thought capture uses: 'reminder', 'directive', 'high_priority'
        RAISE NOTICE 'Status column exists - should support reminder, directive, high_priority values';
    END IF;
END $$;

-- Update status column default and type if needed
ALTER TABLE ideas ALTER COLUMN status SET DEFAULT 'reminder';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- VERIFY THE UPDATED SCHEMA
-- =====================================================
SELECT '=== UPDATED IDEAS TABLE SCHEMA ===' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ideas' 
ORDER BY ordinal_position;

-- =====================================================
-- TEST INSERTION (Optional - for debugging)
-- =====================================================
-- This is a test to see if the schema works with our thought capture
-- You can run this to test, then delete it

-- Test insert with thought capture structure
-- INSERT INTO ideas (
--     title, 
--     content, 
--     priority, 
--     status, 
--     tags, 
--     follow_up_date, 
--     auto_tagged, 
--     created_by, 
--     shared_with, 
--     archived, 
--     signal_cleared
-- ) VALUES (
--     'Test Idea',
--     'This is a test idea content',
--     'medium',
--     'reminder',
--     ARRAY['test'],
--     CURRENT_DATE + INTERVAL '1 day',
--     true,
--     'YOUR_USER_ID_HERE', -- Replace with actual user ID
--     ARRAY[]::uuid[],
--     false,
--     false
-- );

-- =====================================================
-- END OF MIGRATION
-- =====================================================
