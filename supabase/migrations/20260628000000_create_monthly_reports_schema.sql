-- =========================================================================
-- REDESIGNED MONTHLY BUSINESS INTELLIGENCE REPORTING SYSTEM SCHEMA
-- =========================================================================

-- 1. Create monthly_reports tracking table
CREATE TABLE IF NOT EXISTS monthly_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
    year integer NOT NULL,
    generated_at timestamptz,
    generated_by text DEFAULT 'SYSTEM',
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'GENERATED', 'FAILED')),
    storage_paths jsonb NOT NULL DEFAULT '{}'::jsonb,
    email_sent boolean NOT NULL DEFAULT false,
    email_sent_at timestamptz,
    verification_status text NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'FAILED')),
    cleanup_completed boolean NOT NULL DEFAULT false,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (year, month)
);

-- 2. Create report_logs logging table
CREATE TABLE IF NOT EXISTS report_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id uuid REFERENCES monthly_reports(id) ON DELETE CASCADE,
    stage text NOT NULL CHECK (stage IN ('GENERATION', 'EMAIL', 'VERIFICATION', 'CLEANUP')),
    level text NOT NULL DEFAULT 'INFO' CHECK (level IN ('INFO', 'WARNING', 'ERROR')),
    message text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    duration_ms integer,
    created_at timestamptz DEFAULT now()
);

-- 3. Create archived_tasks table mirroring tasks structure for Stage 4 archiving
CREATE TABLE IF NOT EXISTS archived_tasks (
    id uuid,
    assigned_to uuid,
    title text,
    description text,
    priority text,
    status text,
    due_date timestamptz,
    created_by uuid,
    created_at timestamptz,
    subtasks jsonb,
    attachment_url text,
    is_draft boolean,
    task_description text,
    task_tags text[],
    is_new boolean,
    is_daily_task boolean,
    repeat_daily boolean,
    is_urgent boolean,
    ceo_directive text,
    staff_hidden boolean,
    ceo_hidden boolean,
    department_id uuid,
    completed_at timestamptz,
    hidden_from_ceo boolean,
    hidden_from_staff boolean,
    ceo_reviewed boolean,
    reviewed_at timestamptz,
    ceo_visible boolean,
    staff_visible boolean,
    updated_at timestamptz,
    signal_cleared boolean,
    assigned_by uuid,
    priority_level text,
    task_type text,
    progress integer,
    updatedAt text,
    reviewed_by_info text,
    delivery_status text,
    read_at timestamptz,
    escalated_at timestamptz,
    is_escalated boolean,
    is_staff_seen boolean,
    staff_seen_at timestamptz,
    archived_at timestamptz DEFAULT now()
);

-- 4. Create archived_requests table mirroring requests structure for Stage 4 archiving
CREATE TABLE IF NOT EXISTS archived_requests (
    id uuid,
    type text,
    submitted_by uuid,
    title text,
    description text,
    amount numeric,
    status text,
    reviewed_by uuid,
    reviewed_at timestamptz,
    created_at timestamptz,
    priority text,
    total_days integer,
    purpose text,
    dates text,
    time_range text,
    is_confirmed boolean,
    expires_at timestamptz,
    department_id uuid,
    signal_cleared boolean,
    updated_at timestamptz,
    archived_at timestamptz DEFAULT now()
);

-- Enable RLS on the new tables
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_requests ENABLE ROW LEVEL SECURITY;

-- CEO can select and see everything on reports, logs, and archives
CREATE POLICY "CEO can view monthly reports" ON monthly_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'ceo'
        )
    );

CREATE POLICY "CEO can view report logs" ON report_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'ceo'
        )
    );

CREATE POLICY "CEO can view archived tasks" ON archived_tasks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'ceo'
        )
    );

CREATE POLICY "CEO can view archived requests" ON archived_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'ceo'
        )
    );

-- =========================================================================
-- TIMEZONE-AWARE DATA LOCKING SYSTEM (STAGE 1 REQUIREMENT)
-- =========================================================================

