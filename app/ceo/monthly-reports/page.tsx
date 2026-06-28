"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
    LayoutDashboard, 
    FileText, 
    Mail, 
    CheckCircle, 
    AlertTriangle, 
    RefreshCw, 
    Download, 
    Send, 
    ShieldAlert, 
    Database, 
    Terminal, 
    Play, 
    CheckSquare, 
    Trash2, 
    TrendingUp, 
    Activity, 
    AlertCircle,
    Loader2
} from "lucide-react";
import { CEOSidebar } from "@/components/ceo-sidebar";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface MonthlyReportItem {
    id: string;
    month: number;
    year: number;
    generated_at: string;
    generated_by: string;
    status: "PENDING" | "GENERATED" | "FAILED";
    storage_paths: Record<string, string>;
    email_sent: boolean;
    email_sent_at: string;
    verification_status: "PENDING" | "VERIFIED" | "FAILED";
    cleanup_completed: boolean;
}

interface ReportLogItem {
    id: string;
    report_id: string;
    stage: "GENERATION" | "EMAIL" | "VERIFICATION" | "CLEANUP";
    level: "INFO" | "WARNING" | "ERROR";
    message: string;
    duration_ms?: number;
    created_at: string;
    monthly_reports?: {
        year: number;
        month: number;
    };
}

