-- =====================================================
-- GIVE MANAGER PERMISSION TO ADD STAFF
-- =====================================================

-- 1. Update profiles INSERT policy
-- Currently, it seems profiles are created by the new user themselves during signUp, 
-- or by the CEO/Admin via a service role. 
-- If we want to ensure managers can facilitate this (even if the new user is technically the one inserting),
-- we should make sure managers have the necessary view permissions if they need to check for existing users.

-- Actually, if AddStaffDialog uses supabaseAnonKey.auth.signUp, the new user inserts their own profile.
-- But if we want to be explicit or if there are other checks:

-- Allow managers to view all profiles (they probably already can, but let's be sure)
DROP POLICY IF EXISTS "Managers can view all profiles" ON profiles;
CREATE POLICY "Managers can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR is_manager = true OR role = 'manager')));

-- 2. Update activity_feed INSERT policy
-- Allow managers to insert into activity_feed
DROP POLICY IF EXISTS "Managers can insert activity" ON activity_feed;
CREATE POLICY "Managers can insert activity"
  ON activity_feed FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR is_manager = true OR role = 'manager')));

-- 3. If there's an INSERT policy on profiles that is restricted to CEO, update it.
-- Let's check for such policies (we'll use a broad approach)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'CEO can insert profiles') THEN
        DROP POLICY "CEO can insert profiles" ON profiles;
    END IF;
END $$;

CREATE POLICY "Managers and CEO can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR is_manager = true OR role = 'manager')) OR (auth.uid() = id));

-- Note: (auth.uid() = id) allows the new user to insert their own profile after signUp.

-- 4. Ensure managers can view requests (they might need this to see status)
DROP POLICY IF EXISTS "Managers can view requests" ON requests;
CREATE POLICY "Managers can view requests"
  ON requests FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR is_manager = true OR role = 'manager')) OR submitted_by = auth.uid());
