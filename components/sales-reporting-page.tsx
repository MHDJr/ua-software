"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
    Clock,
    Target,
    TrendingUp,
    Users,
    Phone,
    FileText,
    XCircle,
    Send,
    Plus,
    ChevronLeft,
    Award,
    Sun,
    Moon,
    Coffee,
    Sparkles,
    Smile,
    RefreshCw,
    BarChart3,
    Activity,
    CheckCircle2,
    Star,
    Home,
    MessageSquare,
    User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import MobileNavigation from "@/components/mobile-navigation";
import { MonthlyProgressGauge } from "@/components/monthly-progress-gauge";
import { MonthlyConversionTracker } from "@/components/monthly-conversion-tracker";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ProfileModal } from "@/components/ProfileModal";
import { isValidAvatarUrl } from "@/lib/utils";


// Brand colors matching Staff Hub exactly
const BRAND = {
    navy: "#2F1E73",
    orange: "#FA4615",
    lightNavy: "#3F348C",
    softOrange: "#FEF2EE",
    bg: "#F4F7FE",
};

// Confetti effect function
const triggerConfetti = () => {
    const colors = [BRAND.navy, BRAND.orange, "#16a34a", "#f59e0b"];
    const confettiCount = 60;

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement("div");
        confetti.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            width: 10px;
            height: 10px;
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

            confetti.style.transform = `
                translate(calc(-50% + ${x}px), calc(-50% + ${y}px))
                scale(${scale})
            `;
            confetti.style.opacity = opacity.toString();

            if (opacity > 0) {
                requestAnimationFrame(animate);
            } else {
                document.body.removeChild(confetti);
            }
        };

        requestAnimationFrame(animate);
    }
};

// Get greeting based on time of day
const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12)
        return {
            text: "GOOD MORNING",
            icon: <Sun className="w-8 h-8 text-orange-400" />,
        };
    if (hour < 18)
        return {
            text: "GOOD AFTERNOON",
            icon: <Coffee className="w-8 h-8 text-orange-400" />,
        };
    return {
        text: "GOOD EVENING",
        icon: <Moon className="w-8 h-8 text-orange-400" />,
    };
};

// Interface for monthly target data
interface MonthlyTarget {
    id: string;
    target_value: number;
    current_progress: number;
    achievement_percentage: number;
}

