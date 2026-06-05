"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { AuthPage } from "@/components/auth-page";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LoaderOverlay } from "@/components/ui/loader-overlay";

export default function Home() {
    const { user, profile, loading } = useAuth();
    const router = useRouter();

    // Skip auth for development - ONLY via URL parameter
    const runtimeSkip =
        typeof window !== "undefined" &&
        new URLSearchParams(window.location.search).get("skip_auth") === "true";

    const SKIP_AUTH =
        process.env.NEXT_PUBLIC_SKIP_AUTH === "true" || runtimeSkip;

    useEffect(() => {
        if (!loading && profile) {
            console.log("[Home] Profile loaded, determining redirection path for role:", profile.role);
            
            // Check if current user is CEO and we're not on a staff page
            const isCurrentPathStaff = typeof window !== "undefined" && window.location.pathname.startsWith("/staff");
            
            // 1. CEO Redirection
            if (profile.role === "ceo" && !isCurrentPathStaff) {
                console.log("[Home] Redirecting CEO to dashboard");
                router.replace("/ceo");
                return;
            }
            
            // 2. Manager Redirection
            if (profile.is_manager || profile.role === "manager") {
                if (isCurrentPathStaff) return;
                
                // Redirect based on department
                const dept = profile.department?.toLowerCase();
                console.log("[Home] Redirecting Manager to department:", dept);
                
                if (dept === "sales") router.replace("/sales-manager");
                else if (dept === "marketing") router.replace("/marketing-manager");
                else if (dept === "finance" || profile.role === "accounts") router.replace("/finance-manager");
                else if (dept === "administration" || dept === "admin") router.replace("/ceo");
                else router.replace("/staff");
                return;
            }
            
            // 3. Staff/Tutor/Sales/Accounts Redirection
            const role = profile.role?.toLowerCase();
            if (role === "sales" || profile.is_sales_staff || profile.is_tutor || role === "tutor" || role === "accounts" || role === "staff") {
                console.log("[Home] Redirecting Staff/Tutor/Sales to portal");
                router.replace("/staff");
                return;
            }

            // 4. Exhaustive Fallback - if none of the above matched but we have a profile
            console.warn("[Home] No specific role match found, defaulting to staff portal for role:", profile.role);
            router.replace("/staff");
        }
    }, [profile, loading, router]);

    // Safety fallback: If we are stuck on this page for more than 2 seconds with a profile, force redirect
    useEffect(() => {
        if (profile && !loading) {
            const timer = setTimeout(() => {
                console.log("[Home] Safety timer triggered, forcing fallback redirect to /staff");
                router.replace("/staff");
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [profile, loading, router]);

    // State 1: Loading Initial Session or Profile
    if (loading) {
        return <LoaderOverlay isVisible={true} type="initialization" />;
    }

    if (!user || !profile) {
        if (SKIP_AUTH) {
            return (
                <div className="min-h-screen bg-[#F8F9FC] flex items-center justify-center">
                    <div className="flex flex-col gap-4">
                        <Button
                            variant="outline"
                            className="border-slate-200 text-[#2D2A77]"
                            onClick={() => router.push("/ceo")}
                        >
                            CEO Dashboard
                        </Button>
                        <Button
                            variant="outline"
                            className="border-slate-200 text-[#2D2A77]"
                            onClick={() => router.push("/staff")}
                        >
                            Staff Portal
                        </Button>
                        <Button
                            variant="outline"
                            className="border-slate-200 text-[#2D2A77]"
                            onClick={() => router.push("/sales")}
                        >
                            Sales Console
                        </Button>
                    </div>
                </div>
            );
        }

        return <AuthPage />;
    }

    return <LoaderOverlay isVisible={true} type="initialization" />;
}
