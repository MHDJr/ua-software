"use client";

import { useEffect, useRef } from "react";
import { focusManager, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";

// Throttling duration: 10 seconds cooldown between automatic focus syncs
const SYNC_THROTTLE_MS = 10000;

/**
 * Hook to synchronize application state with the backend when the window/app
 * gains focus or visibility. Optimized with cooldown throttle and safe connection resurrection.
 */
export const useWindowSync = () => {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const lockRef = useRef(false);
    const lastSyncTimeRef = useRef<number>(0);

    useEffect(() => {
        const handleSync = async () => {
            if (!user) {
                console.log("[Sync Engine] Skipping synchronization: No active user session.");
                return;
            }
            const now = Date.now();
            
            // Check throttle cooldown
            if (now - lastSyncTimeRef.current < SYNC_THROTTLE_MS) {
                console.log(`[Sync Throttled] Skipping refetch, last sync was ${((now - lastSyncTimeRef.current) / 1000).toFixed(1)}s ago.`);
                return;
            }

            if (lockRef.current) return;
            lockRef.current = true;

            try {
                console.log("[Sync Engine] Tab focused or active. Reactivating system thread...");
                
                // 1. Force-wake the Supabase Auth Client
                // This ensures the auth token is valid and the client is ready for mutations
                try {
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                    
                    if (sessionError || !session) {
                        console.warn("[Sync Engine] Session stale or missing. Attempting a silent refresh...");
                        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
                        if (refreshError) throw refreshError;
                        console.log("[Sync Engine] Session successfully refreshed.");
                    } else {
                        console.log("[Sync Engine] Supabase session verified.");
                    }
                } catch (authErr: any) {
                    const errMsg = authErr?.message || String(authErr);
                    const errName = authErr?.name;
                    if (
                        errName === "AbortError" ||
                        errMsg.includes("AbortError") ||
                        errMsg.includes("aborted") ||
                        errMsg.includes("signal is aborted")
                    ) {
                        console.warn("[Sync Engine] Auth verification aborted.");
                    } else {
                        console.error("[Sync Engine] Auth verification failed:", authErr);
                    }
                }

                // 2. Heartbeat check: Ensure the REST API is responsive
                // This "pokes" the backend to ensure the connection isn't "stuck"
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000);
                    
                    try {
                        const { error } = await supabase
                            .from("profiles")
                            .select("id")
                            .limit(1)
                            .abortSignal(controller.signal);
                        
                        if (error) throw error;
                        console.log("[Sync Engine] Backend heartbeat OK.");
                    } finally {
                        clearTimeout(timeoutId);
                    }
                } catch (heartbeatErr: any) {
                    if (heartbeatErr?.name === "AbortError") {
                        console.warn("[Sync Engine] Backend heartbeat timed out (3s limit reached). Connection may be stuck.");
                    } else {
                        console.warn("[Sync Engine] Backend heartbeat failed or timed out. Connection may be stuck:", heartbeatErr);
                    }
                    // No action needed other than logging, refetchQueries will handle the retry
                }

                // 3. Alert TanStack Query that the app is focused
                focusManager.setFocused(true);
                
                // Smart active query refetch. This gracefully cancels previous fetches and gets new data
                await queryClient.refetchQueries(
                    { type: "active" },
                    { cancelRefetch: true }
                );

                // Update the last sync timestamp
                lastSyncTimeRef.current = Date.now();

                // WebSocket Health check: Attempt to resurrect rather than blind teardown
                const channels = supabase.getChannels();
                const hasChokedChannel = channels.some(ch => ch.state !== "joined");
                
                if (hasChokedChannel || channels.length === 0) {
                    console.log("Removing stalled or missing Supabase channels...");
                    await supabase.removeAllChannels();
                    if (typeof window !== "undefined") {
                        console.log("Emitting global academyos-reconnect-realtime event...");
                        window.dispatchEvent(new Event("supabase-channels-reset"));
                        window.dispatchEvent(new CustomEvent("academyos-reconnect-realtime"));
                    }
                } else {
                    console.log("All Supabase channels are healthy and 'joined'. Ensuring socket is connected...");
                    // Fast check to ensure the websocket is active
                    if (supabase.realtime && !supabase.realtime.isConnected()) {
                        supabase.realtime.connect();
                    }
                }

                // Seamless global resync event for other tab-resilient components
                if (typeof window !== "undefined") {
                    console.log("Emitting global academyos-global-resync event...");
                    window.dispatchEvent(new CustomEvent("academyos-global-resync"));
                }

            } catch (err) {
                console.error("Failed to synchronize application state:", err);
            } finally {
                lockRef.current = false;
            }
        };

        // --- Browser Events ---
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                handleSync();
            }
        };

        const handleFocus = () => {
            if (document.visibilityState === "visible") {
                // ALWAYS ensure the real-time socket is connected on every focus
                // regardless of the sync throttle
                if (supabase.realtime && !supabase.realtime.isConnected()) {
                    console.log("[Sync Engine] Reconnecting real-time socket...");
                    supabase.realtime.connect();
                }
                handleSync();
            }
        };

        const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
            const reason = event.reason;
            const errMsg = reason?.message || String(reason);
            const errName = reason?.name;
            if (
                errName === "AbortError" || 
                errMsg.includes("AbortError") || 
                errMsg.includes("aborted") ||
                errMsg.includes("signal is aborted")
            ) {
                console.warn("[Sync Engine] Unhandled abort promise rejection captured and suppressed:", reason);
                event.preventDefault(); // Prevents the default browser error output in console
            }
        };

        window.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("focus", handleFocus);
        window.addEventListener("unhandledrejection", handleUnhandledRejection);

        // --- Periodic Heartbeat (Every 30 seconds) ---
        // Ensures the connection stays active even without tab switching
        const heartbeatInterval = setInterval(() => {
            console.log("[Sync Engine] Periodic background heartbeat...");
            handleSync();
        }, 30000);

        return () => {
            window.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("focus", handleFocus);
            window.removeEventListener("unhandledrejection", handleUnhandledRejection);
            clearInterval(heartbeatInterval);
        };
    }, [queryClient, user]);
};
