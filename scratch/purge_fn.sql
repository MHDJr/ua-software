-- Create the purge function
CREATE OR REPLACE FUNCTION public.purge_read_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE read = true AND read_at IS NOT NULL AND read_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Try to enable pg_cron and schedule the cron job
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('purge-read-notifications-job', '*/5 * * * *', 'SELECT public.purge_read_notifications();');
