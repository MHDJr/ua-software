"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from "react";
import { toast } from "sonner";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

interface NetworkStatusContextType {
  isOnline: boolean;
  isReconnecting: boolean;
  lastOnline: Date | null;
}

const NetworkStatusContext = createContext<NetworkStatusContextType>({
  isOnline: true,
  isReconnecting: false,
  lastOnline: new Date(),
});

export function useNetworkStatusContext() {
  return useContext(NetworkStatusContext);
}

export function NetworkStatusProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [lastOnline, setLastOnline] = useState<Date | null>(new Date());
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
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
      return navigator.onLine;
    }
  }, []);

  const isOnlineRef = useRef(isOnline);
  const hasShownOfflineToastRef = useRef(hasShownOfflineToast);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    hasShownOfflineToastRef.current = hasShownOfflineToast;
  }, [hasShownOfflineToast]);

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let toastId: string | number | null = null;

    const handleOnline = async () => {
      setIsReconnecting(true);
      
      // Show reconnecting toast
      toastId = toast.loading(
        React.createElement('div', { className: 'flex items-center gap-3' },
          React.createElement(RefreshCw, { className: 'w-4 h-4 animate-spin text-orange-500' }),
          React.createElement('div', {},
            React.createElement('p', { className: 'font-semibold text-sm' }, 'Reconnecting...'),
            React.createElement('p', { className: 'text-xs text-white/60' }, 'Restablishing secure connection')
          )
        ),
        { duration: Infinity }
      );

      const hasConnection = await checkConnection();
      
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }

      reconnectTimeout = setTimeout(() => {
        setIsOnline(hasConnection);
        setIsReconnecting(false);
        setHasShownOfflineToast(false);
        
        if (toastId) {
          toast.dismiss(toastId);
        }
        
        if (hasConnection) {
          setLastOnline(new Date());
          toast.success(
            React.createElement('div', { className: 'flex items-center gap-3' },
              React.createElement(Wifi, { className: 'w-4 h-4 text-emerald-500' }),
              React.createElement('div', {},
                React.createElement('p', { className: 'font-semibold text-sm' }, 'Connection Restored'),
                React.createElement('p', { className: 'text-xs text-white/60' }, 'AcademyOS is back online')
              )
            ),
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

      if (!hasShownOfflineToastRef.current) {
        setHasShownOfflineToast(true);
        toast.error(
          React.createElement('div', { className: 'flex items-center gap-3' },
            React.createElement(WifiOff, { className: 'w-4 h-4 text-red-500' }),
            React.createElement('div', {},
              React.createElement('p', { className: 'font-semibold text-sm' }, 'Connection Lost'),
              React.createElement('p', { className: 'text-xs text-white/60' }, 'Working offline - changes will sync when reconnected')
            )
          ),
          { 
            duration: 5000,
            id: 'offline-toast'
          }
        );
      }
    };

    // Set initial state only if needed
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

  const value = React.useMemo(() => ({
    isOnline,
    isReconnecting,
    lastOnline,
  }), [isOnline, isReconnecting, lastOnline]);

  return (
    React.createElement(NetworkStatusContext.Provider, { value }, children)
  );
}
