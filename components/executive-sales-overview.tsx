"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Users,
    TrendingUp,
    Rocket,
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Phone,
    FileText,
    UserCheck,
    Crown,
    Target,
    Clock,
    ChevronRight,
    MoreHorizontal,
    RefreshCw,
    Star,
    XCircle,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdvancedViewToggle } from "@/components/ui/advanced-view-toggle";
import { DetailedMatrix } from "@/components/detailed-matrix";
import { CEOStaffVelocity } from "./ceo-staff-velocity";
import { useAuth } from "@/lib/auth-context";
import { useTabResiliency } from "./tab-resiliency-engine";
import { supabase, DailyReport, Profile } from "@/lib/supabase";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
// Brand colors
const BRAND_COLORS = {
    indigo: "#2F1E73",
    orange: "#FA4615",
    lightOrange: "#FF6B35",
};

// Real funnel data calculated from daily reports
const calculateFunnelData = (reports: SalesRepData[]) => {
    const totalLeads = reports.reduce((sum, rep) => sum + rep.leadsClaimed, 0);
    const totalEvaluations = reports.reduce((sum, rep) => sum + rep.evaluations, 0);
    const totalConverted = reports.reduce((sum, rep) => sum + rep.closed, 0);
    const totalLost = reports.reduce((sum, rep) => sum + (rep.leadsClaimed - rep.contacted), 0);
    
    // Assume 90% of converted get assigned (can be updated with real data later)
    const totalAssigned = Math.round(totalConverted * 0.9);

    return [
        { 
            stage: "Leads", 
            count: totalLeads, 
            conversion: "100%", 
            icon: Users 
        },
        { 
            stage: "Evaluations", 
            count: totalEvaluations, 
            conversion: totalLeads > 0 ? `${Math.round((totalEvaluations / totalLeads) * 100)}%` : "0%", 
            icon: FileText 
        },
        { 
            stage: "Converted", 
            count: totalConverted, 
            conversion: totalEvaluations > 0 ? `${Math.round((totalConverted / totalEvaluations) * 100)}%` : "0%", 
            icon: CheckCircle2 
        },
        { 
            stage: "Not Converted", 
            count: totalLost, 
            conversion: totalLeads > 0 ? `${Math.round((totalLost / totalLeads) * 100)}%` : "0%", 
            icon: AlertCircle 
        },
        { 
            stage: "Assigned", 
            count: totalAssigned, 
            conversion: totalConverted > 0 ? `${Math.round((totalAssigned / totalConverted) * 100)}%` : "0%", 
            icon: UserCheck 
        },
    ];
};

// Real sales reps data from daily reports
interface SalesRepData {
    id: string;
    name: string;
    initials: string;
    leadsClaimed: number;
    contacted: number;
    evaluations: number;
    closed: number;
    rank: number;
    efficiency_score: number;
    conversion_rate: number;
    lead_quality_rating: number;
    report_date: string;
    submitted_at: string;
}


// Metric card component
const MetricCard = ({
    title,
    value,
    trend,
    trendUp,
    icon: Icon,
    delay,
}: {
    title: string;
    value: string;
    trend: string;
    trendUp: boolean;
    icon: React.ElementType;
    delay: number;
}) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.5 }}
        className="glass-card-ua rounded-2xl p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group"
    >
        <div className="flex items-start justify-between relative z-10">
            <div>
                <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                    {title}
                </p>
                <div className="flex items-baseline gap-3">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-white">{value}</h3>
                    {/* Micro Sparkline */}
                    <svg className="w-12 h-4 opacity-50 group-hover:opacity-100 transition-opacity" viewBox="0 0 48 16" fill="none">
                        <path 
                            d={trendUp ? "M0 16 L10 8 L20 12 L30 4 L40 6 L48 0" : "M0 0 L10 6 L20 4 L30 10 L40 8 L48 16"} 
                            stroke={trendUp ? "#10b981" : "#ef4444"} 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
                <div className="flex items-center gap-1 mt-2">
                    <TrendingUp
                        className={`w-3 h-3 ${trendUp ? "text-green-500" : "text-red-500 rotate-180"}`}
                    />
                    <span
                        className={`text-xs font-bold ${
                            trendUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                        }`}
                    >
                        {trend}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">vs last week</span>
                </div>
            </div>
            <div
                className="p-3 rounded-xl transition-colors group-hover:bg-[#2F1E73]/20"
                style={{ backgroundColor: `${BRAND_COLORS.indigo}10` }}
            >
                <Icon className="w-5 h-5" style={{ color: BRAND_COLORS.indigo }} />
            </div>
        </div>
    </motion.div>
);

// Target metric card component showing only target and monthly progress
const TargetMetricCard = ({
    title,
    achieved,
    target,
    percentage,
    unit = "",
    icon: Icon,
    delay,
}: {
    title: string;
    achieved: number;
    target: number;
    percentage: number;
    unit?: string;
    icon: React.ElementType;
    delay: number;
}) => {
    // Determine progress bar color based on percentage
    const barColor = percentage >= 100 ? "bg-green-500" : percentage >= 75 ? "bg-indigo-600" : percentage >= 50 ? "bg-amber-500" : "bg-red-500";
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5 }}
            className="glass-card-ua rounded-2xl p-5 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group"
        >
            <div className="flex items-start justify-between relative z-10">
                <div className="flex-1">
                    <p className="text-xs font-black text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                        {title}
                    </p>
                    
                    {/* Achieved vs Target */}
                    <div className="flex items-baseline gap-1.5 mb-2">
                        <span className="text-3xl font-black text-gray-900 dark:text-white">
                            {achieved}{unit}
                        </span>
                        <span className="text-sm font-semibold text-gray-400 dark:text-zinc-500">
                            / {target}{unit}
                        </span>
                    </div>

                    {/* Progress Bar & Percentage */}
                    <div className="mt-3">
                        <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                            <span className="text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Achievement</span>
                            <span className={percentage >= 100 ? "text-green-600 dark:text-green-400" : percentage >= 50 ? "text-amber-500" : "text-red-500"}>
                                {percentage}%
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <motion.div 
                                className={`h-full rounded-full ${barColor}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, percentage)}%` }}
                                transition={{ delay: delay + 0.1, duration: 0.8, ease: "easeOut" }}
                            />
                        </div>
                    </div>
                </div>
                
                <div
                    className="p-3 rounded-xl transition-colors group-hover:bg-[#2F1E73]/20 flex-shrink-0"
                    style={{ backgroundColor: `${BRAND_COLORS.indigo}10` }}
                >
                    <Icon className="w-5 h-5" style={{ color: BRAND_COLORS.indigo }} />
                </div>
            </div>
        </motion.div>
    );
};



