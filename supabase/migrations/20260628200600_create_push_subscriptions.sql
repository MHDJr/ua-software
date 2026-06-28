-- =========================================================================
-- MIGRATION: WEB PUSH NOTIFICATION SYSTEM ENGINE
-- =========================================================================

-- 1. Create native push subscriptions table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    device_type TEXT,
    browser TEXT,
    platform TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for optimized queries
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions(endpoint);

-- Enable Row Level Security (RLS)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create Security Policies
CREATE POLICY "Users can select their own push subscriptions"
    ON public.push_subscriptions FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own push subscriptions"
    ON public.push_subscriptions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own push subscriptions"
    ON public.push_subscriptions FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own push subscriptions"
    ON public.push_subscriptions FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 2. System config table for triggers and cron jobs
CREATE TABLE IF NOT EXISTS public.system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Pre-populate defaults (can be edited inside Supabase dashboard/SQL editor)
INSERT INTO public.system_config (key, value) VALUES
('supabase_url', 'http://localhost:54321'),
('supabase_anon_key', 'your-anon-key-here'),
('trigger_secret', 'ua-secure-system-trigger-secret-token-2026')
ON CONFLICT (key) DO NOTHING;

-- Security helper to read configuration values
CREATE OR REPLACE FUNCTION public.get_system_config(config_key text)
RETURNS text AS $$
DECLARE
  config_val text;
BEGIN
  SELECT value INTO config_val FROM public.system_config WHERE key = config_key;
  RETURN COALESCE(config_val, '');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create task reminders tracking table
CREATE TABLE IF NOT EXISTS public.task_reminders_sent (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    reminder_type TEXT NOT NULL, -- '24h', '1h', '15m'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (task_id, reminder_type)
);

-- Enable extensions in appropriate schemas
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 4. Unified trigger function to send push notifications via Edge Function
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS trigger AS $$
DECLARE
  url text;
  anon_key text;
  secret_header text;
  payload jsonb;
  recipient_id uuid;
  title text;
  body text;
  target_url text;
  should_trigger boolean := false;
  sender_name text := 'Someone';
BEGIN
  -- Build payload based on tables and actions
  IF TG_TABLE_NAME = 'tasks' THEN
    IF TG_OP = 'INSERT' AND NEW.assigned_to IS NOT NULL THEN
      recipient_id := NEW.assigned_to;
      title := '📋 New Task';
      body := 'You have been assigned: "' || COALESCE(NEW.title, 'No Title') || '"';
      target_url := '/tasks/' || NEW.id;
      should_trigger := true;
    ELSIF TG_OP = 'UPDATE' THEN
      -- Trigger on new assignment
      IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
        recipient_id := NEW.assigned_to;
        title := '📋 New Task';
        body := 'You have been assigned: "' || COALESCE(NEW.title, 'No Title') || '"';
        target_url := '/tasks/' || NEW.id;
        should_trigger := true;
      -- Trigger on status change
      ELSIF NEW.assigned_to IS NOT NULL AND OLD.status != NEW.status THEN
        recipient_id := NEW.assigned_to;
        title := '📋 Task Status Update';
        body := 'Task "' || COALESCE(NEW.title, 'No Title') || '" is now: ' || UPPER(NEW.status);
        target_url := '/tasks/' || NEW.id;
        should_trigger := true;
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME = 'notifications' THEN
    -- Chat messages are inserted into the notifications table with type = 'message'
    IF TG_OP = 'INSERT' AND (NEW.type = 'message' OR NEW.type = 'chat') THEN
      recipient_id := NEW.user_id;
      title := NEW.title;
      body := NEW.message;
      target_url := '/chat/' || COALESCE(NEW.user_id::text, '');
      should_trigger := true;
    END IF;
  END IF;

  -- Attempt dispatch inside a safe block to protect parent transactions from failing
  IF should_trigger AND recipient_id IS NOT NULL THEN
    BEGIN
      url := public.get_system_config('supabase_url');
      anon_key := public.get_system_config('supabase_anon_key');
      secret_header := public.get_system_config('trigger_secret');
      
      IF url != '' AND url != 'http://localhost:54321' AND anon_key != 'your-anon-key-here' THEN
        payload := jsonb_build_object(
          'recipient_id', recipient_id,
          'title', title,
          'body', body,
          'url', target_url,
          'icon', '/logo.png',
          'image', null
        );
        
        PERFORM net.http_post(
          url := url || '/functions/v1/send-push-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', anon_key,
            'Authorization', 'Bearer ' || anon_key,
            'x-push-trigger-secret', secret_header
          ),
          body := payload
        );
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Web Push trigger failed: %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger function specifically for meetings (multiple attendees UUID array)
CREATE OR REPLACE FUNCTION public.trigger_meeting_notifications()
RETURNS trigger AS $$
DECLARE
  url text;
  anon_key text;
  secret_header text;
  payload jsonb;
  attendee_id uuid;
  meeting_time_text text;
