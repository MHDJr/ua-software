-- Add completed_at column to ideas table
ALTER TABLE ideas ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Update existing completed ideas to have a completed_at value if it's missing
UPDATE ideas SET completed_at = updated_at WHERE completed = true AND completed_at IS NULL;
