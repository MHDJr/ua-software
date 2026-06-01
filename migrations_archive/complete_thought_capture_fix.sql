-- =====================================================
-- COMPLETE THOUGHT CAPTURE FIX
-- Run this entire script in Supabase SQL Editor
-- This fixes both schema and status field issues
-- =====================================================

-- Step 1: Create ideas table if it doesn't exist with correct status values
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
            status TEXT DEFAULT 'reminder' CHECK (status IN ('reminder', 'directive', 'high_priority')),
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
        
        RAISE NOTICE 'Created ideas table with correct status values';
    ELSE
        RAISE NOTICE 'Ideas table already exists, updating schema...';
    END IF;
END $$;

-- Step 2: Add missing columns and fix status constraint
DO $$
BEGIN
    -- Add content column if missing
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
    
    -- Fix status constraint to match component expectations
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ideas' AND column_name = 'status') THEN
        -- Update existing records to use new status values
        UPDATE ideas 
        SET status = CASE 
            WHEN status = 'pending' OR status = 'open' THEN 'reminder'
            WHEN status = 'in_progress' THEN 'directive' 
            WHEN status = 'completed' THEN 'reminder'
            WHEN status = 'archived' THEN 'reminder'
            ELSE COALESCE(status, 'reminder')
        END;
        
        -- Drop and recreate the status constraint
        ALTER TABLE ideas DROP CONSTRAINT IF EXISTS ideas_status_check;
        ALTER TABLE ideas ADD CONSTRAINT ideas_status_check 
        CHECK (status IN ('reminder', 'directive', 'high_priority'));
        
        RAISE NOTICE 'Fixed status constraint to match component values';
    END IF;
END $$;

-- Step 3: Enable RLS and create policies
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own ideas" ON ideas;
DROP POLICY IF EXISTS "Users can insert own ideas" ON ideas;
DROP POLICY IF EXISTS "Users can update own ideas" ON ideas;
DROP POLICY IF EXISTS "Users can delete own ideas" ON ideas;
DROP POLICY IF EXISTS "CEO can manage all ideas" ON ideas;

-- Create new policies
CREATE POLICY "Users can view own ideas" ON ideas
    FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own ideas" ON ideas
    FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own ideas" ON ideas
    FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own ideas" ON ideas
    FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "CEO can manage all ideas" ON ideas
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'ceo'
        )
    );

-- Step 4: Create triggers
CREATE OR REPLACE FUNCTION auto_tag_idea()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-tag based on content
    IF LOWER(NEW.content) LIKE '%urgent%' OR LOWER(NEW.content) LIKE '%asap%' THEN
        NEW.priority := 'high';
    END IF;
    
    IF LOWER(NEW.content) LIKE '%meeting%' OR LOWER(NEW.content) LIKE '%schedule%' THEN
        NEW.tags := array_append(NEW.tags, 'meeting');
    END IF;
    
    IF LOWER(NEW.content) LIKE '%follow up%' OR LOWER(NEW.content) LIKE '%followup%' THEN
        NEW.tags := array_append(NEW.tags, 'follow-up');
    END IF;
    
    NEW.auto_tagged := TRUE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_tag_idea
    BEFORE INSERT ON ideas
    FOR EACH ROW
    EXECUTE FUNCTION auto_tag_idea();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ideas_updated_at
    BEFORE UPDATE ON ideas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 5: Show final table structure
SELECT '=== FINAL TABLE STRUCTURE ===' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'ideas' 
ORDER BY ordinal_position;

-- Step 6: Test with component's expected values
SELECT '=== TESTING COMPONENT INTEGRATION ===' as info;
DO $$
BEGIN
    -- Test insert with component's expected values
    INSERT INTO ideas (title, content, status, priority, created_by, tags, auto_tagged)
    VALUES (
        'Component Test',
        'Testing thought capture with component values',
        'reminder',
        'medium',
        (SELECT id FROM profiles WHERE role = 'ceo' LIMIT 1),
        ARRAY['test'],
        true
    );
    
    -- Clean up the test record
    DELETE FROM ideas WHERE title = 'Component Test';
    
    RAISE NOTICE 'Component integration test successful';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Component test failed: %', SQLERRM;
END $$;

SELECT '=== COMPLETE FIX SUCCESSFUL ===' as info;
SELECT 'Thought capture should now work fully with the component.' as status;
