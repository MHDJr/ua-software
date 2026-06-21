"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

export interface BadgeCounts {
  pendingRequests: number;
  victories: number;
  unreadNotifications: number;
}

export function useBadgeCounts() {
  const { user, loading: authLoading } = useAuth();
  const [badgeCounts, setBadgeCounts] = useState<BadgeCounts>({
    pendingRequests: 0,
    victories: 0,
    unreadNotifications: 0,
  });
  const [loading, setLoading] = useState(true);
  const subscriptionsRef = useRef<any[]>([]);

  const fetchBadgeCounts = useCallback(async (isMounted: boolean = true) => {
    try {
      // Fetch data in parallel
      const today = new Date().toISOString().split('T')[0];
      const queries: any[] = [
        supabase.from("requests").select("id", { count: "exact" }).eq("status", "pending").eq("signal_cleared", false),
        supabase.from("tasks").select("id", { count: "exact" }).eq("status", "completed").gte("updated_at", today)
      ];

      if (user?.id) {
        queries.push(
          supabase.from("ideas").select("id", { count: "exact" }).eq("status", "active")
        );
      }

      const results = await Promise.all(queries);
      const pendingRes = results[0];
      const victoriesRes = results[1];
      const ideasRes = user?.id ? results[2] : { count: 0 };

      if (isMounted) {
        setBadgeCounts({
          pendingRequests: pendingRes.count || 0,
          victories: victoriesRes.count || 0,
          unreadNotifications: ideasRes?.count || 0,
        });
      }
    } catch (error) {
      console.error("Error fetching badge counts:", error);
    } finally {
      if (isMounted) setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    let isMounted = true;
    let debounceTimer: NodeJS.Timeout;

    const debouncedFetch = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isMounted) fetchBadgeCounts(isMounted);
      }, 500); // 500ms debounce
    };

    const setupSubscriptions = () => {
      // 1. If older subscriptions exist, remove/unsubscribe them first to avoid memory leaks
      if (subscriptionsRef.current && subscriptionsRef.current.length > 0) {
        subscriptionsRef.current.forEach(s => {
          if (s) {
            try {
              supabase.removeChannel(s).catch(err => {
                console.warn("Failed to remove old badge channel:", err);
              });
            } catch (e) {
              console.error("Failed to remove old badge channel reference:", e);
            }
          }
        });
        subscriptionsRef.current = [];
      }
      
      const instanceId = Math.random().toString(36).substring(7);
      console.log(`Setting up badge count realtime subscriptions (instance: ${instanceId})...`);
      
      const requestsSub = supabase
        .channel(`badge-requests-changes-${instanceId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, debouncedFetch)
        .subscribe();

      const tasksSub = supabase
        .channel(`badge-tasks-changes-${instanceId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, debouncedFetch)
        .subscribe();
        
      const ideasSub = supabase
        .channel(`badge-ideas-changes-${instanceId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "ideas" }, debouncedFetch)
        .subscribe();
        
      subscriptionsRef.current = [requestsSub, tasksSub, ideasSub];
    };

    fetchBadgeCounts(isMounted);
    setupSubscriptions();

    // Refresh counts every 60 seconds as fallback
    const interval = setInterval(() => {
      if (isMounted) fetchBadgeCounts(isMounted);
    }, 60000);

    // Listen for global resync event
    const handleResync = () => {
      if (isMounted) fetchBadgeCounts(isMounted);
    };

    // Listen for reconnection event
    const handleReconnect = () => {
      if (isMounted) setupSubscriptions();
    };

    // Listen for custom channels reset event to bind fresh channels
    const handleChannelsReset = () => {
      if (isMounted) {
        console.log("Badge counts: Supabase channels reset event detected, re-initializing subscriptions...");
        setupSubscriptions();
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("academyos-global-resync", handleResync);
      window.addEventListener("academyos-reconnect-realtime", handleReconnect);
      window.addEventListener("supabase-channels-reset", handleChannelsReset);
    }

    return () => {
      isMounted = false;
      clearTimeout(debounceTimer);
      
      // Clean up subscriptionsRef on unmount
      if (subscriptionsRef.current && subscriptionsRef.current.length > 0) {
        subscriptionsRef.current.forEach(s => {
          if (s) {
            try {
              supabase.removeChannel(s).catch(err => {
                // Silently swallow cleanup rejections
              });
            } catch (e) {
              console.error("Failed to clean up badge channel on unmount:", e);
            }
          }
        });
      }
      
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("academyos-global-resync", handleResync);
        window.removeEventListener("academyos-reconnect-realtime", handleReconnect);
        window.removeEventListener("supabase-channels-reset", handleChannelsReset);
      }
    };
  }, [user, authLoading, fetchBadgeCounts]);

  return React.useMemo(() => ({ 
    badgeCounts, 
    loading, 
    refetch: fetchBadgeCounts 
  }), [badgeCounts, loading]);
}