export default function MonthlyReportsAdminPage() {
    const { profile, loading: authLoading, userRole } = useAuth();
    const router = useRouter();

    const [reports, setReports] = useState<MonthlyReportItem[]>([]);
    const [logs, setLogs] = useState<ReportLogItem[]>([]);
    const [storageStatus, setStorageStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [logFilter, setLogFilter] = useState<string>("ALL");
    const [logStageFilter, setLogStageFilter] = useState<string>("ALL");

    // Guard Check
    const isAuthorized = profile?.role === "ceo" || profile?.role === "manager" || profile?.is_manager === true;

    // Fetch report records and logs from API
    const fetchData = useCallback(async () => {
        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) return;

            const res = await fetch("/api/admin/bi-reports/logs", {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!res.ok) throw new Error("Failed to load reporting pipeline logs.");

            const data = await res.json();
            if (data.success) {
                setReports(data.reports);
                setLogs(data.logs);
                setStorageStatus(data.storage);
            } else {
                throw new Error(data.error || "Failed to load logs.");
            }
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Error fetching records");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!authLoading && !isAuthorized) {
            toast.error("Access denied: Executive privileges required.");
            router.replace("/ceo");
            return;
        }

        if (profile?.id) {
            fetchData();
        }
    }, [profile, authLoading, isAuthorized, router, fetchData]);

    // Handle manual pipeline triggers
    const triggerAction = async (action: string, year?: number, month?: number) => {
        setActionLoading(action);
        const actionLabel = action.replace("_", " ").toUpperCase();
        toast.info(`Triggering: ${actionLabel}...`);

        try {
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error("No active authorization session");

            const res = await fetch("/api/admin/bi-reports", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ action, year, month })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`Success: ${data.message}`);
                await fetchData(); // Reload logs
            } else {
                throw new Error(data.error || `Failed to run ${actionLabel}.`);
            }
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Execution failed");
        } finally {
            setActionLoading(null);
        }
    };

    // Download a single report securely via API
    const handleDownload = async (path: string, filename: string) => {
        try {
            toast.info(`Fetching report: ${filename}...`);
            const token = (await supabase.auth.getSession()).data.session?.access_token;
            if (!token) throw new Error("No active authorization session");

            const res = await fetch(`/api/admin/bi-reports/download?path=${encodeURIComponent(path)}`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!res.ok) throw new Error("Download failed. Report may not exist in storage.");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success("Download complete!");
        } catch (err: any) {
            console.error(err);
            toast.error(err.message || "Failed to download report");
        }
    };

    const getMonthName = (m: number) => {
        return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1];
    };

    // Filter logs
    const filteredLogs = logs.filter(log => {
        const passLevel = logFilter === "ALL" || log.level === logFilter;
        const passStage = logStageFilter === "ALL" || log.stage === logStageFilter;
        return passLevel && passStage;
    });

    if (authLoading || (loading && reports.length === 0)) {
        return (
            <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-[#FA4616] animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest text-slate-400">Loading BI Console...</p>
                </div>
            </div>
        );
    }

    // Get current date coordinates for UI
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const prevDate = new Date(nowIST);
    prevDate.setDate(0); // previous month
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;

    return (
        <div className="min-h-screen bg-[#050508] text-slate-200 overflow-x-hidden relative flex">
            {/* Sidebar navigation */}
            <CEOSidebar activeView="monthly-reports" />

            {/* Main Console Dashboard */}
            <div className="flex-1 ml-0 md:ml-[80px] p-6 md:p-10 min-h-screen flex flex-col gap-8">
                
                {/* Header Banner */}
                <div className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-black/40 backdrop-blur-3xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-[#FA4616] mb-2">
                            <Activity className="w-4 h-4 animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Zain Intelligence Systems</span>
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider text-white">Monthly BI Reporting System</h1>
                        <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-bold">Usthad Academy Strategic Executive Console</p>
                    </div>

                    <div className="flex items-center gap-4 relative z-10">
                        <div className="bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-right">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase">Current Timezone</span>
                            <span className="text-xs text-indigo-400 font-black uppercase tracking-wider">Asia/Kolkata (IST)</span>
                        </div>
                        <button
                            onClick={fetchData}
                            disabled={loading || actionLoading !== null}
                            className="bg-white/5 border border-white/10 p-3 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 disabled:opacity-50 text-white"
                            title="Refresh logs & statistics"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* State Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="border border-white/5 bg-white/[0.02] backdrop-blur-xl p-5 rounded-2xl flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                            <CheckCircle className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[8px] font-bold text-slate-400 block uppercase">Pipeline Health</span>
                            <span className="text-sm text-white font-black uppercase tracking-wider">OPERATIONAL</span>
                        </div>
                    </div>
                    
                    <div className="border border-white/5 bg-white/[0.02] backdrop-blur-xl p-5 rounded-2xl flex items-center gap-4">
                        <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                            <Database className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[8px] font-bold text-slate-400 block uppercase">Storage Status</span>
                            <span className="text-sm text-white font-black uppercase tracking-wider">
                                {storageStatus?.exists ? "CONNECTED" : "DISCONNECTED"}
                            </span>
                        </div>
                    </div>

                    <div className="border border-white/5 bg-white/[0.02] backdrop-blur-xl p-5 rounded-2xl flex items-center gap-4">
                        <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
                            <Mail className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[8px] font-bold text-slate-400 block uppercase">Email Delivery</span>
                            <span className="text-sm text-white font-black uppercase tracking-wider">RESEND OK</span>
                        </div>
                    </div>

                    <div className="border border-white/5 bg-white/[0.02] backdrop-blur-xl p-5 rounded-2xl flex items-center gap-4">
                        <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-[8px] font-bold text-slate-400 block uppercase">Data Lockdown</span>
                            <span className="text-sm text-white font-black uppercase tracking-wider">ACTIVE (RLS)</span>
                        </div>
                    </div>
                </div>

                {/* Manual Stages Execution Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Live Pipeline Controllers */}
                    <div className="border border-white/5 bg-white/[0.01] backdrop-blur-2xl rounded-2xl p-6 flex flex-col gap-6 shadow-xl lg:col-span-2">
                        <div>
                            <h2 className="text-lg font-black uppercase tracking-wider text-white">Manual Pipeline Stages Trigger</h2>
                            <p className="text-xs text-slate-400 mt-1">Force execute specific stages of the monthly reporting pipeline for the concluded previous month ({getMonthName(prevMonth)} {prevYear}).</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Stage 1 Card */}
                            <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col justify-between gap-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-[#FA4616]">Stage 1 Gate</span>
                                        <span className="text-[8px] px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full font-bold">12:05 AM IST</span>
                                    </div>
                                    <h3 className="text-xs font-black uppercase text-white">Redeem & Generate PDFs</h3>
                                    <p className="text-[10px] text-slate-400 mt-1">Locks previous month's operational records, aggregates ledger/sales metrics, draws all 5 report PDFs via PDFKit, runs integrity checks, and uploads to storage bucket.</p>
                                </div>
                                <button
                                    onClick={() => triggerAction("generate")}
                                    disabled={actionLoading !== null}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#31267D] hover:bg-[#3d3099] text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                                >
                                    {actionLoading === "generate" ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Play className="w-3 h-3" />
                                    )}
                                    Generate Report Now
                                </button>
                            </div>

                            {/* Stage 2 Card */}
                            <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col justify-between gap-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-[#FA4616]">Stage 2 Gate</span>
                                        <span className="text-[8px] px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full font-bold">05:00 AM IST</span>
                                    </div>
                                    <h3 className="text-xs font-black uppercase text-white">Email CEO Delivery</h3>
                                    <p className="text-[10px] text-slate-400 mt-1">Retrieves PDFs from private storage folder, creates Resend attachments, and sends the business intelligence email package to the CEO with automatic retry logic.</p>
                                </div>
                                <button
                                    onClick={() => triggerAction("email")}
                                    disabled={actionLoading !== null}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#31267D] hover:bg-[#3d3099] text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                                >
                                    {actionLoading === "email" ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Send className="w-3 h-3" />
                                    )}
                                    Send Email Again
                                </button>
                            </div>

                            {/* Stage 3 Card */}
                            <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col justify-between gap-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-[#FA4616]">Stage 3 Gate</span>
                                        <span className="text-[8px] px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full font-bold">05:10 AM IST</span>
                                    </div>
                                    <h3 className="text-xs font-black uppercase text-white">Pipeline Verification</h3>
                                    <p className="text-[10px] text-slate-400 mt-1">Verifies file existence, sizes, formats, metadata states, and email delivery. Alerts the system admin immediately if any step is corrupted or fails audit.</p>
                                </div>
                                <button
                                    onClick={() => triggerAction("verify")}
                                    disabled={actionLoading !== null}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                                >
                                    {actionLoading === "verify" ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <CheckSquare className="w-3 h-3" />
                                    )}
                                    Verify Pipeline Status
                                </button>
                            </div>

                            {/* Stage 4 Card */}
                            <div className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col justify-between gap-4">
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-[#FA4616]">Stage 4 Gate</span>
                                        <span className="text-[8px] px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full font-bold">05:30 AM IST</span>
                                    </div>
                                    <h3 className="text-xs font-black uppercase text-white">Archive & Data Cleanup</h3>
                                    <p className="text-[10px] text-slate-400 mt-1">Safely archives completed tasks and leaves requests to history tables, and purges live operational logs. Aborts if reports generated or email sent are FALSE.</p>
                                </div>
                                <button
                                    onClick={() => triggerAction("cleanup")}
                                    disabled={actionLoading !== null}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all disabled:opacity-50"
                                >
                                    {actionLoading === "cleanup" ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-3 h-3" />
                                    )}
                                    Execute Cleanup Purge
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Test Mode panel */}
                    <div className="border border-white/5 bg-white/[0.01] backdrop-blur-2xl rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
                        <div>
                            <div className="flex items-center gap-2 text-indigo-400">
                                <TrendingUp className="w-4 h-4" />
                                <h2 className="text-lg font-black uppercase tracking-wider text-white font-Outfit">Test Mode Sandbox</h2>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Run test validations instantly without waiting for schedules. Test runs generate reports with mock fallbacks if database lacks entries.</p>
                        </div>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={() => triggerAction("generate_test", prevYear, prevMonth)}
                                disabled={actionLoading !== null}
                                className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-all active:scale-98 disabled:opacity-50"
                            >
                                <div>
                                    <span className="text-[10px] font-black uppercase text-white block">Generate Previous Month</span>
                                    <span className="text-[8px] text-slate-400 block uppercase">Period: {getMonthName(prevMonth)} {prevYear} (Test)</span>
                                </div>
                                <Play className="w-3 h-3 text-slate-400" />
                            </button>

                            <button
                                onClick={() => triggerAction("generate_test", nowIST.getFullYear(), nowIST.getMonth() + 1)}
                                disabled={actionLoading !== null}
                                className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-left transition-all active:scale-98 disabled:opacity-50"
                            >
                                <div>
                                    <span className="text-[10px] font-black uppercase text-white block">Generate Current Month</span>
                                    <span className="text-[8px] text-slate-400 block uppercase">Period: {getMonthName(nowIST.getMonth() + 1)} {nowIST.getFullYear()} (Test)</span>
                                </div>
                                <Play className="w-3 h-3 text-slate-400" />
                            </button>

                            <button
                                onClick={() => triggerAction("email_test", prevYear, prevMonth)}
                                disabled={actionLoading !== null}
                                className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-orange-500/10 to-orange-600/10 hover:from-orange-500/20 hover:to-orange-600/20 border border-orange-500/20 rounded-xl text-left transition-all active:scale-98 disabled:opacity-50"
                            >
                                <div>
                                    <span className="text-[10px] font-black uppercase text-[#FA4616] block">Send Test Email Package</span>
                                    <span className="text-[8px] text-slate-400 block uppercase">Dispatches to: {profile?.email || 'CEO'}</span>
                                </div>
                                <Send className="w-3 h-3 text-[#FA4616]" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Historical Reports Explorer */}
                <div className="border border-white/5 bg-white/[0.01] backdrop-blur-2xl rounded-2xl p-6 shadow-xl flex flex-col gap-6">
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-wider text-white">Archived Reports Explorer</h2>
                        <p className="text-xs text-slate-400 mt-1">Explore historical executive reporting periods, metadata records, and download generated PDFs from Supabase Storage.</p>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-white/10 text-slate-400 font-bold uppercase tracking-wider">
                                    <th className="py-3 px-4">Period</th>
                                    <th className="py-3 px-4">Generated At</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4">Email Sent</th>
                                    <th className="py-3 px-4">Verified</th>
                                    <th className="py-3 px-4">Cleanup</th>
                                    <th className="py-3 px-4 text-right">Available Downloads</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.length === 0 ? (
                                    <tr className="border-b border-white/5">
                                        <td colSpan={7} className="py-8 text-center text-slate-500 font-medium">
                                            No reporting history entries found in database. Run a Test Mode simulation above.
                                        </td>
                                    </tr>
                                ) : (
                                    reports.map((report) => (
                                        <tr key={report.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                            <td className="py-4 px-4 font-black uppercase tracking-wider text-white">
                                                {getMonthName(report.month)} {report.year}
                                            </td>
                                            <td className="py-4 px-4 text-slate-400">
                                                {report.generated_at ? new Date(report.generated_at).toLocaleString() : "N/A"}
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                    report.status === "GENERATED" ? "bg-emerald-500/10 text-emerald-400" :
                                                    report.status === "FAILED" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"
                                                }`}>
                                                    {report.status}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-slate-400">
                                                {report.email_sent ? (
                                                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                                                        <CheckCircle className="w-3.5 h-3.5" /> YES
                                                    </span>
                                                ) : "NO"}
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                                    report.verification_status === "VERIFIED" ? "bg-emerald-500/10 text-emerald-400" :
                                                    report.verification_status === "FAILED" ? "bg-red-500/10 text-red-400" : "bg-white/5 text-slate-400"
                                                }`}>
                                                    {report.verification_status}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-slate-400">
                                                {report.cleanup_completed ? "COMPLETED" : "PENDING"}
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                {report.status === "GENERATED" && report.storage_paths ? (
                                                    <div className="flex justify-end gap-1.5 flex-wrap">
                                                        <button
                                                            onClick={() => handleDownload(report.storage_paths["executive-summary"], `Executive_Summary_${getMonthName(report.month)}_${report.year}.pdf`)}
                                                            className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-[9px] font-bold text-white uppercase flex items-center gap-1"
                                                            title="Download Executive Summary"
                                                        >
                                                            <Download className="w-2.5 h-2.5" /> Exec
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownload(report.storage_paths["finance"], `Finance_Report_${getMonthName(report.month)}_${report.year}.pdf`)}
                                                            className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-[9px] font-bold text-white uppercase flex items-center gap-1"
                                                            title="Download Finance Report"
                                                        >
                                                            <Download className="w-2.5 h-2.5" /> Fin
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownload(report.storage_paths["sales"], `Sales_Report_${getMonthName(report.month)}_${report.year}.pdf`)}
                                                            className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-[9px] font-bold text-white uppercase flex items-center gap-1"
                                                            title="Download Sales Report"
                                                        >
                                                            <Download className="w-2.5 h-2.5" /> Sales
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownload(report.storage_paths["operations"], `Operations_Report_${getMonthName(report.month)}_${report.year}.pdf`)}
                                                            className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-[9px] font-bold text-white uppercase flex items-center gap-1"
                                                            title="Download Operations Report"
                                                        >
                                                            <Download className="w-2.5 h-2.5" /> Ops
                                                        </button>
                                                        <button
                                                            onClick={() => handleDownload(report.storage_paths["leave"], `Leave_Report_${getMonthName(report.month)}_${report.year}.pdf`)}
                                                            className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-[9px] font-bold text-white uppercase flex items-center gap-1"
                                                            title="Download Leave Report"
                                                        >
                                                            <Download className="w-2.5 h-2.5" /> Leave
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase">Unavailable</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pipeline Logs Terminal */}
                <div className="border border-white/5 bg-black rounded-2xl p-6 shadow-xl flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2 text-indigo-400">
                            <Terminal className="w-4 h-4" />
                            <h2 className="text-lg font-black uppercase tracking-wider text-white">Pipeline Execution Terminal Logs</h2>
                        </div>

                        {/* Log Filters */}
                        <div className="flex items-center gap-2 flex-wrap text-[10px] font-bold uppercase">
                            <span className="text-slate-400">Filter Level:</span>
                            <select 
                                value={logFilter} 
                                onChange={(e) => setLogFilter(e.target.value)}
                                className="bg-white/5 border border-white/10 px-2 py-1.5 rounded text-white"
                            >
                                <option value="ALL">ALL LEVELS</option>
                                <option value="INFO">INFO ONLY</option>
                                <option value="WARNING">WARNINGS</option>
                                <option value="ERROR">ERRORS</option>
                            </select>

                            <span className="text-slate-400 ml-2">Stage:</span>
                            <select 
                                value={logStageFilter} 
                                onChange={(e) => setLogStageFilter(e.target.value)}
                                className="bg-white/5 border border-white/10 px-2 py-1.5 rounded text-white"
                            >
                                <option value="ALL">ALL STAGES</option>
                                <option value="GENERATION">STAGE 1 (GEN)</option>
                                <option value="EMAIL">STAGE 2 (EMAIL)</option>
                                <option value="VERIFICATION">STAGE 3 (VERIFY)</option>
                                <option value="CLEANUP">STAGE 4 (CLEANUP)</option>
                            </select>
                        </div>
                    </div>

                    {/* Glowing Terminal Container */}
                    <div className="bg-[#020204] border border-white/5 rounded-xl p-4 h-[250px] overflow-y-auto font-mono text-[10px] leading-5 flex flex-col gap-1.5 custom-scrollbar shadow-inner shadow-black">
                        {filteredLogs.length === 0 ? (
                            <div className="text-slate-600 text-center py-10 uppercase tracking-widest">
                                &lt; Empty Terminal - Log stream is inactive &gt;
                            </div>
                        ) : (
                            filteredLogs.map((log) => {
                                let levelColor = "text-indigo-400"; // INFO
                                if (log.level === "WARNING") levelColor = "text-yellow-500 font-bold";
                                if (log.level === "ERROR") levelColor = "text-red-500 font-bold animate-pulse";

                                const dateStr = new Date(log.created_at).toISOString();
                                const repPeriod = log.monthly_reports 
                                    ? `[${getMonthName(log.monthly_reports.month)}-${log.monthly_reports.year}]` 
                                    : "[SYSTEM]";

                                return (
                                    <div key={log.id} className="border-b border-white/[0.02] pb-1 flex flex-col md:flex-row md:items-start gap-1">
                                        <span className="text-slate-500 whitespace-nowrap">{dateStr}</span>
                                        <span className="text-[#FA4616] whitespace-nowrap">{repPeriod}</span>
                                        <span className={`${levelColor} whitespace-nowrap`}>[{log.stage}] [{log.level}]</span>
                                        <span className="text-slate-300 flex-1">{log.message}</span>
                                        {log.duration_ms && (
                                            <span className="text-indigo-300 whitespace-nowrap font-bold">({log.duration_ms}ms)</span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
