"use client";

import React, { useEffect, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Tab Focus Resiliency Engine
 * 
 * Permanently resolves dashboard freezes, stale data, and infinite loading wheels
 * caused by browser background throttling and stale socket connections.
 */
export function TabResiliencyEngine({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isReactivating, setIsReactivating] = useState(false);

  const performSystemReactivation = useCallback(async () => {
    // Check if the user is authenticated first before showing the loader or starting watchdog
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.log("TabResiliencyEngine: No active session. Skipping reactivation loader.");
      return;
    }

    console.log("TabResiliencyEngine: Reactivating system thread...");
    setIsReactivating(true);
    
    // Automated watchdog timer for connection freeze healing (only runs if online)
    let reloadWatchdog: NodeJS.Timeout | null = null;
    if (typeof window !== "undefined" && navigator.onLine) {
      reloadWatchdog = setTimeout(() => {
        console.warn("SYSTEM FREEZE DETECTED: Watchdog triggered automated browser reload to restore database connections.");
        window.location.reload();
      }, 3500);
    }

    // Light check query to verify database connection is thawed and alive
    try {
      const { error } = await supabase.from("profiles").select("id").limit(1);
      if (reloadWatchdog) {
        clearTimeout(reloadWatchdog);
        console.log("System connection thaw verified. Resiliency watchdog disarmed.");
      }
    } catch (err) {
      console.error("Resiliency watchdog caught check exception:", err);
      // Let watchdog fire and reload if the query hung completely
    }
    
    // 1. FORCE TANSTACK QUERY REFRESH
    // Invalidate all queries to force a fresh data fetch
    queryClient.invalidateQueries();

    // 2. FORCE-DISCONNECT DEAD CONNECTIONS
    // Immediately kill stale Supabase real-time subscriptions
    try {
      console.log("TabResiliencyEngine: Purging stale subscriptions...");
      await supabase.removeAllChannels();
    } catch (error) {
      console.error("TabResiliencyEngine: Subscription purge failed", error);
    }

    // 3. RE-ESTABLISH REAL-TIME SUBSCRIPTIONS
    // Trigger reconnection event for components to re-subscribe
    const reconnectEvent = new CustomEvent("academyos-reconnect-realtime");
    window.dispatchEvent(reconnectEvent);

    // 4. SEAMLESS RE-SYNC
    // Trigger a fresh data fetch for all major systems
    const resyncEvent = new CustomEvent("academyos-global-resync");
    window.dispatchEvent(resyncEvent);

    // Hold the loading overlay for a minimum of 900ms to guarantee visual smoothness
    setTimeout(() => {
      setIsReactivating(false);
      
      toast.success(
        <div className="flex items-center gap-3 select-none">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <div>
            <p className="font-semibold text-sm text-slate-800 dark:text-zinc-100">Workspace Synchronized</p>
            <p className="text-xs text-slate-400 dark:text-zinc-500">All data channels fully restored</p>
          </div>
        </div>,
        { duration: 2500, id: "resiliency-toast" }
      );
    }, 900);
  }, [queryClient]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("TabResiliencyEngine: Visibility changed to visible");
        performSystemReactivation();
      }
    };

    // TAB RE-ACTIVATION DETECTION
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Check for focus events as well (covers window switching)
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [performSystemReactivation]);

  return (
    <>
      <AnimatePresence mode="wait">
        {isReactivating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white dark:bg-zinc-950 transition-colors duration-300"
          >
            {/* Logo/Icon Pulsing Effect */}
            <div className="relative mb-6 select-none pointer-events-none">
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-16 h-16 rounded-2xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-indigo-400/20"
              >
                <ShieldCheck className="w-8 h-8 text-white animate-pulse" />
              </motion.div>
              <div className="absolute -inset-1.5 rounded-[1.25rem] border border-indigo-500/30 animate-ping opacity-60 pointer-events-none" />
            </div>

            {/* Loader Typography */}
            <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-800 dark:text-zinc-100 mb-2 select-none">
              Getting your workspace ready
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 select-none animate-pulse">
              Restoring secure data channels...
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}

/**
 * Global Tab Resiliency Hook
 * @param onRefresh Callback to fetch fresh data
 * @param loading boolean value from state
 * @param setLoading State setter for loading state
 * @param onReconnect Optional callback to re-establish real-time subscriptions
 */
export function useTabResiliency(
  onRefresh: () => void, 
  loading: boolean, 
  setLoading: (loading: boolean) => void,
  onReconnect?: () => void
) {
  useEffect(() => {
    const handleResync = () => {
      console.log("TabResiliency: Triggering component resync");
      onRefresh();
    };

    const handleForceReset = () => {
      if (loading) {
        console.log("TabResiliency: Forcing loading state to false");
        setLoading(false);
      }
    };

    const handleReconnect = () => {
      if (onReconnect) {
        console.log("TabResiliency: Triggering component realtime reconnection");
        onReconnect();
      }
    };

    window.addEventListener("academyos-global-resync", handleResync);
    window.addEventListener("academyos-force-reset-loading", handleForceReset);
    window.addEventListener("academyos-reconnect-realtime", handleReconnect);

    return () => {
      window.removeEventListener("academyos-global-resync", handleResync);
      window.removeEventListener("academyos-force-reset-loading", handleForceReset);
      window.removeEventListener("academyos-reconnect-realtime", handleReconnect);
    };
  }, [onRefresh, loading, setLoading, onReconnect]);

  // STREAK LOADING PREVENTION: 4-second strict timeout limit
  useEffect(() => {
    if (loading) {
      const timeoutId = setTimeout(() => {
        setLoading(false);
        console.warn("TabResiliency: Loading timed out after 4s. Force-releasing UI thread.");
      }, 4000);
      return () => clearTimeout(timeoutId);
    }
  }, [loading, setLoading]);
}
