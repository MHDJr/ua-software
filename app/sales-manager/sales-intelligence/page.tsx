"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { ExecutiveSalesOverview } from "@/components/executive-sales-overview";
import { MobileFAB } from "@/components/mobile-fab";
import { LayoutDashboard, LogOut, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase, Profile } from "@/lib/supabase";

export default function SalesManagerIntelligence() {
    const { profile, loading, user, userRole, signOut } = useAuth();
    const [liveProfile, setLiveProfile] = useState<Profile | null>(profile);
    const [isChecking, setIsChecking] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const checkAccess = async () => {
            if (loading) return;
            if (!user) {
                router.replace("/");
                return;
            }

            try {
                const { data } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", user.id)
                    .single();

                const p = (data as Profile) || profile;
                setLiveProfile(p);

                const isCeo = userRole === "CEO" || p?.role === "ceo";
                const isAdmin = (p?.role as string) === "admin" || (p?.role as string) === "administrator" || p?.department === "Administration";
                const hasSalesEdit = isCeo || isAdmin || p?.manager_permissions?.sales_permission === "edit" || p?.manager_permissions?.sales_permission === "both" || p?.manager_permissions?.can_update_staff_sales === true;
                const hasSalesView = hasSalesEdit || p?.manager_permissions?.sales_permission === "view" || p?.manager_permissions?.view_sales_page === true;

                if (!p || (!p.is_manager && !isCeo && !isAdmin) || !hasSalesView) {
                    router.replace("/sales-manager");
                    return;
                }
            } catch (err) {
                console.error("SalesManagerIntelligence access error:", err);
                router.replace("/sales-manager");
            } finally {
                setIsChecking(false);
            }
        };

        checkAccess();
    }, [profile, loading, user, userRole, router]);

    const effectiveProfile = liveProfile || profile;
    const isCeo = userRole === "CEO" || effectiveProfile?.role === "ceo";
    const isAdmin = (effectiveProfile?.role as string) === "admin" || (effectiveProfile?.role as string) === "administrator" || effectiveProfile?.department === "Administration";
    const hasSalesEdit = isCeo || isAdmin || effectiveProfile?.manager_permissions?.sales_permission === "edit" || effectiveProfile?.manager_permissions?.sales_permission === "both" || effectiveProfile?.manager_permissions?.can_update_staff_sales === true;

    if (loading || isChecking || !effectiveProfile) {
        return (
            <div className="min-h-screen bg-[#F4F7FE] flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-[#2F1E73] border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc]">
            {/* Header for Manager */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-[1700px] mx-auto px-4 md:px-8 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-[#2F1E73] rounded-xl flex items-center justify-center shadow-lg shadow-[#2F1E73]/20">
                                <div className="text-white text-[9px] font-black tracking-widest">UA</div>
                            </div>
                            <div>
                                <h1 className="text-xs font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                    Sales Intelligence
                                    <Badge className="bg-orange-500 text-white border-none text-[7px] h-3.5 px-1.5">MANAGER</Badge>
                                </h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {hasSalesEdit && (
                                <button
                                    onClick={() => router.push("/sales-manager/daily-sales")}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider shadow-md shadow-orange-500/20"
                                >
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Update Daily Sales</span>
                                </button>
                            )}
                            <button
                                onClick={() => router.push("/sales-manager")}
                                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all text-[10px] font-bold uppercase tracking-wider"
                            >
                                <LayoutDashboard className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Back to Dashboard</span>
                            </button>
                            <button
                                onClick={() => signOut()}
                                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <div className="max-w-[1700px] mx-auto p-4 md:px-8 py-8">
                <ExecutiveSalesOverview />
            </div>
            
            {/* Mobile FAB */}
            <MobileFAB variant="default" />
        </div>
    );
}