BEGIN
  BEGIN
    url := public.get_system_config('supabase_url');
    anon_key := public.get_system_config('supabase_anon_key');
    secret_header := public.get_system_config('trigger_secret');
    
    IF url != '' AND url != 'http://localhost:54321' AND anon_key != 'your-anon-key-here' AND NEW.attendees IS NOT NULL AND array_length(NEW.attendees, 1) > 0 THEN
      -- Format meeting time e.g. "Mon • 04:00 PM"
      meeting_time_text := to_char(NEW.scheduled_at AT TIME ZONE 'Asia/Kolkata', 'Dy • HH:MI AM');

      FOREACH attendee_id IN ARRAY NEW.attendees LOOP
        payload := jsonb_build_object(
          'recipient_id', attendee_id,
          'title', '📅 Meeting Invitation',
          'body', NEW.title || E'\nScheduled for: ' || meeting_time_text,
          'url', '/meetings/' || NEW.id,
          'icon', '/logo.png',
          'image', null
        );
        
        PERFORM net.http_post(
          url := url || '/functions/v1/send-push-notification',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', anon_key,
            'Authorization', 'Bearer ' || anon_key,
            'x-push-trigger-secret', secret_header
          ),
          body := payload
        );
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Web Push meeting triggers failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Cron function to check for upcoming task deadlines and send reminders
CREATE OR REPLACE FUNCTION public.check_task_reminders()
RETURNS void AS $$
DECLARE
  task_rec record;
  url text;
  anon_key text;
  secret_header text;
  payload jsonb;
  reminder_type text;
  reminder_body text;
  time_diff interval;
BEGIN
  BEGIN
    url := public.get_system_config('supabase_url');
    anon_key := public.get_system_config('supabase_anon_key');
    secret_header := public.get_system_config('trigger_secret');
    
    IF url = '' OR url = 'http://localhost:54321' OR anon_key = 'your-anon-key-here' THEN
      RETURN;
    END IF;

    FOR task_rec IN 
      SELECT t.id, t.assigned_to, t.title, t.due_date
      FROM public.tasks t
      WHERE t.status NOT IN ('completed', 'COMPLETED') 
        AND t.assigned_to IS NOT NULL 
        AND t.due_date IS NOT NULL
        AND t.due_date > now()
    LOOP
      time_diff := task_rec.due_date - now();
      reminder_type := NULL;
      
      -- Check 24 hours (time difference between 23h 45m and 24h 15m)
      IF time_diff >= interval '23 hours 45 minutes' AND time_diff <= interval '24 hours 15 minutes' THEN
        reminder_type := '24h';
        reminder_body := 'Reminder: "' || task_rec.title || '" is due in 24 hours.';
      -- Check 1 hour (time difference between 50m and 1h 10m)
      ELSIF time_diff >= interval '50 minutes' AND time_diff <= interval '1 hour 10 minutes' THEN
        reminder_type := '1h';
        reminder_body := 'Urgent Reminder: "' || task_rec.title || '" is due in 1 hour.';
      -- Check 15 minutes (time difference between 0m and 20m)
      ELSIF time_diff >= interval '0 minutes' AND time_diff <= interval '20 minutes' THEN
        reminder_type := '15m';
        reminder_body := 'Critical Reminder: "' || task_rec.title || '" is due in 15 minutes!';
      END IF;
      
      IF reminder_type IS NOT NULL THEN
        -- Verify that we have not sent this specific reminder type yet
        IF NOT EXISTS (
          SELECT 1 FROM public.task_reminders_sent 
          WHERE task_id = task_rec.id AND reminder_type = reminder_type
        ) THEN
          -- Record sending to prevent duplicates
          INSERT INTO public.task_reminders_sent (task_id, reminder_type)
          VALUES (task_rec.id, reminder_type)
          ON CONFLICT (task_id, reminder_type) DO NOTHING;
          
          -- Trigger the Edge Function call
          payload := jsonb_build_object(
            'recipient_id', task_rec.assigned_to,
            'title', '⏰ Task Reminder',
            'body', reminder_body,
            'url', '/tasks/' || task_rec.id,
            'icon', '/logo.png',
            'image', null
          );
          
          PERFORM net.http_post(
            url := url || '/functions/v1/send-push-notification',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'apikey', anon_key,
              'Authorization', 'Bearer ' || anon_key,
              'x-push-trigger-secret', secret_header
            ),
            body := payload
          );
        END IF;
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'check_task_reminders cron failure: %', SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Apply Triggers to Tables
DROP TRIGGER IF EXISTS trigger_tasks_push ON public.tasks;
CREATE TRIGGER trigger_tasks_push
  AFTER INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();

DROP TRIGGER IF EXISTS trigger_notifications_push ON public.notifications;
CREATE TRIGGER trigger_notifications_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();

DROP TRIGGER IF EXISTS trigger_meetings_push ON public.meetings;
CREATE TRIGGER trigger_meetings_push
  AFTER INSERT ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_meeting_notifications();

-- 8. Register Task Reminders Checker to run every 5 minutes in pg_cron
-- We wrap it in a safe query to ensure it doesn't fail on first run if it's not registered
DO $$
BEGIN
  PERFORM cron.unschedule('task-reminders-cron');
EXCEPTION WHEN OTHERS THEN
  -- ignore
END;
$$;

SELECT cron.schedule(
    'task-reminders-cron',
    '*/5 * * * *',
    $$
    select public.check_task_reminders();
    $$
);

-- Force schema reload
NOTIFY pgrst, 'reload schema';
