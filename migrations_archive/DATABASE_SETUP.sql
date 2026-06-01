-- =====================================================
-- TASK VISIBILITY COLUMNS SETUP
-- =====================================================
-- Run this SQL script in your Supabase dashboard to add the required columns
-- This enables the CEO and Staff page task visibility features

-- Add task visibility columns for CEO and Staff pages
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS ceo_visible BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS staff_visible BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS ceo_reviewed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tasks_ceo_visible ON tasks(ceo_visible) WHERE ceo_visible = false;
CREATE INDEX IF NOT EXISTS idx_tasks_staff_visible ON tasks(staff_visible) WHERE staff_visible = false;
CREATE INDEX IF NOT EXISTS idx_tasks_ceo_reviewed ON tasks(ceo_reviewed) WHERE ceo_reviewed = true;

-- Add comments for documentation
COMMENT ON COLUMN tasks.ceo_visible IS 'Controls task visibility on CEO page (FALSE = hidden from CEO only)';
COMMENT ON COLUMN tasks.staff_visible IS 'Controls task visibility on Staff page (FALSE = hidden from staff only)';
COMMENT ON COLUMN tasks.ceo_reviewed IS 'Indicates if CEO has reviewed the completed task';
COMMENT ON COLUMN tasks.reviewed_at IS 'Timestamp when CEO reviewed the task';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Run these queries to verify the columns were added successfully:

-- Check if columns exist
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name IN ('ceo_visible', 'staff_visible', 'ceo_reviewed', 'reviewed_at')
ORDER BY column_name;

-- Test the new columns with sample data
UPDATE tasks 
SET ceo_visible = TRUE, staff_visible = TRUE, ceo_reviewed = FALSE 
WHERE status = 'completed' 
AND (ceo_visible IS NULL OR staff_visible IS NULL OR ceo_reviewed IS NULL);

-- =====================================================
-- SAMPLE DATA (Optional)
-- =====================================================
-- If you want to test with sample completed tasks:

-- INSERT INTO tasks (id, title, description, assigned_to, created_by, status, priority, ceo_visible, staff_visible, ceo_reviewed, reviewed_at, created_at, updated_at)
-- VALUES 
--   (gen_random_uuid(), 'Sample Completed Task 1', 'This is a test completed task', 'user-id-here', 'ceo-id-here', 'completed', 'medium', TRUE, TRUE, FALSE, NULL, NOW(), NOW()),
--   (gen_random_uuid(), 'Sample Completed Task 2', 'Another test completed task', 'user-id-here', 'ceo-id-here', 'completed', 'high', TRUE, TRUE, TRUE, NOW(), NOW(), NOW());