// Funnel step component
const FunnelStep = ({
    stage,
    count,
    conversion,
    icon: Icon,
    isFirst,
    isLast,
    delay,
    footer,
    trendUp,
}: {
    stage: string;
    count: number;
    conversion: string;
    icon: React.ElementType;
    isFirst: boolean;
    isLast: boolean;
    delay: number;
    footer: string;
    trendUp?: boolean;
}) => {
    const tagBg = "bg-indigo-500/10 dark:bg-indigo-500/20";
    const tagText = "text-indigo-600 dark:text-indigo-400";

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, duration: 0.4 }}
            className="flex-1 relative flex items-center"
        >
            <div className="flex-1 rounded-2xl p-4 md:p-5 text-center relative hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group z-10 bg-white/75 dark:bg-zinc-900/60 backdrop-blur-xl border border-white/40 dark:border-zinc-800/50 shadow-sm flex flex-col items-center justify-between h-full min-h-[165px]">
                <div
                    className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center mx-auto mb-2 transition-transform duration-300 group-hover:scale-110 shadow-sm"
                    style={{ backgroundColor: `${BRAND_COLORS.indigo}15` }}
                >
                    <Icon className="w-5 h-5 md:w-6 md:h-6" style={{ color: BRAND_COLORS.indigo }} />
                </div>
                <div className="flex-1 flex flex-col justify-center">
                    <h4 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-zinc-100 tracking-tighter leading-none mb-1">{count}</h4>
                    <p className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest truncate w-full px-2 mb-2">
                        {stage}
                    </p>
                </div>
                
                {/* Polished tag indicator */}
                <div className={`inline-flex items-center justify-center px-3 py-1 rounded-full ${tagBg} mb-2`}>
                    <span className={`text-[10px] font-black tracking-widest ${tagText}`}>
                        {conversion}
                    </span>
                </div>

                {/* Comparison Footer */}
                <div className={`text-[10px] font-bold tracking-wide ${
                    trendUp === undefined 
                        ? "text-gray-500 dark:text-zinc-400" 
                        : trendUp 
                            ? "text-green-600 dark:text-green-400" 
                            : "text-red-500 dark:text-red-400"
                }`}>
                    {footer}
                </div>
            </div>

            {/* Elegant Chevron Connector */}
            {!isLast && (
                <div className="w-6 md:w-8 lg:w-10 flex justify-center items-center z-0 flex-shrink-0 -mx-2 md:-mx-3">
                    <ArrowRight className="w-5 h-5 md:w-6 md:h-6 text-slate-300 dark:text-zinc-600 opacity-50" strokeWidth={3} />
                </div>
            )}
        </motion.div>
    );
};
const SalesRepRow = ({ rep, index }: { rep: SalesRepData; index: number }) => (
    <motion.tr
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.6 + index * 0.1 }}
        className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors"
    >
        <td className="py-4 px-4">
            <div className="flex items-center gap-3">
                <Avatar
                    className="w-9 h-9 border-2"
                    style={{ borderColor: `${BRAND_COLORS.indigo}20` }}
                >
                    <AvatarFallback
                        className="text-xs font-bold text-white"
                        style={{ backgroundColor: BRAND_COLORS.indigo }}
                    >
                        {rep.initials}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-sm font-semibold text-gray-900">{rep.name}</p>
                    {rep.rank === 1 && (
                        <Badge
                            className="text-[10px] px-1.5 py-0"
                            style={{
                                backgroundColor: `${BRAND_COLORS.orange}15`,
                                color: BRAND_COLORS.orange,
                                border: "none",
                            }}
                        >
                            <Crown className="w-3 h-3 mr-1" />
                            Top Performer
                        </Badge>
                    )}
                </div>
            </div>
        </td>
        <td className="py-4 px-4 text-center">
            <span className="text-sm font-medium text-gray-700">{rep.leadsClaimed}</span>
        </td>
        <td className="py-4 px-4 text-center">
            <span className="text-sm font-medium text-gray-700">{rep.evaluations}</span>
        </td>
        <td className="py-4 px-4 text-center">
            <span
                className="text-sm font-bold"
                style={{ color: BRAND_COLORS.indigo }}
            >
                {rep.closed}
            </span>
        </td>
        <td className="py-4 px-4 text-center">
            <span
                className="text-sm font-bold"
                style={{ color: BRAND_COLORS.orange }}
            >
                {rep.leadsClaimed - rep.contacted}
            </span>
        </td>
        <td className="py-4 px-4 text-right">
            <div className="flex items-center justify-end gap-2">
                <div className="text-right">
                    <div className="text-lg font-bold" style={{ color: BRAND_COLORS.indigo }}>
                        {rep.lead_quality_rating}
                    </div>
                    <div className="text-xs text-gray-400">/10</div>
                </div>
                <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                        backgroundColor: rep.lead_quality_rating >= 8 ? `${BRAND_COLORS.orange}15` : 
                                       rep.lead_quality_rating >= 6 ? `${BRAND_COLORS.indigo}15` : '#f3f4f6'
                    }}
                >
                    <Star 
                        className="w-4 h-4" 
                        style={{
                            color: rep.lead_quality_rating >= 8 ? BRAND_COLORS.orange : 
                                   rep.lead_quality_rating >= 6 ? BRAND_COLORS.indigo : '#6b7280'
                        }} 
                    />
                </div>
            </div>
        </td>
    </motion.tr>
);