-- Helper function to check if a date lies in a previous month relative to the current IST date
CREATE OR REPLACE FUNCTION is_date_previous_month(check_date date)
RETURNS boolean AS $$
DECLARE
    first_day_of_current_month date;
BEGIN
    -- Truncate current timestamp in Asia/Kolkata timezone to the first day of the month
    first_day_of_current_month := date_trunc('month', timezone('Asia/Kolkata', now()))::date;
    RETURN check_date < first_day_of_current_month;
END;
$$ LANGUAGE plpgsql STABLE;

-- Ensure RLS is active on write-locked source tables
ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales_tracking ENABLE ROW LEVEL SECURITY;

-- Create RESTRICTIVE policies for UPDATE, DELETE, and INSERT on financial_entries
CREATE POLICY "Lock previous month updates on financial_entries" 
    ON financial_entries 
    AS RESTRICTIVE 
    FOR UPDATE 
    USING (NOT is_date_previous_month(entry_date))
    WITH CHECK (NOT is_date_previous_month(entry_date));

CREATE POLICY "Lock previous month deletes on financial_entries" 
    ON financial_entries 
    AS RESTRICTIVE 
    FOR DELETE 
    USING (NOT is_date_previous_month(entry_date));

CREATE POLICY "Lock previous month inserts on financial_entries" 
    ON financial_entries 
    AS RESTRICTIVE 
    FOR INSERT 
    WITH CHECK (NOT is_date_previous_month(entry_date));

-- Create RESTRICTIVE policies for UPDATE, DELETE, and INSERT on daily_sales_tracking
CREATE POLICY "Lock previous month updates on daily_sales_tracking" 
    ON daily_sales_tracking 
    AS RESTRICTIVE 
    FOR UPDATE 
    USING (NOT is_date_previous_month(tracking_date))
    WITH CHECK (NOT is_date_previous_month(tracking_date));

CREATE POLICY "Lock previous month deletes on daily_sales_tracking" 
    ON daily_sales_tracking 
    AS RESTRICTIVE 
    FOR DELETE 
    USING (NOT is_date_previous_month(tracking_date));

CREATE POLICY "Lock previous month inserts on daily_sales_tracking" 
    ON daily_sales_tracking 
    AS RESTRICTIVE 
    FOR INSERT 
    WITH CHECK (NOT is_date_previous_month(tracking_date));

-- =========================================================================
-- DATABASE CRON SCHEDULER CONFIGURATION (Asia/Kolkata mapping)
-- =========================================================================

-- Enable pg_cron if not already active
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Unschedule any conflicting cron jobs from the database safely (no error if they don't exist)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname IN (
    'monthly-performance-report-cron',
    'bi-report-stage1-cron',
    'bi-report-stage2-cron',
    'bi-report-stage3-cron',
    'bi-report-stage4-cron'
);

-- 12:05 AM IST maps to 6:35 PM (18:35) UTC of previous day
SELECT cron.schedule(
    'bi-report-stage1-cron',
    '35 18 * * *',
    $$
    select net.http_post(
        url := 'https://dashboard.usthadacademy.com/api/cron/bi-reports?stage=1',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);

-- 05:00 AM IST maps to 11:30 PM (23:30) UTC of previous day
SELECT cron.schedule(
    'bi-report-stage2-cron',
    '30 23 * * *',
    $$
    select net.http_post(
        url := 'https://dashboard.usthadacademy.com/api/cron/bi-reports?stage=2',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);

-- 05:10 AM IST maps to 11:40 PM (23:40) UTC of previous day
SELECT cron.schedule(
    'bi-report-stage3-cron',
    '40 23 * * *',
    $$
    select net.http_post(
        url := 'https://dashboard.usthadacademy.com/api/cron/bi-reports?stage=3',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);

-- 05:30 AM IST maps to 12:00 AM (00:00) UTC of same day
SELECT cron.schedule(
    'bi-report-stage4-cron',
    '0 0 * * *',
    $$
    select net.http_post(
        url := 'https://dashboard.usthadacademy.com/api/cron/bi-reports?stage=4',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);
