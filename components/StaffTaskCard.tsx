"use client";

import React, { useEffect } from "react";
import { supabase, Task, Profile } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import {
    CheckCircle2,
    AlertTriangle,
    LayoutDashboard,
    Target,
    Sparkles,
    Clock,
    User,
    ChevronDown,
    Info,
    X,
    Zap,
    Send,
    Check,
    Circle,
} from "lucide-react";

// Brand Palette matching parent
const brand = {
    navy: "#2C2171",
    orange: "#F15A29",
    lightNavy: "#3F348C",
    softOrange: "#FEF2EE",
    bg: "#F4F7FE",
};

interface StaffTaskCardProps {
    task: Task;
    showCompleted: boolean;
    handleTaskClick: (task: Task) => void;
    expandedTask: string | null;
    taskCreators: Record<string, any>;
    removeCompletedTask: (taskId: string) => void;
    startMission: (taskId: string) => void;
    updateTaskProgress: (taskId: string, pct: number) => void;
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    markAsCompleted: (taskId: string) => void;
    submitForReview: (taskId: string) => void;
    profile: Profile | null;
    isV2Enabled: boolean;
    onMarkSeenLocal: (taskId: string) => void;
}

const renderDigitalGauge = (task: Task, showCompleted: boolean) => {
    const s = (task.status || "PENDING").toUpperCase();
    const progress = showCompleted ? 100 : (task.progress || 0);
    const radius = 14;
    const circumference = 2 * Math.PI * radius; // ~88
    const strokeDashoffset = circumference - (circumference * progress) / 100;
    
    let strokeColor = "stroke-blue-500";
    
    if (showCompleted) {
        strokeColor = "stroke-emerald-500";
    } else if (s === "PENDING") {
        strokeColor = "stroke-orange-500";
    } else if (s === "UNDER_REVIEW" || s === "IN_REVIEW") {
        strokeColor = "stroke-purple-500";
    }

    return (
        <div className="flex items-center gap-2.5 select-none shrink-0">
            <span className="text-xl md:text-2xl font-black text-slate-800 dark:text-white tracking-tight">
                {progress}%
            </span>
            <div className="relative w-9 h-9 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="18"
                        cy="18"
                        r={radius}
                        className="stroke-slate-100 dark:stroke-zinc-800 fill-none"
                        strokeWidth="3"
                    />
                    <circle
                        cx="18"
                        cy="18"
                        r={radius}
                        className={cn("fill-none transition-all duration-500 ease-out", strokeColor)}
                        strokeWidth="3"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    {showCompleted ? (
                        <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    ) : s === "PENDING" ? (
                        <Zap className="w-2.5 h-2.5 text-orange-600 dark:text-orange-400 fill-orange-500/10" />
                    ) : s === "UNDER_REVIEW" || s === "IN_REVIEW" ? (
                        <Clock className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400 animate-pulse" />
                    ) : (
                        <Circle className="w-2 h-2 text-blue-600 dark:text-blue-500 fill-blue-500" />
                    )}
                </div>
            </div>
        </div>
    );
};

