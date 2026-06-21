import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder";

export const supabase: SupabaseClient = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    },
);

export type Profile = {
    id: string;
    email: string;
    username?: string | null;
    full_name: string;
    role: "ceo" | "staff" | "sales" | "accounts" | "manager" | "tutor";
    phone?: string;
    department?: string;
    avatar_url?: string;
    designation?: string;
    status: "online" | "busy" | "away" | "offline";
    ceo_door_status?: "open" | "dnd";
    password?: string; // Stored staff password
    is_sales_staff?: boolean;
    is_tutor?: boolean;
    is_manager?: boolean;
    created_at: string;
    updated_at: string;
    subscription?: any;
};

export type Task = {
    id: string;
    assigned_to: string;
    title: string;
    description?: string;
    priority: "low" | "medium" | "high" | "urgent";
    status: "pending" | "in_progress" | "completed" | "paused" | "in_review" | "PENDING" | "IN_PROGRESS" | "UNDER_REVIEW" | "COMPLETED";
    progress?: number;
    updatedAt?: string;
    due_date?: string;
    created_by: string;
    created_at: string;
    updated_at?: string;
    repeat_daily?: boolean;
    is_daily_task?: boolean;
    overdue_notified?: boolean;
    is_new?: boolean;
    task_tags?: string[];
    is_staff_seen?: boolean;
    staff_seen_at?: string;
    task_description?: string;
    subtasks?: any;
    attachment_url?: string;
    is_draft?: boolean;
    signal_cleared?: boolean;
    reviewed_at?: string | null;
    reviewed_by_info?: string | null;
    is_escalated?: boolean;
    escalated_at?: string;
    assigned_to_user?: {
        full_name: string;
        department: string;
    };
    creator?: {
        role: "ceo" | "staff" | "sales" | "accounts" | "manager" | "tutor";
        is_manager: boolean;
    };
};

export type Request = {
    id: string;
    type:
        | "leave"
        | "permission"
        | "work_adjustment"
        | "expense"
        | "feedback"
        | "budget"
        | "access_elevation"
        | "role_change"
        | "add_staff";
    submitted_by: string;
    title: string;
    description?: string;
    amount?: number;
    priority?: "normal" | "high" | "urgent";
    status: "pending" | "approved" | "rejected";
    reviewed_by?: string;
    reviewed_at?: string;
    metadata?: any;
    // Leave request fields
    dates?: string;
    total_days?: number;
    purpose?: string;
    time_range?: string;
    is_confirmed?: boolean;
    created_at: string;
    signal_cleared?: boolean;
};

export type Broadcast = {
    id: string;
    message: string;
    created_by: string;
    created_at: string;
    expires_at: string;
};

export type Knock = {
    id: string;
    knocked_by: string;
    message?: string;
    status: "pending" | "accepted" | "declined";
    created_at: string;
};

export type ActivityFeed = {
    id: string;
    action_type: string;
    description: string;
    user_id: string;
    metadata?: any;
    created_at: string;
};

export type Attendance = {
    id: string;
    user_id: string;
    clock_in: string;
    clock_out?: string;
    date: string;
};

export type SignupRequest = {
    id: string;
    email: string;
    username?: string | null;
    full_name: string;
    role: "ceo" | "staff";
    status: "pending" | "approved" | "rejected";
    created_at: string;
};

export type Meeting = {
    id: string;
    title: string;
    description?: string;
    start_time: string;
    end_time: string;
    attendees: string[];
    meeting_link?: string;
    created_at: string;
};

export type ExecutiveReport = {
    id: string;
    title: string;
    summary: any;
    created_at: string;
    period_start?: string;
    period_end?: string;
};

export type AgentStatus = {
    id: string;
    last_run?: string;
    status: string;
    metadata?: any;
};

// =====================================================
// SALES & DEMO WORKFLOW TYPES
// =====================================================

export type Lead = {
    id: string;
    lead_name: string;
    email?: string;
    phone?: string;
    program_interest?: string;
    place?: string;
    description?: string;
    assigned_to?: string;
    status: LeadStatus;
    source?: string;
    notes?: string;
    next_follow_up?: string;
    demo_outcome?: string;
    conversion_reason?: string;
    demo_tutor_id?: string;
    demo_time?: string;
    ceo_alert_message?: string;
    ceo_alert_at?: string;
    created_at: string;
    updated_at: string;
    created_by?: string;
    signal_cleared?: boolean;
};

