"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, TrendingUp, Trophy, Settings, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { supabase, Profile } from "@/lib/supabase";
import { SetMonthlyTargetModal } from "./set-monthly-target-modal";

// Brand colors
const BRAND = {
    navy: "#2F1E73",
    orange: "#F14D24",
    lightOrange: "#FA4615",
};

interface MonthlyConversionTrackerProps {
    currentMonthConversions: number;
    profile: Profile;
    onTargetUpdated?: () => void;
}

interface MonthlyTarget {
    id: string;
    target_value: number;
    current_progress: number;
    achievement_percentage: number;
    target_month: string;
}

export function MonthlyConversionTracker({ 
    currentMonthConversions, 
    profile, 
    onTargetUpdated 
}: MonthlyConversionTrackerProps) {
    const [monthlyTarget, setMonthlyTarget] = useState<MonthlyTarget | null>(null);
    const [actualMonthlyConversions, setActualMonthlyConversions] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // Fetch current month conversions from daily reports
    const fetchCurrentMonthConversions = async () => {
        try {
            const currentMonth = new Date();
            const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
            const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
            
            const { data, error } = await supabase
                .from('daily_reports')
                .select('conversions')
                .eq('profile_id', profile.id)
                .gte('report_date', firstDay.toISOString().split('T')[0])
                .lte('report_date', lastDay.toISOString().split('T')[0]);

            if (error) {
                console.error('Error fetching monthly conversions:', error);
                return 0;
            }

            const totalConversions = data?.reduce((sum, report) => sum + (report.conversions || 0), 0) || 0;
            return totalConversions;
        } catch (error) {
            console.error('Error fetching monthly conversions:', error);
            return 0;
        }
    };

    // Fetch monthly conversion target
    const fetchMonthlyTarget = async () => {
        try {
            setLoading(true);
            const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
            
            const { data, error } = await supabase
                .from('monthly_targets')
                .select('*')
                .eq('profile_id', profile.id)
                .eq('department', 'sales')
                .eq('target_month', currentMonth + '-01')
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
                console.error('Error fetching monthly target:', error);
            } else {
                setMonthlyTarget(data);
            }
        } catch (error) {
            console.error('Error fetching monthly target:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (profile) {
            fetchMonthlyTarget();
            fetchCurrentMonthConversions().then(setActualMonthlyConversions);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile]);

    const handleTargetUpdated = () => {
        fetchMonthlyTarget();
        if (onTargetUpdated) {
            onTargetUpdated();
        }
    };

    const getProgressColor = (percentage: number) => {
        if (percentage >= 100) return "from-green-500 to-emerald-600";
        if (percentage >= 80) return "from-blue-500 to-indigo-600";
        if (percentage >= 50) return "from-yellow-500 to-orange-500";
        return "from-red-500 to-pink-500";
    };

    const getStatusIcon = (percentage: number) => {
        if (percentage >= 100) return <Trophy className="w-4 h-4 text-yellow-500" />;
        if (percentage >= 50) return <TrendingUp className="w-4 h-4 text-blue-500" />;
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
    };

    const getStatusText = (percentage: number) => {
        if (percentage >= 100) return "Target Achieved! 🎉";
        if (percentage >= 80) return "Almost There!";
        if (percentage >= 50) return "Good Progress";
        return "Keep Going!";
    };

    if (loading) {
        return (
            <Card className="bg-gradient-to-br from-white/90 to-white/60 border border-white/20 backdrop-blur-xl p-6">
                <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
                    <div className="h-4 bg-gray-200 rounded w-full"></div>
                </div>
            </Card>
        );
    }

    const achievementPercentage = monthlyTarget ? 
        ((actualMonthlyConversions / monthlyTarget.target_value) * 100) : 0;
    const remainingConversions = monthlyTarget ? 
        Math.max(0, monthlyTarget.target_value - actualMonthlyConversions) : 0;

    return (
        <>
            <Card className="relative group overflow-hidden transition-all duration-500 hover:shadow-2xl hover:shadow-indigo-500/10 border-0">
                {/* Animated Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 opacity-90" />
                <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/5 via-transparent to-orange-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-orange-500/10 to-transparent rounded-full blur-2xl" />
                
                {/* Content */}
                <div className="relative p-8">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div 
                                    className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105"
                                    style={{ 
                                        background: 'linear-gradient(135deg, #2F1E73 0%, #3F348C 100%)',
                                        boxShadow: '0 8px 32px rgba(47, 30, 125, 0.3)'
                                    }}
                                >
                                    <Target className="w-8 h-8 text-white" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full animate-pulse" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                    Monthly Conversions
                                </h3>
                                <p className="text-sm text-gray-500 font-medium">Track your conversion target</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsModalOpen(true)}
                            className="h-10 w-10 rounded-xl hover:bg-gray-100/80 transition-all duration-200 group-hover:scale-110"
                        >
                            <Settings className="w-5 h-5 text-gray-600 group-hover:text-gray-900 transition-colors" />
                        </Button>
                    </div>

                    {/* Current Month Display */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                                <span className="text-sm font-semibold text-gray-600 uppercase tracking-wider">Current Month</span>
                            </div>
                            <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                                {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </span>
                        </div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-5xl font-black bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">
                                {actualMonthlyConversions}
                            </span>
                            {monthlyTarget && (
                                <>
                                    <span className="text-2xl font-light text-gray-400">/</span>
                                    <span className="text-2xl font-bold text-gray-600">{monthlyTarget.target_value}</span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Progress Section */}
                    {monthlyTarget ? (
                        <div className="space-y-6">
                            {/* Progress Bar */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Progress</span>
                                    <div className="flex items-center gap-3">
                                        {getStatusIcon(achievementPercentage)}
                                        <span className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">
                                            {achievementPercentage.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                                <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                    <div
                                        className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getProgressColor(achievementPercentage)} rounded-full transition-all duration-1000 ease-out relative overflow-hidden`}
                                        style={{ width: `${Math.min(achievementPercentage, 100)}%` }}
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                                        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg" />
                                    </div>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                                    <div className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Achieved</div>
                                    <div className="text-lg font-bold text-green-800">{actualMonthlyConversions}</div>
                                </div>
                                <div className="text-center p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200">
                                    <div className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-1">Target</div>
                                    <div className="text-lg font-bold text-orange-800">{monthlyTarget.target_value}</div>
                                </div>
                                <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                                    <div className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Remaining</div>
                                    <div className="text-lg font-bold text-blue-800">{remainingConversions}</div>
                                </div>
                            </div>

                            {/* Status Badge */}
                            <div className="flex items-center justify-center">
                                <Badge 
                                    variant="secondary"
                                    className={`px-6 py-3 rounded-full text-sm font-bold uppercase tracking-wider border-2 ${
                                        achievementPercentage >= 100 
                                            ? "bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-300 shadow-lg shadow-green-500/20" 
                                            : achievementPercentage >= 50
                                            ? "bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-800 border-blue-300 shadow-lg shadow-blue-500/20"
                                            : "bg-gradient-to-r from-orange-100 to-amber-100 text-orange-800 border-orange-300 shadow-lg shadow-orange-500/20"
                                    }`}
                                >
                                    {getStatusText(achievementPercentage)}
                                </Badge>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <div className="relative inline-block mb-6">
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center shadow-lg">
                                    <AlertCircle className="w-10 h-10 text-gray-400" />
                                </div>
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">!</span>
                                </div>
                            </div>
                            <h4 className="text-lg font-bold text-gray-800 mb-3">No Target Set</h4>
                            <p className="text-gray-500 mb-6 max-w-sm mx-auto">Set your monthly conversion target to start tracking your progress</p>
                            <Button
                                onClick={() => setIsModalOpen(true)}
                                className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold px-8 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                            >
                                Set Your Target
                            </Button>
                        </div>
                    )}
                </div>
            </Card>

            {/* Set Target Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <SetMonthlyTargetModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        department="sales"
                        onSuccess={handleTargetUpdated}
                    />
                )}
            </AnimatePresence>
        </>
    );
}
