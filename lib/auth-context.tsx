"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
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
                    setLoading(false); // Set loading to false if we have a cache
                } catch (e) {
                    sessionStorage.removeItem("ua_profile");
                }
            }
        }

        // 2. Get initial session
        const getInitialSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUser(session.user);
                await fetchProfile(session.user.id);
            }
            setLoading(false);
        };

        getInitialSession();

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (session) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                } else {
                    setUser(null);
                    setProfile(null);
                }
                setLoading(false);
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

    return (
        <AuthContext.Provider value={{ user, profile, loading, userRole, signIn, signOut, refreshProfile }}>
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