export type LeadStatus =
    | "new"
    | "contacted"
    | "demo_scheduled"
    | "demo_completed"
    | "converted"
    | "lost"
    | "cold";

export type DemoRequest = {
    id: string;
    lead_id: string;
    tutor_id: string;
    proposed_time: string;
    status: "pending" | "accepted" | "declined" | "completed";
    response_note?: string;
    created_by?: string;
    created_at: string;
    responded_at?: string;
    // Joined data
    lead?: Lead;
    tutor?: Profile;
    signal_cleared?: boolean;
};

export type TutorAvailability = {
    id: string;
    tutor_id: string;
    status: "available" | "busy" | "unavailable";
    note?: string;
    last_updated: string;
    updated_by?: string;
    auto_status?: boolean;
    preferred_notice_minutes?: number;
    max_daily_demos?: number;
    working_hours_start?: string;
    working_hours_end?: string;
    tutor?: Profile;
};

// =====================================================
// TUTOR COMMAND PAGE TYPES
// =====================================================

export type Class = {
    id: string;
    tutor_id: string;
    title: string;
    description?: string;
    class_type: "class" | "demo" | "meeting";
    status: "upcoming" | "live" | "completed" | "cancelled";
    start_time: string;
    end_time: string;
    lead_id?: string;
    student_count: number;
    max_students: number;
    meeting_link?: string;
    notes?: string;
    created_at: string;
    updated_at: string;
    // Joined data
    lead?: Lead;
};

export type ClassSchedule = {
    id: string;
    tutor_id: string;
    title: string;
    description?: string;
    day_of_week: number; // 0=Sunday, 6=Saturday
    start_time: string;
    end_time: string;
    is_active: boolean;
    created_at: string;
};

export type TutorNotification = {
    id: string;
    tutor_id: string;
    type:
        | "class_reminder"
        | "demo_assigned"
        | "demo_request"
        | "class_starting"
        | "system";
    title: string;
    message?: string;
    class_id?: string;
    demo_request_id?: string;
    read: boolean;
    action_taken: boolean;
    created_at: string;
    expires_at?: string;
    // Joined data
    class?: Class;
    demo_request?: DemoRequest;
};

// =====================================================
// CEO COMMAND PAGE TYPES
// =====================================================

export type Programme = {
    id: string;
    title: string;
    description?: string;
    programme_type: "demo" | "class" | "workshop" | "training" | "meeting";
    priority: "normal" | "high" | "critical";
    start_time: string;
    end_time: string;
    status:
        | "scheduled"
        | "deployed"
        | "in_progress"
        | "completed"
        | "cancelled";
    created_by?: string;
    created_at: string;
    updated_at?: string;
};

export type Idea = {
    id: string;
    title?: string;
    content: string;
    priority?: "low" | "medium" | "high" | "urgent";
    status?: "reminder" | "directive" | "high_priority";
    tags?: string[];
    follow_up_date?: string;
    auto_tagged?: boolean;
    created_by: string;
    shared_with: string[];
    archived: boolean;
    completed?: boolean;
    completed_at?: string;
    updated_at?: string;
    created_at: string;
    expires_at: string;
    reactions?: string[]; // Array of staff IDs who reacted with 👍
    signal_cleared?: boolean;
};

export type SalesSignals = {
    leadsToday: number;
    demosScheduled: number;
    salesBlocked: number;
};

// =====================================================
// DAILY SALES REPORTING TYPES
// =====================================================

export type DailyReport = {
    id: string;
    user_id: string;
    profile_id: string;
    reporter_name: string;
    report_date: string;
    total_leads: number;
    conversions: number;
    evaluations_taken: number;
    lost_leads: number;
    lead_quality_rating: number;
    conversion_rate: number;
    efficiency_score: number;
    submitted_at: string;
    reviewed_by?: string;
    reviewed_at?: string;
    notes?: string;
};
