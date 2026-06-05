"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
    Wallet,
    TrendingUp,
    History,
    Target,
    Send,
    CheckCircle2,
    ArrowUpRight,
    ArrowDownRight,
    AlertTriangle,
    ShieldCheck,
    FileText,
    Activity,
    ReceiptText,
    Home,
    Clock,
    User,
    Sun,
    Sparkles,
    ChevronLeft,
    Loader2
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { MonthlyProgressGauge } from "@/components/monthly-progress-gauge";
import { ProfileModal } from "@/components/ProfileModal";
import { isValidAvatarUrl } from "@/lib/utils";


// Types
interface FinancialEntry {
    id: string;
    date: string;
    uloomxIncome: number;
    usthadIncome: number;
    expenses: number;
    revenue: number;
}

interface MonthlyTarget {
    id: string;
    target_value: number;
    current_progress: number;
    achievement_percentage: number;
}

// Format currency helper
const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
};

// Format time helper
const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).replace('am', 'AM').replace('pm', 'PM');
};

// Fetch monthly target data
const fetchMonthlyTarget = async (userId: string): Promise<MonthlyTarget | null> => {
    try {
        const currentMonth = new Date();
        currentMonth.setDate(1); // First day of current month
        
        const { data, error } = await supabase
            .from('monthly_targets')
            .select('*')
            .eq('profile_id', userId)
            .eq('department', 'accounts')
            .eq('target_month', currentMonth.toISOString().split('T')[0])
            .single();
        
        if (error) {
            console.error('Error fetching monthly target:', error);
            return null;
        }
        
        return data;
    } catch (error) {
        console.error('Error fetching monthly target:', error);
        return null;
    }
};

// Fetch real history data
const fetchFinancialHistory = async (userId: string): Promise<FinancialEntry[]> => {
    try {
        const { data, error } = await supabase
            .from('financial_entries')
            .select('*')
            .eq('submitted_by', userId)
            .order('entry_date', { ascending: false })
            .limit(10);
        
        if (error) {
            console.error('Error fetching financial history:', error);
            return [];
        }
        
        return (data || []).map(entry => ({
            id: entry.id,
            date: new Date(entry.entry_date).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric' 
            }),
            uloomxIncome: parseFloat(entry.uloomx_income) || 0,
            usthadIncome: parseFloat(entry.usthad_income) || 0,
            expenses: parseFloat(entry.total_expenses) || 0,
            revenue: parseFloat(entry.revenue) || 0,
        }));
    } catch (error) {
        console.error('Error fetching financial history:', error);
        return [];
    }
};

