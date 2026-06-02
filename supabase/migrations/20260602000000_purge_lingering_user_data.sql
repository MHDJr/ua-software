-- =====================================================
-- COMPREHENSIVE CASCADE DELETION FOR PROFILES (V3)
-- =====================================================
-- This migration updates delete_profile_cascade to also clean up signup_requests
-- and any other lingering identifiers that prevent email/username reuse.

CREATE OR REPLACE FUNCTION delete_profile_cascade(profile_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_email TEXT;
    v_username TEXT;
BEGIN
    -- 0. Capture email and username before deletion to clean up other tables
    SELECT email, username INTO v_email, v_username FROM profiles WHERE id = profile_uuid;

    -- 1. meeting_participants
    BEGIN
        DELETE FROM meeting_participants WHERE user_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 2. meeting_notifications
    BEGIN
        DELETE FROM meeting_notifications WHERE recipient_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 3. tutor_notifications
    BEGIN
        DELETE FROM tutor_notifications WHERE tutor_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 4. class_schedules
    BEGIN
        DELETE FROM class_schedules WHERE tutor_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 5. classes
    BEGIN
        DELETE FROM classes WHERE tutor_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 6. conversions
    BEGIN
        DELETE FROM conversions WHERE staff_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 7. daily_task_templates
    BEGIN
        DELETE FROM daily_task_templates WHERE staff_id = profile_uuid OR created_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 8. broadcast_acks
    BEGIN
        DELETE FROM broadcast_acks WHERE user_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 9. tasks
    BEGIN
        DELETE FROM tasks WHERE assigned_to = profile_uuid OR created_by = profile_uuid OR assigned_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 10. requests
    BEGIN
        DELETE FROM requests WHERE submitted_by = profile_uuid OR reviewed_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 11. broadcasts
    BEGIN
        UPDATE broadcasts SET created_by = NULL WHERE created_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 12. demo_requests
    BEGIN
        DELETE FROM demo_requests WHERE tutor_id = profile_uuid OR created_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 13. leads (nullify assignments and creators, keeping client data intact)
    BEGIN
        UPDATE leads SET assigned_sales_rep = NULL WHERE assigned_sales_rep = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        UPDATE leads SET assigned_to = NULL WHERE assigned_to = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        UPDATE leads SET demo_tutor_id = NULL WHERE demo_tutor_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        UPDATE leads SET created_by = NULL WHERE created_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 14. monthly_targets
    BEGIN
        DELETE FROM monthly_targets WHERE profile_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 15. activity_feed
    BEGIN
        DELETE FROM activity_feed WHERE user_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 16. knocks
    BEGIN
        DELETE FROM knocks WHERE knocked_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 17. tutor_availability
    BEGIN
        DELETE FROM tutor_availability WHERE tutor_id = profile_uuid OR updated_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 18. ideas
    BEGIN
        DELETE FROM ideas WHERE created_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 19. student_assignments
    BEGIN
        DELETE FROM student_assignments WHERE tutor_id = profile_uuid OR assigned_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 20. tutor_time_slots
    BEGIN
        DELETE FROM tutor_time_slots WHERE tutor_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 21. follow_ups
    BEGIN
        DELETE FROM follow_ups WHERE created_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 22. daily_reports
    BEGIN
        DELETE FROM daily_reports WHERE profile_id = profile_uuid OR user_id = profile_uuid OR reviewed_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 23. financial_entries
    BEGIN
        UPDATE financial_entries SET user_id = NULL WHERE user_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        UPDATE financial_entries SET submitted_by = NULL WHERE submitted_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    BEGIN
        UPDATE financial_entries SET reviewed_by = NULL WHERE reviewed_by = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 24. notifications
    BEGIN
        DELETE FROM notifications WHERE user_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 25. attendance
    BEGIN
        DELETE FROM attendance WHERE user_id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 26. signup_requests (CLEANUP BY IDENTIFIERS)
    BEGIN
        IF v_email IS NOT NULL THEN
            DELETE FROM signup_requests WHERE email = v_email;
        END IF;
        IF v_username IS NOT NULL THEN
            DELETE FROM signup_requests WHERE username = v_username;
        END IF;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    -- 27. Finally delete the profile from profiles table
    BEGIN
        DELETE FROM profiles WHERE id = profile_uuid;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
