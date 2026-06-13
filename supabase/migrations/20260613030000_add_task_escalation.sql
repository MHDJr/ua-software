-- =====================================================
-- MIGRATION: ADD TASK ESCALATION COLUMN
-- =====================================================

-- 1. Add is_escalated column if not present
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_escalated BOOLEAN DEFAULT FALSE;

-- 2. Force reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
