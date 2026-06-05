"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { supabase, Profile } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

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
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [userRole, setUserRole] = useState<'CEO' | 'MANAGER' | null>(null);
    const router = useRouter();

    const sessionCheckPromise = useRef<Promise<void> | null>(null);
    const isSessionResolved = useRef(false);
    const lastCheckedUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        // 1. Check for cached profile to speed up initial render
        if (typeof window !== "undefined") {
            const cachedProfile = sessionStorage.getItem("ua_profile");
            if (cachedProfile) {
                try {
                    const parsed = JSON.parse(cachedProfile);
                    setProfile(parsed);
                    // Fast role determination
                    if (parsed.role === 'ceo') setUserRole('CEO');
                    else if (parsed.is_manager || parsed.role === 'manager') setUserRole('MANAGER');
                } catch (e) {
                    sessionStorage.removeItem("ua_profile");
                }
            }
        }

        // 2. Get initial session
        const getInitialSession = async () => {
            if (sessionCheckPromise.current) return sessionCheckPromise.current;

            sessionCheckPromise.current = (async () => {
                try {
                    const { data: { session } } = await supabase.auth.getSession();
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
                    // Fallback gracefully: settle state
                    setUser(null);
                    setProfile(null);
                    setUserRole(null);
                    lastCheckedUserIdRef.current = null;
                } finally {
                    isSessionResolved.current = true;
                    setLoading(false);
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
                        await sessionCheckPromise.current;
                    }
                }

                const sessionUserId = session?.user?.id || null;
                // De-duplicate: do not trigger re-render / fetch if user has not changed
                if (sessionUserId === lastCheckedUserIdRef.current && isSessionResolved.current) {
                    return;
                }
                lastCheckedUserIdRef.current = sessionUserId;

                try {
                    if (session) {
                        setUser(session.user);
                        await fetchProfile(session.user.id);
                    } else {
                        setUser(null);
                        setProfile(null);
                        setUserRole(null);
                    }
                } catch (error: any) {
                    console.error("Error in onAuthStateChange handler:", error);
                } finally {
                    setLoading(false);
                }
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const fetchProfile = async (userId: string) => {
        const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .single();

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
