"use client";

import { ManagerCommandCenter } from "@/components/manager/ManagerCommandCenter";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MarketingManagerPage() {
    const { profile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!profile) {
                router.replace("/");
            } else if (profile.role === "ceo") {
                router.replace("/ceo");
            } else if (!profile.is_manager || profile.department !== "Marketing") {
                // Not a marketing manager, redirect to their proper place
                if (profile.is_manager) {
                    if (profile.department === "Finance") router.replace("/finance-manager");
                    else if (profile.department === "Sales") router.replace("/sales-manager");
                    else if (profile.department === "Administration" || profile.department === "Admin") router.replace("/ceo");
                    else router.replace("/staff");
                } else {
                    router.replace("/staff");
                }
            }
        }
    }, [profile, loading, router]);

    if (loading || !profile) {
        return (
            <div className="min-h-screen bg-[#F4F7FE] flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-[#2F1E73] border-t-transparent rounded-full" />
            </div>
        );
    }

    return <ManagerCommandCenter department="Marketing" dashboardTitle="Marketing Manager Dashboard" />;
}