export const StaffTaskCard: React.FC<StaffTaskCardProps> = ({
    task,
    showCompleted,
    handleTaskClick,
    expandedTask,
    taskCreators,
    removeCompletedTask,
    startMission,
    updateTaskProgress,
    setTasks,
    markAsCompleted,
    submitForReview,
    profile,
    isV2Enabled,
    onMarkSeenLocal,
}) => {
    
    // Automated background seen receipt on component mount / load
    useEffect(() => {
        const markAsSeen = async () => {
            if (!task.is_staff_seen) {
                // Update local state first for immediate UI consistency
                onMarkSeenLocal(task.id);
                try {
                    const { error } = await supabase
                        .from("tasks")
                        .update({
                            is_staff_seen: true,
                            staff_seen_at: new Date().toISOString()
                        })
                        .eq("id", task.id);
                    
                    if (error) {
                        console.error("[StaffTaskCard] Failed to save seen state in database:", error);
                    } else {
                        console.log("[StaffTaskCard] Task marked seen in database:", task.id);
                    }
                } catch (err) {
                    console.error("[StaffTaskCard] Exception marking task as seen:", err);
                }
            }
        };
        
        markAsSeen();
    }, [task.id, task.is_staff_seen, onMarkSeenLocal]);

    return (
        <div
            className={cn(
                "bg-white/95 dark:bg-zinc-950/95 border border-slate-200/50 dark:border-white/10 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.03)] dark:shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 ease-out hover:border-slate-300 dark:hover:border-white/20 translate-gpu hover:scale-[1.01] border-l-[6px]",
                showCompleted 
                    ? "border-l-emerald-500" 
                    : (task.status || "PENDING").toUpperCase() === "IN_PROGRESS"
                        ? "border-l-blue-500"
                        : ((task.status || "PENDING").toUpperCase() === "UNDER_REVIEW" || (task.status || "PENDING").toUpperCase() === "IN_REVIEW")
                            ? "border-l-purple-500"
                            : task.priority === "urgent" || task.priority === "high"
                                ? "border-l-rose-500"
                                : task.priority === "medium"
                                    ? "border-l-amber-500"
                                    : "border-l-zinc-700"
            )}
        >
            <div
                className="p-5 md:p-6 cursor-pointer flex items-center justify-between min-h-[56px]"
                onClick={() => handleTaskClick(task)}
            >
                <div className="flex items-center gap-3 md:gap-5 flex-1 min-w-0">
                    <div
                        className={cn(
                            "w-11 h-11 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 flex items-center justify-center relative shrink-0",
                            showCompleted
                                ? "text-emerald-600 dark:text-emerald-400"
                                : (task.priority === "urgent" || (task as any).category === "URGENT")
                                    ? "text-rose-600 dark:text-red-400"
                                    : "text-slate-500 dark:text-zinc-400"
                        )}
                    >
                        {showCompleted ? (
                            <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6" />
                        ) : task.priority === "urgent" ? (
                            <AlertTriangle className="w-5 h-5 md:w-6 md:h-6" />
                        ) : (
                            <LayoutDashboard className="w-5 h-5 md:w-6 md:h-6" />
                        )}
                        {task.is_daily_task && !showCompleted && (
                            <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-orange-500 rounded-lg border-2 border-white dark:border-zinc-950 flex items-center justify-center shadow-md">
                                <Target className="w-2.5 h-2.5 text-white" />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span
                                className={cn(
                                    "px-2 py-0.5 rounded text-[9px] font-black tracking-widest uppercase border",
                                    showCompleted
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                        : task.priority === "urgent" || task.priority === "high"
                                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                            : "bg-slate-100 dark:bg-zinc-850 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700/80"
                                )}
                            >
                                {showCompleted ? "COMPLETED" : task.priority?.toUpperCase()}
                            </span>

                            {showCompleted && ((task as any).reviewed_at || (task as any).ceo_reviewed) && (
                                <span className="flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest animate-pulse">
                                    <Check className="w-2.5 h-2.5 text-emerald-500" />
                                    {((task as any).reviewed_by_info || "Management").toUpperCase()} REVIEWED OK
                                </span>
                            )}
                            {task.is_daily_task && !showCompleted && (
                                <span className="flex items-center gap-1 text-[9px] font-black text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 uppercase tracking-widest">
                                    <Sparkles className="w-2 h-2" />{" "}
                                    Daily
                                </span>
                            )}
                        </div>
                        <h3 className="text-base md:text-xl font-black text-slate-900 dark:text-white leading-tight">
                            {task.title}
                        </h3>
                        {task.due_date && (
                            <div className="flex items-center gap-1.5 mt-1.5 text-rose-600 dark:text-rose-400/90">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="text-[9px] font-black uppercase tracking-widest">
                                    Due: {new Date(task.due_date).toLocaleDateString()}
                                </span>
                            </div>
                        )}
                        {taskCreators[task.created_by] && (
                            <div className="flex items-center gap-1.5 mt-2 text-slate-500 dark:text-zinc-400 text-[9px] font-black tracking-widest uppercase">
                                <User className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500 animate-pulse" />
                                <span>
                                    Assigned by: <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{
                                        taskCreators[task.created_by].role === 'ceo' 
                                            ? `${taskCreators[task.created_by].full_name || 'Saleem'} (CEO)` 
                                            : `${taskCreators[task.created_by].full_name || 'Administrator'} (${taskCreators[task.created_by].designation || 'Administrator'})`
                                    }</span>
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-3">
                    {renderDigitalGauge(task, showCompleted)}
                    <ChevronDown
                        className={cn(
                            "w-5 h-5 text-slate-400 dark:text-zinc-500 transition-transform duration-300",
                            expandedTask && expandedTask === task.id ? "rotate-180 text-orange-500" : ""
                        )}
                    />
                </div>
            </div>
            {expandedTask && expandedTask === task.id && (
                <div className="px-5 md:px-6 pb-6 space-y-5">
                    <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 rounded-xl italic text-sm text-slate-600 dark:text-zinc-400 flex items-start gap-3">
                        <Info className="w-4 h-4 text-slate-400 dark:text-zinc-500 mt-0.5 flex-shrink-0" />
                        &quot;{task.description}&quot;
                    </div>
                    <div className="flex gap-3">
                        {showCompleted ? (
                            <>
                                <button
                                    onClick={() => removeCompletedTask(task.id)}
                                    className="flex-1 py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 transition-all"
                                >
                                    <X className="w-4 h-4" />{" "}
                                    Delete Permanently
                                </button>
                                {((task as any).ceo_reviewed || (task as any).reviewed_at) && (
                                    <div className="px-3 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl text-[9px] font-black uppercase border border-blue-500/20 flex items-center gap-2 animate-pulse">
                                        <Check className="w-3 h-3" />
                                        Reviewed by{" "}
                                        {(task as any).reviewed_by_info || "Management"}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="w-full space-y-4">
                                {(() => {
                                    const s = (task.status || "PENDING").toUpperCase();
                                    if (s === "PENDING") {
                                        return (
                                            <button
                                                onClick={() => startMission(task.id)}
                                                className="w-full py-3.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-orange-500/10 flex items-center justify-center gap-2 transition-all duration-300 border border-transparent dark:border-white/10"
                                            >
                                                <Zap className="w-4 h-4 fill-white" /> Start Mission
                                            </button>
                                        );
                                    }
                                    if (s === "IN_PROGRESS") {
                                        return (
                                            <div className="space-y-4 p-4 md:p-6 rounded-2xl bg-slate-50 dark:bg-zinc-950/40 border border-slate-200/60 dark:border-white/5 backdrop-blur-md">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                                        Operational Progress: {task.progress || 10}%
                                                    </span>
                                                </div>
                                                
                                                {/* Premium Glassmorphic Slider Track */}
                                                <div className="relative flex items-center select-none w-full h-6">
                                                    {isV2Enabled ? (
                                                        <>
                                                            {/* Custom Track Background */}
                                                            <div className="absolute inset-x-0 h-2 bg-slate-200 dark:bg-zinc-800 rounded-full border border-slate-300 dark:border-white/5" />
                                                            
                                                            {/* Custom Track Fill */}
                                                            <div 
                                                                className="absolute left-0 h-2 bg-gradient-to-r from-orange-500 to-[#EF4A24] rounded-full"
                                                                style={{ width: `${task.progress || 10}%` }}
                                                            />
                                                            
                                                            {/* Custom Track Micro-Glow */}
                                                            <div 
                                                                className="absolute left-0 h-2 bg-orange-500 rounded-full blur-[4px] opacity-60 transition-all duration-150 shadow-[0_0_12px_rgba(239,74,36,0.5)]"
                                                                style={{ width: `${task.progress || 10}%` }}
                                                            />

                                                            {/* Custom Slider Thumb Knob */}
                                                            <div 
                                                                className="absolute w-4 h-4 bg-white dark:bg-zinc-100 rounded-full border border-orange-500 shadow-[0_0_8px_rgba(239,74,36,0.6)] transition-all duration-150 pointer-events-none"
                                                                style={{ left: `calc(${task.progress || 10}% - 8px)` }}
                                                            />

                                                            <input 
                                                                type="range"
                                                                min="0"
                                                                max="100"
                                                                value={task.progress || 10}
                                                                onChange={(e) => {
                                                                    const val = parseInt(e.target.value);
                                                                    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, progress: val } : t));
                                                                }}
                                                                onMouseUp={(e: any) => {
                                                                    updateTaskProgress(task.id, parseInt(e.target.value));
                                                                }}
                                                                onTouchEnd={(e: any) => {
                                                                    updateTaskProgress(task.id, parseInt(e.target.value));
                                                                }}
                                                                className="absolute w-full h-6 opacity-0 cursor-pointer z-10"
                                                            />
                                                        </>
                                                    ) : (
                                                        <input 
                                                            type="range"
                                                            min="0"
                                                            max="100"
                                                            value={task.progress || 10}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value);
                                                                setTasks(prev => prev.map(t => t.id === task.id ? { ...t, progress: val } : t));
                                                            }}
                                                            onMouseUp={(e: any) => {
                                                                updateTaskProgress(task.id, parseInt(e.target.value));
                                                            }}
                                                            onTouchEnd={(e: any) => {
                                                                updateTaskProgress(task.id, parseInt(e.target.value));
                                                            }}
                                                            className="w-full h-2 bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-white/5 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
                                                        />
                                                    )}
                                                </div>
                                                
                                                {/* Quick Percentage Tabs */}
                                                <div className="grid grid-cols-4 gap-2">
                                                    {[25, 50, 75, 100].map((pct) => {
                                                        const isSelected = (task.progress || 10) === pct;
                                                        return (
                                                            <button
                                                                key={pct}
                                                                type="button"
                                                                onClick={() => {
                                                                    updateTaskProgress(task.id, pct);
                                                                }}
                                                                className={cn(
                                                                    "py-2 rounded-xl text-[10px] font-black transition-all border",
                                                                    isSelected
                                                                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/50 shadow-[0_0_12px_rgba(59,130,246,0.15)] scale-105"
                                                                        : "bg-slate-100 dark:bg-white/[0.02] border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-white/[0.05] text-slate-600 dark:text-zinc-400"
                                                                )}
                                                            >
                                                                {pct === 100 ? "Complete" : `${pct}%`}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                
                                                {/* Action Submit Button */}
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    {profile?.is_manager && (
                                                        <button
                                                            onClick={() => markAsCompleted(task.id)}
                                                            className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 active:scale-95 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 transition-all duration-300 border border-transparent dark:border-white/10"
                                                        >
                                                            <CheckCircle2 className="w-3.5 h-3.5" /> Mark Completed
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => submitForReview(task.id)}
                                                        className={cn(
                                                            "py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 active:scale-95 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 transition-all duration-300 border border-transparent dark:border-white/10 disabled:opacity-50 disabled:pointer-events-none disabled:scale-100",
                                                            profile?.is_manager ? "flex-1" : "w-full"
                                                        )}
                                                    >
                                                        <Send className="w-3.5 h-3.5" /> Submit for Review
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    }
                                    if (s === "UNDER_REVIEW" || s === "IN_REVIEW") {
                                        return (
                                            <div className="w-full p-6 rounded-2xl bg-purple-500/5 border border-purple-500/20 flex flex-col items-center justify-center gap-3 text-center animate-pulse">
                                                <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 shadow-sm shadow-purple-500/10">
                                                    <Clock className="w-5 h-5 animate-spin" style={{ animationDuration: '4s' }} />
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-xs font-black text-purple-400 uppercase tracking-widest">
                                                        Awaiting Verification
                                                    </span>
                                                    <p className="text-[10px] text-purple-400/70 font-medium">
                                                        Lock enabled. A CEO/Administrator is reviewing your completion.
                                                    </p>
                                                </div>
                                                {profile?.is_manager && (
                                                    <button
                                                        onClick={() => markAsCompleted(task.id)}
                                                        className="mt-2 w-full py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl font-bold uppercase text-[9px] tracking-widest border border-emerald-500/20 transition-all flex items-center justify-center gap-2"
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve & Complete (Admin)
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
