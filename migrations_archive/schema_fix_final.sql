-- =====================================================
-- SCHEMA FIX FOR THOUGHT CAPTURE
-- Run this in your Supabase SQL Editor
-- =====================================================

-- First, see what columns currently exist
SELECT '=== CURRENT IDEAS TABLE COLUMNS ===' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ideas' 
ORDER BY ordinal_position;

-- Add missing columns that thought capture needs
DO $$
BEGIN
    -- Add content column (if description exists, rename it)
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
END $$;

-- Update status column to support new values
ALTER TABLE ideas ALTER COLUMN status SET DEFAULT 'reminder';

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';

-- Show final schema
SELECT '=== UPDATED SCHEMA ===' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ideas' 
ORDER BY ordinal_position;

-- =====================================================
-- AFTER RUNNING THIS:
-- 1. Try capturing a thought again
-- 2. It should work now with all columns available
-- =====================================================
