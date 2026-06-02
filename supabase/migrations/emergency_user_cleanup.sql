-- =====================================================
-- EMERGENCY CLEANUP: PURGE GHOST USER DATA
-- =====================================================
-- Use this script if you have deleted a user but cannot reuse their email/username.
-- Replace 'TARGET_EMAIL' and 'TARGET_USERNAME' with the values you want to free up.

DO $$
DECLARE
    target_email TEXT := 'TARGET_EMAIL'; -- <--- CHANGE THIS
    target_username TEXT := 'TARGET_USERNAME'; -- <--- CHANGE THIS
    target_id UUID;
BEGIN
    -- 1. Try to find the UUID from profiles or signup_requests
    SELECT id INTO target_id FROM profiles WHERE email = target_email OR username = target_username LIMIT 1;
    
    -- 2. If we found a UUID, call the comprehensive cascade delete
    IF target_id IS NOT NULL THEN
        PERFORM delete_profile_cascade(target_id);
        RAISE NOTICE 'Cascade delete performed for UUID: %', target_id;
    END IF;

    -- 3. Explicitly purge from signup_requests (just in case)
    DELETE FROM signup_requests WHERE email = target_email OR username = target_username;
    RAISE NOTICE 'Signup requests purged for % / %', target_email, target_username;

    -- 4. Explicitly purge from profiles by email/username (just in case)
    DELETE FROM profiles WHERE email = target_email OR username = target_username;
    RAISE NOTICE 'Profiles purged for % / %', target_email, target_username;

    -- NOTE: You MUST still manually delete the user from the Supabase AUTH dashboard
    -- to free up the email address in the authentication system.
END $$;
