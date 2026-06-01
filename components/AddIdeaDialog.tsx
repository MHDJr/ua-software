"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Bookmark,
    Loader2,
    Sparkles,
    Users,
    Share2,
    Target,
    Shield,
    Megaphone,
    Check,
    Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface AddIdeaDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    staffList: Array<{
        id: string;
        name: string;
        dept: string;
        role?: string;
    }>;
    currentUserId: string;
}

type ActionMode = "note" | "task" | "reminder";

type IdeaCategory = "strategy" | "product" | "operation" | "marketing" | "other";
type IdeaPriority = "low" | "medium" | "high" | "critical";

const CATEGORIES: {
    value: IdeaCategory;
    label: string;
    icon: React.ElementType;
    desc: string;
    color: string;
}[] = [
    {
        value: "strategy",
        label: "Strategy",
        icon: Target,
        desc: "Long-term planning",
        color: "#2D2A77",
    },
    {
        value: "product",
        label: "Product",
        icon: Sparkles,
        desc: "Features & innovation",
        color: "#F15A24",
    },
    {
        value: "operation",
        label: "Operations",
        icon: Shield,
        desc: "Process improvements",
        color: "#10B981",
    },
    {
        value: "marketing",
        label: "Marketing",
        icon: Megaphone,
        desc: "Growth & outreach",
        color: "#8B5CF6",
    },
    {
        value: "other",
        label: "Other",
        icon: Lightbulb,
        desc: "General ideas",
        color: "#6B7280",
    },
];

const PRIORITIES: {
    value: IdeaPriority;
    label: string;
    color: string;
    bgColor: string;
}[] = [
    { value: "low", label: "Low", color: "#6B7280", bgColor: "rgba(107,114,128,0.1)" },
    { value: "medium", label: "Medium", color: "#F59E0B", bgColor: "rgba(245,158,11,0.1)" },
    { value: "high", label: "High", color: "#F15A24", bgColor: "rgba(241,90,36,0.1)" },
    { value: "critical", label: "Critical", color: "#DC2626", bgColor: "rgba(220,38,38,0.1)" },
];

// ─── Brand tokens ───────────────────────────────────────────────────────────
const VIOLET = "#2D2A77";
const ORANGE = "#F15A24";

