"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
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
      const taskSelection = "id, title, description, assigned_to, priority, status, progress, due_date, created_by, created_at, updated_at, repeat_daily, is_daily_task, assigned_to_user:profiles!assigned_to(full_name, department, designation, role), creator:profiles!created_by(full_name, role, designation, is_manager)";
      
      const { data: task, error } = await supabase
        .from("tasks")
        .select(taskSelection)
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
      
      // Select only required columns for tasks to optimize payload
      const taskSelection = "id, title, description, assigned_to, priority, status, progress, due_date, created_by, created_at, updated_at, repeat_daily, is_daily_task, assigned_to_user:profiles!assigned_to(full_name, department, designation, role), creator:profiles!created_by(full_name, role, designation, is_manager)";
      
      let query = supabase
        .from(name)
        .select(
          name === "tasks"
            ? taskSelection
            : "*"
        )
        .order("created_at", { ascending: false });

      // Limit snapshots to 100 most recent items to avoid massive state objects
      if (name === "tasks") {
        query = query.limit(100);
      }

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

    const instanceId = Math.random().toString(36).substring(7);
    const channel = supabase
      .channel(`${name}-realtime-${instanceId}`)
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

  return useMemo(() => ({ data, setData, isOnline }), [data, isOnline]);
}
