"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

// ============================================
// SHARED CONFIG
// ============================================
const EMPTY_ARRAY: any[] = [];

const DASHBOARD_QUERY_CONFIG = {
    staleTime: 1000 * 60 * 5, // 5 minutes before data is considered stale
    gcTime: 1000 * 60 * 10,   // 10 minutes cache retention
};

// ============================================
// TASKS HOOK
// ============================================
export function useTasks(options: any = {}) {
    const { user } = useAuth();
    
    const { data: activeTasksData, isLoading: isLoadingActive, isFetching: isFetchingActive } = useQuery({
        queryKey: ["tasks", "active"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tasks")
                .select("id, title, description, assigned_to, priority, status, progress, due_date, created_by, created_at, updated_at, repeat_daily, is_daily_task, is_staff_seen, staff_seen_at, assigned_to_user:profiles!assigned_to(full_name, department), creator:profiles!created_by(role, is_manager)")
                .not("status", "in", '("completed","deleted","COMPLETED")')
                .order("updated_at", { ascending: false });
            
            if (error) {
                // Self-healing fallback if database columns are not yet created
                if (error.code === "42703") {
                    const fallback = await supabase
                        .from("tasks")
                        .select("id, title, description, assigned_to, priority, status, progress, due_date, created_by, created_at, updated_at, repeat_daily, is_daily_task, assigned_to_user:profiles!assigned_to(full_name, department), creator:profiles!created_by(role, is_manager)")
                        .not("status", "in", '("completed","deleted","COMPLETED")')
                        .order("updated_at", { ascending: false });
                    if (fallback.error) throw fallback.error;
                    return fallback.data;
                }
                throw error;
            }
            return data;
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options,
        enabled: !!user && (options.enabled !== undefined ? options.enabled : true)
    });

    const { data: completedTasksData, isLoading: isLoadingCompleted, isFetching: isFetchingCompleted } = useQuery({
        queryKey: ["tasks", "completed"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tasks")
                .select("id, title, description, assigned_to, priority, status, progress, due_date, created_by, created_at, updated_at, repeat_daily, is_daily_task, is_staff_seen, staff_seen_at, assigned_to_user:profiles!assigned_to(full_name, department), creator:profiles!created_by(role, is_manager)")
                .in("status", ["completed", "COMPLETED"])
                .is("reviewed_at", null)
                .order("updated_at", { ascending: false })
                .limit(50);
            
            if (error) {
                // Self-healing fallback if database columns are not yet created
                if (error.code === "42703") {
                    const fallback = await supabase
                        .from("tasks")
                        .select("id, title, description, assigned_to, priority, status, progress, due_date, created_by, created_at, updated_at, repeat_daily, is_daily_task, assigned_to_user:profiles!assigned_to(full_name, department), creator:profiles!created_by(role, is_manager)")
                        .in("status", ["completed", "COMPLETED"])
                        .is("reviewed_at", null)
                        .order("updated_at", { ascending: false })
                        .limit(50);
                    if (fallback.error) throw fallback.error;
                    return fallback.data;
                }
                throw error;
            }
            return data;
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options,
        enabled: !!user && (options.enabled !== undefined ? options.enabled : true)
    });

    const activeTasks = activeTasksData || EMPTY_ARRAY;
    const completedTasks = completedTasksData || EMPTY_ARRAY;

    return {
        activeTasks,
        completedTasks,
        isLoading: isLoadingActive || isLoadingCompleted,
        isFetching: isFetchingActive || isFetchingCompleted
    };
}

// ============================================
// STAFF HOOK
// ============================================
export function useStaff(options: any = {}) {
    const { user } = useAuth();
    
    const { data, ...rest } = useQuery({
        queryKey: ["staff"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .neq("role", "ceo")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data.filter((s: any) => s.full_name !== "[DELETED]");
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options,
        enabled: !!user && (options.enabled !== undefined ? options.enabled : true)
    });
    return { data: data || EMPTY_ARRAY, ...rest };
}

// ============================================
// LEADS & DEMOS HOOK
// ============================================
export function useLeads(options: any = {}) {
    const { user } = useAuth();
    
    const { data: leadsData, isLoading: isLoadingLeads } = useQuery({
        queryKey: ["leads"],
        queryFn: async () => {
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from("leads")
                .select("*")
                .or(`created_at.gte.${threeDaysAgo},status.eq.converted,updated_at.gte.${threeDaysAgo}`)
                .order("updated_at", { ascending: false });
            if (error) {
                console.error("Leads fetch error:", error);
                throw error;
            }
            return data;
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options,
        enabled: !!user?.id && (options.enabled !== undefined ? options.enabled : true)
    });

    const { data: demoRequestsData, isLoading: isLoadingDemos } = useQuery({
        queryKey: ["demo_requests", user?.id],
        queryFn: async () => {
            // 1. Fetch accepted demo requests
            const { data: demos, error: demoError } = await supabase
                .from("demo_requests")
                .select("*")
                .eq("status", "accepted")
                .order("created_at", { ascending: false });
            if (demoError) {
                console.error("Error fetching demo requests:", demoError);
                throw demoError;
            }
            if (!demos || demos.length === 0) return EMPTY_ARRAY;

            // 2. Extract unique lead IDs
            const leadIds = Array.from(new Set(demos.map(d => d.lead_id).filter(Boolean)));
            if (leadIds.length === 0) return demos.map(d => ({ ...d, lead: null }));

            // 3. Fetch corresponding leads to perform client-side join
            const { data: leads, error: leadError } = await supabase
                .from("leads")
                .select("*")
                .in("id", leadIds);
            if (leadError) {
                console.error("Error fetching leads for demo requests:", leadError);
                throw leadError;
            }

            // 4. Map/Merge leads to their demo requests client-side
            const leadMap = new Map(leads?.map(l => [l.id, l]) || []);
            return demos.map(d => ({
                ...d,
                lead: leadMap.get(d.lead_id) || null
            }));
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options,
        enabled: !!user?.id && (options.enabled !== undefined ? options.enabled : true)
    });

    return { 
        leads: leadsData || EMPTY_ARRAY, 
        demoRequests: demoRequestsData || EMPTY_ARRAY, 
        isLoading: isLoadingLeads || isLoadingDemos 
    };
}

// ============================================
// REQUESTS HOOK
// ============================================
export function useRequests(options: any = {}) {
    const { user } = useAuth();
    
    const { data, ...rest } = useQuery({
        queryKey: ["requests"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("requests")
                .select("*, submitted_by:profiles!submitted_by(*)")
                .eq("status", "pending")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options,
        enabled: !!user && (options.enabled !== undefined ? options.enabled : true)
    });
    return { data: data || EMPTY_ARRAY, ...rest };
}

// ============================================
// MEETINGS HOOK
// ============================================
export function useMeetings(options: any = {}) {
    const { user } = useAuth();
    
    const { data, ...rest } = useQuery({
        queryKey: ["meetings"],
        queryFn: async () => {
            const now = new Date().toISOString();
            const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const { data, error } = await supabase
                .from("meetings")
                .select("*")
                .gte("scheduled_at", now)
                .lte("scheduled_at", nextWeek)
                .order("scheduled_at", { ascending: true });
            if (error) throw error;
            return data;
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options,
        enabled: !!user && (options.enabled !== undefined ? options.enabled : true)
    });
    return { data: data || EMPTY_ARRAY, ...rest };
}

// ============================================
// CEO DIRECTIVES HOOK (Separate table)
// ============================================
export function useCeoDirectives(options: any = {}) {
    const { user, userRole } = useAuth();
    return useQuery({
        queryKey: ["ceo_directives", userRole],
        queryFn: async () => {
            if (userRole !== 'CEO') return [];
            const { data, error } = await supabase
                .from("ceo_directives")
                .select("*")
                .eq("is_active", true)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options,
        enabled: !!user && userRole === 'CEO' && (options.enabled !== undefined ? options.enabled : true)
    });
}

// ============================================
// STAFF DIRECTIVES HOOK
// ============================================
export function useStaffDirectives(options: any = {}) {
    const { user } = useAuth();
    return useQuery({
        queryKey: ["staff_directives"],
        queryFn: async () => {
            try {
                const { data, error } = await supabase
                    .from("staff_directives")
                    .select("*")
                    .order("created_at", { ascending: false });
                if (error) {
                    console.warn(`[useStaffDirectives] Query failed with code ${error.code}: ${error.message}`);
                    return EMPTY_ARRAY;
                }
                return data || EMPTY_ARRAY;
            } catch (err: any) {
                console.warn("[useStaffDirectives] Exception caught fetching staff_directives:", err.message || err);
                return EMPTY_ARRAY;
            }
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options,
        enabled: !!user && (options.enabled !== undefined ? options.enabled : true)
    });
}

// ============================================
// STAFF PERFORMANCE SUMMARY HOOK
// ============================================
export function useStaffPerformanceSummary(options: any = {}) {
    const { user, userRole } = useAuth();
    const isAuthorized = userRole === 'CEO' || userRole === 'MANAGER';

    return useQuery({
        queryKey: ["staff_performance_summary", userRole],
        queryFn: async () => {
            if (!isAuthorized) {
                console.warn("[useStaffPerformanceSummary] Access restricted to CEO or MANAGER roles. Skipping query.");
                return EMPTY_ARRAY;
            }
            try {
                const { data, error } = await supabase
                    .from("staff_performance_summary")
                    .select("*")
                    .order("completion_rate", { ascending: false });
                if (error) {
                    console.warn(`[useStaffPerformanceSummary] Query failed with code ${error.code}: ${error.message}`);
                    return EMPTY_ARRAY;
                }
                return data || EMPTY_ARRAY;
            } catch (err: any) {
                console.warn("[useStaffPerformanceSummary] Exception caught fetching staff_performance_summary:", err.message || err);
                return EMPTY_ARRAY;
            }
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options,
        enabled: !!user && isAuthorized && (options.enabled !== undefined ? options.enabled : true)
    });
}

// ============================================
// CEO STAFF PRESENCE HOOK
// ============================================
export function useCeoStaffPresence(options: any = {}) {
    const { user, userRole } = useAuth();
    const isAuthorized = userRole === 'CEO';

    return useQuery({
        queryKey: ["ceo_staff_presence", userRole],
        queryFn: async () => {
            if (!isAuthorized) {
                console.warn("[useCeoStaffPresence] Access restricted to CEO role. Skipping query.");
                return EMPTY_ARRAY;
            }
            try {
                const { data, error } = await supabase
                    .from("ceo_staff_presence")
                    .select("*")
                    .order("updated_at", { ascending: false });
                if (error) {
                    console.warn(`[useCeoStaffPresence] Query failed with code ${error.code}: ${error.message}`);
                    return EMPTY_ARRAY;
                }
                return data || EMPTY_ARRAY;
            } catch (err: any) {
                console.warn("[useCeoStaffPresence] Exception caught fetching ceo_staff_presence:", err.message || err);
                return EMPTY_ARRAY;
            }
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options,
        enabled: !!user && isAuthorized && (options.enabled !== undefined ? options.enabled : true)
    });
}

// ============================================
// FINANCIAL ENTRIES HOOK
// ============================================
export function useFinancialEntries(options: any = {}) {
    const { user } = useAuth();
    
    return useQuery({
        queryKey: ["financial-entries"],
        queryFn: async () => {
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split("T")[0];

            const { data, error } = await supabase
                .from("financial_entries")
                .select("*")
                .gte("entry_date", sixtyDaysAgoStr)
                .order("entry_date", { ascending: false });

            if (error) throw error;
            return data || [];
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options,
        enabled: !!user && (options.enabled !== undefined ? options.enabled : true)
    });
}

// ============================================
// DAILY REPORTS HOOK
// ============================================
export function useDailyReports(options: any = {}) {
    const { user } = useAuth();
    
    return useQuery({
        queryKey: ["daily-reports"],
        queryFn: async () => {
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split("T")[0];

            const { data, error } = await supabase
                .from("daily_reports")
                .select("*")
                .gte("report_date", sixtyDaysAgoStr)
                .order("report_date", { ascending: false });

            if (error) throw error;
            return data || [];
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options,
        enabled: !!user && (options.enabled !== undefined ? options.enabled : true)
    });
}

// ============================================
// ACADEMY SALES TARGETS HOOK
// ============================================
export function useSalesTargets(options: any = {}) {
    const { user } = useAuth();
    
    return useQuery({
        queryKey: ["sales-targets"],
        queryFn: async () => {
            const currentMonth = new Date();
            currentMonth.setDate(1);
            const monthStr = currentMonth.toISOString().split("T")[0];

            const { data, error } = await supabase
                .from("academy_sales_targets")
                .select("*")
                .eq("target_month", monthStr)
                .maybeSingle();

            if (error) throw error;
            return data || { target_month: monthStr, leads_target: 1000, evaluation_target: 70, conversion_target: 15 };
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options,
        enabled: !!user && (options.enabled !== undefined ? options.enabled : true)
    });
}


