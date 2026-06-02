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
    const { data: activeTasksData, isLoading: isLoadingActive, isFetching: isFetchingActive } = useQuery({
        queryKey: ["tasks", "active"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tasks")
                .select("id, title, description, assigned_to, priority, status, progress, due_date, created_by, created_at, updated_at, repeat_daily, is_daily_task, assigned_to_user:profiles!assigned_to(full_name, department), creator:profiles!created_by(role, is_manager)")
                .not("status", "in", '("completed","deleted","COMPLETED")')
                .order("updated_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options
    });

    const { data: completedTasksData, isLoading: isLoadingCompleted, isFetching: isFetchingCompleted } = useQuery({
        queryKey: ["tasks", "completed"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("tasks")
                .select("id, title, description, assigned_to, priority, status, progress, due_date, created_by, created_at, updated_at, repeat_daily, is_daily_task, assigned_to_user:profiles!assigned_to(full_name, department), creator:profiles!created_by(role, is_manager)")
                .in("status", ["completed", "COMPLETED"])
                .is("reviewed_at", null)
                .order("updated_at", { ascending: false })
                .limit(50);
            if (error) throw error;
            return data;
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options
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
        ...options
    });
    return { data: data || EMPTY_ARRAY, ...rest };
}

// ============================================
// LEADS & DEMOS HOOK
// ============================================
export function useLeads(options: any = {}) {
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
        ...options
    });

    const { data: demoRequestsData, isLoading: isLoadingDemos } = useQuery({
        queryKey: ["demo_requests"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("demo_requests")
                .select("*, leads:leads(*)")
                .eq("status", "accepted")
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        ...DASHBOARD_QUERY_CONFIG,
        ...options
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
        ...options
    });
    return { data: data || EMPTY_ARRAY, ...rest };
}

// ============================================
// MEETINGS HOOK
// ============================================
export function useMeetings(options: any = {}) {
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
        ...options
    });
    return { data: data || EMPTY_ARRAY, ...rest };
}

// ============================================
// CEO DIRECTIVES HOOK (Separate table)
// ============================================
export function useCeoDirectives(options: any = {}) {
    const { userRole } = useAuth();
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
        ...options
    });
}
