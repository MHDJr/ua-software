-- Add reviewed_by_info column to tasks table to store names of people who reviewed the task
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reviewed_by_info TEXT;

-- Update existing reviewed_at comments or similar if needed
COMMENT ON COLUMN tasks.reviewed_by_info IS 'Stores formatted string of who reviewed the task (e.g. "CEO, Sales Manager")';
