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
            // Check if current user is CEO and we're not on a staff page
            const isCurrentPathStaff = typeof window !== "undefined" && window.location.pathname.startsWith("/staff");
            const isCEOAddingStaff = profile.role === "ceo" && !isCurrentPathStaff;
            
            if (profile.role === "ceo" && !isCurrentPathStaff) {
                router.replace("/ceo");
            }
            else if (profile.is_manager || profile.role === "manager") {
                if (isCurrentPathStaff) return;
                
                // Redirect based on department
                const dept = profile.department?.toLowerCase();
                if (dept === "sales") router.replace("/sales-manager");
                else if (dept === "marketing") router.replace("/marketing-manager");
                else if (dept === "finance" || profile.role === "accounts") router.replace("/finance-manager");
                else router.replace("/staff");
            }
            else if (profile.role === "sales" || profile.is_tutor || profile.role === "accounts" || profile.role === "staff") {
                router.replace("/staff");
            }
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