export default function FinanceManagerDailyRecordPage() {
    const router = useRouter();
    const { profile, loading: authLoading } = useAuth();
    
    // Form state
    const [uloomxIncome, setUloomxIncome] = useState<string>("");
    const [usthadIncome, setUsthadIncome] = useState<string>("");
    const [expenses, setExpenses] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [currentTime, setCurrentTime] = useState<Date | null>(null);
    const [greeting, setGreeting] = useState("Good Morning");
    const [isClient, setIsClient] = useState(false);
    const [financialHistory, setFinancialHistory] = useState<FinancialEntry[]>([]);
    const [monthlyTarget, setMonthlyTarget] = useState<MonthlyTarget | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // Update time and greeting
    useEffect(() => {
        setIsClient(true);
        const updateTime = () => {
            const now = new Date();
            setCurrentTime(now);
            
            const hour = now.getHours();
            if (hour < 12) setGreeting("Good Morning");
            else if (hour < 17) setGreeting("Good Afternoon");
            else setGreeting("Good Evening");
        };
        
        updateTime();
        const interval = setInterval(updateTime, 60000);
        return () => clearInterval(interval);
    }, []);

    // Calculate revenue
    const revenue = useMemo(() => {
        const uloomx = parseFloat(uloomxIncome) || 0;
        const usthad = parseFloat(usthadIncome) || 0;
        const exp = parseFloat(expenses) || 0;
        return uloomx + usthad - exp;
    }, [uloomxIncome, usthadIncome, expenses]);

    // Calculate validation checks
    const validationChecks = useMemo(() => {
        const totalIncome = (parseFloat(uloomxIncome) || 0) + (parseFloat(usthadIncome) || 0);
        const expenseRatio = totalIncome > 0 ? (parseFloat(expenses) || 0) / totalIncome : 0;
        
        return {
            hasHighExpenseRatio: expenseRatio > 0.5,
            expenseRatio: expenseRatio * 100,
            isReadyForReview: totalIncome > 0 && expenseRatio <= 0.5
        };
    }, [uloomxIncome, usthadIncome, expenses]);

    // Calculate income split for progress bar
    const incomeSplit = useMemo(() => {
        const uloomx = parseFloat(uloomxIncome) || 0;
        const usthad = parseFloat(usthadIncome) || 0;
        const total = uloomx + usthad;
        
        if (total === 0) return { uloomxPercentage: 0, usthadPercentage: 0 };
        
        return {
            uloomxPercentage: (uloomx / total) * 100,
            usthadPercentage: (usthad / total) * 100
        };
    }, [uloomxIncome, usthadIncome]);

    // Handle form submission
    const handleSubmit = async () => {
        if (!uloomxIncome && !usthadIncome) {
            toast.error("Please enter at least one income value");
            return;
        }

        if (!profile) {
            toast.error("User not authenticated");
            return;
        }

        setIsSubmitting(true);
        
        try {
            const today = new Date().toISOString().split('T')[0];
            
            const { data, error } = await supabase
                .from('financial_entries')
                .insert({
                    user_id: profile.id,
                    entry_date: today,
                    uloomx_income: parseFloat(uloomxIncome) || 0,
                    usthad_income: parseFloat(usthadIncome) || 0,
                    total_expenses: parseFloat(expenses) || 0,
                    submitted_by: profile.id,
                    status: 'pending'
                })
                .select()
                .single();
            
            if (error) {
                console.error('Error saving financial entry:', error);
                toast.error("Failed to save financial entry");
                return;
            }
            
            toast.success("Financial entry saved successfully!");
            setShowSuccess(true);
            
            // Refresh history
            const updatedHistory = await fetchFinancialHistory(profile.id);
            setFinancialHistory(updatedHistory);
            
            setTimeout(() => {
                setShowSuccess(false);
                setUloomxIncome("");
                setUsthadIncome("");
                setExpenses("");
            }, 2000);
            
        } catch (error) {
            console.error('Error submitting financial entry:', error);
            toast.error("An error occurred while saving");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // Fetch financial history and monthly target on component mount
    useEffect(() => {
        const loadData = async () => {
            if (!profile) return;
            try {
                setLoading(true);
                const [history, target] = await Promise.all([
                    fetchFinancialHistory(profile.id),
                    fetchMonthlyTarget(profile.id)
                ]);
                setFinancialHistory(history);
                setMonthlyTarget(target);
            } catch (err: any) {
                if (err?.name === "AbortError") {
                    console.warn("[FinanceManagerDailyRecordPage] Data load aborted.");
                    return;
                }
                console.error("[FinanceManagerDailyRecordPage] Error loading data:", err);
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, [profile]);

    // Role verification
    useEffect(() => {
        if (!authLoading && (!profile || (!profile.is_manager && profile.role !== "ceo" && profile.role !== "accounts"))) {
            router.push("/");
        }
    }, [profile, authLoading, router]);

    if (authLoading || !profile) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f9fafb] pt-[calc(env(safe-area-inset-top)+4rem)] md:pt-0 pb-28">
            {/* Desktop Header - Hidden on Mobile */}
            <div className="hidden md:block bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div 
                                onClick={() => setIsProfileModalOpen(true)}
                                className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff4d00] to-[#ff8c00] flex items-center justify-center text-white font-bold shadow-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-350"
                            >
                                {profile?.avatar_url && isValidAvatarUrl(profile.avatar_url) ? (
                                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    profile?.avatar_url || (profile?.full_name || 'AC').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                                )}
                            </div>
                            <div>
                                <div className="px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 inline-block mb-2">
                                    <span className="text-xs font-bold text-indigo-600 tracking-wide uppercase">Finance Manager Daily Entry</span>
                                </div>
                                <h1 className="text-2xl font-bold text-[#1e293b]">{greeting}</h1>
                                <p className="text-sm text-[#64748b]">Ready to record today&apos;s flow</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => router.push("/finance-manager")}
                                className="px-4 py-2 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Back to Hub
                            </button>
                            <div className="text-xl font-bold text-[#1e293b] font-mono">
                                {currentTime ? formatTime(currentTime) : "--:--"}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Header */}
            <div className="md:hidden">
                <div className="max-w-[450px] mx-auto bg-white px-4 pt-4 pb-6 rounded-b-[24px] shadow-sm">
                    {/* Top Row: Avatar, Badge, Clock */}
                    <div className="flex items-center justify-between mb-4">
                        {/* User Avatar */}
                        <div 
                            onClick={() => setIsProfileModalOpen(true)}
                            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff4d00] to-[#ff8c00] flex items-center justify-center text-white font-bold text-sm shadow-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-350"
                        >
                            {profile?.avatar_url && isValidAvatarUrl(profile.avatar_url) ? (
                                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                                profile?.avatar_url || (profile?.full_name || 'AC').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                            )}
                        </div>
                        
                        {/* FINANCE Badge */}
                        <div className="px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100">
                            <span className="text-xs font-bold text-indigo-600 tracking-wide uppercase">Finance Mgr</span>
                        </div>
                        
                        {/* Live Digital Clock */}
                        <div className="text-right flex items-center gap-2">
                             <button 
                                onClick={() => router.push("/finance-manager")}
                                className="p-2 rounded-xl border border-slate-100 bg-slate-50 text-slate-500"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-lg font-bold text-[#1e293b] font-mono">
                                {currentTime ? formatTime(currentTime) : "--:--"}
                            </span>
                        </div>
                    </div>
                    
                    {/* Secondary Row: Greeting Card */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-orange-100">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                    <Sun className="w-5 h-5 text-amber-600" />
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-[#1e293b]">{greeting}</h1>
                                    <p className="text-xs text-[#64748b]">Ready to record today&apos;s flow</p>
                                </div>
                            </div>
                            <div className="px-3 py-1.5 rounded-full bg-white/80 border border-orange-200">
                                <span className="text-xs font-semibold text-orange-700 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" />
                                    Focused
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Unified Responsive Layout */}
            <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto px-4 md:px-6 py-6">
                
                {/* LEFT GRID SECTION (Daily Entry & Quick History) */}
                <div className="lg:col-span-7 flex flex-col gap-8">
                    
                    {/* Daily Entry Card */}
                    <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-5 md:p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#ff4d00] to-[#ff8c00] flex items-center justify-center shadow-lg shadow-orange-200">
                                <Wallet className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[#1e293b]">Daily Entry</h2>
                                <p className="text-sm text-[#64748b]">Record financial data</p>
                            </div>
                        </div>

                        {/* Input Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* UloomX Total Income */}
                            <div className="relative">
                                <input
                                    type="number"
                                    id="uloomx"
                                    value={uloomxIncome}
                                    onChange={(e) => setUloomxIncome(e.target.value)}
                                    placeholder=" "
                                    className="peer w-full h-16 px-4 pt-6 pb-2 rounded-2xl border-2 border-gray-200 text-lg font-semibold text-[#1e293b] placeholder:text-transparent focus:outline-none focus:border-[#ff4d00] focus:ring-4 focus:ring-[#ff4d00]/10 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <label 
                                    htmlFor="uloomx"
                                    className="absolute left-4 top-2 text-xs font-medium text-[#64748b] transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-5 peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-[#ff4d00]"
                                >
                                    UloomX Income
                                </label>
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-lg pointer-events-none">₹</span>
                            </div>

                            {/* Usthad Academy Income */}
                            <div className="relative">
                                <input
                                    type="number"
                                    id="usthad"
                                    value={usthadIncome}
                                    onChange={(e) => setUsthadIncome(e.target.value)}
                                    placeholder=" "
                                    className="peer w-full h-16 px-4 pt-6 pb-2 rounded-2xl border-2 border-gray-200 text-lg font-semibold text-[#1e293b] placeholder:text-transparent focus:outline-none focus:border-[#ff4d00] focus:ring-4 focus:ring-[#ff4d00]/10 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <label 
                                    htmlFor="usthad"
                                    className="absolute left-4 top-2 text-xs font-medium text-[#64748b] transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-5 peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-[#ff4d00]"
                                >
                                    Usthad Academy Income
                                </label>
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-lg pointer-events-none">₹</span>
                            </div>

                            {/* Total Combined Expenses - Spans full width */}
                            <div className="relative md:col-span-2">
                                <input
                                    type="number"
                                    id="expenses"
                                    value={expenses}
                                    onChange={(e) => setExpenses(e.target.value)}
                                    placeholder=" "
                                    className="peer w-full h-16 px-4 pt-6 pb-2 rounded-2xl border-2 border-gray-200 text-lg font-semibold text-[#1e293b] placeholder:text-transparent focus:outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                <label 
                                    htmlFor="expenses"
                                    className="absolute left-4 top-2 text-xs font-medium text-[#64748b] transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-5 peer-placeholder-shown:text-gray-400 peer-focus:top-2 peer-focus:text-xs peer-focus:text-red-500"
                                >
                                    Total Expenses
                                </label>
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-lg pointer-events-none">₹</span>
                            </div>
                        </div>

                        {/* Revenue Display - Upgraded Gradient */}
                        <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 shadow-[0_4px_20px_rgba(16,185,129,0.15)] relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
                            <div className="flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-white/90" />
                                    <span className="text-sm font-bold text-white/95 tracking-wide uppercase">Revenue</span>
                                </div>
                                <span className="text-3xl font-black text-white tracking-tight">
                                    {formatCurrency(revenue)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Quick History Card */}
                    <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-5 md:p-6">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                    <History className="w-5 h-5 text-slate-600" />
                                </div>
                                <div className="">
                                    <h2 className="text-base font-bold text-[#1e293b]">Quick History</h2>
                                    <p className="text-xs text-[#64748b]">Last entries</p>
                                </div>
                            </div>
                        </div>

                        {/* History List */}
                        <div className="space-y-3">
                            {loading ? (
                                <div className="text-center py-4 text-sm text-[#64748b]">Loading history...</div>
                            ) : financialHistory.length === 0 ? (
                                <div className="text-center py-4 text-sm text-[#64748b]">No entries yet</div>
                            ) : (
                                financialHistory.map((entry) => (
                                    <div key={entry.id} className="p-3 rounded-xl bg-slate-50/50 border border-slate-100/60 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-semibold text-[#1e293b]">{entry.date}</span>
                                            <span className="text-sm font-bold text-emerald-600">
                                                {formatCurrency(entry.revenue)}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs font-medium text-[#64748b]">
                                            <span className="text-slate-500">Income: {formatCurrency(entry.uloomxIncome + entry.usthadIncome)}</span>
                                            <span className="text-red-400">Exp: {formatCurrency(entry.expenses)}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* RIGHT GRID SECTION (Overview & Actions) */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    


                    {/* Transmission Verification Card */}
                    <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-5 md:p-6">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                                <ShieldCheck className="w-5 h-5 text-slate-700" />
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-[#1e293b]">Verification</h2>
                                <p className="text-xs text-[#64748b]">Live validation</p>
                            </div>
                        </div>

                        {/* Live Split */}
                        <div className="mb-5">
                            <div className="flex justify-between text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
                                <span>UloomX</span>
                                <span>Usthad</span>
                            </div>
                            <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                                {incomeSplit.uloomxPercentage > 0 && (
                                    <div 
                                        className="bg-[#ff4d00] flex items-center justify-center transition-all duration-300"
                                        style={{ width: `${incomeSplit.uloomxPercentage}%` }}
                                    />
                                )}
                                {incomeSplit.usthadPercentage > 0 && (
                                    <div 
                                        className="bg-[#2C2171] flex items-center justify-center transition-all duration-300"
                                        style={{ width: `${incomeSplit.usthadPercentage}%` }}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Smart Alert */}
                        <div className={`p-3.5 rounded-xl border ${
                            validationChecks.hasHighExpenseRatio 
                                ? 'bg-red-50 border-red-200 text-red-700' 
                                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}>
                            <div className="flex items-center gap-2">
                                {validationChecks.hasHighExpenseRatio ? (
                                    <AlertTriangle className="w-4 h-4" />
                                ) : (
                                    <CheckCircle2 className="w-4 h-4" />
                                )}
                                <span className="text-xs font-bold uppercase tracking-wide">
                                    {validationChecks.hasHighExpenseRatio 
                                        ? `High Expense: ${validationChecks.expenseRatio.toFixed(0)}%` 
                                        : 'Ready for Review'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Transmit Action Button */}
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (!uloomxIncome && !usthadIncome)}
                        className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-4 w-full flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group mt-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span className="text-sm font-bold uppercase tracking-widest">Transmitting</span>
                            </>
                        ) : showSuccess ? (
                            <>
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                <span className="text-sm font-bold uppercase tracking-widest text-emerald-400">Transmitted</span>
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                                <span className="text-sm font-bold uppercase tracking-widest">Transmit Report</span>
                            </>
                        )}
                    </button>
                    
                </div>
            </div>
            
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
            />
        </div>
    );
}
