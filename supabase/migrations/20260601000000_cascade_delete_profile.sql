-- =====================================================
-- COMPREHENSIVE CASCADE DELETION FOR PROFILES
-- =====================================================
-- This script redefines delete_profile_cascade to completely purge all records
-- from dependent tables where they reference the terminated staff member's UUID.

CREATE OR REPLACE FUNCTION delete_profile_cascade(profile_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- 1. Delete notifications
    BEGIN
        DELETE FROM notifications WHERE user_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 2. Delete tutor_notifications
    BEGIN
        DELETE FROM tutor_notifications WHERE tutor_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 3. Delete class_schedules
    BEGIN
        DELETE FROM class_schedules WHERE tutor_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 4. Delete classes
    BEGIN
        DELETE FROM classes WHERE tutor_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 5. Delete tutor_availability
    BEGIN
        DELETE FROM tutor_availability WHERE tutor_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 6. Delete daily_reports
    BEGIN
        DELETE FROM daily_reports WHERE profile_id = profile_uuid OR user_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 7. Delete knocks
    BEGIN
        DELETE FROM knocks WHERE knocked_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 8. Delete attendance
    BEGIN
        DELETE FROM attendance WHERE user_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 9. Delete activity_feed
    BEGIN
        DELETE FROM activity_feed WHERE user_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 10. Delete requests (submitted or reviewed)
    BEGIN
        DELETE FROM requests WHERE submitted_by = profile_uuid OR reviewed_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 11. Delete tasks (assigned or created)
    BEGIN
        DELETE FROM tasks WHERE assigned_to = profile_uuid OR created_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 12. Delete ideas
    BEGIN
        DELETE FROM ideas WHERE created_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 13. Finally delete the profile from profiles table
    BEGIN
        DELETE FROM profiles WHERE id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-grant execute permission
GRANT EXECUTE ON FUNCTION delete_profile_cascade(UUID) TO authenticated;
