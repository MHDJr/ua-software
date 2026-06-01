"use client";

import React from "react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ExecutiveSalesOverview } from "@/components/executive-sales-overview";
import { CEOSidebar } from "@/components/ceo-sidebar";
import { MobileFAB } from "@/components/mobile-fab";
import { Crown, LayoutDashboard, LogOut, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MarketingManagerIntelligence() {
    const { profile, loading, user, signOut } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading && (!user || !profile || (!profile.is_manager && profile.role !== "ceo"))) {
            router.replace("/");
        }
    }, [profile, loading, user, router]);

    if (loading || !profile) {
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
                                    <Badge className="bg-indigo-500 text-white border-none text-[7px] h-3.5 px-1.5">MARKETING MANAGER</Badge>
                                </h1>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push("/marketing-manager")}
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
            <div className="max-w-[1700px] mx-auto p-4 md:p-8">
                <ExecutiveSalesOverview />
            </div>
            
            {/* Mobile FAB */}
            <MobileFAB variant="default" />
        </div>
    );
}
