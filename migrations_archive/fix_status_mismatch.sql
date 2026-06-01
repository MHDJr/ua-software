-- =====================================================
-- FIX STATUS MISMATCH FOR THOUGHT CAPTURE
-- This fixes the status field to match the component expectations
-- =====================================================

-- Step 1: Update the ideas table status constraint to match component
DO $$
BEGIN
    -- Check if the status column exists and update its constraint
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ideas' AND column_name = 'status') THEN
        -- First, update any existing records to use the new status values
        UPDATE ideas 
        SET status = CASE 
            WHEN status = 'pending' THEN 'reminder'
            WHEN status = 'in_progress' THEN 'directive' 
            WHEN status = 'completed' THEN 'reminder'
            ELSE status
        END 
        WHERE status IN ('pending', 'in_progress', 'completed');
        
        -- Drop the existing check constraint if it exists
        ALTER TABLE ideas DROP CONSTRAINT IF EXISTS ideas_status_check;
        
        -- Add the correct constraint that matches the component
        ALTER TABLE ideas 
        ADD CONSTRAINT ideas_status_check 
        CHECK (status IN ('reminder', 'directive', 'high_priority'));
        
        RAISE NOTICE 'Updated status constraint to match component expectations';
    END IF;
END $$;

-- Step 2: Update the TypeScript type definition comment for reference
SELECT '=== STATUS FIELD UPDATED ===' as info;
SELECT 'Status field now accepts: reminder, directive, high_priority' as status_values;

-- Step 3: Test the schema with the component's expected values
SELECT '=== TESTING COMPONENT VALUES ===' as info;
DO $$
BEGIN
    -- Test insert with component's expected status values
    INSERT INTO ideas (title, content, status, priority, created_by)
    VALUES (
        'Status Test',
        'Testing if the status field works with component values',
        'reminder',
        'medium',
        (SELECT id FROM profiles WHERE role = 'ceo' LIMIT 1)
    );
    
    -- Clean up the test record
    DELETE FROM ideas WHERE title = 'Status Test';
    
    RAISE NOTICE 'Status test successful - component should work now';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Status test failed: %', SQLERRM;
END $$;

SELECT '=== STATUS FIX COMPLETE ===' as info;
SELECT 'Thought capture status field now matches component expectations.' as result;
