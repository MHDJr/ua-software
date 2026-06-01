-- =====================================================
-- DATABASE MIGRATION: TASKS LIVE METRICS SCHEMA EXPANSION
-- Run this in the Supabase SQL Editor to support live progress tracking
-- =====================================================

-- 1. Ensure progress column exists with range check (0-100)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);

-- 2. Ensure updatedAt column exists (supporting camelCase as used in frontend)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "updatedAt" TEXT;

-- 3. Drop existing status check constraints to prevent mismatch between lowercase/uppercase
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS status_check;

-- 4. Add updated constraint supporting all states (including legacy 'deleted' and new uppercase equivalents)
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (
    status IN (
        'pending', 'in_progress', 'completed', 'paused', 'in_review', 'deleted',
        'PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED', 'DELETED'
    )
);

-- 5. Add a comment to describe the new schema fields
COMMENT ON COLUMN tasks.progress IS 'Task workload completion percentage (0 to 100)';
COMMENT ON COLUMN tasks."updatedAt" IS 'Real-time updated timestamp string from frontend interactions';

SELECT '=== TASK SCHEMA EXPANSION SUCCESSFUL ===' as info;
