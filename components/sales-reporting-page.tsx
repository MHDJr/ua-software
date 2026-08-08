"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
    Target,
    Phone,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    BarChart3,
    Activity,
    Save,
    Search,
    Calendar,
    Crown,
    Check,
    Minus,
    Plus,
    Users
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import MobileNavigation from "@/components/mobile-navigation";
import { supabase, Profile } from "@/lib/supabase";
import { ProfileModal } from "@/components/ProfileModal";
import { isValidAvatarUrl, cn } from "@/lib/utils";
import Link from "next/link";

const BRAND = {
    navy: "#2F1E73",
    orange: "#FA4615",
    lightNavy: "#3F348C",
    softOrange: "#FEF2EE",
    bg: "#F4F7FE",
};

interface SalesStaffEntry {
    profileId: string;
    fullName: string;
    username: string;
    avatarUrl?: string;
    department: string;
    designation: string;
    totalLeads: number;
    evaluationsTaken: number;
    conversions: number;
    lostLeads: number;
    leadQualityRating: number;
    conversionRate: number;
    efficiencyScore: number;
    notes?: string;
    isModified: boolean;
    isSaved: boolean;
    reportId?: string;
}

// Confetti effect helper
const triggerConfetti = () => {
    if (typeof window === "undefined") return;
    const colors = [BRAND.navy, BRAND.orange, "#16a34a", "#f59e0b"];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement("div");
        confetti.style.cssText = `
            position: fixed;
            top: 40%;
            left: 50%;
            width: 8px;
            height: 8px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            pointer-events: none;
            z-index: 9999;
            border-radius: 50%;
            transform: translate(-50%, -50%);
        `;
        document.body.appendChild(confetti);

        const angle = (Math.PI * 2 * i) / confettiCount;
        const velocity = 6 + Math.random() * 6;
        let opacity = 1;
        let scale = 1;
        let x = 0;
        let y = 0;

        const animate = () => {
            x += Math.cos(angle) * velocity;
            y += Math.sin(angle) * velocity + 2;
            opacity -= 0.015;
            scale -= 0.008;

            confetti.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${scale})`;
            confetti.style.opacity = opacity.toString();

            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                if (document.body.contains(confetti)) {
                    document.body.removeChild(confetti);
                }
            }
        };

        requestAnimationFrame(animate);
    }
};

export function SalesReportingPage({ backPath = "/staff" }: { backPath?: string }) {
    const { profile, user } = useAuth();
    const [time, setTime] = useState("");
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSavingAll, setIsSavingAll] = useState(false);
    const [savingStaffId, setSavingStaffId] = useState<string | null>(null);

    // Selected Tracking Date (defaults to today)
    const [selectedDate, setSelectedDate] = useState(() => {
        return new Date().toISOString().split("T")[0];
    });

    // Live profile fetch to bypass any stale sessionStorage cache
    const [liveProfile, setLiveProfile] = useState<Profile | null>(profile);

    useEffect(() => {
        const fetchLiveProfile = async () => {
            if (!user) return;
            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", user.id)
                    .single();
                if (!error && data) {
                    setLiveProfile(data as Profile);
                }
            } catch (err) {
                console.error("Live profile fetch error:", err);
            }
        };
        fetchLiveProfile();
    }, [user, profile]);

    // Staff List & Sales Entries
    const [staffEntries, setStaffEntries] = useState<SalesStaffEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    const effectiveProfile = liveProfile || profile;

    // 12-Hour Live Clock
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            const seconds = now.getSeconds();
            const ampm = hours >= 12 ? "PM" : "AM";
            const displayHours = hours % 12 || 12;
            const displayMinutes = minutes.toString().padStart(2, "0");
            const displaySeconds = seconds.toString().padStart(2, "0");
            setTime(`${displayHours}:${displayMinutes}:${displaySeconds} ${ampm}`);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    // Calculate conversion rate & efficiency score helpers
    const calculateMetrics = (leads: number, evals: number, convs: number, quality: number) => {
        const conversionRate = leads > 0 ? Math.round((convs / leads) * 100) : (convs > 0 ? 100 : 0);
        const efficiencyScore = leads > 0 ? Math.min(100, Math.round(
            (convs / leads) * 50 +
            (evals / leads) * 30 +
            (quality / 10) * 20
        )) : (convs > 0 ? 100 : 0);
        return { conversionRate, efficiencyScore };
    };

    // Load sales staff and their daily metrics
    const loadSalesData = useCallback(async () => {
        setIsLoading(true);
        try {
            // 1. Fetch all sales operatives from profiles
            const { data: profilesData, error: profilesError } = await supabase
                .from("profiles")
                .select("id, full_name, username, avatar_url, role, department, designation, is_sales_staff, is_manager")
                .order("full_name", { ascending: true });

            if (profilesError) throw profilesError;

            // Filter sales personnel
            let salesProfiles = (profilesData || []).filter((p) => {
                const dept = (p.department || "").toLowerCase();
                const desig = (p.designation || "").toLowerCase();
                const role = (p.role || "").toLowerCase();
                return dept === "sales" || desig.includes("sales") || role === "sales" || Boolean(p.is_sales_staff);
            });

            if (salesProfiles.length === 0) {
                salesProfiles = (profilesData || []).filter((p) => p.role !== "ceo");
            }

            // 2. Fetch daily_sales_tracking for selected date
            const { data: trackingData } = await supabase
                .from("daily_sales_tracking")
                .select("*")
                .eq("tracking_date", selectedDate);

            // 3. Fetch daily_reports for selected date
            const { data: reportsData } = await supabase
                .from("daily_reports")
                .select("*")
                .eq("report_date", selectedDate);

            const trackingMap = new Map((trackingData || []).map((t) => [t.profile_id, t]));
            const reportsMap = new Map((reportsData || []).map((r) => [r.profile_id, r]));

            const entries: SalesStaffEntry[] = salesProfiles.map((p) => {
                const tracking = trackingMap.get(p.id);
                const report = reportsMap.get(p.id);

                const totalLeads = tracking?.total_leads ?? report?.total_leads ?? 0;
                const evaluationsTaken = tracking?.evaluations_taken ?? report?.evaluations_taken ?? 0;
                const conversions = tracking?.conversions ?? report?.conversions ?? 0;
                const lostLeads = tracking?.lost_leads ?? report?.lost_leads ?? 0;
                const leadQualityRating = tracking?.lead_quality_rating ?? report?.lead_quality_rating ?? 7;

                const { conversionRate, efficiencyScore } = calculateMetrics(
                    totalLeads,
                    evaluationsTaken,
                    conversions,
                    leadQualityRating
                );

                return {
                    profileId: p.id,
                    fullName: p.full_name || p.username || "Sales Operative",
                    username: p.username || p.id.slice(0, 6),
                    avatarUrl: p.avatar_url,
                    department: p.department || "Sales",
                    designation: p.designation || (p.is_manager ? "Sales Lead" : "Sales Representative"),
                    totalLeads,
                    evaluationsTaken,
                    conversions,
                    lostLeads,
                    leadQualityRating,
                    conversionRate,
                    efficiencyScore,
                    notes: report?.notes || "",
                    isModified: false,
                    isSaved: Boolean(tracking || report),
                    reportId: report?.id,
                };
            });

            setStaffEntries(entries);
        } catch (err: any) {
            console.error("Error loading sales data:", err);
            toast.error("Failed to load sales data.");
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        loadSalesData();
    }, [loadSalesData]);

    // Handle changing input field for a staff operative
    const handleFieldChange = (
        profileId: string,
        field: "totalLeads" | "evaluationsTaken" | "conversions" | "lostLeads" | "leadQualityRating",
        value: number
    ) => {
        const sanitizedVal = Math.max(0, isNaN(value) ? 0 : value);
        setStaffEntries((prev) =>
            prev.map((entry) => {
                if (entry.profileId !== profileId) return entry;
                const updated = { ...entry, [field]: sanitizedVal, isModified: true };
                const { conversionRate, efficiencyScore } = calculateMetrics(
                    updated.totalLeads,
                    updated.evaluationsTaken,
                    updated.conversions,
                    updated.leadQualityRating
                );
                updated.conversionRate = conversionRate;
                updated.efficiencyScore = efficiencyScore;
                return updated;
            })
        );
    };

    // Quick increment/decrement conversions
    const handleAdjustConversions = (profileId: string, delta: number) => {
        setStaffEntries((prev) =>
            prev.map((entry) => {
                if (entry.profileId !== profileId) return entry;
                const nextConvs = Math.max(0, entry.conversions + delta);
                const updated = { ...entry, conversions: nextConvs, isModified: true };
                const { conversionRate, efficiencyScore } = calculateMetrics(
                    updated.totalLeads,
                    updated.evaluationsTaken,
                    updated.conversions,
                    updated.leadQualityRating
                );
                updated.conversionRate = conversionRate;
                updated.efficiencyScore = efficiencyScore;
                return updated;
            })
        );
    };

    // Save individual staff member's sales record
    const handleSaveStaffRecord = async (entry: SalesStaffEntry) => {
        setSavingStaffId(entry.profileId);
        try {
            const nowIso = new Date().toISOString();

            // 1. Upsert into daily_sales_tracking
            const { error: trackingError } = await supabase
                .from("daily_sales_tracking")
                .upsert({
                    profile_id: entry.profileId,
                    tracking_date: selectedDate,
                    total_leads: entry.totalLeads,
                    evaluations_taken: entry.evaluationsTaken,
                    conversions: entry.conversions,
                    lost_leads: entry.lostLeads,
                    lead_quality_rating: entry.leadQualityRating,
                    updated_at: nowIso,
                }, { onConflict: "profile_id,tracking_date" });

            if (trackingError) {
                console.warn("Tracking upsert warning:", trackingError.message);
            }

            // 2. Upsert into daily_reports
            const reportPayload = {
                profile_id: entry.profileId,
                reporter_name: entry.fullName,
                report_date: selectedDate,
                total_leads: entry.totalLeads,
                evaluations_taken: entry.evaluationsTaken,
                conversions: entry.conversions,
                lost_leads: entry.lostLeads,
                lead_quality_rating: entry.leadQualityRating,
                conversion_rate: entry.conversionRate,
                efficiency_score: entry.efficiencyScore,
                submitted_at: nowIso,
                reviewed_by: effectiveProfile?.full_name || effectiveProfile?.username || "Sales Operations",
                notes: `Logged via Centralized Sales Operations (${effectiveProfile?.full_name || "Manager"})`,
            };

            const { data: existingReport } = await supabase
                .from("daily_reports")
                .select("id")
                .eq("profile_id", entry.profileId)
                .eq("report_date", selectedDate)
                .maybeSingle();

            if (existingReport?.id) {
                await supabase
                    .from("daily_reports")
                    .update(reportPayload)
                    .eq("id", existingReport.id);
            } else {
                await supabase
                    .from("daily_reports")
                    .insert(reportPayload);
            }

            // 3. Sync conversions table count if conversions > 0
            if (entry.conversions > 0) {
                const { count } = await supabase
                    .from("conversions")
                    .select("*", { count: "exact", head: true })
                    .eq("staff_id", entry.profileId)
                    .eq("conversion_date", selectedDate);

                if ((count || 0) < entry.conversions) {
                    const toInsert = entry.conversions - (count || 0);
                    const conversionRows = Array.from({ length: toInsert }).map((_, i) => ({
                        staff_id: entry.profileId,
                        staff_name: entry.fullName,
                        student_name: `Conversion Deal #${(count || 0) + i + 1}`,
                        conversion_date: selectedDate,
                        created_at: nowIso,
                    }));
                    await supabase.from("conversions").insert(conversionRows);
                }
            }

            setStaffEntries((prev) =>
                prev.map((item) =>
                    item.profileId === entry.profileId
                        ? { ...item, isModified: false, isSaved: true }
                        : item
                )
            );

            triggerConfetti();
            toast.success(`Saved sales records for ${entry.fullName}`, {
                description: `${entry.conversions} conversions, ${entry.totalLeads} leads synced successfully.`,
            });
        } catch (err: any) {
            console.error("Save staff record error:", err);
            toast.error(`Failed to save for ${entry.fullName}: ${err.message}`);
        } finally {
            setSavingStaffId(null);
        }
    };

    // Save all modified staff records
    const handleSaveAllRecords = async () => {
        setIsSavingAll(true);
        let successCount = 0;
        const toSave = staffEntries.filter((e) => e.isModified || !e.isSaved);

        if (toSave.length === 0) {
            toast.info("All operative records are already up to date.");
            setIsSavingAll(false);
            return;
        }

        try {
            for (const entry of toSave) {
                const nowIso = new Date().toISOString();

                await supabase.from("daily_sales_tracking").upsert({
                    profile_id: entry.profileId,
                    tracking_date: selectedDate,
                    total_leads: entry.totalLeads,
                    evaluations_taken: entry.evaluationsTaken,
                    conversions: entry.conversions,
                    lost_leads: entry.lostLeads,
                    lead_quality_rating: entry.leadQualityRating,
                    updated_at: nowIso,
                }, { onConflict: "profile_id,tracking_date" });

                const { data: existingReport } = await supabase
                    .from("daily_reports")
                    .select("id")
                    .eq("profile_id", entry.profileId)
                    .eq("report_date", selectedDate)
                    .maybeSingle();

                const reportPayload = {
                    profile_id: entry.profileId,
                    reporter_name: entry.fullName,
                    report_date: selectedDate,
                    total_leads: entry.totalLeads,
                    evaluations_taken: entry.evaluationsTaken,
                    conversions: entry.conversions,
                    lost_leads: entry.lostLeads,
                    lead_quality_rating: entry.leadQualityRating,
                    conversion_rate: entry.conversionRate,
                    efficiency_score: entry.efficiencyScore,
                    submitted_at: nowIso,
                    reviewed_by: effectiveProfile?.full_name || "Sales Operations",
                    notes: `Batch logged via Centralized Sales Operations (${effectiveProfile?.full_name || "Manager"})`,
                };

                if (existingReport?.id) {
                    await supabase.from("daily_reports").update(reportPayload).eq("id", existingReport.id);
                } else {
                    await supabase.from("daily_reports").insert(reportPayload);
                }

                successCount++;
            }

            setStaffEntries((prev) =>
                prev.map((item) => ({ ...item, isModified: false, isSaved: true }))
            );

            triggerConfetti();
            toast.success(`Batch synchronized ${successCount} sales records!`, {
                description: `Academy daily sales pipeline updated for ${selectedDate}.`,
            });
        } catch (err: any) {
            console.error("Batch save error:", err);
            toast.error("Failed to batch save all records.");
        } finally {
            setIsSavingAll(false);
        }
    };

    // Filtered staff list by search query
    const filteredStaff = useMemo(() => {
        if (!searchQuery.trim()) return staffEntries;
        const q = searchQuery.toLowerCase();
        return staffEntries.filter(
            (e) =>
                e.fullName.toLowerCase().includes(q) ||
                e.username.toLowerCase().includes(q) ||
                e.designation.toLowerCase().includes(q)
        );
    }, [staffEntries, searchQuery]);

    // Aggregate summary numbers across all sales reps for the selected date
    const summaryKPIs = useMemo(() => {
        const totalLeads = staffEntries.reduce((sum, e) => sum + e.totalLeads, 0);
        const totalEvals = staffEntries.reduce((sum, e) => sum + e.evaluationsTaken, 0);
        const totalConvs = staffEntries.reduce((sum, e) => sum + e.conversions, 0);
        const totalLost = staffEntries.reduce((sum, e) => sum + e.lostLeads, 0);
        const avgConversionRate = totalLeads > 0 ? Math.round((totalConvs / totalLeads) * 100) : (totalConvs > 0 ? 100 : 0);

        let topPerformer: SalesStaffEntry | null = null;
        let maxConvs = -1;
        staffEntries.forEach((e) => {
            if (e.conversions > maxConvs) {
                maxConvs = e.conversions;
                topPerformer = e;
            }
        });

        return {
            totalLeads,
            totalEvals,
            totalConvs,
            totalLost,
            avgConversionRate,
            topPerformer: (maxConvs > 0 ? topPerformer : null) as SalesStaffEntry | null,
        };
    }, [staffEntries]);

    // Date navigation helpers
    const handleShiftDate = (days: number) => {
        const current = new Date(selectedDate);
        current.setDate(current.getDate() + days);
        setSelectedDate(current.toISOString().split("T")[0]);
    };

    const isToday = selectedDate === new Date().toISOString().split("T")[0];

    return (
        <div className="min-h-screen max-w-[100vw] overflow-x-hidden bg-[#F4F7FE]" style={{ backgroundColor: BRAND.bg }}>
            {/* Header Bar */}
            <header className="h-20 bg-white/95 backdrop-blur-xl border-b border-slate-200/80 flex items-center justify-between px-4 md:px-8 sticky top-0 z-40 shadow-sm">
                <div className="flex items-center gap-4">
                    <Link
                        href={backPath}
                        className="w-10 h-10 rounded-2xl bg-slate-100/80 hover:bg-slate-200/80 border border-slate-200 flex items-center justify-center text-slate-700 transition-all active:scale-95"
                        title="Return to Command Center"
                    >
                        <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-[#2F1E73] flex items-center justify-center text-white shadow-md shadow-indigo-950/20">
                            <BarChart3 className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-base md:text-lg font-black uppercase tracking-wider text-slate-900">
                                    Sales Operations Command
                                </h1>
                                <span className="px-2.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border shadow-xs bg-orange-50 text-[#FA4615] border-orange-200">
                                    Centralized Logger
                                </span>
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Official Academy Sales &amp; Conversions Entry Portal
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden sm:flex flex-col text-right">
                        <p className="text-xs font-mono font-black text-slate-900">{time}</p>
                        <p className="text-[9px] font-bold uppercase text-slate-400">
                            {effectiveProfile?.full_name || effectiveProfile?.username}
                        </p>
                    </div>
                    <div
                        onClick={() => setIsProfileModalOpen(true)}
                        className="w-10 h-10 rounded-2xl bg-[#2F1E73] flex items-center justify-center text-white text-xs font-black shadow-md overflow-hidden cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                    >
                        {effectiveProfile?.avatar_url && isValidAvatarUrl(effectiveProfile.avatar_url) ? (
                            <img src={effectiveProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            effectiveProfile?.full_name?.[0] || effectiveProfile?.username?.[0] || "U"
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content Area: Centralized Logger */}
            <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6">
                {/* Operations Control & Date Navigation Bar */}
                <div className="p-6 rounded-[28px] bg-white border border-slate-200/80 shadow-[0_10px_30px_rgba(0,0,0,0.03)] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    {/* Date Selector */}
                    <div className="flex items-center gap-3 w-full lg:w-auto">
                        <div className="p-2.5 rounded-2xl bg-indigo-50/50 text-[#2F1E73] border border-indigo-100">
                            <Calendar className="w-5 h-5 text-[#2F1E73]" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                Tracking Date
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                                <button
                                    onClick={() => handleShiftDate(-1)}
                                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"
                                    title="Previous Day"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-black text-slate-900 bg-slate-50 focus:bg-white focus:border-[#2F1E73] focus:outline-none transition-all shadow-inner"
                                    style={{ color: "#0f172a" }}
                                />
                                <button
                                    onClick={() => handleShiftDate(1)}
                                    disabled={isToday}
                                    className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-slate-100 flex items-center justify-center text-slate-700 transition-colors"
                                    title="Next Day"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                                {isToday ? (
                                    <Badge className="bg-emerald-50 text-emerald-600 border border-emerald-200 text-[8px] font-black uppercase tracking-wider ml-1">
                                        Today
                                    </Badge>
                                ) : (
                                    <button
                                        onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
                                        className="text-[9px] font-black uppercase text-[#2F1E73] hover:underline ml-1"
                                    >
                                        Jump to Today
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Search & Actions */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
                        <div className="relative flex-1 sm:w-64">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <Input
                                placeholder="Search sales operative..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 rounded-xl bg-slate-50 border-slate-300 text-xs font-bold text-slate-900 focus:ring-[#2F1E73]/15 focus:border-[#2F1E73]"
                                style={{ color: "#0f172a" }}
                            />
                        </div>

                        <Button
                            onClick={loadSalesData}
                            variant="outline"
                            disabled={isLoading}
                            className="h-11 px-4 rounded-xl border-slate-300 text-slate-700 hover:text-slate-900 font-black uppercase text-[10px] tracking-wider gap-2 transition-all active:scale-95"
                        >
                            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                            Refresh
                        </Button>

                        <Button
                            onClick={handleSaveAllRecords}
                            disabled={isSavingAll || isLoading}
                            className="h-11 px-6 rounded-xl bg-[#FA4615] hover:bg-[#e03e12] text-white font-black uppercase text-[10px] tracking-widest gap-2 shadow-lg shadow-orange-500/20 hover:brightness-105 active:scale-95 transition-all"
                        >
                            {isSavingAll ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                                <Save className="w-3.5 h-3.5" />
                            )}
                            Save All Operatives
                        </Button>
                    </div>
                </div>

                {/* Academy Aggregate KPIs Banner */}
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-white border border-slate-200/70 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-[#2F1E73]">
                            <Phone className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Leads</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{summaryKPIs.totalLeads}</p>
                            <p className="text-[8px] font-bold text-slate-400">Logged on {selectedDate}</p>
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200/70 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                            <Activity className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Evaluations Taken</p>
                            <p className="text-2xl font-black text-slate-900 mt-0.5">{summaryKPIs.totalEvals}</p>
                            <p className="text-[8px] font-bold text-slate-400">Demo sessions completed</p>
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border border-slate-200/70 shadow-sm flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                            <Target className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Conversions Closed</p>
                            <p className="text-2xl font-black text-emerald-600 mt-0.5">{summaryKPIs.totalConvs}</p>
                            <p className="text-[8px] font-bold text-slate-400">Conversion Rate: {summaryKPIs.avgConversionRate}%</p>
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-gradient-to-br from-[#2F1E73] to-[#1E144F] text-white border border-indigo-900/40 shadow-md flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-amber-300">
                            <Crown className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-indigo-200">Top Daily Performer</p>
                            <p className="text-sm font-black truncate max-w-[140px] text-white mt-0.5">
                                {summaryKPIs.topPerformer ? summaryKPIs.topPerformer.fullName : "Awaiting Sales"}
                            </p>
                            <p className="text-[8px] font-bold text-amber-400">
                                {summaryKPIs.topPerformer ? `${summaryKPIs.topPerformer.conversions} Closures Today` : "0 conversions"}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Operatives Sales Entry Grid */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-800 flex items-center gap-2">
                            <span>Sales Personnel Directory</span>
                            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[9px] font-black">
                                {filteredStaff.length} Reps
                            </span>
                        </h3>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            Enter metrics below • Values save directly to database
                        </p>
                    </div>

                    {isLoading ? (
                        <div className="p-16 rounded-[28px] bg-white border border-slate-100 flex flex-col items-center justify-center text-center">
                            <RefreshCw className="w-8 h-8 text-[#2F1E73] animate-spin mb-3" />
                            <p className="text-xs font-black uppercase tracking-widest text-slate-600">
                                Loading Sales Personnel Records...
                            </p>
                        </div>
                    ) : filteredStaff.length === 0 ? (
                        <div className="p-16 rounded-[28px] bg-white border border-slate-100 text-center">
                            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-700">No Sales Operatives Found</p>
                            <p className="text-xs text-slate-400 mt-1">Make sure sales staff profiles are created and assigned to the Sales department.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredStaff.map((entry) => {
                                const isSavingThis = savingStaffId === entry.profileId;
                                return (
                                    <div
                                        key={entry.profileId}
                                        className={cn(
                                            "p-5 md:p-6 rounded-[24px] bg-white border transition-all duration-300 shadow-sm hover:shadow-md",
                                            entry.isModified
                                                ? "border-orange-300 ring-2 ring-orange-400/10 bg-orange-50/10"
                                                : entry.isSaved
                                                ? "border-slate-200/90"
                                                : "border-slate-200/60"
                                        )}
                                    >
                                        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                                            {/* Staff Profile Info */}
                                            <div className="flex items-center gap-3.5 min-w-[220px]">
                                                <Avatar className="w-12 h-12 rounded-2xl border-2 border-slate-100 shadow-sm shrink-0">
                                                    <AvatarImage src={isValidAvatarUrl(entry.avatarUrl) ? entry.avatarUrl : undefined} />
                                                    <AvatarFallback className="bg-[#2F1E73] text-white font-black text-sm">
                                                        {entry.fullName.slice(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-black text-slate-900 text-sm truncate uppercase tracking-tight">
                                                            {entry.fullName}
                                                        </p>
                                                        {entry.conversions >= 5 && (
                                                            <span className="text-xs" title="Super Closer">🔥</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] font-bold text-[#2F1E73] uppercase tracking-wider mt-0.5 flex items-center gap-1.5">
                                                        <span className="text-slate-400">@{entry.username}</span>
                                                        <span>•</span>
                                                        <span>{entry.designation}</span>
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Entry Input Fields - HIGH CONTRAST CLEAR TEXT */}
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto flex-1 max-w-2xl">
                                                {/* Total Leads */}
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-500 block">
                                                        Total Leads
                                                    </label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        value={entry.totalLeads}
                                                        onChange={(e) =>
                                                            handleFieldChange(entry.profileId, "totalLeads", parseInt(e.target.value) || 0)
                                                        }
                                                        placeholder="0"
                                                        className="h-10 text-center font-mono font-black text-sm text-slate-900 bg-slate-100/90 border border-slate-300 focus:bg-white focus:border-[#2F1E73] focus:ring-2 focus:ring-[#2F1E73]/20 rounded-xl shadow-inner transition-all"
                                                        style={{ color: "#0f172a", backgroundColor: "#f1f5f9" }}
                                                    />
                                                </div>

                                                {/* Evaluations */}
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-500 block">
                                                        Evaluations
                                                    </label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        value={entry.evaluationsTaken}
                                                        onChange={(e) =>
                                                            handleFieldChange(entry.profileId, "evaluationsTaken", parseInt(e.target.value) || 0)
                                                        }
                                                        placeholder="0"
                                                        className="h-10 text-center font-mono font-black text-sm text-slate-900 bg-slate-100/90 border border-slate-300 focus:bg-white focus:border-[#2F1E73] focus:ring-2 focus:ring-[#2F1E73]/20 rounded-xl shadow-inner transition-all"
                                                        style={{ color: "#0f172a", backgroundColor: "#f1f5f9" }}
                                                    />
                                                </div>

                                                {/* Conversions (with + / - quick buttons) */}
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black uppercase tracking-widest text-emerald-700 block">
                                                        Conversions (Wins)
                                                    </label>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAdjustConversions(entry.profileId, -1)}
                                                            className="w-7 h-10 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-700 shrink-0 transition-colors font-black"
                                                        >
                                                            <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
                                                        </button>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            value={entry.conversions}
                                                            onChange={(e) =>
                                                                handleFieldChange(entry.profileId, "conversions", parseInt(e.target.value) || 0)
                                                            }
                                                            placeholder="0"
                                                            className="h-10 text-center font-mono font-black text-sm text-emerald-950 bg-emerald-50 border border-emerald-300 focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 rounded-xl shadow-inner transition-all"
                                                            style={{ color: "#064e3b", backgroundColor: "#ecfdf5" }}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleAdjustConversions(entry.profileId, 1)}
                                                            className="w-7 h-10 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shrink-0 transition-colors shadow-xs shadow-emerald-500/30"
                                                            title="Add Conversion"
                                                        >
                                                            <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Lost Leads */}
                                                <div className="space-y-1">
                                                    <label className="text-[8px] font-black uppercase tracking-widest text-slate-500 block">
                                                        Lost / Drop
                                                    </label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        value={entry.lostLeads}
                                                        onChange={(e) =>
                                                            handleFieldChange(entry.profileId, "lostLeads", parseInt(e.target.value) || 0)
                                                        }
                                                        placeholder="0"
                                                        className="h-10 text-center font-mono font-black text-sm text-slate-900 bg-slate-100/90 border border-slate-300 focus:bg-white focus:border-[#2F1E73] focus:ring-2 focus:ring-[#2F1E73]/20 rounded-xl shadow-inner transition-all"
                                                        style={{ color: "#0f172a", backgroundColor: "#f1f5f9" }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Calculated Performance & Save Button */}
                                            <div className="flex items-center justify-between sm:justify-end gap-3 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                                                <div className="flex flex-col text-right">
                                                    <span className="text-[10px] font-black text-slate-900">
                                                        {entry.conversionRate}% Close Rate
                                                    </span>
                                                    <span className="text-[8px] font-bold text-slate-400">
                                                        {entry.efficiencyScore} Efficiency Score
                                                    </span>
                                                </div>

                                                <Button
                                                    onClick={() => handleSaveStaffRecord(entry)}
                                                    disabled={isSavingThis}
                                                    className={cn(
                                                        "h-10 px-4 rounded-xl font-black uppercase text-[9px] tracking-wider transition-all duration-200 gap-1.5 active:scale-95",
                                                        entry.isModified
                                                            ? "bg-[#FA4615] hover:bg-[#e03e12] text-white shadow-md shadow-orange-500/20"
                                                            : entry.isSaved
                                                            ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                                                            : "bg-[#2F1E73] hover:bg-[#25185e] text-white"
                                                    )}
                                                >
                                                    {isSavingThis ? (
                                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                                    ) : entry.isModified ? (
                                                        <Save className="w-3 h-3" />
                                                    ) : (
                                                        <Check className="w-3 h-3" />
                                                    )}
                                                    {isSavingThis ? "Saving..." : entry.isModified ? "Save Record" : "Saved"}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>

            {/* Mobile Navigation */}
            <MobileNavigation currentPage="sales" />
            <div className="md:hidden h-20" />

            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
            />
        </div>
    );
}

export default SalesReportingPage;
