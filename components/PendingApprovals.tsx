"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn, isValidAvatarUrl } from "@/lib/utils";
import {
    Shield,
    Calendar,
    Briefcase,
    ArrowUpRight,
    Check,
    X,
    AlertCircle,
    Inbox,
    DollarSign,
    FileText,
    Clock,
    MessageSquare,
    Settings,
    UserPlus,
    Building2,
    Code2,
} from "lucide-react";

// Brand colors
const BRAND_COLORS = {
    indigo: "#31267D",
    orange: "#F14D24",
};

// Types of pending requests
export type RequestType = "leave" | "permission" | "work_adjustment" | "expense" | "feedback" | "budget" | "access_elevation" | "role_change" | "add_staff";

export interface PendingRequest {
    id: string;
    staffId: string;
    staffName: string;
    staffAvatar?: string;
    staffInitials: string;
    requestType: RequestType;
    description: string;
    requestedAt: string;
    urgency?: "normal" | "high" | "urgent";
    amount?: number;
    // Leave request specific fields
    leaveType?: "casual" | "medical" | "emergency" | "early";
    dates?: string;
    totalDays?: number;
}

interface PendingApprovalsProps {
    requests: PendingRequest[];
    onApprove: (requestId: string) => void;
    onDecline: (requestId: string) => void;
    isCeo?: boolean;
    className?: string;
}

// Request type configuration
const requestTypeConfig: Record<
    RequestType,
    { icon: React.ElementType; label: string; color: string; bgColor: string }
> = {
    leave: {
        icon: Calendar,
        label: "Leave Request",
        color: "text-blue-600",
        bgColor: "bg-blue-50",
    },
    permission: {
        icon: Clock,
        label: "Permission Request",
        color: "text-purple-600",
        bgColor: "bg-purple-50",
    },
    work_adjustment: {
        icon: Settings,
        label: "Work Adjustment",
        color: "text-gray-600",
        bgColor: "bg-gray-50",
    },
    expense: {
        icon: DollarSign,
        label: "Expense Request",
        color: "text-green-600",
        bgColor: "bg-green-50",
    },
    feedback: {
        icon: MessageSquare,
        label: "Feedback Request",
        color: "text-indigo-600",
        bgColor: "bg-indigo-50",
    },
    budget: {
        icon: FileText,
        label: "Budget Request",
        color: "text-orange-600",
        bgColor: "bg-orange-50",
    },
    role_change: {
        icon: Briefcase,
        label: "Role Change",
        color: "text-amber-600",
        bgColor: "bg-amber-50",
    },
    access_elevation: {
        icon: Shield,
        label: "Access Elevation",
        color: "text-[#31267D]",
        bgColor: "bg-[#31267D]/10",
    },
    add_staff: {
        icon: UserPlus,
        label: "Add Staff Request",
        color: "text-emerald-600",
        bgColor: "bg-emerald-50",
    },
};

// Leave type configuration
const leaveTypeConfig: Record<
    NonNullable<PendingRequest["leaveType"]>,
    { label: string; color: string; bgColor: string }
> = {
    casual: {
        label: "Casual Leave",
        color: "text-blue-500",
        bgColor: "bg-blue-100",
    },
    medical: {
        label: "Medical Leave",
        color: "text-red-500",
        bgColor: "bg-red-100",
    },
    emergency: {
        label: "Emergency Leave",
        color: "text-orange-500",
        bgColor: "bg-orange-100",
    },
    early: {
        label: "Early Leave",
        color: "text-purple-500",
        bgColor: "bg-purple-100",
    },
};

