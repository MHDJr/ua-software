-- =====================================================
-- FINANCIAL DATA SETUP FOR ACCOUNTS SYSTEM
-- =====================================================
-- Run this SQL script in your Supabase dashboard to create the required tables
-- This enables real financial data tracking for the Accounts page and CEO Financial Intelligence

-- Create financial_entries table for daily financial data
CREATE TABLE IF NOT EXISTS financial_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    uloomx_income DECIMAL(12,2) DEFAULT 0,
    usthad_income DECIMAL(12,2) DEFAULT 0,
    total_expenses DECIMAL(12,2) DEFAULT 0,
    revenue DECIMAL(12,2) GENERATED ALWAYS AS (uloomx_income + usthad_income - total_expenses) STORED,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    submitted_by UUID REFERENCES profiles(id),
    reviewed_by UUID REFERENCES profiles(id),
    reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for financial_entries
ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own financial entries, CEO can view all
CREATE POLICY "Users can view own financial entries" ON financial_entries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "CEO can view all financial entries" ON financial_entries FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Policy: Users can insert their own financial entries
CREATE POLICY "Users can insert own financial entries" ON financial_entries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: CEO can update all financial entries
CREATE POLICY "CEO can update financial entries" ON financial_entries FOR UPDATE
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'ceo'));

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_financial_entries_date ON financial_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_financial_entries_user ON financial_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_entries_status ON financial_entries(status);

-- Add comments for documentation
COMMENT ON TABLE financial_entries IS 'Daily financial entries submitted by accounts staff';
COMMENT ON COLUMN financial_entries.uloomx_income IS 'Income from UloomX platform';
COMMENT ON COLUMN financial_entries.usthad_income IS 'Income from Usthad Academy';
COMMENT ON COLUMN financial_entries.total_expenses IS 'Total combined expenses';
COMMENT ON COLUMN financial_entries.revenue IS 'Calculated revenue (income - expenses)';

-- =====================================================
-- TASK ASSIGNMENT ENHANCEMENTS
-- =====================================================

-- Add missing columns to tasks table if they don't exist
DO $$
BEGIN
    -- Check and add priority_level column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'priority_level'
    ) THEN
        ALTER TABLE tasks ADD COLUMN priority_level TEXT DEFAULT 'daily' CHECK (priority_level IN ('routine', 'daily', 'urgent'));
        RAISE NOTICE 'Added priority_level column to tasks table';
    END IF;

    -- Check and add task_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tasks' AND column_name = 'task_type'
    ) THEN
        ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'assignment' CHECK (task_type IN ('assignment', 'daily_task', 'mission'));
        RAISE NOTICE 'Added task_type column to tasks table';
    END IF;
END $$;

-- Update existing tasks to have proper priority_level if null
UPDATE tasks 
SET priority_level = CASE 
    WHEN priority = 'urgent' THEN 'urgent'
    WHEN priority = 'high' THEN 'urgent'
    WHEN priority = 'medium' THEN 'daily'
    ELSE 'routine'
END
WHERE priority_level IS NULL;

-- Update existing tasks to be assignments if they're assigned to specific users
UPDATE tasks 
SET task_type = 'assignment'
WHERE task_type IS NULL AND assigned_to IS NOT NULL;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check if financial_entries table exists and has the right structure
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'financial_entries' 
ORDER BY column_name;

-- Check if tasks table has the new columns
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'tasks' 
AND column_name IN ('priority_level', 'task_type')
ORDER BY column_name;

-- =====================================================
-- SAMPLE DATA (Optional - for testing)
-- =====================================================

-- Insert sample financial entries for testing
INSERT INTO financial_entries (user_id, uloomx_income, usthad_income, total_expenses, status, submitted_by)
SELECT 
    p.id,
    RANDOM() * 100000 + 50000, -- Random uloomx income between 50k-150k
    RANDOM() * 80000 + 30000, -- Random usthad income between 30k-110k
    RANDOM() * 50000 + 20000, -- Random expenses between 20k-70k
    'approved',
    p.id
FROM profiles p 
WHERE p.role IN ('staff', 'sales')
LIMIT 10;

-- Insert sample tasks for testing
INSERT INTO tasks (assigned_to, title, description, priority_level, task_type, created_by, priority, status)
SELECT 
    p.id,
    'Sample Financial Task for ' || p.full_name,
    'This is a sample task for testing the assignment system',
    CASE WHEN RANDOM() > 0.7 THEN 'urgent' WHEN RANDOM() > 0.4 THEN 'daily' ELSE 'routine' END,
    'assignment',
    (SELECT id FROM profiles WHERE role = 'ceo' LIMIT 1),
    CASE WHEN RANDOM() > 0.7 THEN 'urgent' WHEN RANDOM() > 0.4 THEN 'medium' ELSE 'low' END,
    'pending'
FROM profiles p 
WHERE p.role IN ('staff', 'sales')
LIMIT 5;