// Deployment item component
const DeploymentItem = ({ deployment, index }: { deployment: any; index: number }) => (
    <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8 + index * 0.1 }}
        className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/20 transition-colors group"
    >
        <div
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{
                backgroundColor: `${BRAND_COLORS.orange}15`,
            }}
        >
            <Rocket
                className="w-5 h-5"
                style={{
                    color: BRAND_COLORS.orange,
                }}
            />
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
                {deployment.studentName}
            </p>
            <p className="text-xs text-white/80 flex items-center gap-1">
                <ArrowRight className="w-3 h-3" />
                Assigned to <span className="font-medium text-white/90">{deployment.tutorName}</span>
            </p>
        </div>
        <span className="text-xs text-white/60 flex-shrink-0">{deployment.time}</span>
    </motion.div>
);

export function ExecutiveSalesOverview() {
    const { profile, userRole } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [salesReps, setSalesReps] = useState<SalesRepData[]>([]);
    const [assignments, setAssignments] = useState<any[]>([]);
    const [unassignedCount, setUnassignedCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isAdvancedView, setIsAdvancedView] = useState(false);
    
    // Pipeline specific state
    const [pipelineFilter, setPipelineFilter] = useState<'today' | 'week' | 'month'>('month');
    const [pipelineData, setPipelineData] = useState<SalesRepData[]>([]);

    // Sales targets and historical data
    const [targets, setTargets] = useState({
        leadsTarget: 1000,
        evalTarget: 70,
        conversionTarget: 15,
    });
    const [isTargetsModalOpen, setIsTargetsModalOpen] = useState(false);
    const [historicalReports, setHistoricalReports] = useState<any[]>([]);

    // Load academy targets from database as single source of truth
    const loadTargets = async () => {
        const currentMonth = new Date();
        currentMonth.setDate(1);
        const monthStr = currentMonth.toISOString().split('T')[0];
        
        if (!monthStr) return;
        
        try {
            const { data, error } = await supabase
                .from('academy_sales_targets')
                .select('*')
                .eq('target_month', monthStr)
                .maybeSingle();
                
            if (data && !error) {
                const dbTargets = {
                    leadsTarget: Number(data.leads_target) || 1000,
                    evalTarget: Number(data.evaluation_target) || 70,
                    conversionTarget: Number(data.conversion_target) || 15
                };
                setTargets(dbTargets);
                localStorage.setItem('ua_sales_targets', JSON.stringify({ ...dbTargets, month: monthStr }));
                return;
            }
        } catch (err) {
            console.warn("Academy sales targets DB load fallback:", err);
        }
        
        // Fallback to uniform defaults for all users
        setTargets({
            leadsTarget: 1000,
            evalTarget: 70,
            conversionTarget: 15
        });
    };

    const handleSaveTargets = async (leadsVal: number, evalVal: number, convVal: number) => {
        const currentMonth = new Date();
        currentMonth.setDate(1);
        const monthStr = currentMonth.toISOString().split('T')[0];
        
        const targetData = {
            target_month: monthStr,
            leads_target: leadsVal,
            evaluation_target: evalVal,
            conversion_target: convVal,
            updated_at: new Date().toISOString()
        };
        
        const localObj = {
            leadsTarget: leadsVal,
            evalTarget: evalVal,
            conversionTarget: convVal,
            month: monthStr
        };
        localStorage.setItem('ua_sales_targets', JSON.stringify(localObj));
        setTargets({ leadsTarget: leadsVal, evalTarget: evalVal, conversionTarget: convVal });
        
        try {
            const { error } = await supabase
                .from('academy_sales_targets')
                .upsert(targetData, { onConflict: 'target_month' });
                
            if (error) {
                console.warn("Database targets save warning:", error.message);
                toast.success("Targets updated successfully (saved locally)!");
            } else {
                toast.success("Targets updated and synchronized successfully!");
            }
        } catch (err) {
            console.warn("Database targets save catch error:", err);
            toast.success("Targets updated successfully (saved locally)!");
        }
    };

    const fetchHistoricalReports = async () => {
        try {
            const sixtyDaysAgo = new Date();
            sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
            const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];
            
            const { data, error } = await supabase
                .from('daily_reports')
                .select('*')
                .gte('report_date', sixtyDaysAgoStr)
                .order('report_date', { ascending: false });
                
            if (error) {
                console.error("Error fetching historical reports:", error);
                return;
            }
            
            setHistoricalReports(data || []);
        } catch (e) {
            console.error("Exception in fetchHistoricalReports:", e);
        }
    };

    useEffect(() => {
        if (!profile) return;
        loadTargets();
    }, [profile]);


    // Tab Resiliency Engine Integration
    useTabResiliency(
        () => {
            fetchDailyReports();
            fetchAssignments();
            fetchHistoricalReports();
        },
        loading,
        setLoading
    );

    const computedMetrics = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        
        // Helper: aggregate data for a list of entries
        const aggregate = (entries: any[]) => {
            const leads = entries.reduce((sum, r) => sum + (r.total_leads || 0), 0);
            const evals = entries.reduce((sum, r) => sum + (r.evaluations_taken || 0), 0);
            const convs = entries.reduce((sum, r) => sum + (r.conversions || 0), 0);
            const evalRate = leads > 0 ? Math.round((evals / leads) * 100) : 0;
            const closeRate = leads > 0 ? Math.round((convs / leads) * 100) : 0;
            return { leads, evals, convs, evalRate, closeRate };
        };
        
        // 1. Today's entries
        const todayEntries = historicalReports.filter(r => r.report_date === todayStr);
        const todayData = aggregate(todayEntries);
        
        // 2. Yesterday's entries
        const yesterdayEntries = historicalReports.filter(r => r.report_date === yesterdayStr);
        const yesterdayData = aggregate(yesterdayEntries);
        
        // 3. This Week's entries (last 7 days, including today)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
        const thisWeekEntries = historicalReports.filter(r => r.report_date >= sevenDaysAgoStr && r.report_date <= todayStr);
        const thisWeekData = aggregate(thisWeekEntries);
        
        // 4. Previous Week's entries (7 days before that)
        const fourteenDaysAgo = new Date();
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
        const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0];
        const prevWeekEntries = historicalReports.filter(r => r.report_date >= fourteenDaysAgoStr && r.report_date < sevenDaysAgoStr);
        const prevWeekData = aggregate(prevWeekEntries);
        
        // 5. Monthly entries (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
        const monthlyEntries = historicalReports.filter(r => r.report_date >= thirtyDaysAgoStr && r.report_date <= todayStr);
        const monthlyData = aggregate(monthlyEntries);
        
        // 6. Previous Month's entries (days 30 to 59 ago)
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 59);
        const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().split('T')[0];
        const prevMonthlyEntries = historicalReports.filter(r => r.report_date >= sixtyDaysAgoStr && r.report_date < thirtyDaysAgoStr);
        const prevMonthlyData = aggregate(prevMonthlyEntries);
        
        // Compute difference percentage function
        const getDiffPercent = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? "+100%" : "0%";
            const diff = ((curr - prev) / prev) * 100;
            return `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%`;
        };
        
        const getDiffRatePercent = (currRate: number, prevRate: number) => {
            const diff = currRate - prevRate;
            return `${diff >= 0 ? '+' : ''}${diff.toFixed(0)}%`;
        };
        
        // Month View: target achievement percentages (now all treated as raw counts/numbers instead of percentages)
        const leadsAchievement = targets.leadsTarget > 0 ? Math.round((monthlyData.leads / targets.leadsTarget) * 100) : 0;
        const evalAchievement = targets.evalTarget > 0 ? Math.round((monthlyData.evals / targets.evalTarget) * 100) : 0;
        const conversionAchievement = targets.conversionTarget > 0 ? Math.round((monthlyData.convs / targets.conversionTarget) * 100) : 0;

        const baseMonthly = {
            monthlyLeads: monthlyData.leads,
            monthlyEvals: monthlyData.evals,
            monthlyConvs: monthlyData.convs,
            leadsAchievement,
            evalAchievement,
            conversionAchievement,
        };

        if (pipelineFilter === 'today') {
            return {
                ...baseMonthly,
                leads: todayData.leads,
                evals: todayData.evals,
                convs: todayData.convs,
                evalRate: todayData.evalRate,
                closeRate: todayData.closeRate,
                leadsSub: `${getDiffPercent(todayData.leads, yesterdayData.leads)} vs yesterday`,
                evalSub: `${getDiffPercent(todayData.evals, yesterdayData.evals)} vs yesterday`,
                closeSub: `${getDiffPercent(todayData.convs, yesterdayData.convs)} vs yesterday`,
                leadsTrendUp: todayData.leads >= yesterdayData.leads,
                evalTrendUp: todayData.evals >= yesterdayData.evals,
                closeTrendUp: todayData.convs >= yesterdayData.convs
            };
        } else if (pipelineFilter === 'week') {
            return {
                ...baseMonthly,
                leads: thisWeekData.leads,
                evals: thisWeekData.evals,
                convs: thisWeekData.convs,
                evalRate: thisWeekData.evalRate,
                closeRate: thisWeekData.closeRate,
                leadsSub: `${getDiffPercent(thisWeekData.leads, prevWeekData.leads)} vs last week`,
                evalSub: `${getDiffPercent(thisWeekData.evals, prevWeekData.evals)} vs last week`,
                closeSub: `${getDiffPercent(thisWeekData.convs, prevWeekData.convs)} vs last week`,
                leadsTrendUp: thisWeekData.leads >= prevWeekData.leads,
                evalTrendUp: thisWeekData.evals >= prevWeekData.evals,
                closeTrendUp: thisWeekData.convs >= prevWeekData.convs
            };
        } else {
            return {
                ...baseMonthly,
                leads: monthlyData.leads,
                evals: monthlyData.evals,
                convs: monthlyData.convs,
                evalRate: monthlyData.evalRate,
                closeRate: monthlyData.closeRate,
                leadsSub: `${leadsAchievement}% achieved of target (${targets.leadsTarget})`,
                evalSub: `${evalAchievement}% achieved of target (${targets.evalTarget})`,
                closeSub: `${conversionAchievement}% achieved of target (${targets.conversionTarget})`,
                leadsTrendUp: monthlyData.leads >= prevMonthlyData.leads,
                evalTrendUp: monthlyData.evals >= prevMonthlyData.evals,
                closeTrendUp: monthlyData.convs >= prevMonthlyData.convs
            };
        }
    }, [historicalReports, pipelineFilter, targets]);

    const dailyLedgerLog = useMemo(() => {
        const dateGroups: { [date: string]: { leads: number, evals: number, convs: number } } = {};
        
        historicalReports.forEach((r: any) => {
            const dateStr = r.report_date;
            if (!dateGroups[dateStr]) {
                dateGroups[dateStr] = { leads: 0, evals: 0, convs: 0 };
            }
            dateGroups[dateStr].leads += r.total_leads || 0;
            dateGroups[dateStr].evals += r.evaluations_taken || 0;
            dateGroups[dateStr].convs += r.conversions || 0;
        });
        
        return Object.entries(dateGroups)
            .map(([date, data]) => {
                const evalRate = data.leads > 0 ? Math.round((data.evals / data.leads) * 100) : 0;
                const closeRate = data.leads > 0 ? Math.round((data.convs / data.leads) * 100) : 0;
                return {
                    date: new Date(date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    }),
                    rawDate: date,
                    ...data,
                    evalRate,
                    closeRate
                };
            })
            .sort((a, b) => b.rawDate.localeCompare(a.rawDate))
            .slice(0, 30);
    }, [historicalReports]);

    const calculateMetrics = (reports: SalesRepData[]) => {
        const totalLeads = reports.reduce((sum, rep) => sum + rep.leadsClaimed, 0);
        const totalEvaluations = reports.reduce((sum, rep) => sum + rep.evaluations, 0);
        const totalConverted = reports.reduce((sum, rep) => sum + rep.closed, 0);
        
        const evalRate = totalLeads > 0 ? Math.round((totalEvaluations / totalLeads) * 100) : 0;
        const closeRate = totalLeads > 0 ? Math.round((totalConverted / totalLeads) * 100) : 0;
        
        // For pending deployments, use a placeholder or could be calculated from real data
        const pendingDeployments = totalConverted > 0 ? Math.max(0, totalConverted - Math.round(totalConverted * 0.9)) : 0;

        return {
            totalLeads,
            evalRate,
            closeRate,
            pendingDeployments
        };
    };

    // Fetch assignments from database
    const fetchAssignments = async () => {
        try {
            // Fetch assigned students
            const { data: assignedData, error: assignedError } = await supabase
                .from("conversions")
                .select("*")
                .not("assigned_tutor", "is", null)
                .order("assigned_at", { ascending: false })
                .limit(10);

            if (assignedError) {
                console.error("Error fetching assignments:", assignedError);
                return;
            }

            // Fetch unassigned students count
            const { count: unassignedData, error: unassignedError } = await supabase
                .from("conversions")
                .select("id", { count: 'exact' })
                .is("assigned_tutor", null);

            if (unassignedError) {
                console.error("Error fetching unassigned count:", unassignedError);
            } else {
                setUnassignedCount(unassignedData || 0);
            }

            // Transform assigned data for display
            const transformedAssignments = assignedData?.map(assignment => {
                const assignedTime = new Date(assignment.assigned_at);
                const now = new Date();
                const diffInMinutes = Math.floor((now.getTime() - assignedTime.getTime()) / (1000 * 60));
                
                let timeAgo;
                if (diffInMinutes < 60) {
                    timeAgo = `${diffInMinutes} min ago`;
                } else if (diffInMinutes < 1440) {
                    timeAgo = `${Math.floor(diffInMinutes / 60)} hours ago`;
                } else {
                    timeAgo = `${Math.floor(diffInMinutes / 1440)} days ago`;
                }

                return {
                    id: assignment.id,
                    studentName: assignment.student_name,
                    tutorName: assignment.assigned_tutor,
                    time: timeAgo,
                };
            }) || [];

            setAssignments(transformedAssignments);
        } catch (error) {
            console.error("Error fetching assignments:", error);
        }
    };

    const fetchPipelineData = async (filter: 'today' | 'week' | 'month') => {
        try {
            const today = new Date();
            let startDate = new Date(today);
            
            if (filter === 'week') {
                startDate.setDate(today.getDate() - 7);
            } else if (filter === 'month') {
                startDate.setDate(today.getDate() - 30);
            }

            const startDateStr = startDate.toISOString().split('T')[0];
            const endDateStr = today.toISOString().split('T')[0];
            
            let query = supabase.from('daily_reports').select('*');
            
            if (filter === 'today') {
                query = query.eq('report_date', startDateStr);
            } else {
                query = query.gte('report_date', startDateStr).lte('report_date', endDateStr);
            }

            const { data, error } = await query;
            
            if (error) {
                console.error('Error fetching pipeline data:', error);
                return;
            }

            const mappedData: SalesRepData[] = (data || []).map((report: any) => ({
                id: report.id,
                name: '', // Not needed for funnel sum
                initials: '',
                leadsClaimed: report.total_leads || 0,
                contacted: (report.total_leads || 0) - (report.lost_leads || 0),
                evaluations: report.evaluations_taken || 0,
                closed: report.conversions || 0,
                rank: 0,
                efficiency_score: 0,
                conversion_rate: 0,
                lead_quality_rating: 0,
                report_date: report.report_date,
                submitted_at: report.submitted_at,
            }));

            setPipelineData(mappedData);
        } catch (error) {
            console.error('Error fetching pipeline data:', error);
        }
    };

    useEffect(() => {
        fetchPipelineData(pipelineFilter);
    }, [pipelineFilter]);

    // Fetch daily reports data
    const fetchDailyReports = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            
            // Query to get only the latest report for each staff member today
            const { data: reports, error } = await supabase
                .from('daily_reports')
                .select(`
                    *,
                    profiles!daily_reports_profile_id_fkey (
                        full_name,
                        role,
                        is_sales_staff
                    )
                `)
                .eq('report_date', today)
                .order('submitted_at', { ascending: false });

            console.log('Daily reports query result:', { reports, error, today });

            if (error) {
                console.error('Error fetching daily reports:', error);
                return;
            }

            // Debug: Log all reports before filtering
            console.log('All reports found:', reports?.length || 0);

            // Group reports by profile_id and keep only the latest one for each staff member
            const latestReportsMap = new Map();
            reports?.forEach((report: any) => {
                const profileId = report.profile_id;
                if (!latestReportsMap.has(profileId) || 
                    new Date(report.submitted_at) > new Date(latestReportsMap.get(profileId).submitted_at)) {
                    latestReportsMap.set(profileId, report);
                }
            });

            const uniqueReports = Array.from(latestReportsMap.values());
            console.log('Unique latest reports:', uniqueReports.length);

            // Transform data for display
            const transformedData: SalesRepData[] = uniqueReports
                .filter((report: any) => {
                    console.log('Processing report:', {
                        id: report.id,
                        profile_name: report.profiles?.full_name,
                        report_date: report.report_date,
                        today: today
                    });
                    return report.profiles?.full_name;
                })
                .map((report: any, index: number) => ({
                    id: report.id,
                    name: report.profiles!.full_name,
                    initials: report.profiles!.full_name
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase(),
                    leadsClaimed: report.total_leads,
                    contacted: report.total_leads - report.lost_leads, // Approximate contacted
                    evaluations: report.evaluations_taken,
                    closed: report.conversions,
                    rank: index + 1, // Will be recalculated based on conversions
                    efficiency_score: report.efficiency_score,
                    conversion_rate: report.conversion_rate,
                    lead_quality_rating: report.lead_quality_rating,
                    report_date: report.report_date,
                    submitted_at: report.submitted_at,
                }))
                .sort((a, b) => b.closed - a.closed) // Sort by conversions (closed)
                .map((rep, index) => ({ ...rep, rank: index + 1 })); // Update ranks

            console.log('Transformed data:', transformedData);
            setSalesReps(transformedData);
        } catch (error) {
            console.error('Error fetching daily reports:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Initial fetch
    useEffect(() => {
        fetchDailyReports();
        fetchAssignments();
        fetchHistoricalReports();
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchDailyReports();
        fetchAssignments();
        fetchHistoricalReports();
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] dark:bg-[#050505] p-2 md:p-6 lg:p-8">
            {/* Premium Glass-Morphism Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 md:mb-8 bg-white/60 dark:bg-zinc-900/50 backdrop-blur-xl border border-white/40 dark:border-zinc-800/60 rounded-[20px] md:rounded-[24px] shadow-lg p-4 md:p-6 lg:p-8"
            >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 md:gap-6">
                    {/* Left Side: Brand Section */}
                    <div className="flex items-center gap-3 md:gap-5 w-full lg:w-auto">
                        {/* Gradient Icon Box */}
                        <div className="relative flex items-center justify-center w-14 h-14 md:w-20 md:h-20 flex-shrink-0">
                            {/* Blurred radial accent glow */}
                            <div className="absolute inset-0 bg-[#2F1E73]/15 blur-md rounded-full"></div>
                            {/* Icon directly on glass */}
                            <Target className="relative z-10 w-8 h-8 md:w-10 md:h-10 text-[#2F1E73] dark:text-purple-400" />
                        </div>

                        {/* Title and Quote */}
                        <div className="min-w-0 flex-1">
                            <h1 className="text-xl md:text-3xl lg:text-4xl font-black text-[#1e293b] dark:text-zinc-100 uppercase tracking-tight leading-tight truncate">
                                Sales Intelligence
                            </h1>
                            <p className="text-xs md:text-sm italic text-slate-400 dark:text-zinc-400 mt-0.5 md:mt-1 line-clamp-2">
                                &quot;Real-time visibility into the acquisition pipeline.&quot;
                            </p>
                        </div>
                    </div>

                    {/* Right Side: Functional Metrics */}
                    <div className="flex flex-row items-center gap-3 md:gap-4 w-full lg:w-auto justify-between lg:justify-end flex-shrink-0">
                        {profile?.role === 'ceo' && (
                            <button
                                onClick={() => setIsTargetsModalOpen(true)}
                                className="flex items-center gap-1.5 md:gap-2 px-3.5 py-2 text-[10px] md:text-xs font-bold text-white rounded-xl shadow-md active:scale-95 transition-all duration-200"
                                style={{
                                    background: "linear-gradient(135deg, #ff4d00 0%, #dc2626 100%)",
                                    boxShadow: "0 2px 10px rgba(255, 77, 0, 0.2)"
                                }}
                            >
                                <Target className="w-3.5 h-3.5 text-white" />
                                <span className="whitespace-nowrap">Set Targets</span>
                            </button>
                        )}
                        {/* Advanced View Toggle */}
                        <AdvancedViewToggle
                            isAdvanced={isAdvancedView}
                            onToggle={setIsAdvancedView}
                        />

                        {/* Live System Status */}
                        <div className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:py-2 rounded-full bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 flex-shrink-0">
                            <div className="relative flex items-center justify-center">
                                <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full"></div>
                                <div className="absolute w-1.5 h-1.5 md:w-2 md:h-2 bg-green-500 rounded-full animate-ping"></div>
                            </div>
                            <span className="text-[10px] md:text-xs font-bold text-green-700 dark:text-green-400 tracking-wide whitespace-nowrap">
                                LIVE FEED
                            </span>
                        </div>

                        {/* Vertical faint line */}
                        <div className="w-px h-6 md:h-8 bg-slate-200 dark:bg-zinc-700 flex-shrink-0 hidden lg:block"></div>

                        {/* Date/Time Stamp */}
                        <div className="px-2.5 md:px-3 py-1.5 md:py-2 rounded-full bg-slate-100 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 flex-shrink-0 hidden xl:block">
                            <span className="text-[10px] md:text-xs font-medium text-slate-500 dark:text-zinc-400 whitespace-nowrap flex items-center gap-2">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {currentTime.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>


            {/* Top Row: 3 Metric Cards showing monthly achievements and targets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
                <TargetMetricCard
                    title="Monthly Leads Target"
                    achieved={computedMetrics.monthlyLeads}
                    target={targets.leadsTarget}
                    percentage={computedMetrics.leadsAchievement}
                    icon={Users}
                    delay={0.1}
                />
                <TargetMetricCard
                    title="Monthly Evaluation Target"
                    achieved={computedMetrics.monthlyEvals}
                    target={targets.evalTarget}
                    percentage={computedMetrics.evalAchievement}
                    icon={Target}
                    delay={0.2}
                />
                <TargetMetricCard
                    title="Monthly Conversions Target"
                    achieved={computedMetrics.monthlyConvs}
                    target={targets.conversionTarget}
                    percentage={computedMetrics.conversionAchievement}
                    icon={CheckCircle2}
                    delay={0.3}
                />
            </div>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass-card-ua rounded-2xl p-6 mb-8"
            >
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-1 h-5 rounded-full"
                            style={{ backgroundColor: BRAND_COLORS.orange }}
                        />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
                            Sales Flow
                        </h3>
                    </div>
                    
                    {/* Pipeline Filter */}
                    <div className="flex bg-gray-100/50 dark:bg-zinc-800/50 rounded-lg p-1">
                        <button
                            onClick={() => setPipelineFilter('today')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                                pipelineFilter === 'today'
                                    ? 'bg-white dark:bg-zinc-700 text-[#FA4615] shadow-sm'
                                    : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
                            }`}
                        >
                            Today
                        </button>
                        <button
                            onClick={() => setPipelineFilter('week')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                                pipelineFilter === 'week'
                                    ? 'bg-white dark:bg-zinc-700 text-[#FA4615] shadow-sm'
                                    : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
                            }`}
                        >
                            Week
                        </button>
                        <button
                            onClick={() => setPipelineFilter('month')}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                                pipelineFilter === 'month'
                                    ? 'bg-white dark:bg-zinc-700 text-[#FA4615] shadow-sm'
                                    : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
                            }`}
                        >
                            Month
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-3">
                    <FunnelStep
                        stage="Leads"
                        count={computedMetrics.leads}
                        conversion="100%"
                        icon={Users}
                        isFirst={true}
                        isLast={false}
                        delay={0.4}
                        footer={computedMetrics.leadsSub}
                        trendUp={computedMetrics.leadsTrendUp}
                    />
                    <FunnelStep
                        stage="Evaluations"
                        count={computedMetrics.evals}
                        conversion={`${computedMetrics.evalRate}%`}
                        icon={FileText}
                        isFirst={false}
                        isLast={false}
                        delay={0.5}
                        footer={computedMetrics.evalSub}
                        trendUp={computedMetrics.evalTrendUp}
                    />
                    <FunnelStep
                        stage="Converted"
                        count={computedMetrics.convs}
                        conversion={`${computedMetrics.closeRate}%`}
                        icon={CheckCircle2}
                        isFirst={false}
                        isLast={true}
                        delay={0.6}
                        footer={computedMetrics.closeSub}
                        trendUp={computedMetrics.closeTrendUp}
                    />
                </div>

            </motion.div>

            {/* Bottom Grid: 2 Columns */}
            <div className="grid grid-cols-2 gap-6">
                {/* Column 1: Sales Matrix */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 }}
                    className="glass-card-ua rounded-2xl p-6"
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <div
                                className="w-1 h-5 rounded-full"
                                style={{ backgroundColor: BRAND_COLORS.indigo }}
                            />
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400">
                                Sales Matrix
                            </h3>
                            <Badge
                                variant="outline"
                                className="text-xs"
                                style={{ borderColor: BRAND_COLORS.indigo, color: BRAND_COLORS.indigo }}
                            >
                                Today&apos;s Reports
                            </Badge>
                        </div>
                        {(userRole === 'CEO' || userRole === 'MANAGER') && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-gray-500 hover:text-gray-700"
                                onClick={handleRefresh}
                                disabled={refreshing}
                            >
                                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            </Button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Agent
                                    </th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Leads
                                    </th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Evals
                                    </th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Converted
                                    </th>
                                    <th className="text-center py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Not Conv
                                    </th>
                                    <th className="text-right py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Lead Quality
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="py-8 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="animate-spin h-4 w-4 border-2 border-gray-300 border-t-gray-600 rounded-full"></div>
                                                <span className="text-sm text-gray-500">Loading daily reports...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : salesReps.length === 0 ? (
                                    <>
                                        <tr>
                                            <td colSpan={6} className="py-12">
                                                <div className="flex flex-col items-center gap-2 relative z-10">
                                                    <Users className="w-8 h-8 text-gray-300 dark:text-zinc-600 mb-2" />
                                                    <p className="text-sm text-gray-500 dark:text-zinc-400 font-medium">No daily reports submitted today</p>
                                                    <p className="text-xs text-gray-400 dark:text-zinc-500">Sales staff reports will appear here once submitted</p>
                                                </div>
                                            </td>
                                        </tr>

                                    </>
                                ) : (
                                    salesReps.map((rep, index) => (
                                        <SalesRepRow key={rep.id} rep={rep} index={index} />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </motion.div>

                {/* Column 2: Sales Daily Ledger Log */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 }}
                    className="glass-card-ua rounded-2xl p-6 flex flex-col justify-between"
                >
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-1 h-5 rounded-full"
                                    style={{ backgroundColor: BRAND_COLORS.orange }}
                                />
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
                                    Sales Daily Ledger Log
                                </h3>
                            </div>
                            <Badge
                                variant="outline"
                                className="text-xs"
                                style={{ borderColor: BRAND_COLORS.orange, color: BRAND_COLORS.orange }}
                            >
                                Last 30 Days
                            </Badge>
                        </div>

                        <ScrollArea className="h-[320px] pr-4">
                            <div className="space-y-2">
                                {dailyLedgerLog.map((day) => (
                                    <div 
                                        key={day.rawDate} 
                                        className="p-3 rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-100/60 dark:border-zinc-800/40 hover:bg-slate-50 dark:hover:bg-zinc-800/60 transition-all flex flex-col sm:flex-row justify-between sm:items-center gap-2"
                                    >
                                        <div>
                                            <span className="text-xs font-bold text-[#1e293b] dark:text-zinc-200">{day.date}</span>
                                            <div className="flex gap-3 text-[10px] font-semibold text-slate-500 mt-1 uppercase tracking-wider">
                                                <span>Leads: {day.leads}</span>
                                                <span>Evals: {day.evals}</span>
                                                <span>Convs: {day.convs}</span>
                                            </div>
                                        </div>

                                    </div>
                                ))}
                                {dailyLedgerLog.length === 0 && (
                                    <div className="text-center py-12">
                                        <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                                        <p className="text-sm text-gray-500 font-medium">No sales ledger logs yet</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>

                    <div className="pt-4 mt-4 border-t border-gray-100 dark:border-zinc-800/60 flex items-center justify-between text-xs text-gray-400 select-none">
                        <span>Daily cumulative metrics</span>
                        <span className="font-bold text-[#2F1E73] dark:text-purple-400">Total days: {dailyLedgerLog.length}</span>
                    </div>
                </motion.div>
            </div>

            {/* Detailed Matrix Section - Appears in Advanced View */}
            <AnimatePresence>
                {isAdvancedView && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, scale: 0.95 }}
                        animate={{ 
                            opacity: 1, 
                            height: "auto", 
                            scale: 1,
                            transition: {
                                height: { duration: 0.6, ease: "easeInOut" },
                                opacity: { duration: 0.4, delay: 0.1 },
                                scale: { duration: 0.5, ease: "easeOut" }
                            }
                        }}
                        exit={{ 
                            opacity: 0, 
                            height: 0, 
                            scale: 0.95,
                            transition: {
                                height: { duration: 0.4, ease: "easeInOut" },
                                opacity: { duration: 0.3 },
                                scale: { duration: 0.3, ease: "easeIn" }
                            }
                        }}
                        className="overflow-hidden"
                    >
                        <motion.div
                            className="m-6 space-y-6"
                            initial={{ y: 20 }}
                            animate={{ y: 0 }}
                            transition={{ duration: 0.5, delay: 0.2 }}
                        >
                            {/* Sales Staff Velocity - Only in Advanced View */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: 0.1 }}
                            >
                                <CEOStaffVelocity />
                            </motion.div>
                            
                            <DetailedMatrix salesReps={salesReps} historicalReports={historicalReports} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Set Sales Targets Modal */}
            <SetSalesTargetsModal
                isOpen={isTargetsModalOpen}
                onClose={() => setIsTargetsModalOpen(false)}
                currentTargets={targets}
                onSave={handleSaveTargets}
            />
        </div>
    );
}

// =====================================================
// DIALOG / MODAL FOR SETTING ACADEMY SALES TARGETS
// =====================================================
interface SetSalesTargetsModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentTargets: {
        leadsTarget: number;
        evalTarget: number;
        conversionTarget: number;
    };
    onSave: (leads: number, evals: number, convs: number) => Promise<void>;
}

function SetSalesTargetsModal({
    isOpen,
    onClose,
    currentTargets,
    onSave
}: SetSalesTargetsModalProps) {
    const [leadsVal, setLeadsVal] = useState(currentTargets.leadsTarget.toString());
    const [evalVal, setEvalVal] = useState(currentTargets.evalTarget.toString());
    const [convVal, setConvVal] = useState(currentTargets.conversionTarget.toString());
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setLeadsVal(currentTargets.leadsTarget.toString());
        setEvalVal(currentTargets.evalTarget.toString());
        setConvVal(currentTargets.conversionTarget.toString());
    }, [currentTargets, isOpen]);

    const handleSave = async () => {
        const leads = Math.max(0, parseInt(leadsVal) || 0);
        const ev = Math.max(0, parseInt(evalVal) || 0);
        const cv = Math.max(0, parseInt(convVal) || 0);
        
        setIsSaving(true);
        try {
            await onSave(leads, ev, cv);
            onClose();
        } catch (e) {
            console.error("Save targets error:", e);
            toast.error("Failed to save sales targets.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md bg-white dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-3xl p-6 shadow-2xl">
                <DialogHeader className="mb-4">
                    <DialogTitle className="text-xl font-black text-slate-900 dark:text-zinc-100 flex items-center gap-2 uppercase tracking-wide">
                        <Target className="w-5 h-5 text-[#FA4615]" />
                        Set Monthly Sales Targets
                    </DialogTitle>
                    <p className="text-xs text-slate-400">Configure target values for the current active month</p>
                </DialogHeader>

                <div className="space-y-6 py-2">
                    {/* Leads Target Card */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-2">
                            <Label htmlFor="leads-target-input" className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Leads Target</Label>
                            <Input
                                id="leads-target-input"
                                type="number"
                                value={leadsVal}
                                onChange={(e) => setLeadsVal(e.target.value)}
                                className="w-28 text-right font-mono font-bold text-slate-950 dark:text-white bg-white dark:bg-zinc-800 border-2 border-slate-300 dark:border-zinc-600 focus:border-[#FA4615] focus:ring-1 focus:ring-[#FA4615] rounded-xl h-9 px-3 transition-all"
                            />
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="5000"
                            step="50"
                            value={leadsVal}
                            onChange={(e) => setLeadsVal(e.target.value)}
                            className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#FA4615]"
                        />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-semibold">
                            <span>0</span>
                            <span>2,500</span>
                            <span>5,000</span>
                        </div>
                    </div>

                    {/* Evaluation Target Card */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-2">
                            <Label htmlFor="eval-target-input" className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Evaluation Target</Label>
                            <Input
                                id="eval-target-input"
                                type="number"
                                value={evalVal}
                                onChange={(e) => setEvalVal(e.target.value)}
                                className="w-28 text-right font-mono font-bold text-slate-950 dark:text-white bg-white dark:bg-zinc-800 border-2 border-slate-300 dark:border-zinc-600 focus:border-[#FA4615] focus:ring-1 focus:ring-[#FA4615] rounded-xl h-9 px-3 transition-all"
                            />
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="1000"
                            step="10"
                            value={evalVal}
                            onChange={(e) => setEvalVal(e.target.value)}
                            className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#FA4615]"
                        />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-semibold">
                            <span>0</span>
                            <span>500</span>
                            <span>1,000</span>
                        </div>
                    </div>

                    {/* Conversion Target Card */}
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                        <div className="flex justify-between items-center mb-2">
                            <Label htmlFor="conv-target-input" className="text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">Conversion Target</Label>
                            <Input
                                id="conv-target-input"
                                type="number"
                                value={convVal}
                                onChange={(e) => setConvVal(e.target.value)}
                                className="w-28 text-right font-mono font-bold text-slate-950 dark:text-white bg-white dark:bg-zinc-800 border-2 border-slate-300 dark:border-zinc-600 focus:border-[#FA4615] focus:ring-1 focus:ring-[#FA4615] rounded-xl h-9 px-3 transition-all"
                            />
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="500"
                            step="5"
                            value={convVal}
                            onChange={(e) => setConvVal(e.target.value)}
                            className="w-full h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#FA4615]"
                        />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1 font-semibold">
                            <span>0</span>
                            <span>250</span>
                            <span>500</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 justify-end mt-6">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="rounded-xl border border-slate-100 hover:bg-slate-50"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="rounded-xl font-bold bg-[#FA4615] hover:bg-[#FA4615]/90 text-white shadow-lg active:scale-95 transition-all"
                    >
                        {isSaving ? "Saving..." : "Save Targets"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default ExecutiveSalesOverview;