export function SalesReportingPage({ backPath = "/staff" }: { backPath?: string }) {
    const { profile, user } = useAuth();
    const [time, setTime] = useState("");
    const [vibe, setVibe] = useState("Focused");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
    const [conversionCount, setConversionCount] = useState("1");
    const [isAddingConversion, setIsAddingConversion] = useState(false);
    const [mobileNavTab, setMobileNavTab] = useState("home");
    const [hasSubmittedToday, setHasSubmittedToday] = useState(false);
    const [todayReportId, setTodayReportId] = useState<string | null>(null);
    const [monthlyTarget, setMonthlyTarget] = useState<MonthlyTarget | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    // Form states with localStorage persistence
    const [totalLeads, setTotalLeads] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('sales_totalLeads') || "";
        }
        return "";
    });
    const [conversions, setConversions] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sales_conversions');
            console.log('Loading conversions from localStorage:', saved);
            return saved || "0";
        }
        return "0";
    });
    const [evaluations, setEvaluations] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('sales_evaluations') || "";
        }
        return "";
    });
    const [lostLeads, setLostLeads] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('sales_lostLeads') || "";
        }
        return "";
    });
    const [leadQuality, setLeadQuality] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sales_leadQuality');
            return saved ? JSON.parse(saved) : [7];
        }
        return [7];
    });

    // 12-Hour Format Timer Logic
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

    // Update tracking data in database whenever form values change
    useEffect(() => {
        if (typeof window !== 'undefined' && user && profile) {
            console.log('Updating tracking data in database:', { totalLeads, conversions, evaluations, lostLeads, leadQuality });
            
            const updateTrackingData = async () => {
                try {
                    const today = new Date().toISOString().split("T")[0];
                    
                    const { data, error } = await supabase
                        .from("daily_sales_tracking")
                        .upsert({
                            profile_id: profile.id,
                            tracking_date: today,
                            total_leads: parseInt(totalLeads) || 0,
                            conversions: parseInt(conversions) || 0,
                            evaluations_taken: parseInt(evaluations) || 0,
                            lost_leads: parseInt(lostLeads) || 0,
                            lead_quality_rating: leadQuality[0] || 7,
                            updated_at: new Date().toISOString(),
                        })
                        .select();
                    
                    if (error) {
                        console.error('Database update error:', error);
                        // If table doesn't exist, fall back to localStorage only
                        if (error.message.includes('relation') && error.message.includes('does not exist')) {
                            console.log('daily_sales_tracking table does not exist, using localStorage fallback');
                        }
                    } else {
                        console.log('Database update successful:', data);
                    }
                } catch (err) {
                    console.error('Unexpected error updating tracking data:', err);
                }
            };
            
            // Debounce the update to avoid too frequent database calls
            const timeoutId = setTimeout(updateTrackingData, 1000);
            return () => clearTimeout(timeoutId);
        }
    }, [totalLeads, conversions, evaluations, lostLeads, leadQuality, user, profile]);

    // Also save to localStorage as backup
    useEffect(() => {
        if (typeof window !== 'undefined') {
            console.log('Saving to localStorage:', { totalLeads, conversions, evaluations, lostLeads, leadQuality });
            localStorage.setItem('sales_totalLeads', totalLeads);
            localStorage.setItem('sales_conversions', conversions);
            localStorage.setItem('sales_evaluations', evaluations);
            localStorage.setItem('sales_lostLeads', lostLeads);
            localStorage.setItem('sales_leadQuality', JSON.stringify(leadQuality));
            
            // Also save a timestamp to track when data was last saved
            localStorage.setItem('sales_lastSaved', new Date().toISOString());
        }
    }, [totalLeads, conversions, evaluations, lostLeads, leadQuality]);

    // Fetch monthly target data
    const fetchSalesMonthlyTarget = async () => {
        if (!profile) return null;
        
        try {
            const currentMonth = new Date();
            currentMonth.setDate(1); // First day of current month
            
            const { data, error } = await supabase
                .from('monthly_targets')
                .select('*')
                .eq('profile_id', profile.id)
                .eq('department', 'sales')
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

    // Check if user has already submitted report today
    useEffect(() => {
        const checkTodaySubmission = async () => {
            if (!user || !profile) return;

            const today = new Date().toISOString().split("T")[0];
            
            // For now, use localStorage as primary storage since database table may not exist
            // This ensures data persistence even if database operations fail
            loadFromLocalStorage();
            
            // Try to use database if available, but don't depend on it
            try {
                const { data: trackingData, error: trackingError } = await supabase
                    .from("daily_sales_tracking")
                    .select("*")
                    .eq("profile_id", profile.id)
                    .eq("tracking_date", today)
                    .single();

                if (!trackingError && trackingData) {
                    console.log('Loading tracking data from database:', trackingData);
                    // Only use database data if localStorage is empty/defaults
                    const localConversions = localStorage.getItem('sales_conversions') || "0";
                    if (localConversions === "0" && trackingData.conversions > 0) {
                        setConversions(trackingData.conversions.toString());
                        setTotalLeads(trackingData.total_leads?.toString() || "");
                        setEvaluations(trackingData.evaluations_taken?.toString() || "");
                        setLostLeads(trackingData.lost_leads?.toString() || "");
                        setLeadQuality([trackingData.lead_quality_rating || 7]);
                    }
                }
            } catch (err) {
                console.log('Database tracking not available, using localStorage only');
            }
            
            // Check if report has been submitted today (separate from tracking)
            const { data: reportData, error: reportError } = await supabase
                .from("daily_reports")
                .select("id, submitted_at")
                .eq("profile_id", profile.id)
                .eq("report_date", today)
                .single();

            if (reportData && !reportError) {
                setHasSubmittedToday(true);
                setTodayReportId(reportData.id);
            }
            
            // Load monthly target data
            const targetData = await fetchSalesMonthlyTarget();
            setMonthlyTarget(targetData);
        };

        const loadFromLocalStorage = () => {
            const localConversions = localStorage.getItem('sales_conversions') || "0";
            const localTotalLeads = localStorage.getItem('sales_totalLeads') || "";
            const localEvaluations = localStorage.getItem('sales_evaluations') || "";
            const localLostLeads = localStorage.getItem('sales_lostLeads') || "";
            const localLeadQuality = JSON.parse(localStorage.getItem('sales_leadQuality') || "[7]");
            
            console.log('Loading from localStorage:', { localConversions, localTotalLeads, localEvaluations, localLostLeads, localLeadQuality });
            
            setTotalLeads(localTotalLeads);
            setConversions(localConversions);
            setEvaluations(localEvaluations);
            setLostLeads(localLostLeads);
            setLeadQuality(localLeadQuality);
        };

        checkTodaySubmission();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, profile]);

    // Daily reset at midnight
    useEffect(() => {
        const checkMidnightReset = () => {
            const now = new Date();
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            
            const msUntilMidnight = tomorrow.getTime() - now.getTime();
            
            const resetTimer = setTimeout(() => {
                // Clear localStorage for new day
                localStorage.removeItem('sales_totalLeads');
                localStorage.removeItem('sales_conversions');
                localStorage.removeItem('sales_evaluations');
                localStorage.removeItem('sales_lostLeads');
                localStorage.removeItem('sales_leadQuality');
                localStorage.removeItem('sales_lastSaved');
                
                // Reset form values
                setTotalLeads("");
                setConversions("0");
                setEvaluations("");
                setLostLeads("");
                setLeadQuality([7]);
                setHasSubmittedToday(false);
                setTodayReportId(null);
                
                toast.success("New day started! Sales metrics reset.");
                
                // Set up next day's reset
                checkMidnightReset();
            }, msUntilMidnight);
            
            return () => clearTimeout(resetTimer);
        };
        
        checkMidnightReset();
    }, []);

    // Calculate conversion rate
    const conversionRate = useMemo(() => {
        const total = parseInt(totalLeads) || 0;
        const conv = parseInt(conversions) || 0;
        return total > 0 ? Math.round((conv / total) * 100) : 0;
    }, [totalLeads, conversions]);

    // Calculate efficiency score
    const efficiencyScore = useMemo(() => {
        const total = parseInt(totalLeads) || 0;
        const conv = parseInt(conversions) || 0;
        const evals = parseInt(evaluations) || 0;
        const lost = parseInt(lostLeads) || 0;
        
        if (total === 0) return 0;
        
        // Weighted score: conversions 50%, evaluations 30%, lead quality 20%
        const convWeight = (conv / total) * 50;
        const evalWeight = (evals / total) * 30;
        const qualityWeight = (leadQuality[0] / 10) * 20;
        
        return Math.round(convWeight + evalWeight + qualityWeight);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [totalLeads, conversions, evaluations, leadQuality]);

    const handleTransmitReport = async () => {
        if (hasSubmittedToday) {
            toast.error("You have already submitted your daily report today. Come back tomorrow!");
            return;
        }

        if (!totalLeads || !conversions || !evaluations || !lostLeads) {
            toast.error("Please fill in all metrics before transmitting");
            return;
        }

        if (!user || !profile) {
            toast.error("Please login to submit report");
            return;
        }

        setIsSubmitting(true);

        try {
            // Use localStorage values as primary source since database table may not exist
            const today = new Date().toISOString().split("T")[0];
            const reportData = {
                user_id: user.id,
                profile_id: profile.id,
                reporter_name: profile.full_name || profile.email || "Sales Agent",
                report_date: today,
                total_leads: parseInt(totalLeads) || 0,
                conversions: parseInt(conversions) || 0,
                evaluations_taken: parseInt(evaluations) || 0,
                lost_leads: parseInt(lostLeads) || 0,
                lead_quality_rating: leadQuality[0] || 7,
                conversion_rate: conversionRate,
                efficiency_score: efficiencyScore,
                submitted_at: new Date().toISOString(),
            };

            const { data, error } = await supabase
                .from("daily_reports")
                .upsert(reportData, {
                    onConflict: "profile_id,report_date"
                })
                .select();

            if (error) {
                console.error("Submit error:", error);
                toast.error("Failed to transmit report: " + error.message);
                setIsSubmitting(false);
                return;
            }

            // Mark as submitted today
            setHasSubmittedToday(true);
            
            triggerConfetti();
            toast.success("Daily Sales Report Updated!", {
                description: `Report #${data?.[0]?.id} updated for ${profile?.full_name?.split(" ")[0] || "Agent"}`,
            });
            
            // Don't reset form - keep data for reference
            // setTotalLeads("");
            // setConversions("");
            // setEvaluations("");
            // setLostLeads("");
            // setLeadQuality([7]);
        } catch (error) {
            console.error("Submit exception:", error);
            toast.error("Something went wrong transmitting the report");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleAddConversion = async () => {
        if (hasSubmittedToday) {
            toast.error("Cannot add conversions after daily report has been submitted");
            return;
        }

        const count = parseInt(conversionCount) || 0;
        if (count <= 0) {
            toast.error("Please enter a valid number of conversions");
            return;
        }

        if (!user || !profile) {
            toast.error("Please login to add conversions");
            return;
        }

        setIsAddingConversion(true);

        try {
            // Store conversion with a generic name since we're bulk adding
            const conversionData = {
                staff_id: profile.id,
                staff_name: profile.full_name || profile.email || "Sales Agent",
                student_name: `${count} Conversion(s) Added`,
                conversion_date: new Date().toISOString().split("T")[0],
                created_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from("conversions")
                .insert(conversionData);

            if (error) {
                console.error("Conversion error:", error);
                toast.error("Failed to add conversion: " + error.message);
                return;
            }

            // Update conversions count in the form
            const currentConversions = parseInt(conversions) || 0;
            setConversions((currentConversions + count).toString());

            // Only update daily report if it has been submitted today
            if (hasSubmittedToday && todayReportId) {
                const total = parseInt(totalLeads) || 0;
                const nextConversions = currentConversions + count;
                const nextConversionRate = total > 0 ? Math.round((nextConversions / total) * 100) : 0;
                
                const evals = parseInt(evaluations) || 0;
                const nextEfficiencyScore = total > 0 ? Math.round(
                    (nextConversions / total) * 50 +
                    (evals / total) * 30 +
                    (leadQuality[0] / 10) * 20
                ) : 0;

                const { error: updateError } = await supabase
                    .from("daily_reports")
                    .update({
                        conversions: nextConversions,
                        conversion_rate: nextConversionRate,
                        efficiency_score: nextEfficiencyScore,
                    })
                    .eq("id", todayReportId);

                if (updateError) {
                    console.error("Update report error:", updateError);
                    toast.error("Failed to update daily report conversions: " + updateError.message);
                }
            }

            triggerConfetti();
            toast.success(`${count} conversion(s) added!`, {
                description: "Conversion count updated successfully",
            });

            // Reset modal
            setConversionCount("1");
            setIsConversionModalOpen(false);
        } catch (error) {
            console.error("Add conversion exception:", error);
            toast.error("Something went wrong adding the conversion");
        } finally {
            setIsAddingConversion(false);
        }
    };

    const greeting = getGreeting();
    const agentName = profile?.full_name?.split(" ")[0] || "AGENT";

    return (
        <div className="min-h-screen max-w-[100vw] overflow-x-hidden bg-slate-50/50" style={{ backgroundColor: BRAND.bg }}>
            {/* Mobile Header - Compact Status Bar */}
            <header className="md:hidden h-16 bg-white/90 backdrop-blur-xl border-b border-slate-200 flex items-center justify-between px-4 sticky top-0 z-50">
                <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/images/usthadacademylogo2.svg"
                            alt="UA Logo"
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <div className="flex items-center px-2 py-1 rounded-lg" style={{ backgroundColor: `${BRAND.navy}10` }}>
                        <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: BRAND.navy }}>
                            SALES
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-xs font-bold text-slate-900">{time}</p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase">{agentName}</p>
                    </div>
                    <div
                        onClick={() => setIsProfileModalOpen(true)}
                        style={{ backgroundColor: BRAND.navy }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-300"
                    >
                        {profile?.avatar_url && isValidAvatarUrl(profile.avatar_url) ? (
                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            profile?.avatar_url || (profile?.full_name?.[0] || profile?.email?.[0] || "U")
                        )}
                    </div>
                </div>
            </header>

            {/* Desktop Header */}
            <header className="hidden md:flex h-20 bg-white border-b border-slate-200 items-center justify-between px-8 sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        {/* Logo */}
                        <div className="relative">
                            <div className="relative h-12 w-12">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="/images/usthadacademylogo2.svg"
                                    alt="UA Logo"
                                    className="h-full w-full object-contain"
                                />
                            </div>
                        </div>
                        <div className="hidden md:block h-12 relative w-48">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/images/verticallogo.svg"
                                alt="Usthad Academy"
                                className="h-full w-full object-contain object-left"
                                style={{
                                    filter: "brightness(0) saturate(100%) invert(13%) sepia(33%) saturate(4725%) hue-rotate(248deg) brightness(94%) contrast(96%)",
                                }}
                            />
                        </div>
                        <div className="hidden md:flex items-center px-3 py-1.5 rounded-lg" style={{ backgroundColor: `${BRAND.navy}10` }}>
                            <span className="text-sm font-semibold uppercase tracking-wider" style={{ color: BRAND.navy }}>
                                SALES COMMAND | DAILY REPORT
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Mobile: Back to Hub Link */}
                    <Link href={backPath} className="md:hidden">
                        <button className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-[9px] font-black uppercase tracking-wider text-slate-600">
                            <ChevronLeft className="w-3 h-3" />
                            Hub
                        </button>
                    </Link>

                    {/* Desktop: Back to Hub Link */}
                    <Link href={backPath} className="hidden md:block">
                        <button className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all text-[10px] font-black uppercase tracking-widest text-slate-600">
                            <ChevronLeft className="w-4 h-4" />
                            Back to Hub
                        </button>
                    </Link>

                    <div className="hidden md:block text-right">
                        <p className="text-sm font-bold text-slate-900">
                            {profile?.full_name || "Loading..."}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">
                            Sales Command Staff
                        </p>
                    </div>
                    <div
                        onClick={() => setIsProfileModalOpen(true)}
                        style={{ backgroundColor: BRAND.navy }}
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold shadow-md overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-300"
                    >
                        {profile?.avatar_url && isValidAvatarUrl(profile.avatar_url) ? (
                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            profile?.avatar_url || (profile?.full_name?.[0] || profile?.email?.[0] || "U")
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content - Mobile: single column, Desktop: grid */}
            <main className="p-4 sm:p-6 lg:p-8 max-w-[1700px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* LEFT COLUMN: Data Tracking & Core Inputs */}
                <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
                    

                    
                    {/* Daily Metrics Input Card */}
                    <div className="bg-white/80 backdrop-blur-md border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] rounded-2xl p-6">
                        <div className="flex items-end justify-between mb-8">
                            <div>
                                <h2 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
                                    Daily Metrics
                                    <Target className="w-5 h-5" style={{ color: BRAND.orange }} />
                                </h2>
                                <p className="text-xs text-slate-400 font-medium">Record today&apos;s performance data</p>
                            </div>
                            <Badge
                                variant="outline"
                                className="text-[10px] font-black uppercase tracking-wider px-3 py-1"
                                style={{ borderColor: BRAND.navy, color: BRAND.navy }}
                            >
                                <Clock className="w-3 h-3 mr-1" />
                                {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                            </Badge>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Total Leads */}
                            <div className="space-y-3">
                                <Label className="text-xs font-bold text-slate-700 flex items-center gap-2 uppercase tracking-widest">
                                    <Users className="w-4 h-4" style={{ color: BRAND.navy }} />
                                    Total Leads Today
                                </Label>
                                <Input
                                    type="number"
                                    placeholder="Enter number..."
                                    value={totalLeads}
                                    onChange={(e) => setTotalLeads(e.target.value)}
                                    className="h-14 bg-slate-50/50 border border-slate-200/80 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/60 transition-all text-lg font-bold text-slate-900 placeholder:text-slate-400"
                                />
                            </div>

                            {/* Conversions */}
                            <div className="space-y-3">
                                <Label className="text-xs font-bold text-slate-700 flex items-center gap-2 uppercase tracking-widest">
                                    <Target className="w-4 h-4" style={{ color: BRAND.navy }} />
                                    Conversions
                                </Label>
                                <Input
                                    type="number"
                                    placeholder="Enter number..."
                                    value={conversions}
                                    onChange={(e) => setConversions(e.target.value)}
                                    className="h-14 bg-slate-50/50 border border-slate-200/80 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/60 transition-all text-lg font-bold text-slate-900 placeholder:text-slate-400"
                                />
                            </div>

                            {/* Evaluations Taken */}
                            <div className="space-y-3">
                                <Label className="text-xs font-bold text-slate-700 flex items-center gap-2 uppercase tracking-widest">
                                    <FileText className="w-4 h-4" style={{ color: BRAND.navy }} />
                                    Evaluations Taken
                                </Label>
                                <Input
                                    type="number"
                                    placeholder="Enter number..."
                                    value={evaluations}
                                    onChange={(e) => setEvaluations(e.target.value)}
                                    className="h-14 bg-slate-50/50 border border-slate-200/80 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/60 transition-all text-lg font-bold text-slate-900 placeholder:text-slate-400"
                                />
                            </div>

                            {/* Lost Leads */}
                            <div className="space-y-3">
                                <Label className="text-xs font-bold text-slate-700 flex items-center gap-2 uppercase tracking-widest">
                                    <XCircle className="w-4 h-4" style={{ color: BRAND.navy }} />
                                    Lost Leads
                                </Label>
                                <Input
                                    type="number"
                                    placeholder="Enter number..."
                                    value={lostLeads}
                                    onChange={(e) => setLostLeads(e.target.value)}
                                    className="h-14 bg-slate-50/50 border border-slate-200/80 rounded-xl focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/60 transition-all text-lg font-bold text-slate-900 placeholder:text-slate-400"
                                />
                            </div>
                        </div>
                    </div>
                    
                </div>

                {/* RIGHT COLUMN: Utilities, Status & Final Actions */}
                <div className="col-span-1 lg:col-span-4 flex flex-col gap-6">
                    
                    {/* Meta Utility Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-white/80 backdrop-blur-md border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] rounded-2xl p-6"
                    >
                        <h3 className="text-xs font-black tracking-widest uppercase text-slate-400 mb-6 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-indigo-500" />
                            Live Status
                        </h3>
                        
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100/50 flex flex-col items-center">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">Conv. Rate</p>
                                <div className="flex items-center gap-1.5">
                                    <TrendingUp className="w-4 h-4" style={{ color: conversionRate >= 50 ? "#10b981" : BRAND.orange }} />
                                    <span className="text-xl font-black text-slate-800">{conversionRate}%</span>
                                </div>
                            </div>
                            <div className="bg-slate-50/50 rounded-xl p-4 border border-slate-100/50 flex flex-col items-center">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">Efficiency</p>
                                <div className="flex items-center gap-1.5">
                                    <Award className="w-4 h-4 text-indigo-500" />
                                    <span className="text-xl font-black text-slate-800">{efficiencyScore}%</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1 bg-slate-50/50 rounded-xl p-3 border border-slate-100/50 flex flex-col justify-center items-center">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Shift Clock</p>
                                <p className="text-sm font-black text-slate-800 tabular-nums">{time.split(' ')[0]}</p>
                            </div>
                            <button onClick={() => setVibe(vibe === "Focused" ? "Unstoppable" : "Focused")} className="flex-1 bg-slate-50/50 rounded-xl p-3 border border-slate-100/50 flex flex-col justify-center items-center hover:bg-slate-100 transition-colors">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">Vibe</p>
                                <p className="text-xs font-black text-indigo-600 uppercase flex items-center gap-1">
                                    <Smile className="w-3 h-3" /> {vibe}
                                </p>
                            </button>
                        </div>
                    </motion.div>

                    {/* Quality Assessment Slider */}
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-[#1e1b4b] rounded-2xl p-6 text-white shadow-[0_8px_30px_rgba(30,27,75,0.2)] relative overflow-hidden border border-indigo-500/20"
                    >
                        <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 bg-indigo-500 filter blur-[40px]"></div>
                        
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="p-1.5 bg-white/10 rounded-lg">
                                    <Star className="w-4 h-4 text-indigo-300" />
                                </div>
                                <span className="text-xs font-black tracking-widest uppercase text-white/70">
                                    Quality Assessment
                                </span>
                            </div>

                            <div className="flex flex-col gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black border-2 border-indigo-400/30 bg-white/5 relative shadow-[0_0_15px_rgba(99,102,241,0.2)]">
                                        {leadQuality[0]}
                                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold bg-indigo-500 text-white shadow-lg">
                                            /10
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-black text-indigo-100">
                                            {leadQuality[0] >= 8 ? "Exceptional" : leadQuality[0] >= 6 ? "Good" : leadQuality[0] >= 4 ? "Average" : "Needs Work"}
                                        </p>
                                        <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1">Lead Quality Score</p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                                        <span className="text-white/40">Poor</span>
                                        <span className="text-white/40">Excellent</span>
                                    </div>
                                    <Slider
                                        value={leadQuality}
                                        onValueChange={setLeadQuality}
                                        max={10}
                                        min={1}
                                        step={1}
                                        className="w-full [&_[role=slider]]:border-indigo-400 [&_[role=slider]]:bg-white [&_.bg-primary]:bg-gradient-to-r [&_.bg-primary]:from-indigo-600 [&_.bg-primary]:to-indigo-300 [&_[role=slider]]:shadow-[0_0_15px_rgba(99,102,241,0.6)] [&_.bg-secondary]:bg-white/10"
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Ready to Transmit Card */}
                    <motion.div 
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white/80 backdrop-blur-md border border-slate-100 shadow-[0_8px_30px_rgba(0,0,0,0.015)] rounded-2xl p-6"
                    >
                        {hasSubmittedToday ? (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5 flex flex-col items-center text-center">
                                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <h3 className="text-sm font-black uppercase tracking-widest text-emerald-900 mb-1">Report Submitted</h3>
                                <p className="text-xs font-medium text-emerald-600/80">Your daily report has been sent to the CEO dashboard.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-1">Ready to Transmit</h3>
                                    <p className="text-xs font-medium text-slate-500">Finalize and send to CEO.</p>
                                </div>
                                <Button
                                    onClick={handleTransmitReport}
                                    disabled={isSubmitting}
                                    className="w-full h-14 text-xs font-black tracking-widest uppercase rounded-xl transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 shadow-lg shadow-indigo-900/20"
                                    style={{ backgroundColor: BRAND.navy, color: "white" }}
                                >
                                    {isSubmitting ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                                    {isSubmitting ? "TRANSMITTING..." : "TRANSMIT REPORT"}
                                </Button>
                            </div>
                        )}
                    </motion.div>
                </div>
            </main>

            {/* Conversion Modal */}
            <Dialog open={isConversionModalOpen} onOpenChange={setIsConversionModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2" style={{ color: BRAND.navy }}>
                            <Target className="w-5 h-5" />
                            Add New Conversion
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="conversion-count" className="text-sm font-medium text-slate-700">
                                Number of Conversions
                            </Label>
                            <Input
                                id="conversion-count"
                                type="number"
                                min="1"
                                placeholder="Enter number..."
                                value={conversionCount}
                                onChange={(e) => setConversionCount(e.target.value)}
                                className="mt-1 h-12 bg-slate-50 border-slate-200 focus:border-[#2F1E73] focus:ring-[#2F1E73]/20 rounded-xl"
                                style={{ color: "#1e293b" }}
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsConversionModalOpen(false);
                                    setConversionCount("1");
                                }}
                                className="flex-1 h-12 rounded-xl font-medium"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddConversion}
                                disabled={isAddingConversion || !conversionCount || parseInt(conversionCount) <= 0}
                                className="flex-1 h-12 rounded-xl font-medium transition-all duration-200 hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    backgroundColor: BRAND.orange,
                                    color: "white",
                                }}
                            >
                                {isAddingConversion ? (
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <Plus className="w-4 h-4 mr-2" />
                                )}
                                {isAddingConversion ? "Adding..." : "Add Conversion"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Shared Mobile Navigation */}
            <MobileNavigation currentPage="sales" />

            {/* Spacer for mobile bottom nav */}
            <div className="md:hidden h-20"></div>

            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
            />
        </div>
    );
}

export default SalesReportingPage;
