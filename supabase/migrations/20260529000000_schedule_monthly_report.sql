-- =========================================================================
-- MONTHLY REPORT OS AUTOMATION SCHEDULER MIGRATION
-- =========================================================================
-- This script activates pg_cron and pg_net extensions in the database and 
-- schedules the `monthly-report` edge function to execute automatically 
-- on the 1st of every month at midnight UTC (00:00).
-- =========================================================================

-- 1. Enable Required Supabase extensions in their respective schemas
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- 2. Schedule the edge function trigger cron job
-- This cron job makes a secure HTTP POST request to the Supabase Edge Function endpoint.
-- It dynamically obtains the project host reference or defaults to local development.
select cron.schedule(
    'monthly-performance-report-cron', -- Unique Job Name
    '0 0 1 * *',                         -- Cron Expression: On the 1st of every month at 00:00 UTC
    $$
    select net.http_post(
        url := 'http://localhost:54321/functions/v1/monthly-report',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
    );
    $$
);

-- =========================================================================
-- SECURE SECRET DEPLOYMENT GUIDE (EXECUTIVE ACTION REQUIRED)
-- =========================================================================
-- To enable email dispatch through Resend, please execute the following 
-- command in your terminal/CLI environment to store your secrets:
--
-- supabase secrets set RESEND_API_KEY="re_your_api_key_here"
--
-- You can verify your active secrets using:
-- supabase secrets list
-- =========================================================================