// Format relative time
const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// Helper to parse budget requests and extract details from the description string
const parseBudgetRequest = (description: string, dbAmount?: number) => {
    let amountStr = dbAmount ? `₹${dbAmount.toLocaleString('en-IN')}` : "";
    let category = "office";
    let reason = description;

    if (description.includes(" | ")) {
        const parts = description.split(" | ");
        parts.forEach(part => {
            const index = part.indexOf(":");
            if (index !== -1) {
                const key = part.slice(0, index).trim().toLowerCase();
                const val = part.slice(index + 1).trim();
                if (key === "amount") {
                    const cleanedVal = val.replace(/[₹$,]/g, '').trim();
                    const numericVal = parseFloat(cleanedVal);
                    if (!isNaN(numericVal) && !amountStr) {
                        amountStr = `₹${numericVal.toLocaleString('en-IN')}`;
                    }
                } else if (key === "category") {
                    category = val.toLowerCase();
                } else if (key === "reason") {
                    reason = val;
                }
            }
        });
    } else {
        const match = description.match(/[₹$]\d+([,\d]+)?/);
        if (match && !amountStr) {
            amountStr = match[0].replace('$', '₹');
        }
    }

    return { amountStr, category, reason };
};

// Helper to format dates beautifully (e.g. "2026-05-26 → 2026-05-28" to "May 26 to May 28")
const formatDates = (datesStr?: string) => {
    if (!datesStr) return "";
    try {
        const parts = datesStr.includes("→")
            ? datesStr.split("→").map(p => p.trim())
            : [datesStr.trim()];

        const formatDatePart = (dStr: string) => {
            const date = new Date(dStr);
            if (isNaN(date.getTime())) return dStr;
            return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        };

        if (parts.length === 2) {
            return `${formatDatePart(parts[0])} to ${formatDatePart(parts[1])}`;
        }
        return formatDatePart(parts[0]);
    } catch (e) {
        return datesStr;
    }
};

// Helper to parse Access & Permission requests and strip raw text labels
const parseAccessRequest = (description: string) => {
    let system = "";
    let duration = "";
    let justification = description;

    if (description.includes(" | ")) {
        const parts = description.split(" | ");
        parts.forEach(part => {
            const index = part.indexOf(":");
            if (index !== -1) {
                const key = part.slice(0, index).trim().toLowerCase();
                const val = part.slice(index + 1).trim();
                if (key === "system" || key === "action") {
                    system = val;
                } else if (key === "duration" || key === "urgency") {
                    duration = val;
                } else if (key === "justification") {
                    justification = val;
                }
            }
        });
    }
    return { system, duration, justification };
};

// Helper to strip repetitive prefixes like "[CASUAL LEAVE] 3 days:" from descriptions
const cleanDescription = (description: string) => {
    if (!description) return "";
    return description.replace(/^\[[^\]]+\]\s*\d+\s*(days|day):?\s*(-|→)?\s*/i, "").trim();
};

// Custom category icons and style mappings for budget/expense allocations
const categoryConfig: Record<
    string,
    { icon: React.ElementType; label: string; color: string; bgColor: string }
> = {
    marketing: { icon: Building2, label: "Marketing", color: "text-[#31267D]", bgColor: "bg-[#31267D]/10" },
    development: { icon: Code2, label: "Dev", color: "text-emerald-600", bgColor: "bg-emerald-50" },
    dev: { icon: Code2, label: "Dev", color: "text-emerald-600", bgColor: "bg-emerald-50" },
    office: { icon: Briefcase, label: "Office", color: "text-amber-600", bgColor: "bg-amber-50" },
};

