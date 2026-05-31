"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { RealtimeChannel } from "@supabase/supabase-js";

export function useRealtimeTable<T extends { id: string; assigned_to?: string; created_by?: string }>(
  tableName: string = "tasks"
) {
  const [data, setData] = useState<T[]>([]);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  
  const router = useRouter();
  const channelRef = useRef<RealtimeChannel | null>(null);
  
  const tableNameRef = useRef(tableName);
  tableNameRef.current = tableName;

  // Decoupled task fetcher for a single record with relations
  const fetchSingleTaskWithRelations = useCallback(async (id: string) => {
    try {
      const { data: task, error } = await supabase
        .from("tasks")
        .select("*, assigned_to_user:profiles!assigned_to(full_name, department, designation, role), creator:profiles!created_by(full_name, role, designation, is_manager)")
        .eq("id", id)
        .single();
      
      if (error) {
        console.error("Error fetching task relations:", error);
        return null;
      }
      return task;
    } catch (err) {
      console.error("Exception in single task fetcher:", err);
      return null;
    }
  }, []);

  const fetchLatestSnapshot = useCallback(async () => {
    try {
      const name = tableNameRef.current;
      let query = supabase
        .from(name)
        .select(
          name === "tasks"
            ? "*, assigned_to_user:profiles!assigned_to(full_name, department, designation, role), creator:profiles!created_by(full_name, role, designation, is_manager)"
            : "*"
        )
        .order("created_at", { ascending: false });

      const { data: result, error } = await query;
      
      if (error) {
        console.error(`Error fetching snapshot for ${name}:`, error);
        return;
      }
      
      if (result) {
        setData(result as unknown as T[]);
      }
    } catch (err) {
      console.error(`Unexpected snapshot fetch error for ${tableNameRef.current}:`, err);
    }
  }, []);

  const setupRealtimeSubscription = useCallback(() => {
    const name = tableNameRef.current;

    // Strict Cleanup of any existing channel
    if (channelRef.current) {
      console.log(`Unsubscribing from existing channel for ${name}...`);
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`${name}-realtime-heal-channel`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: name },
        async (payload: any) => {
          console.log(`Realtime postgres change on ${name}:`, payload);
          const { eventType, new: newRecord, old: oldRecord } = payload;

          if (eventType === "INSERT") {
            setData((prev) => {
              // 1. Relation Field Race Condition Fix: Check if already present via Optimistic UI
              const alreadyExists = prev.some((item) => item.id === newRecord.id);
              if (alreadyExists) {
                // Keep the existing record (which has relations already injected)
                return prev;
              }
              
              // 2. If it's an external insert, fetch relations asynchronously
              if (name === "tasks") {
                fetchSingleTaskWithRelations(newRecord.id).then((fetchedTask) => {
                  if (fetchedTask) {
                    setData((current) => 
                      current.map((item) => item.id === newRecord.id ? (fetchedTask as unknown as T) : item)
                    );
                  }
                });
              }

              return [newRecord as T, ...prev];
            });
          } else if (eventType === "UPDATE") {
            setData((prev) => {
              const existing = prev.find((item) => item.id === newRecord.id);
              if (existing) {
                // Preserve relations on UPDATE event to avoid lag or layout flashing
                const merged: T = {
                  ...existing,
                  ...newRecord,
                  assigned_to_user: (existing as any).assigned_to_user,
                  creator: (existing as any).creator,
                };

                // If the assignee actually changed, trigger Decoupled Async query to fetch new profile metadata
                if (existing.assigned_to !== newRecord.assigned_to && name === "tasks") {
                  fetchSingleTaskWithRelations(newRecord.id).then((fetchedTask) => {
                    if (fetchedTask) {
                      setData((current) => 
                        current.map((item) => item.id === newRecord.id ? (fetchedTask as unknown as T) : item)
                      );
                    }
                  });
                }

                return prev.map((item) => (item.id === newRecord.id ? merged : item));
              } else {
                // Missing task in state: Fetch fully and insert
                if (name === "tasks") {
                  fetchSingleTaskWithRelations(newRecord.id).then((fetchedTask) => {
                    if (fetchedTask) {
                      setData((current) => {
                        if (current.some((item) => item.id === newRecord.id)) {
                          return current.map((item) => item.id === newRecord.id ? (fetchedTask as unknown as T) : item);
                        }
                        return [fetchedTask as unknown as T, ...current];
                      });
                    }
                  });
                }
                return [newRecord as T, ...prev];
              }
            });
          } else if (eventType === "DELETE") {
            setData((prev) => prev.filter((item) => item.id !== oldRecord.id));
          }
        }
      );

    channel.subscribe((status) => {
      console.log(`Realtime channel status for ${name}:`, status);
      if (status === "SUBSCRIBED") {
        setIsOnline(true);
      } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setIsOnline(false);
      }
    });

    channelRef.current = channel;
  }, [fetchSingleTaskWithRelations]);

  // Initial setup on mount
  useEffect(() => {
    fetchLatestSnapshot();
    setupRealtimeSubscription();

    return () => {
      // Strict Realtime Channel Cleanup
      if (channelRef.current) {
        console.log(`Cleaning up channel on unmount for ${tableNameRef.current}...`);
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchLatestSnapshot, setupRealtimeSubscription]);

  // Coordinate with AcademyOS Resiliency Engine custom events
  useEffect(() => {
    const handleReconnect = () => {
      console.log(`[useRealtimeTable] Received academyos-reconnect-realtime. Rebuilding channel for ${tableNameRef.current}...`);
      setupRealtimeSubscription();
    };

    const handleResync = () => {
      console.log(`[useRealtimeTable] Received academyos-global-resync. Silently re-fetching snapshot for ${tableNameRef.current}...`);
      fetchLatestSnapshot();
    };

    window.addEventListener("academyos-reconnect-realtime", handleReconnect);
    window.addEventListener("academyos-global-resync", handleResync);

    return () => {
      window.removeEventListener("academyos-reconnect-realtime", handleReconnect);
      window.removeEventListener("academyos-global-resync", handleResync);
    };
  }, [setupRealtimeSubscription, fetchLatestSnapshot]);

  // Self-Healing Recovery Routine for Tab Focus / Sleep Wakeup
  useEffect(() => {
    const handleTabHeal = async () => {
      if (document.visibilityState !== "visible") return;

      console.log(`Tab woke up. Healing realtime session for ${tableNameRef.current}...`);
      
      try {
        // 1. Wake up Auth Client with stale token checking
        let { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          console.warn("Session is stale or missing. Trying refreshSession fallback...");
          try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            if (refreshError || !refreshData.session) {
              console.error("Session refresh failed. Gracefully waiting for central auth provider.");
            } else {
              session = refreshData.session;
            }
          } catch (refreshException) {
            console.error("Exception during session refresh:", refreshException);
          }
        }

        // 2. Repair Broken Socket Handshake
        // Delay standalone healing by 200ms to allow central TabResiliencyEngine to complete channel purge
        setTimeout(async () => {
          const currentChannel = channelRef.current;
          if (!currentChannel || currentChannel.state !== "joined") {
            console.warn(`[useRealtimeTable Standalone Heal] Channel state is ${currentChannel?.state || "null"}. Re-subscribing...`);
            setupRealtimeSubscription();
          } else {
            console.log("[useRealtimeTable Standalone Heal] Channel connection is healthy.");
          }
        }, 200);

        // 3. Re-Sync Data gaps silently
        await fetchLatestSnapshot();
      } catch (recoveryError) {
        console.error("Telemetry healing failure:", recoveryError);
      }
    };

    document.addEventListener("visibilitychange", handleTabHeal);
    window.addEventListener("focus", handleTabHeal);

    return () => {
      document.removeEventListener("visibilitychange", handleTabHeal);
      window.removeEventListener("focus", handleTabHeal);
    };
  }, [fetchLatestSnapshot, setupRealtimeSubscription]);

  return { data, setData, isOnline };
}
