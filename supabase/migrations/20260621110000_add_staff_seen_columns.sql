-- =====================================================
-- MIGRATION: ADD STAFF SEEN COLUMNS & STORAGE BUCKET POLICIES
-- =====================================================

-- 1. Add is_staff_seen and staff_seen_at columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_staff_seen BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS staff_seen_at TIMESTAMP WITH TIME ZONE;

-- 2. Backfill existing tasks
UPDATE tasks SET is_staff_seen = false WHERE is_staff_seen IS NULL;

-- 3. Setup avatars storage bucket (in case of fresh setups)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true, 
  5242880, -- 5MB
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- 5. Drop existing policies if they exist to avoid duplicates
DROP POLICY IF EXISTS "Public Read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Insert avatars" ON storage.objects;
DROP POLICY IF EXISTS "Update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Delete avatars" ON storage.objects;

-- 6. Create Storage Policies for avatars bucket
-- Allow public SELECT (read) access
CREATE POLICY "Public Read avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Allow authenticated INSERT (upload) access if file is in avatars/ folder and starts with user's ID
CREATE POLICY "Insert avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars' 
    AND (
      name LIKE 'avatars/' || auth.uid()::text || '%' 
      OR name LIKE auth.uid()::text || '%'
    )
  );

-- Allow authenticated UPDATE access to own files
CREATE POLICY "Update avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (
      name LIKE 'avatars/' || auth.uid()::text || '%' 
      OR name LIKE auth.uid()::text || '%'
    )
  );

-- Allow authenticated DELETE access to own files
CREATE POLICY "Delete avatars" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars' 
    AND (
      name LIKE 'avatars/' || auth.uid()::text || '%' 
      OR name LIKE auth.uid()::text || '%'
    )
  );

-- 7. Force reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
SELECT public.reload_schema();
