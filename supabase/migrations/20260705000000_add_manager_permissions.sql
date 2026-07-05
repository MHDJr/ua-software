-- Add manager_permissions column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS manager_permissions JSONB DEFAULT '{}'::jsonb;

-- Trigger schema reload to update PostgREST cache
NOTIFY pgrst, 'reload schema';
