-- =====================================================
-- THOUGHT CAPTURE SCHEMA FIX
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- Step 1: Check if ideas table exists
SELECT '=== CHECKING IDEAS TABLE EXISTENCE ===' as info;
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'public'
   AND    table_name   = 'ideas'
) as table_exists;

-- Step 2: Create ideas table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE  table_schema = 'public'
        AND    table_name   = 'ideas'
    ) THEN
        CREATE TABLE ideas (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            title TEXT,
            content TEXT NOT NULL,
            priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
            status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'archived')),
            category TEXT DEFAULT 'general',
            tags TEXT[] DEFAULT '{}',
            created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            follow_up_date TIMESTAMP WITH TIME ZONE,
            auto_tagged BOOLEAN DEFAULT FALSE,
            shared_with UUID[] DEFAULT '{}',
            archived BOOLEAN DEFAULT FALSE,
            signal_cleared BOOLEAN DEFAULT FALSE,
            reactions UUID[] DEFAULT '{}'
        );
        
        -- Add indexes
        CREATE INDEX idx_ideas_created_by ON ideas(created_by);
        CREATE INDEX idx_ideas_status ON ideas(status);
        CREATE INDEX idx_ideas_priority ON ideas(priority);
        CREATE INDEX idx_ideas_created_at ON ideas(created_at);
        
        RAISE NOTICE 'Created ideas table';
    ELSE
        RAISE NOTICE 'Ideas table already exists';
    END IF;
END $$;

-- Step 3: Add missing columns if they don't exist
DO $$
BEGIN
    -- Add content column if missing (rename description to content if needed)
    IF NOT EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'ideas' AND column_name = 'content'
    ) THEN
        IF EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = 'ideas' AND column_name = 'description'
        ) THEN
            ALTER TABLE ideas RENAME COLUMN description TO content;
            RAISE NOTICE 'Renamed description to content';
        ELSE
            ALTER TABLE ideas ADD COLUMN content TEXT NOT NULL DEFAULT '';
            RAISE NOTICE 'Added content column';
        END IF;
    END IF;
    
    -- Add other missing columns
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ideas' AND column_name = 'tags') THEN
        ALTER TABLE ideas ADD COLUMN tags TEXT[] DEFAULT '{}';
        RAISE NOTICE 'Added tags column';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ideas' AND column_name = 'follow_up_date') THEN
        ALTER TABLE ideas ADD COLUMN follow_up_date TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added follow_up_date column';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ideas' AND column_name = 'auto_tagged') THEN
        ALTER TABLE ideas ADD COLUMN auto_tagged BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added auto_tagged column';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ideas' AND column_name = 'shared_with') THEN
        ALTER TABLE ideas ADD COLUMN shared_with UUID[] DEFAULT '{}';
        RAISE NOTICE 'Added shared_with column';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ideas' AND column_name = 'archived') THEN
        ALTER TABLE ideas ADD COLUMN archived BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added archived column';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ideas' AND column_name = 'signal_cleared') THEN
        ALTER TABLE ideas ADD COLUMN signal_cleared BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added signal_cleared column';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ideas' AND column_name = 'reactions') THEN
        ALTER TABLE ideas ADD COLUMN reactions UUID[] DEFAULT '{}';
        RAISE NOTICE 'Added reactions column';
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ideas' AND column_name = 'updated_at') THEN
        ALTER TABLE ideas ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column';
    END IF;
END $$;

-- Step 4: Show final table structure
SELECT '=== FINAL TABLE STRUCTURE ===' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ideas' 
ORDER BY ordinal_position;

-- Step 5: Test insert to verify schema works
SELECT '=== TESTING SCHEMA ===' as info;
DO $$
BEGIN
    -- Try a test insert to verify the schema works
    INSERT INTO ideas (title, content, priority, status, created_by)
    VALUES (
        'Schema Test',
        'Testing if the thought capture schema works correctly',
        'medium',
        'open',
        (SELECT id FROM profiles WHERE role = 'ceo' LIMIT 1)
    );
    
    -- Clean up the test record
    DELETE FROM ideas WHERE title = 'Schema Test';
    
    RAISE NOTICE 'Schema test successful - thought capture should work now';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Schema test failed: %', SQLERRM;
END $$;

SELECT '=== SCHEMA FIX COMPLETE ===' as info;
SELECT 'Thought capture should now work. Try using the thought capture feature in the UI.' as status;
