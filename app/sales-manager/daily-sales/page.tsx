"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { SalesReportingPage } from "@/components/sales-reporting-page";

export default function SalesManagerDailySalesPage() {
    const { user, profile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && (!user || !profile || (!profile.is_manager && profile.role !== "ceo" && profile.role !== "sales"))) {
            router.push("/");
        }
    }, [user, profile, loading, router]);

    if (loading || !profile) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin h-8 w-8 border-2 border-[#2F1E73]/20 border-t-[#2F1E73] rounded-full" />
                    Loading Sales Command...
                </div>
            </div>
        );
    }

    return <SalesReportingPage backPath="/sales-manager" />;
}