export default function AddIdeaDialog({
    open,
    onOpenChange,
    staffList,
    currentUserId,
}: AddIdeaDialogProps) {
    const [actionMode, setActionMode] = useState<ActionMode>("note");
    const [loading, setLoading] = useState(false);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState<IdeaCategory>("strategy");
    const [priority, setPriority] = useState<IdeaPriority>("medium");
    const [shareWithStaff, setShareWithStaff] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
    const [shareAllStaff, setShareAllStaff] = useState(false);

    const resetForm = () => {
        setActionMode("note");
        setTitle("");
        setDescription("");
        setCategory("strategy");
        setPriority("medium");
        setShareWithStaff(false);
        setSelectedStaff([]);
        setShareAllStaff(false);
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!title.trim()) {
            toast.error("Idea title is required");
            return;
        }

        if (!description.trim()) {
            toast.error("Please describe your idea");
            return;
        }

        setLoading(true);

        try {
            // Insert the idea into the database
            const { data: ideaData, error: ideaError } = await supabase
                .from("ideas")
                .insert({
                    title: title.trim(),
                    content: description.trim(),
                    category,
                    priority: priority === "critical" ? "high" : (priority === "high" ? "high" : (priority === "medium" ? "medium" : "low")),
                    created_by: currentUserId,
                    status: actionMode === "reminder" ? "reminder" : (priority === "critical" || priority === "high" ? "high_priority" : "directive"),
                })
                .select()
                .single();

            if (ideaError) {
                // If ideas table doesn't exist, create a notification instead
                if (ideaError.message?.includes("does not exist")) {
                    // Create notification as fallback
                    const { error: notifError } = await supabase
                        .from("notifications")
                        .insert({
                            title: `NEW IDEA: ${title.trim()}`,
                            message: `[${category.toUpperCase()}] ${description.trim()}`,
                            type: "info",
                        });

                    if (notifError) throw notifError;
                } else {
                    throw ideaError;
                }
            }

            // If sharing with staff
            if (shareWithStaff) {
                const targetStaffIds = shareAllStaff
                    ? staffList.map((s) => s.id)
                    : selectedStaff;

                if (targetStaffIds.length > 0) {
                    // Create notifications for selected staff
                    const notifications = targetStaffIds.map((staffId) => ({
                        user_id: staffId,
                        title: `CEO Shared an Idea: ${title.trim()}`,
                        message: `[${category.toUpperCase()}] ${description.trim().substring(0, 100)}${
                            description.length > 100 ? "..." : ""
                        }`,
                        type: "info" as const,
                    }));

                    const { error: shareError } = await supabase
                        .from("notifications")
                        .insert(notifications);

                    if (shareError) {
                        console.error("Error sharing with staff:", shareError);
                    }
                }
            }

            toast.success(
                shareWithStaff && (shareAllStaff || selectedStaff.length > 0)
                    ? "Idea saved and shared with staff"
                    : "Idea saved to Intelligence & Directives"
            );

            resetForm();
            onOpenChange(false);
        } catch (error: any) {
            console.error("Error saving idea:", error);
            toast.error(error.message || "Failed to save idea");
        } finally {
            setLoading(false);
        }
    }

    const toggleStaffSelection = (staffId: string) => {
        setSelectedStaff((prev) =>
            prev.includes(staffId)
                ? prev.filter((id) => id !== staffId)
                : [...prev, staffId]
        );
    };

    const selectedCategory = CATEGORIES.find((c) => c.value === category);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="p-0 overflow-hidden border-0 shadow-none bg-transparent"
                style={{ maxWidth: 640 }}
            >
                {/* ── Backdrop glow ── */}
                <div
                    className="absolute inset-0 -z-10 rounded-2xl opacity-30 blur-3xl pointer-events-none"
                    style={{
                        background: `radial-gradient(ellipse at 30% 0%, ${ORANGE}55 0%, transparent 60%),
                                     radial-gradient(ellipse at 80% 100%, ${VIOLET}88 0%, transparent 60%)`,
                    }}
                />

                {/* ── Glass card ── */}
                <div
                    className="relative rounded-2xl overflow-hidden"
                    style={{
                        background: "rgba(255,255,255,0.82)",
                        backdropFilter: "blur(24px) saturate(180%)",
                        WebkitBackdropFilter: "blur(24px) saturate(180%)",
                        border: "1px solid rgba(255,255,255,0.6)",
                        boxShadow: `0 20px 60px rgba(45,42,119,0.18),
                                    0 4px 20px rgba(241,90,36,0.10),
                                    0 1px 0px rgba(255,255,255,0.8) inset`,
                    }}
                >
                    {/* ── Top accent bar ── */}
                    <div
                        className="absolute top-0 left-0 right-0 h-[3px]"
                        style={{
                            background: `linear-gradient(90deg, ${ORANGE}, ${VIOLET})`,
                        }}
                    />

                    {/* ─────────── HEADER ─────────── */}
                    <div className="px-8 pt-8 pb-6">
                        {/* Logo row */}
                        <div className="flex items-center gap-2.5 mb-5">
                            <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-black tracking-widest shadow-md"
                                style={{
                                    background: `linear-gradient(135deg, ${VIOLET}, #4B47C0)`,
                                    boxShadow: `0 4px 14px ${VIOLET}55`,
                                }}
                            >
                                <Bookmark className="w-4 h-4" />
                            </div>
                            <span
                                className="text-[11px] font-bold tracking-[0.18em] uppercase"
                                style={{ color: VIOLET }}
                            >
                                CEO Command Log
                            </span>
                        </div>

                        <DialogTitle
                            className="text-[18px] font-black uppercase tracking-[0.12em] leading-tight"
                            style={{ color: VIOLET }}
                        >
                            CREATE EXECUTIVE ACTION
                        </DialogTitle>
                        <p className="mt-1 text-[12px] text-gray-400 font-medium tracking-wide">
                            Issue executive directive for team alignment and action
                        </p>
                    </div>

                    {/* ─────────── ACTION MODE SEGMENTED CONTROL ─────────── */}
                    <div className="px-8 pb-4">
                        <div className="flex gap-1 p-1 rounded-xl" style={{ background: "rgba(249,250,251,0.8)" }}>
                            {[
                                { value: "note" as ActionMode, label: "NOTE" },
                                { value: "task" as ActionMode, label: "TASK" },
                                { value: "reminder" as ActionMode, label: "REMINDER" },
                            ].map(({ value, label }) => (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setActionMode(value)}
                                    className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-200"
                                    style={{
                                        background: actionMode === value
                                            ? `linear-gradient(135deg, ${VIOLET}, #4B47C0)`
                                            : "transparent",
                                        color: actionMode === value ? "white" : VIOLET,
                                        boxShadow: actionMode === value
                                            ? `0 2px 8px ${VIOLET}40`
                                            : "none",
                                    }}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ─────────── FORM ─────────── */}
                    <form onSubmit={handleSubmit} className="px-8 pb-8">
                        {/* ── Idea Title ── */}
                        <div className="mb-5">
                            <FieldLabel text="Subject" Icon={Sparkles} />
                            <input
                                type="text"
                                placeholder="e.g., Q3 Strategic Initiative: Customer Success Enhancement"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full h-12 px-4 text-sm rounded-xl transition-all duration-300 outline-none"
                                style={{
                                    border: "1px solid #E5E7EB",
                                    background: "rgba(255,255,255,0.9)",
                                    color: "#111827",
                                }}
                                onFocus={(e) => {
                                    e.currentTarget.style.borderColor = VIOLET;
                                    e.currentTarget.style.boxShadow = `0 0 0 3px rgba(45,42,119,0.12)`;
                                }}
                                onBlur={(e) => {
                                    e.currentTarget.style.borderColor = "#E5E7EB";
                                    e.currentTarget.style.boxShadow = "none";
                                }}
                            />
                        </div>

                        {/* ── Category Selection ── */}
                        <div className="mb-5">
                            <FieldLabel text="Category" />
                            <div className="grid grid-cols-5 gap-2 mt-2">
                                {CATEGORIES.map(({ value, label, icon: Icon, desc, color }) => {
                                    const active = category === value;
                                    return (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setCategory(value)}
                                            className="relative rounded-xl p-3 text-left transition-all duration-300 focus:outline-none"
                                            style={{
                                                border: active
                                                    ? `2px solid ${color}`
                                                    : "2px solid #E5E7EB",
                                                background: active
                                                    ? `${color}10`
                                                    : "rgba(249,250,251,0.8)",
                                                boxShadow: active
                                                    ? `0 0 0 4px ${color}15, 0 4px 12px ${color}20`
                                                    : "none",
                                                transform: active
                                                    ? "translateY(-1px)"
                                                    : "translateY(0)",
                                            }}
                                        >
                                            {active && (
                                                <span
                                                    className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full"
                                                    style={{
                                                        background: color,
                                                        boxShadow: `0 0 6px ${color}`,
                                                    }}
                                                />
                                            )}
                                            <div
                                                className="w-7 h-7 rounded-lg mb-2 flex items-center justify-center"
                                                style={{
                                                    background: active
                                                        ? `${color}20`
                                                        : "#F3F4F6",
                                                }}
                                            >
                                                <Icon
                                                    className="w-3.5 h-3.5"
                                                    style={{
                                                        color: active ? color : "#9CA3AF",
                                                    }}
                                                />
                                            </div>
                                            <p
                                                className="text-[10px] font-bold uppercase tracking-wider"
                                                style={{
                                                    color: active ? color : "#374151",
                                                }}
                                            >
                                                {label}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Priority & Description Row ── */}
                        <div className="grid grid-cols-4 gap-4 mb-5">
                            <div className="col-span-1">
                                <FieldLabel text="Priority" />
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {PRIORITIES.map(({ value, label, color, bgColor }) => {
                                        const active = priority === value;
                                        return (
                                            <button
                                                key={value}
                                                type="button"
                                                onClick={() => setPriority(value)}
                                                className="px-3 py-1.5 rounded-full text-left text-[10px] font-semibold transition-all duration-200"
                                                style={{
                                                    background: active
                                                        ? color
                                                        : "rgba(249,250,251,0.8)",
                                                    color: active ? "white" : color,
                                                    border: active
                                                        ? `1px solid ${color}`
                                                        : `1px solid ${color}30`,
                                                    fontSize: "10px",
                                                    padding: "6px 12px",
                                                    minWidth: "auto",
                                                }}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="col-span-3">
                                <FieldLabel text="Directive Details / Reminders" />
                                <textarea
                                    placeholder={
                                        actionMode === "task" 
                                            ? "Enter task objective..."
                                            : actionMode === "reminder"
                                            ? "Set reminder details and time..."
                                            : "Enter personal reminders or instructions for the team..."
                                    }
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={5}
                                    className="w-full px-4 py-3 text-sm rounded-xl transition-all duration-300 outline-none resize-none"
                                    style={{
                                        border: "1px solid #E5E7EB",
                                        background: "rgba(255,255,255,0.9)",
                                        color: "#111827",
                                    }}
                                    onFocus={(e) => {
                                        e.currentTarget.style.borderColor = VIOLET;
                                        e.currentTarget.style.boxShadow = `0 0 0 3px rgba(45,42,119,0.12)`;
                                    }}
                                    onBlur={(e) => {
                                        e.currentTarget.style.borderColor = "#E5E7EB";
                                        e.currentTarget.style.boxShadow = "none";
                                    }}
                                />
                            </div>
                        </div>

                        {/* ── Privacy Toggle Section ── */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between p-4 rounded-xl transition-all duration-200"
                                style={{
                                    border: "1px solid #E5E7EB",
                                    background: "rgba(249,250,251,0.8)",
                                }}
                            >
                                <div className="flex items-center gap-3">
                                    <Bookmark
                                        className="w-4 h-4"
                                        style={{ color: VIOLET }}
                                    />
                                    <span className="text-[12px] font-semibold tracking-wide" style={{ color: VIOLET }}>
                                        Privacy Settings
                                    </span>
                                </div>
                                
                                <div className="flex items-center gap-3">
                                    <span 
                                        className={`text-[11px] font-medium transition-all duration-200 ${
                                            !shareWithStaff ? "text-violet-600 font-semibold" : "text-gray-400"
                                        }`}
                                    >
                                        Private Reminder
                                    </span>
                                    
                                    <button
                                        type="button"
                                        onClick={() => setShareWithStaff(!shareWithStaff)}
                                        className="relative w-12 h-6 rounded-full transition-all duration-300"
                                        style={{
                                            background: shareWithStaff
                                                ? `linear-gradient(135deg, ${ORANGE}, ${VIOLET})`
                                                : "#E5E7EB",
                                        }}
                                    >
                                        <div
                                            className="absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm"
                                            style={{
                                                left: shareWithStaff ? "25px" : "3px",
                                            }}
                                        />
                                    </button>
                                    
                                    <span 
                                        className={`text-[11px] font-medium transition-all duration-200 ${
                                            shareWithStaff ? "text-violet-600 font-semibold" : "text-gray-400"
                                        }`}
                                    >
                                        Publish to Command Center
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* ── Action Buttons ── */}
                        <div
                            className="flex items-center justify-between pt-5"
                            style={{
                                borderTop: "1px solid rgba(229,231,235,0.8)",
                            }}
                        >
                            <DialogClose asChild>
                                <button
                                    type="button"
                                    className="h-11 px-6 rounded-xl text-[12px] font-bold uppercase tracking-widest transition-all duration-300"
                                    style={{ color: "#9CA3AF" }}
                                    onMouseEnter={(e) => {
                                        (
                                            e.currentTarget as HTMLButtonElement
                                        ).style.color = VIOLET;
                                        (
                                            e.currentTarget as HTMLButtonElement
                                        ).style.background =
                                            "rgba(45,42,119,0.06)";
                                    }}
                                    onMouseLeave={(e) => {
                                        (
                                            e.currentTarget as HTMLButtonElement
                                        ).style.color = "#9CA3AF";
                                        (
                                            e.currentTarget as HTMLButtonElement
                                        ).style.background = "transparent";
                                    }}
                                >
                                    Cancel
                                </button>
                            </DialogClose>

                            <button
                                type="submit"
                                disabled={loading}
                                className="relative h-11 px-7 rounded-xl text-[12px] font-black uppercase tracking-widest text-white flex items-center gap-2.5 overflow-hidden transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                                style={{
                                    background: `linear-gradient(135deg, ${ORANGE}, ${VIOLET})`,
                                    boxShadow: `0 4px 20px rgba(241,90,36,0.35), 0 2px 8px rgba(45,42,119,0.25)`,
                                }}
                                onMouseEnter={(e) => {
                                    if (!loading) {
                                        (
                                            e.currentTarget as HTMLButtonElement
                                        ).style.boxShadow =
                                            `0 6px 28px rgba(241,90,36,0.55), 0 3px 14px rgba(45,42,119,0.4)`;
                                        (
                                            e.currentTarget as HTMLButtonElement
                                        ).style.transform =
                                            "translateY(-1px)";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    (
                                        e.currentTarget as HTMLButtonElement
                                    ).style.boxShadow =
                                        `0 4px 20px rgba(241,90,36,0.35), 0 2px 8px rgba(45,42,119,0.25)`;
                                    (
                                        e.currentTarget as HTMLButtonElement
                                    ).style.transform = "translateY(0)";
                                }}
                            >
                                {/* Shimmer overlay */}
                                <span
                                    className="absolute inset-0 pointer-events-none"
                                    style={{
                                        background:
                                            "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.18) 50%, transparent 60%)",
                                        backgroundSize: "200% 100%",
                                        animation:
                                            "shimmer 2.5s ease-in-out infinite",
                                    }}
                                />
                                {loading ? (
                                    <Loader2 className="h-4 w-4 animate-spin relative z-10" />
                                ) : (
                                    <Bookmark className="h-4 w-4 relative z-10" />
                                )}
                                <span className="relative z-10">
                                    {loading
                                        ? "Saving..."
                                        : shareWithStaff
                                        ? "Publish Directive"
                                        : "Save Reminder"}
                                </span>
                            </button>
                        </div>
                    </form>
                </div>

                {/* Shimmer keyframes */}
                <style>{`
                    @keyframes shimmer {
                        0%   { background-position: -200% center; }
                        100% { background-position:  200% center; }
                    }
                `}</style>
            </DialogContent>
        </Dialog>
    );
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function FieldLabel({
    text,
    Icon,
}: {
    text: string;
    Icon?: React.ElementType;
}) {
    return (
        <label
            className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] mb-0"
            style={{ color: "#6B7280" }}
        >
            {Icon && <Icon className="w-3 h-3" />}
            {text}
        </label>
    );
}
