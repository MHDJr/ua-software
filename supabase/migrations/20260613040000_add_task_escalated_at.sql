-- =====================================================
-- MIGRATION: ADD TASK ESCALATED_AT COLUMN
-- =====================================================

-- 1. Add escalated_at column if not present
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE;

-- 2. Force reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
