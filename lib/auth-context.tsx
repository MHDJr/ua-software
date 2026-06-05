"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase, Profile } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface AuthContextType {
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    userRole: 'CEO' | 'MANAGER' | null;
    signIn: (email: string, password: string) => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<'CEO' | 'MANAGER' | null>(null);
    const router = useRouter();

    const sessionCheckPromise = useRef<Promise<void> | null>(null);
    const isSessionResolved = useRef(false);
    const lastCheckedUserIdRef = useRef<string | null>(null);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (!isMounted) return;
        let isEffectMounted = true;

        // 1. Check for cached profile to speed up initial render
        if (typeof window !== "undefined") {
            const cachedProfile = sessionStorage.getItem("ua_profile");
            if (cachedProfile) {
                try {
                    const parsed = JSON.parse(cachedProfile);
                    if (isEffectMounted) {
                        setProfile(parsed);
                        // Fast role determination
                        if (parsed.role === 'ceo') setUserRole('CEO');
                        else if (parsed.is_manager || parsed.role === 'manager') setUserRole('MANAGER');
                    }
                } catch (e) {
                    sessionStorage.removeItem("ua_profile");
                }
            }
        }

        // Safety fallback timeout to ensure the loading state settles to false
        const safetyTimeout = setTimeout(() => {
            if (isEffectMounted) {
                console.warn("[AuthContext] Safety fallback timeout triggered (4s). Forcing loading state to settle.");
                isSessionResolved.current = true;
                setLoading(false);
            }
        }, 4000); // Reduced from 6 seconds to 4 seconds

        // 2. Get initial session
        const getInitialSession = async () => {
            if (sessionCheckPromise.current) return sessionCheckPromise.current;

            sessionCheckPromise.current = (async () => {
                try {
                    let session: any = null;
                    try {
                        const { data: { session: activeSession } } = await supabase.auth.getSession();
                        session = activeSession;
                    } catch (err: any) {
                        if (err?.name === "AbortError") {
                            console.warn("[AuthContext] Initial session fetch aborted.");
                            return; // Quietly catch abort errors
                        }
                        throw err;
                    }

                    if (!isEffectMounted) return;

                    if (session) {
                        setUser(session.user);
                        lastCheckedUserIdRef.current = session.user.id;
                        await fetchProfile(session.user.id);
                    } else {
                        setUser(null);
                        setProfile(null);
                        setUserRole(null);
                        lastCheckedUserIdRef.current = null;
                    }
                } catch (error: any) {
                    if (error?.name === "AbortError") {
                        return; // Quietly catch abort errors
                    }
                    const errorName = error?.name || "";
                    const errorMessage = error?.message || "";
                    const isAbort = errorName === 'AbortError' || 
                                    errorMessage.includes('AbortError') ||
                                    errorName === 'AuthSessionMissingError' ||
                                    errorMessage.includes('AuthSessionMissingError');
                    if (isAbort) {
                        console.warn("Session check aborted or missing safely:", errorMessage || error);
                    } else {
                        console.error("Error getting initial session:", error);
                    }
                    
                    if (!isEffectMounted) return;
                    // Fallback gracefully: settle state
                    setUser(null);
                    setProfile(null);
                    setUserRole(null);
                    lastCheckedUserIdRef.current = null;
                } finally {
                    if (isEffectMounted) {
                        clearTimeout(safetyTimeout);
                        isSessionResolved.current = true;
                        setLoading(false);
                    }
                }
            })();

            return sessionCheckPromise.current;
        };

        getInitialSession();

        // 3. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                // Ensure initial session check has resolved first
                if (!isSessionResolved.current) {
                    if (sessionCheckPromise.current) {
                        try {
                            await sessionCheckPromise.current;
                        } catch (err: any) {
                            if (err?.name === "AbortError") return;
                            console.error("Error waiting for initial session in auth state change listener:", err);
                        }
                    }
                }

                if (!isEffectMounted) return;

                const sessionUserId = session?.user?.id || null;
                // De-duplicate: do not trigger re-render / fetch if user has not changed
                if (sessionUserId === lastCheckedUserIdRef.current && isSessionResolved.current) {
                    return;
                }
                lastCheckedUserIdRef.current = sessionUserId;

                if (isEffectMounted) {
                    setLoading(true);
                }

                try {
                    if (session) {
                        if (isEffectMounted) setUser(session.user);
                        await fetchProfile(session.user.id);
                    } else {
                        if (isEffectMounted) {
                            setUser(null);
                            setProfile(null);
                            setUserRole(null);
                        }
                    }
                } catch (error: any) {
                    if (error?.name === "AbortError") return;
                    console.error("Error in onAuthStateChange handler:", error);
                } finally {
                    if (isEffectMounted) {
                        setLoading(false);
                    }
                }
            }
        );

        return () => {
            isEffectMounted = false;
            subscription.unsubscribe();
            clearTimeout(safetyTimeout);
        };
    }, [isMounted]);

    useEffect(() => {
        if (!isMounted) return;
        if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
            return;
        }

        const showUpdateToast = (worker: ServiceWorker) => {
            toast.info("New operational update available.", {
                description: "A new version of the dashboard is ready.",
                action: {
                    label: "Refresh Now",
                    onClick: () => {
                        worker.postMessage({ type: "SKIP_WAITING" });
                        window.location.reload();
                    },
                },
                duration: Infinity, // Keep the toast visible
            });
        };

        // Register the service worker sw.js
        navigator.serviceWorker.register("/sw.js").then((reg) => {
            // Check if there is an update already waiting
            if (reg.waiting) {
                showUpdateToast(reg.waiting);
            }

            // Listen for any new service worker update installs
            reg.addEventListener("updatefound", () => {
                const newWorker = reg.installing;
                if (newWorker) {
                    newWorker.addEventListener("statechange", () => {
                        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                            showUpdateToast(newWorker);
                        }
                    });
                }
            });
        }).catch((err) => {
            console.error("[ServiceWorker] Registration failed:", err);
        });

        // Controllerchange fires when the active service worker changes (e.g. via skipWaiting)
        let refreshing = false;
        const handleControllerChange = () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        };

        navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

        // Periodically check for service worker updates every 5 minutes and on window focus
        const checkUpdates = async () => {
            try {
                const reg = await navigator.serviceWorker.ready;
                await reg.update();
            } catch (err) {
                console.debug("[ServiceWorker] Update check skipped:", err);
            }
        };

        const interval = setInterval(checkUpdates, 5 * 60 * 1000);
        window.addEventListener("focus", checkUpdates);

        return () => {
            clearInterval(interval);
            window.removeEventListener("focus", checkUpdates);
            navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
        };
    }, [isMounted]);

    const fetchProfile = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();

            if (!isMountedRef.current) return;

            if (!error && data) {
                const p = data as Profile;
                setProfile(p);
                if (typeof window !== "undefined") {
                    sessionStorage.setItem("ua_profile", JSON.stringify(p));
                }
                // Determine user role based on profile
                if (p.role === 'ceo') {
                    setUserRole('CEO');
                } else if (p.is_manager || p.role === 'manager') {
                    setUserRole('MANAGER');
                } else {
                    setUserRole(null);
                }
            }
        } catch (err: any) {
            if (err?.name === "AbortError") return;
            console.error("Error fetching profile:", err);
        }
    };

    const signIn = async (email: string, password: string) => {
        if (typeof window !== "undefined") {
            sessionStorage.removeItem("ua_profile");
        }
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
    };

    const signOut = async () => {
        if (typeof window !== "undefined") {
            sessionStorage.removeItem("ua_profile");
        }
        await supabase.auth.signOut();
        router.push("/auth");
    };

    const refreshProfile = async () => {
        if (user) {
            await fetchProfile(user.id);
        }
    };

    const value = React.useMemo(() => ({
        user,
        profile,
        loading,
        userRole,
        signIn,
        signOut,
        refreshProfile
    }), [user, profile, loading, userRole, signIn, signOut, refreshProfile]);

    if (!isMounted) {
        return null; // Bypasses the broken pre-rendered HTML snapshot completely until the client engine is active
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
