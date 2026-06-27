-- MIGRATION: EXTEND MESSAGE BACKUP RETENTION TO 7 DAYS
-- Redefine public.purge_read_notifications() helper function to retain read messages for 7 days.

CREATE OR REPLACE FUNCTION public.purge_read_notifications()
RETURNS void AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE read = true AND read_at IS NOT NULL AND read_at < now() - interval '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