// Individual request row component
const RequestRow = ({
    request,
    onApprove,
    onDecline,
    isProcessing,
    isCeo = false,
}: {
    request: PendingRequest;
    onApprove: (id: string) => void;
    onDecline: (id: string) => void;
    isProcessing: boolean;
    isCeo?: boolean;
}) => {
    const config = requestTypeConfig[request.requestType];
    const Icon = config.icon;
    const leaveConfig = request.leaveType ? leaveTypeConfig[request.leaveType] : null;

    const isLeave = request.requestType === "leave";
    const isBudget = request.requestType === "budget" || request.requestType === "expense";
    const isAccessOrPermission = request.requestType === "access_elevation" || request.requestType === "permission";

    const renderActionControls = () => {
        if (!isCeo) {
            return (
                <div className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-zinc-800/80 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 border border-slate-200/50 dark:border-zinc-700/30">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    <span>CEO Approval Only</span>
                </div>
            );
        }
        return (
            <>
                <button
                    onClick={() => onDecline(request.id)}
                    disabled={isProcessing}
                    className="bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 hover:bg-rose-100/80 font-semibold px-4 py-2 rounded-lg text-xs tracking-wider transition-all active:scale-95 disabled:opacity-50"
                >
                    Reject
                </button>
                <button
                    onClick={() => onApprove(request.id)}
                    disabled={isProcessing}
                    className="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 hover:bg-emerald-100/80 font-semibold px-4 py-2 rounded-lg text-xs tracking-wider transition-all active:scale-95 disabled:opacity-50"
                >
                    Approve
                </button>
            </>
        );
    };

    // 1. Variant A: LEAVE REQUEST LAYOUT
    if (isLeave) {
        return (
            <div
                className={cn(
                    "group relative overflow-hidden transition-all duration-300",
                    "bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-100 dark:border-zinc-800/40 shadow-sm hover:shadow-md"
                )}
            >
                {/* Crisp 3px vertical accent indicator bar on the far-left edge */}
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-400" />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pl-1">
                    {/* Left Column: Avatar, Name, Category Pill, Timeline Capsule, and Reason */}
                    <div className="flex-1 min-w-0">
                        {/* Top Row: Avatar + Name Stack */}
                        <div className="flex items-start gap-4">
                             <Avatar className="w-11 h-11 border border-slate-100 dark:border-zinc-800 shadow-sm flex-shrink-0">
                                 <AvatarImage src={isValidAvatarUrl(request.staffAvatar) ? request.staffAvatar : undefined} alt={request.staffName} />
                                 <AvatarFallback
                                     className="text-white text-xs font-semibold"
                                     style={{ backgroundColor: BRAND_COLORS.indigo }}
                                 >
                                     {request.staffAvatar && !isValidAvatarUrl(request.staffAvatar)
                                         ? request.staffAvatar
                                         : request.staffInitials}
                                 </AvatarFallback>
                             </Avatar>

                            <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-slate-900 dark:text-zinc-100 text-sm">
                                        {request.staffName}
                                    </span>
                                    {leaveConfig && (
                                        <span
                                            className={cn(
                                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold",
                                                leaveConfig.bgColor,
                                                leaveConfig.color
                                            )}
                                        >
                                            {leaveConfig.label}
                                        </span>
                                    )}
                                </div>

                                {/* Timeline Capsule right below Name */}
                                {request.totalDays && request.dates && (
                                    <div className="inline-flex items-center gap-1.5 bg-slate-100/80 dark:bg-zinc-800/80 px-2.5 py-0.5 rounded-full text-[10px] font-semibold text-slate-600 dark:text-zinc-400 mt-1.5 w-fit">
                                        <span>📅</span>
                                        <span>
                                            {request.totalDays} {request.totalDays === 1 ? "Day" : "Days"} • {formatDates(request.dates)}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Dedicated Message Block underneath */}
                        <div className="mt-3.5 pl-0 sm:pl-[60px]">
                            <p className="text-sm font-medium text-slate-600 dark:text-zinc-300 leading-relaxed">
                                {cleanDescription(request.description)}
                            </p>
                        </div>
                    </div>

                    {/* Right Column: Isolated button controls centered vertically with the card layout */}
                    <div className="flex items-center gap-3 self-end lg:self-center flex-shrink-0 w-full lg:w-auto justify-end">
                        {renderActionControls()}
                    </div>
                </div>
            </div>
        );
    }

    // 2. Variant B: BUDGET / ALLOCATION TICKETS
    if (isBudget) {
        const budgetInfo = parseBudgetRequest(request.description, request.amount);
        const catConfig = categoryConfig[budgetInfo.category] || categoryConfig["office"];
        const CatIcon = catConfig.icon;

        return (
            <div
                className={cn(
                    "group relative overflow-hidden transition-all duration-300",
                    "bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-100 dark:border-zinc-800/40 shadow-sm hover:shadow-md"
                )}
            >
                {/* Crisp 3px vertical accent indicator bar on the far-left edge */}
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-400" />

                <div className="flex flex-col pl-1">
                    {/* Header Row: Left Side (Avatar, Name, Category) | Right Side (Requested Allocation badge & buttons) */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Left Side: Avatar & Name details */}
                        <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10 border border-slate-100 dark:border-zinc-800 shadow-sm flex-shrink-0">
                                <AvatarImage src={isValidAvatarUrl(request.staffAvatar) ? request.staffAvatar : undefined} alt={request.staffName} />
                                <AvatarFallback
                                    className="text-white text-xs font-semibold"
                                    style={{ backgroundColor: BRAND_COLORS.indigo }}
                                >
                                    {request.staffAvatar && !isValidAvatarUrl(request.staffAvatar)
                                        ? request.staffAvatar
                                        : request.staffInitials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-semibold text-slate-900 dark:text-zinc-100 text-sm tracking-tight">
                                        {request.staffName}
                                    </p>
                                    <span className="text-xs text-slate-400 dark:text-zinc-500">
                                        {formatRelativeTime(request.requestedAt)}
                                    </span>
                                </div>
                                <div
                                    className={cn(
                                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold mt-0.5",
                                        catConfig.bgColor,
                                        catConfig.color
                                    )}
                                >
                                    <CatIcon className="w-3 h-3" />
                                    <span>{catConfig.label}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Prominently Right-Aligned Requested Allocation badge + Buttons */}
                        <div className="flex flex-wrap items-center gap-4 self-end md:self-center justify-end w-full md:w-auto mt-2 md:mt-0">
                            {/* Prominent green Requested Allocation badge inline with header */}
                            <div className="flex flex-col items-end bg-emerald-50/40 dark:bg-emerald-950/10 px-4 py-1.5 rounded-lg border border-emerald-100/50 dark:border-emerald-900/10 min-w-[130px]">
                                <span className="text-[9px] font-bold text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-widest">REQUESTED ALLOCATION</span>
                                <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                    {budgetInfo.amountStr || "₹0"}
                                </span>
                            </div>

                            {/* Buttons */}
                            <div className="flex items-center gap-2">
                                {renderActionControls()}
                            </div>
                        </div>
                    </div>

                    {/* Dedicated Message description on its own row with clear padding */}
                    <div className="mt-4 pl-0 sm:pl-[52px] border-t border-slate-100 dark:border-zinc-800/40 pt-3">
                        <p className="text-sm font-medium text-slate-600 dark:text-zinc-300 leading-relaxed">
                            {budgetInfo.reason}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // 3. Variant C: ACCESS & PERMISSION TICKETS
    if (isAccessOrPermission) {
        const info = parseAccessRequest(request.description);

        return (
            <div
                className={cn(
                    "group relative overflow-hidden transition-all duration-300",
                    "bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-100 dark:border-zinc-800/40 shadow-sm hover:shadow-md"
                )}
            >
                {/* Crisp 3px vertical accent indicator bar on the far-left edge */}
                <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-400" />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pl-1">
                    {/* Left Column: Header line & badges & justification */}
                    <div className="flex-1 min-w-0">
                        {/* Header Line */}
                        <div className="flex items-center gap-3">
                            <Avatar className="w-10 h-10 border border-slate-100 dark:border-zinc-800 shadow-sm flex-shrink-0">
                                <AvatarImage src={isValidAvatarUrl(request.staffAvatar) ? request.staffAvatar : undefined} alt={request.staffName} />
                                <AvatarFallback
                                    className="text-white text-xs font-semibold"
                                    style={{ backgroundColor: BRAND_COLORS.indigo }}
                                >
                                    {request.staffAvatar && !isValidAvatarUrl(request.staffAvatar)
                                        ? request.staffAvatar
                                        : request.staffInitials}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-900 dark:text-zinc-100 text-sm">
                                    {request.staffName}
                                </span>
                                <span className="text-xs text-slate-400 dark:text-zinc-500">
                                    {formatRelativeTime(request.requestedAt)}
                                </span>
                                <span className="text-slate-300 dark:text-zinc-700">·</span>
                                <div
                                    className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold",
                                        config.bgColor,
                                        config.color
                                    )}
                                >
                                    <Icon className="w-3 h-3" />
                                    {config.label}
                                </div>
                            </div>
                        </div>

                        {/* Technical Metadata Badges Row */}
                        {info.system && (
                            <div className="flex flex-wrap items-center gap-2 mt-3 pl-0 sm:pl-[52px]">
                                <span className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 px-2.5 py-1 rounded-md text-[11px] font-mono border border-slate-100 dark:border-zinc-800">
                                    🖥️ {info.system}
                                </span>
                                {info.duration && (
                                    <span className="inline-flex items-center gap-1.5 bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 px-2.5 py-1 rounded-md text-[11px] font-mono border border-slate-100 dark:border-zinc-800">
                                        ⏱️ {info.duration}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Clean Justification Box */}
                        <div className="mt-3 pl-0 sm:pl-[52px]">
                            <div className="bg-slate-50/50 dark:bg-zinc-900/50 border border-slate-100 dark:border-zinc-800/40 p-3 rounded-lg">
                                <p className="text-sm text-slate-700 dark:text-zinc-300 font-medium leading-relaxed">
                                    {info.justification}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Action Buttons */}
                    <div className="flex items-center gap-3 self-end lg:self-center flex-shrink-0 w-full lg:w-auto justify-end">
                        {renderActionControls()}
                    </div>
                </div>
            </div>
        );
    }

    // 4. Fallback Layout for other request types
    return (
        <div
            className={cn(
                "group relative overflow-hidden transition-all duration-300",
                "bg-white dark:bg-zinc-900 p-5 rounded-xl border border-slate-100 dark:border-zinc-800/40 shadow-sm hover:shadow-md"
            )}
        >
            {/* Crisp 3px vertical accent indicator bar on the far-left edge */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-400" />

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pl-1">
                {/* Left side: content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-4">
                        <Avatar className="w-10 h-10 border border-slate-100 dark:border-zinc-800 shadow-sm flex-shrink-0">
                            <AvatarImage src={isValidAvatarUrl(request.staffAvatar) ? request.staffAvatar : undefined} alt={request.staffName} />
                            <AvatarFallback
                                className="text-white text-xs font-semibold"
                                style={{ backgroundColor: BRAND_COLORS.indigo }}
                            >
                                {request.staffAvatar && !isValidAvatarUrl(request.staffAvatar)
                                    ? request.staffAvatar
                                    : request.staffInitials}
                            </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-slate-900 dark:text-zinc-100 text-sm">
                                    {request.staffName}
                                </span>
                                <span className="text-xs text-slate-400 dark:text-zinc-500">
                                    {formatRelativeTime(request.requestedAt)}
                                </span>
                                <span className="text-slate-300 dark:text-zinc-700">·</span>
                                <div
                                    className={cn(
                                        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold",
                                        config.bgColor,
                                        config.color
                                    )}
                                >
                                    <Icon className="w-3 h-3" />
                                    {config.label}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 pl-0 sm:pl-[52px]">
                        <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300 leading-relaxed bg-white/40 dark:bg-zinc-950/10 p-3 rounded-lg border border-slate-100/50 dark:border-zinc-800/20">
                            {request.description}
                        </p>
                    </div>
                </div>

                {/* Tactical Action Buttons */}
                <div className="flex items-center gap-3 self-end md:self-center flex-shrink-0 mt-3 md:mt-0 w-full md:w-auto justify-end">
                    {renderActionControls()}
                </div>
            </div>
        </div>
    );
};

// Empty state component
const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-12 px-4">
        <div
            className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center mb-4",
                "bg-gradient-to-br from-[#31267D]/10 to-[#31267D]/5"
            )}
        >
            <Shield className="w-7 h-7 text-[#31267D]" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 tracking-tight">
            System Fully Authorized
        </h3>
        <p className="text-sm text-gray-500 mt-1 text-center max-w-xs">
            All pending requests have been processed. No approvals required at this time.
        </p>
    </div>
);

export function PendingApprovals({
    requests,
    onApprove,
    onDecline,
    isCeo = false,
    className,
}: PendingApprovalsProps) {
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

    const handleApprove = async (requestId: string) => {
        setProcessingIds((prev) => new Set(prev).add(requestId));
        try {
            await onApprove(requestId);
        } finally {
            setProcessingIds((prev) => {
                const newSet = new Set(prev);
                newSet.delete(requestId);
                return newSet;
            });
        }
    };

    const handleDecline = async (requestId: string) => {
        setProcessingIds((prev) => new Set(prev).add(requestId));
        try {
            await onDecline(requestId);
        } finally {
            setProcessingIds((prev) => {
                const newSet = new Set(prev);
                newSet.delete(requestId);
                return newSet;
            });
        }
    };

    const pendingCount = requests.filter(
        (r) => !processingIds.has(r.id)
    ).length;

    return (
        <div
            className={cn(
                "relative rounded-[24px] overflow-hidden transition-all duration-300",
                "bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border border-white/40 dark:border-zinc-800/60 shadow-[0_12px_40px_rgba(0,0,0,0.03)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)]",
                className
            )}
        >
            {/* Subtle indigo tint overlay */}
            <div
                className="absolute inset-0 pointer-events-none opacity-40"
                style={{
                    background: `linear-gradient(180deg, rgba(49,38,125,0.03) 0%, transparent 50%)`,
                }}
            />

            {/* Header */}
            <div className="relative flex items-center justify-between px-5 py-4 border-b border-[#31267D]/10">
                <div className="flex items-center gap-3">
                    <div
                        className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center",
                            "bg-[#31267D]/10"
                        )}
                    >
                        <Inbox className="w-4 h-4 text-[#31267D]" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900 tracking-tight">
                            Priority Action Hub
                        </h3>
                        <p className="text-[11px] text-gray-500">
                            {pendingCount > 0
                                ? `${pendingCount} request${pendingCount !== 1 ? "s" : ""} awaiting your review`
                                : "All caught up"}
                        </p>
                    </div>
                </div>

                {pendingCount > 0 && (
                    <span
                        className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-semibold",
                            "bg-[#F14D24]/10 text-[#F14D24]"
                        )}
                    >
                        {pendingCount}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="relative p-4">
                {requests.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="space-y-4">
                        {requests.map((request, index) => (
                            <div
                                key={request.id}
                                className="ua-entry-animate"
                                style={{ animationDelay: `${index * 80}ms` }}
                            >
                                <RequestRow
                                    request={request}
                                    onApprove={handleApprove}
                                    onDecline={handleDecline}
                                    isProcessing={processingIds.has(request.id)}
                                    isCeo={isCeo}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer - only show if there are requests */}
            {requests.length > 0 && (
                <div className="relative px-5 py-3 border-t border-[#31267D]/10 bg-white/40">
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Review requests carefully before approval</span>
                    </div>
                </div>
            )}
        </div>
    );
}

export default PendingApprovals;
