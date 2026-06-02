"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

interface NetworkStatus {
  isOnline: boolean;
  isReconnecting: boolean;
  lastOnline: Date | null;
  checkConnection: () => Promise<boolean>;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [lastOnline, setLastOnline] = useState<Date | null>(new Date());

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      // Attempt to fetch a small resource to verify actual connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch('/api/health-check', { 
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store'
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      // Fallback to navigator.onLine if fetch fails
      return navigator.onLine;
    }
  }, []);

  const isOnlineRef = useRef(isOnline);
  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let toastId: string | number | null = null;

    const handleOnline = async () => {
      setIsReconnecting(true);
      
      // Show reconnecting toast
      toastId = toast.loading(
        <div className="flex items-center gap-3">
          <RefreshCw className="w-4 h-4 animate-spin text-orange-500" />
          <div>
            <p className="font-semibold text-sm">Reconnecting...</p>
            <p className="text-xs text-white/60">Restablishing secure connection</p>
          </div>
        </div>,
        { duration: Infinity }
      );

      // Verify actual connectivity
      const hasConnection = await checkConnection();
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      // Give it a moment to stabilize
      reconnectTimeout = setTimeout(() => {
        setIsOnline(hasConnection);
        setIsReconnecting(false);
        setLastOnline(new Date());
        
        if (toastId) {
          toast.dismiss(toastId);
        }
        
        if (hasConnection) {
          toast.success(
            <div className="flex items-center gap-3">
              <Wifi className="w-4 h-4 text-emerald-500" />
              <div>
                <p className="font-semibold text-sm">Connection Restored</p>
                <p className="text-xs text-white/60">AcademyOS is back online</p>
              </div>
            </div>,
            { duration: 3000 }
          );
        }
      }, 1500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsReconnecting(false);
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      toast.error(
        <div className="flex items-center gap-3">
          <WifiOff className="w-4 h-4 text-red-500" />
          <div>
            <p className="font-semibold text-sm">Connection Lost</p>
            <p className="text-xs text-white/60">Working offline - changes will sync when reconnected</p>
          </div>
        </div>,
        { 
          duration: 5000,
          id: 'offline-toast'
        }
      );
    };

    // Set initial state - only if different to avoid unnecessary re-renders
    const currentOnLine = navigator.onLine;
    if (isOnlineRef.current !== currentOnLine) {
        setIsOnline(currentOnLine);
    }

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Also listen for visibility change to check connection when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isOnlineRef.current) {
        handleOnline();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [checkConnection]);

  return {
    isOnline,
    isReconnecting,
    lastOnline,
    checkConnection,
  };
}

// Hook to monitor API health and show degradation warnings
export function useApiHealth(): { isHealthy: boolean; latency: number } {
  const [isHealthy, setIsHealthy] = useState(true);
  const [latency, setLatency] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkHealth = async () => {
      const start = performance.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        await fetch('/api/health-check', { 
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store'
        });
        
        clearTimeout(timeoutId);
        
        const end = performance.now();
        const currentLatency = end - start;
        setLatency(currentLatency);
        setIsHealthy(currentLatency < 5000); // Consider unhealthy if latency > 5s
      } catch {
        setIsHealthy(false);
      }
    };

    // Check immediately and then every 30 seconds
    checkHealth();
    interval = setInterval(checkHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  return { isHealthy, latency };
}
