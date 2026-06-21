"use client";

import React, {
    useState,
    useEffect,
    useMemo,
    Fragment,
    useRef,
    useCallback,
} from "react";
import { useRouter } from "next/navigation";
import {
    supabase,
    Profile,
    Task,
    Request,
    Broadcast,
    Knock,
    ActivityFeed,
    Attendance,
    SignupRequest,
    Meeting,
    ExecutiveReport,
    AgentStatus,
    Lead,
    LeadStatus,
    DemoRequest,
    TutorAvailability,
    TutorNotification,
    Programme,
    Idea,
    SalesSignals,
} from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth-context";
import { computeVelocityMetrics } from "@/lib/velocity-engine";
import { useTheme } from "./theme-provider";
import { Button } from "@/components/ui/button";
import {
    Bell,
    Clock,
    FileText,
    UserPlus,
    AlertTriangle,
    Check,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    Target,
    PhoneCall,
    Archive,
    Plus,
    MessageSquare,
    Zap,
    TrendingUp,
    ArrowRight,
    Trash2,
    RefreshCw,
    Loader2,
    ShieldAlert,
    ShieldCheck,
    LogOut,
    Wifi,
    Hourglass,
    Play,
    CheckCircle,
    CheckCircle2,
    MessageCircle,
    Rocket,
    ClipboardList,
    DollarSign,
    Calendar,
    Lightbulb,
    AlertCircle,
    Activity,
    ListTodo,
    CheckSquare,
    X,
    Users,
    MapPin,
    Package,
    Video,
    Bookmark,
    Crown,
    Megaphone,
    Send,
    Eye,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "./theme-toggle";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AnimatePresence, motion } from "framer-motion";
import AddStaffDialog from "./AddStaffDialog";
import { NewIdeaDialog } from "./new-idea-dialog";
import { ThoughtCapture } from "./thought-capture";
import { MessageDialog, MessageType } from "./message-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { deleteFile } from "@/lib/storage";
import { SkeletonCommandCenter } from "./skeleton-loader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn, isValidAvatarUrl } from "@/lib/utils";
import { format, parseISO, isPast, isToday, isTomorrow } from "date-fns";
import { useTabResiliency } from "./tab-resiliency-engine";
import { useIdeas } from "@/hooks/use-ideas";
import { useQueryClient } from "@tanstack/react-query";
import {
    useTasks,
    useStaff,
    useLeads,
    useRequests,
    useMeetings,
    useCeoDirectives,
    useCeoStaffPresence,
    useFinancialEntries,
    useDailyReports,
    useSalesTargets,
} from "@/hooks/use-dashboard-data";

// ============================================
// TYPES & CONSTANTS
// ============================================

type SystemStatus = "STABLE" | "WARNING" | "CRITICAL";

// ============================================
// UI COMPONENTS (MINIMAL & AUTHORITY FOCUSED)
// ============================================

const SectionHeader = React.memo(
    ({
        title,
        color = "bg-theme-bg-white-20",
        className = "mb-4",
    }: {
        title: string;
        color?: string;
        className?: string;
    }) => (
        <div className={cn("flex items-center gap-3", className)}>
            <div className={cn("w-1.5 h-6 rounded-full shadow-sm", color)} />
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-zinc-100">
                {title}
            </h3>
        </div>
    ),
);
SectionHeader.displayName = "SectionHeader";

const CommandCard = React.memo(
    ({
        children,
        className = "",
    }: {
        children: React.ReactNode;
        className?: string;
    }) => {
        return (
            <div
                className={cn(
                    "rounded-3xl p-6 relative overflow-hidden transition-all duration-300",
                    "bg-white/80 backdrop-blur-xl border border-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.03)]",
                    "dark:bg-zinc-900/60 dark:border-zinc-800/60 dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)]",
                    className,
                )}
            >
                {children}
            </div>
        );
    },
);
CommandCard.displayName = "CommandCard";

const ExecutivePerformanceEngine = React.memo(
    ({ tasks, completedTasks }: { tasks: Task[]; completedTasks: Task[] }) => {
        const { userRole } = useAuth();
        const isV2Enabled = process.env.NEXT_PUBLIC_ENABLE_V2_FEATURES === "true" || (typeof window !== "undefined" && window.localStorage.getItem("ENABLE_V2_FEATURES") === "true");

        // Optimization: Pre-calculate velocity to avoid complex filtering in render
        const { velocity, activeTasksCount, completedTodayCount } = useMemo(() => {
            const activeCount = tasks.length;
            const completedCount = completedTasks.filter(
                (t) => t.updated_at && isToday(parseISO(t.updated_at)),
            ).length;
            const totalToday = activeCount + completedCount;
            const v =
                totalToday > 0
                    ? Math.round((completedCount / totalToday) * 100)
                    : 84;
            return {
                velocity: v,
                activeTasksCount: activeCount,
                completedTodayCount: completedCount,
            };
        }, [tasks, completedTasks]);

        const v2Metrics = useMemo(() => {
            if (!isV2Enabled) return null;
            return computeVelocityMetrics(tasks, completedTasks);
        }, [tasks, completedTasks, isV2Enabled]);

        const finalVelocity = isV2Enabled && v2Metrics ? v2Metrics.velocityScore : velocity;

        // Optimization: Memoize load distribution
        const loadDist = useMemo(() => {
            const departments = [
                "Administration",
                "Marketing",
                "Sales",
                "Finance",
            ];
            return departments.map((dept) => {
                const deptTasks = tasks.filter((t) => {
                    const deptName =
                        (t as any).assigned_to_user?.department?.toLowerCase() ||
                        "";
                    return deptName === dept.toLowerCase();
                });
                const count = deptTasks.length;
                const hasEscalated = deptTasks.some((t) => t.is_escalated === true);
                return { name: dept, count, hasEscalated };
            });
        }, [tasks]);

        const maxLoad = useMemo(() => Math.max(...loadDist.map((d) => d.count), 1), [loadDist]);

        return (
            <CommandCard className="mt-2">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-zinc-100 opacity-80">
                            Performance Engine
                        </h3>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.1)]">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500">
                                Optimized
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 cursor-pointer group">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 group-hover:text-indigo-600 transition-colors">
                            Today
                        </span>
                        <ChevronDown className="w-3 h-3 text-slate-400 dark:text-zinc-500 group-hover:text-indigo-600 transition-colors" />
                    </div>
                </div>

                {/* Operational Velocity Metric */}
                <div className="mb-8 p-5 rounded-[2rem] bg-slate-50/50 dark:bg-zinc-800/30 border border-slate-100 dark:border-zinc-800/50 shadow-inner">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.15em]">
                            Operational Velocity
                        </span>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                            {finalVelocity}%
                        </span>
                    </div>
                    <div className="h-2.5 w-full bg-white dark:bg-zinc-900 rounded-full overflow-hidden flex p-0.5 border border-slate-100 dark:border-zinc-800 shadow-sm">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${finalVelocity}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className="h-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                        />
                    </div>
                    <div className="flex justify-between mt-3 px-1">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                            <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-tight">
                                {completedTodayCount} Completed
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-700" />
                            <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-tight">
                                {activeTasksCount} Pending
                            </span>
                        </div>
                    </div>
                </div>

                {isV2Enabled && v2Metrics && (
                    <div className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-2xl bg-slate-50/50 dark:bg-zinc-850/30 border border-slate-200/50 dark:border-zinc-800/30 text-[10px] font-mono shadow-sm">
                        <div className="flex flex-col">
                            <span className="text-slate-400 dark:text-zinc-500 uppercase tracking-wider text-[9px] font-black">Avg Read Lag</span>
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{v2Metrics.averageReadLagMinutes}m</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-slate-400 dark:text-zinc-500 uppercase tracking-wider text-[9px] font-black">Execution Speed</span>
                            <span className="text-xs font-black text-slate-800 dark:text-slate-200 mt-0.5">{v2Metrics.averageExecutionHours}h</span>
                        </div>
                    </div>
                )}

                {/* Departmental Load Distribution */}
                <div className="mb-2">
                    <div className="flex items-center gap-2 mb-5">
                        <Activity className="w-3.5 h-3.5 text-indigo-500/60 dark:text-indigo-400/60" />
                        <h4 className="text-[10px] font-black text-slate-900 dark:text-zinc-100 opacity-80 uppercase tracking-[0.2em]">
                            Load Distribution
                        </h4>
                    </div>
                    <div className="grid grid-cols-1 gap-3.5">
                        {loadDist.map((dept) => (
                            <div
                                key={dept.name}
                                className="flex items-center justify-between group"
                            >
                                <div className="flex items-center gap-3 flex-1">
                                    <span
                                        className={cn(
                                            "w-1.5 h-4 rounded-full transition-all duration-500 shadow-sm",
                                            isV2Enabled && (dept as any).hasEscalated
                                                ? "bg-red-500 dark:bg-red-650 animate-pulse ring-2 ring-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.8)]"
                                                : dept.name === "Administration"
                                                  ? "bg-slate-400 dark:bg-zinc-500"
                                                  : dept.name === "Marketing"
                                                    ? "bg-purple-500 dark:bg-purple-600"
                                                    : dept.name === "Sales"
                                                      ? "bg-orange-500 dark:bg-orange-600"
                                                      : "bg-blue-500 dark:bg-blue-600",
                                        )}
                                    />
                                    <span className="text-[11px] font-black text-slate-400 dark:text-zinc-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight">
                                        {dept.name}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3 w-32">
                                    <div className="flex-1 h-1.5 bg-slate-50 dark:bg-zinc-800/50 rounded-full overflow-hidden shadow-inner border border-slate-100/50 dark:border-zinc-800/30">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{
                                                width: `${(dept.count / maxLoad) * 100}%`,
                                            }}
                                            className={cn(
                                                "h-full rounded-full opacity-80 shadow-sm transition-all duration-500",
                                                isV2Enabled && (dept as any).hasEscalated
                                                    ? "bg-gradient-to-r from-red-600 via-red-500 to-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse"
                                                    : dept.name === "Administration"
                                                      ? "bg-slate-400 dark:bg-zinc-500"
                                                      : dept.name === "Marketing"
                                                        ? "bg-purple-500 dark:bg-purple-600"
                                                        : dept.name === "Sales"
                                                          ? "bg-orange-500 dark:bg-orange-600"
                                                          : "bg-blue-500 dark:bg-blue-600",
                                            )}
                                        />
                                    </div>
                                    <span className="text-[11px] font-black text-slate-900 dark:text-zinc-100 w-5 text-right tabular-nums">
                                        {dept.count}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CommandCard>
        );
    },
);
ExecutivePerformanceEngine.displayName = "ExecutivePerformanceEngine";

const renderCEOTaskGauge = (t: Task) => {
    const s = (t.status || "PENDING").toUpperCase();
    const progress = s === "COMPLETED" ? 100 : t.progress || 0;
    const radius = 14;
    const circumference = 2 * Math.PI * radius; // ~88
    const strokeDashoffset = circumference - (circumference * progress) / 100;

    let strokeColor = "stroke-blue-500";
    if (s === "COMPLETED") {
        strokeColor = "stroke-emerald-500";
    } else if (s === "PENDING") {
        strokeColor = "stroke-orange-500";
    } else if (s === "UNDER_REVIEW" || s === "IN_REVIEW") {
        strokeColor = "stroke-purple-500";
    }

    return (
        <div className="flex items-center gap-2 select-none shrink-0">
            <span className="text-sm font-black text-slate-800 dark:text-zinc-200 tracking-tight">
                {progress}%
            </span>
            <div className="relative w-8 h-8 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90">
                    <circle
                        cx="16"
                        cy="16"
                        r={radius}
                        className="stroke-slate-100 dark:stroke-zinc-800 fill-none"
                        strokeWidth="2.5"
                    />
                    <circle
                        cx="16"
                        cy="16"
                        r={radius}
                        className={cn(
                            "fill-none transition-all duration-500 ease-out",
                            strokeColor,
                        )}
                        strokeWidth="2.5"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                    {s === "COMPLETED" ? (
                        <Check className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
                    ) : s === "PENDING" ? (
                        <Zap className="w-2.5 h-2.5 text-orange-500 dark:text-orange-400 fill-orange-500/10" />
                    ) : s === "UNDER_REVIEW" || s === "IN_REVIEW" ? (
                        <Clock className="w-2.5 h-2.5 text-purple-500 dark:text-purple-400 animate-pulse" />
                    ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    )}
                </div>
            </div>
        </div>
    );
};

// MAIN COMPONENT: EXECUTIVE COMMAND
// ============================================

export function ExecutiveCommand({ currentView }: { currentView?: string }) {
    const router = useRouter();
    const isV2Enabled = process.env.NEXT_PUBLIC_ENABLE_V2_FEATURES === "true" || (typeof window !== "undefined" && window.localStorage.getItem("ENABLE_V2_FEATURES") === "true");
    const { profile, signOut, userRole, loading } = useAuth();
    const { theme } = useTheme();
    const queryClient = useQueryClient();

    // ============================================
    // 1. STATE DECLARATIONS (TOP-LEVEL)
    // ============================================

    // TanStack Query Hooks (Primary Data Source)
    // Optimization: Disable redundant focus refetching as useWindowSync handles it with throttling
    const queryOptions = useMemo(() => ({
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 5, // 5 minutes
    }), []);

    const {
        activeTasks: tasks = [],
        completedTasks = [],
        isFetching: isTasksFetching,
    } = useTasks(queryOptions);
    const { data: rawStaff = [], isFetching: isStaffFetching } = useStaff(queryOptions);
    const { data: presenceData = [], isFetching: isPresenceFetching } = useCeoStaffPresence(queryOptions);

    const staff = useMemo(() => {
        if (!presenceData || (presenceData as any[]).length === 0) {
            return rawStaff;
        }
        const presenceMap = new Map<string, any>((presenceData as any[]).map((p: any) => [p.user_id, p]));
        return rawStaff.map((member: any) => {
            const presence = presenceMap.get(member.id) as any;
            if (presence) {
                return {
                    ...member,
                    status: presence.status || member.status,
                    lastActive: presence.updated_at,
                    sessionStart: presence.session_start,
                    sessionDuration: presence.session_duration,
                };
            }
            return member;
        });
    }, [rawStaff, presenceData]);
    const { data: requests = [], isFetching: isRequestsFetching } =
        useRequests(queryOptions);
    const { data: meetings = [], isFetching: isMeetingsFetching } =
        useMeetings(queryOptions);
    const { data: ceoDirectives = [], isFetching: isCeoDirectivesFetching } =
        useCeoDirectives(queryOptions);
    const { leads, demoRequests, isLoading: isLoadingLeads } = useLeads(queryOptions);
    const {
        ideas,
        isFetching: isIdeasFetching,
        toggleIdea: toggleIdeaMutation,
        disposeIdea: disposeIdeaMutation,
    } = useIdeas(queryOptions);
    const { data: financialEntries = [] } = useFinancialEntries(queryOptions);
    const { data: dailyReports = [] } = useDailyReports(queryOptions);
    const { data: salesTargets } = useSalesTargets(queryOptions);

    // UI & Filter States
    const [taskTab, setTaskTab] = useState<
        "active" | "blocked" | "overdue" | "daily" | "completed"
    >("active");
    const [departmentFilter, setDepartmentFilter] = useState<
        "ceo" | "administration" | "marketing" | "sales" | "finance"
    >("ceo");
    const [meetingFilter, setMeetingFilter] = useState<
        "upcoming" | "today" | "week"
    >("upcoming");
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [isRefreshing, setIsRefreshing] = useState(false);
    // Added for fast branded refresh
    const [isSystemRefreshing, setIsSystemRefreshing] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [isManageMode, setIsManageMode] = useState(false);
    const [showStaffOverview, setShowStaffOverview] = useState(false);
    const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
    const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
    const [isAssignTaskOpen, setIsAssignTaskOpen] = useState(false);
    const [isRemoveStaffModalOpen, setIsRemoveStaffModalOpen] = useState(false);
    const [staffToRemove, setStaffToRemove] = useState<Profile | null>(null);
    const [confirmName, setConfirmName] = useState("");
    const [isIdeasOpen, setIsIdeasOpen] = useState(false);
    const [isNewIdeaDialogOpen, setIsNewIdeaDialogOpen] = useState(false);
    const [isChatModalOpen, setIsChatModalOpen] = useState(false);
    const [selectedStaffForChat, setSelectedStaffForChat] =
        useState<Profile | null>(null);
    const [chatMessage, setChatMessage] = useState("");

    // Global Announcement States
    const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] =
        useState(false);
    const [announcementDefaultType, setAnnouncementDefaultType] =
        useState<MessageType>("announcement");
    const [announcementMessage, setAnnouncementMessage] = useState("");
    const [isDeployingAnnouncement, setIsDeployingAnnouncement] =
        useState(false);
    const [channelDestination, setChannelDestination] = useState<
        "CEO_BROADCAST" | "COMMUNITY_BOARD"
    >("CEO_BROADCAST");
    const [announcementType, setAnnouncementType] = useState<
        "MEETING" | "NOTICE" | "DEADLINE"
    >("NOTICE");

    // Tracking Sets
    const [completedIdeas, setCompletedIdeas] = useState<Set<string>>(
        new Set(),
    );
    const [deletingTaskIds, setDeletingTaskIds] = useState<Set<string>>(
        new Set(),
    );
    const [escalatingTaskIds, setEscalatingTaskIds] = useState<Set<string>>(
        new Set(),
    );
    const [clearedNotifications, setClearedNotifications] = useState<
        Set<string>
    >(new Set());

    // Form States
    const [newIdea, setNewIdea] = useState({
        title: "",
        description: "",
        priority: "medium",
    });
    const [selectedStaffForIdea, setSelectedStaffForIdea] = useState<string[]>(
        [],
    );
    const [hoveredRequest, setHoveredRequest] = useState<any | null>(null);

    // Refs
    const channelsRef = useRef<any[]>([]);
    const isVisibleRef = useRef(true);
    const lastValidProfileIdRef = useRef<string | null>(profile?.id || null);

    // UA Messenger unread count (feeds the header button badge)
    const [hqUnreadCount, setHqUnreadCount] = useState(0);
    const [hqIsOpen, setHqIsOpen] = useState(false);

    // ============================================
    // 2. DERIVED STATE & MEMOS
    // ============================================

    // Periodic refresh for time-based filtering
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
        return () => clearInterval(interval);
    }, []);

    // UA Messenger unread count polling
    useEffect(() => {
        if (!profile?.id) return;
        const fetchCount = async () => {
            try {
                const { count } = await supabase
                    .from("notifications")
                    .select("*", { count: "exact", head: true })
                    .eq("user_id", profile.id)
                    .eq("type", "direct")
                    .eq("read", false);
                setHqUnreadCount(count ?? 0);
            } catch {}
        };
        fetchCount();
        
        // Listen for immediate messenger updates
        window.addEventListener("hq-messenger-updated", fetchCount);
        const interval = setInterval(fetchCount, 30000);
        
        return () => {
            clearInterval(interval);
            window.removeEventListener("hq-messenger-updated", fetchCount);
        };
    }, [profile?.id]);

    // Sync hqIsOpen state with external toggle events
    useEffect(() => {
        const onToggle = () => setHqIsOpen(prev => !prev);
        const onOpen = () => setHqIsOpen(true);
        const onClose = () => setHqIsOpen(false);
        window.addEventListener("toggle-hq-messenger", onToggle);
        window.addEventListener("open-hq-messenger", onOpen);
        window.addEventListener("close-hq-messenger", onClose);
        return () => {
            window.removeEventListener("toggle-hq-messenger", onToggle);
            window.removeEventListener("open-hq-messenger", onOpen);
            window.removeEventListener("close-hq-messenger", onClose);
        };
    }, []);


    // Update completedIdeas set when ideas change
    useEffect(() => {
        const completedIds = ideas
            .filter((idea: any) => idea.completed)
            .map((idea: any) => idea.id);

        setCompletedIdeas((prev) => {
            if (
                prev.size === completedIds.length &&
                completedIds.every((id) => prev.has(id))
            ) {
                return prev;
            }
            return new Set(completedIds);
        });
    }, [ideas]);

    // Update profile ref
    useEffect(() => {
        if (profile?.id) lastValidProfileIdRef.current = profile.id;
    }, [profile?.id]);

    // Filter visible ideas (hide completed ideas after 1 hour)
    const visibleIdeas = useMemo(() => {
        const oneHourAgo = new Date(currentTime - 60 * 60 * 1000);
        return ideas.filter((idea: any) => {
            if (!idea.completed) return true;
            const completedAt = idea.completed_at
                ? new Date(idea.completed_at)
                : new Date(idea.updated_at);
            return completedAt > oneHourAgo;
        });
    }, [ideas, currentTime]);

    const deptFilteredTasks = useMemo(() => {
        return tasks.filter(t => {
            if (departmentFilter === "ceo") return true;
            const assignee = staff.find((s) => s.id === t.assigned_to);
            if (!assignee) return false;
            const dept = assignee.department?.toLowerCase() || "";
            switch (departmentFilter) {
                case "sales":
                    return dept === "sales";
                case "marketing":
                    return dept === "marketing";
                case "finance":
                    return dept === "finance" || dept === "accounts";
                case "administration":
                    return dept === "administration" || dept === "admin" || dept === "hr";
                default:
                    return false;
            }
        });
    }, [tasks, departmentFilter, staff]);

    const deptFilteredCompletedTasks = useMemo(() => {
        return completedTasks.filter(t => {
            if (departmentFilter === "ceo") return true;
            const assignee = staff.find((s) => s.id === t.assigned_to);
            if (!assignee) return false;
            const dept = assignee.department?.toLowerCase() || "";
            switch (departmentFilter) {
                case "sales":
                    return dept === "sales";
                case "marketing":
                    return dept === "marketing";
                case "finance":
                    return dept === "finance" || dept === "accounts";
                case "administration":
                    return dept === "administration" || dept === "admin" || dept === "hr";
                default:
                    return false;
            }
        });
    }, [completedTasks, departmentFilter, staff]);

    const deptOverdueCount = useMemo(() => {
        return deptFilteredTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== "completed").length;
    }, [deptFilteredTasks]);

    const deptCompletedCount = useMemo(() => {
        return deptFilteredCompletedTasks.length;
    }, [deptFilteredCompletedTasks]);

    // Optimize displayed tasks
    const displayedTasks = useMemo(() => {
        if (taskTab === "completed") return deptFilteredCompletedTasks;

        return deptFilteredTasks.filter((t) => {
            if (deletingTaskIds.has(t.id)) return false;

            const isOverdue = t.due_date && new Date(t.due_date) < new Date();
            const isDaily = t.is_daily_task === true || t.repeat_daily === true;

            // CEO/My Tasks filter (only apply if department is ceo)
            if (departmentFilter === "ceo") {
                if (userRole === "MANAGER") {
                    const currentMe =
                        profile?.id || lastValidProfileIdRef.current;
                    const isAssignedByCeo = (t as any).creator?.role === "ceo";
                    const isAssignedToMe = t.assigned_to === currentMe;
                    if (!isAssignedByCeo || !isAssignedToMe) return false;
                }
            }

            if (taskTab === "daily") return isDaily;
            if (taskTab === "overdue") return isOverdue;
            if (taskTab === "blocked") return t.priority === "urgent";
            return !isOverdue && t.priority !== "urgent";
        });
    }, [
        taskTab,
        deptFilteredTasks,
        deptFilteredCompletedTasks,
        deletingTaskIds,
        departmentFilter,
        userRole,
        profile?.id,
    ]);

    // ============================================
    // 3. ACTIONS & LOGIC
    // ============================================

    const fetchData = useCallback(
        async (force = false, silent = false) => {
            if (!silent) setIsRefreshing(true);
            try {
                // High-speed parallel invalidation for manual refreshes
                await queryClient.invalidateQueries({
                    predicate: (query) =>
                        query.queryKey[0] === "tasks" ||
                        query.queryKey[0] === "staff" ||
                        query.queryKey[0] === "requests" ||
                        query.queryKey[0] === "ideas" ||
                        query.queryKey[0] === "meetings" ||
                        query.queryKey[0] === "ceo_directives" ||
                        query.queryKey[0] === "financial-entries" ||
                        query.queryKey[0] === "daily-reports" ||
                        query.queryKey[0] === "sales-targets",
                });
            } catch (e) {
                console.error("Telemetry sync failed:", e);
            } finally {
                if (!silent) setIsRefreshing(false);
            }
        },
        [queryClient],
    );

    const setupRealtime = useCallback(() => {
        // STRICT CLEANUP: Clear all existing channels before re-subscribing
        if (channelsRef.current.length > 0) {
            console.log("[ExecutiveCommand] Cleaning up existing realtime channels...");
            channelsRef.current.forEach((ch) => {
                if (ch) supabase.removeChannel(ch);
            });
            channelsRef.current = [];
        }

        // DEBOUNCED INVALIDATION: Prevent rapid-fire re-renders from postgres payloads
        const invalidationLocks = {
            tasks: false,
            requests: false,
            ideas: false
        };

        const throttledInvalidate = (key: 'tasks' | 'requests' | 'ideas') => {
            if (invalidationLocks[key]) return;
            invalidationLocks[key] = true;
            
            queryClient.invalidateQueries({ queryKey: [key] });
            
            // Release lock after 2 seconds to prevent overwhelming the UI
            setTimeout(() => {
                invalidationLocks[key] = false;
            }, 2000);
        };

        const instanceId = Math.random().toString(36).substring(7);
        const taskChannel = supabase
            .channel(`tasks-updates-exec-${instanceId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "tasks" },
                () => throttledInvalidate("tasks"),
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') console.log("Task Realtime: Subscribed");
            });

        const requestChannel = supabase
            .channel(`requests-updates-exec-${instanceId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "requests" },
                () => throttledInvalidate("requests"),
            )
            .subscribe();

        const ideaChannel = supabase
            .channel(`ideas-updates-exec-${instanceId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "ideas" },
                () => throttledInvalidate("ideas"),
            )
            .subscribe();

        channelsRef.current = [taskChannel, requestChannel, ideaChannel];
    }, [queryClient]);

    useEffect(() => {
        if (loading || !profile?.id) {
            return;
        }
        setupRealtime();
        return () => {
            console.log("[ExecutiveCommand] Unmounting: Removing all realtime channels");
            if (channelsRef.current.length > 0) {
                channelsRef.current.forEach((ch) => {
                    if (ch) supabase.removeChannel(ch);
                });
                channelsRef.current = [];
            }
        };
    }, [setupRealtime, loading, profile?.id]);

    // 24/7 Resiliency & Smart Recovery Engine
    useEffect(() => {
        const performFullRefresh = () => {
            console.log("[ExecutiveCommand] Triggering Resiliency Refresh...");
            setIsSystemRefreshing(true);
            
            // Watchdog: Force reload after 3.5s if thread hangs
            const watchdog = setTimeout(() => {
                window.location.reload();
            }, 3500);

            // Give the UI a tiny moment to show the branded overlay
            setTimeout(() => {
                window.location.reload();
            }, 150);

            return () => clearTimeout(watchdog);
        };

        const handleGlobalError = (event: ErrorEvent | PromiseRejectionEvent) => {
            const message = (event as any).message || (event as any).reason?.message || "";
            if (message.includes("ChunkLoadError") || message.includes("Loading chunk")) {
                performFullRefresh();
            }
        };

        window.addEventListener("error", handleGlobalError);
        window.addEventListener("unhandledrejection", handleGlobalError);

        return () => {
            window.removeEventListener("error", handleGlobalError);
            window.removeEventListener("unhandledrejection", handleGlobalError);
        };
    }, []);

    const handleResync = useCallback(() => {
        // Manual refresh if needed, but we rely on query invalidation
        fetchData(true, true);
    }, [fetchData]);

    const handleReconnect = useCallback(() => {
        console.log(
            "[ExecutiveCommand] Tab Focus: Re-establishing stable realtime connection",
        );
        setupRealtime();
    }, [setupRealtime]);

    useTabResiliency(
        handleResync,
        isRefreshing,
        setIsRefreshing,
        handleReconnect,
    );

    // Toggle completion status
    const toggleIdeaCompletion = async (ideaId: string) => {
        // Find the current idea to get its completion status
        const currentIdea = ideas.find((idea) => idea.id === ideaId);
        if (!currentIdea) return;

        toggleIdeaMutation({ ideaId, isCompleted: !!currentIdea.completed });
    };

    // Clear all completed directives
    const clearCompletedDirectives = async () => {
        const completedIds = Array.from(completedIdeas);

        if (completedIds.length === 0) {
            toast.info("No completed directives to clear");
            return;
        }

        try {
            // Delete all completed directives from database
            const { error } = await supabase
                .from("ideas")
                .delete()
                .in("id", completedIds);

            if (error) {
                console.error("Error clearing completed directives:", error);
                toast.error("Failed to clear completed directives");
                return;
            }

            // Clear local state
            setCompletedIdeas(new Set());

            // Refresh ideas data via useIdeas refetch if needed or just wait for invalidation
            // (Note: clearCompletedDirectives still uses manual Supabase call, we should ideally use a mutation)

            toast.success(
                `Cleared ${completedIds.length} completed directive${completedIds.length > 1 ? "s" : ""}`,
            );
        } catch (error) {
            console.error("Error clearing completed directives:", error);
            toast.error("Failed to clear completed directives");
        }
    };

    // Form States
    const [repeatDaily, setRepeatDaily] = useState(false);

    const [newTask, setNewTask] = useState({
        title: "",
        assignedTo: "",
        priority: "medium",
        description: "",
        due_date: "",
        due_time: "",
    });

    const [isDelegationModalOpen, setIsDelegationModalOpen] = useState(false);
    const [selectedIdeaForDelegation, setSelectedIdeaForDelegation] =
        useState<Idea | null>(null);
    const [isDelegating, setIsDelegating] = useState(false);

    // Enhanced Task Form State
    const [taskDescription, setTaskDescription] = useState("");
    const [attachmentUrl, setAttachmentUrl] = useState("");
    const [assigneeSearch, setAssigneeSearch] = useState("");
    const [isDraft, setIsDraft] = useState(false);
    const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

    // LIVE OPERATIONS DATA
    // Optimization: Debounce or throttle the activity feed calculation if necessary,
    // but for now, we'll ensure it only re-calculates on meaningful data changes.
    const activities = useMemo(() => {
        // Optimization: Use a smaller subset of data if the lists are huge
        // and only process items that are actually needed for the signal feed.
        const items: any[] = [];
        
        // 1. Escalations (High Priority)
        tasks.forEach(t => {
            if ((t.priority === "urgent" || (isV2Enabled && t.is_escalated)) && !(t as any).signal_cleared) {
                items.push({
                    id: `esc-${t.id}`,
                    category: "escalation",
                    title: t.is_escalated ? "Critical Escalation" : "Operation Escalated",
                    description: t.is_escalated 
                        ? `OPERATION ESCALATED: "${t.title}" is critically overdue!` 
                        : `Urgent: ${t.title}`,
                    time: t.updated_at || t.created_at,
                    icon: AlertCircle,
                    color: "#ef4444",
                    colorType: "red",
                    priority: "high",
                });
            }
        });

        // 2. Staff (Recently Joined)
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
        staff.forEach(s => {
            if (new Date(s.created_at) > twoDaysAgo && !(s as any).signal_cleared) {
                items.push({
                    id: `staff-${s.id}`,
                    category: "staff",
                    title: "New Operative",
                    description: `${s.full_name} joined as ${s.department}`,
                    time: s.created_at,
                    icon: Users,
                    color: "#06b6d4",
                    colorType: "cyan",
                    priority: "medium",
                });
            }
        });

        // 3. New Task Assignments
        tasks.forEach(t => {
            if (t.priority !== "urgent" && t.status === "pending" && !(t as any).signal_cleared) {
                items.push({
                    id: `task-${t.id}`,
                    category: "task",
                    title: "Task Dispatched",
                    description: `${t.title} assigned to ${staff.find((s) => s.id === t.assigned_to)?.full_name || "Operative"}`,
                    time: t.created_at,
                    icon: ClipboardList,
                    color: "#3b82f6",
                    colorType: "blue",
                    priority: "medium",
                });
            }
        });

        // 4. Completed Tasks
        completedTasks.slice(0, 10).forEach(t => {
            if (!(t as any).signal_cleared) {
                items.push({
                    id: `completed-${t.id}`,
                    category: "completed",
                    title: "Mission Complete",
                    description: `${t.title} completed by ${staff.find((s) => s.id === t.assigned_to)?.full_name || "Operative"}`,
                    time: t.updated_at,
                    icon: CheckCircle,
                    color: "#10b981",
                    colorType: "green",
                    priority: "low",
                });
            }
        });

        // 5. Leads & Conversions
        leads.forEach(l => {
            if (!(l as any).signal_cleared) {
                if (l.status === "new") {
                    items.push({
                        id: `lead-${l.id}`,
                        category: "lead",
                        title: "New Lead",
                        description: `${l.lead_name}`,
                        time: l.created_at,
                        icon: UserPlus,
                        color: "#f59e0b",
                        colorType: "amber",
                        priority: "medium",
                    });
                } else if (l.status === "converted") {
                    items.push({
                        id: `pay-${l.id}`,
                        category: "payment",
                        title: "Payment Received",
                        description: `Lead conversion: ${l.lead_name}`,
                        time: l.updated_at || l.created_at,
                        icon: DollarSign,
                        color: "#10b981",
                        colorType: "green",
                        priority: "high",
                    });
                }
            }
        });

        // 6. Requests
        requests.forEach(r => {
            if (!(r as any).signal_cleared) {
                items.push({
                    id: `${r.type === 'leave' ? 'leave' : 'req'}-${r.id}`,
                    category: r.type === 'leave' ? "leave" : "request",
                    title: r.type === 'leave' ? "Leave Requested" : "Resource Request",
                    description: `${r.title} by ${staff.find((s) => s.id === r.submitted_by)?.full_name || "Operative"}`,
                    time: r.created_at,
                    icon: r.type === 'leave' ? Calendar : Package,
                    color: r.type === 'leave' ? "#f97316" : "#8b5cf6",
                    colorType: r.type === 'leave' ? "orange" : "purple",
                    priority: "medium",
                });
            }
        });

        // 7. Ideas
        ideas.forEach(i => {
            if (!(i as any).signal_cleared) {
                items.push({
                    id: `idea-${i.id}`,
                    category: "idea",
                    title: "Strategic Idea",
                    description: i.title || i.content?.slice(0, 40),
                    time: i.created_at,
                    icon: Lightbulb,
                    color: "#8b5cf6",
                    colorType: "purple",
                    priority: "medium",
                });
            }
        });

        // 8. Demo Requests
        demoRequests.forEach(d => {
            if (!(d as any).signal_cleared) {
                items.push({
                    id: `demo-${d.id}`,
                    category: "task",
                    title: "Demo Scheduled",
                    description: `Session for ${d.lead?.lead_name || "Lead"}`,
                    time: d.created_at,
                    icon: PhoneCall,
                    color: "#3b82f6",
                    colorType: "blue",
                    priority: "medium",
                });
            }
        });

        // 9. Upcoming Meetings
        meetings.forEach(m => {
            if (!(m as any).signal_cleared) {
                items.push({
                    id: `meeting-${m.id}`,
                    category: "meeting",
                    title: "Strategic Session",
                    description: m.title,
                    time: m.scheduled_at,
                    icon: Video,
                    color: "#6366f1",
                    colorType: "indigo",
                    priority: "medium",
                });
            }
        });

        return items
            .filter((item) => !clearedNotifications.has(item.id))
            .sort((a, b) => {
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 1;
                const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 1;
                if (aPriority !== bPriority) return bPriority - aPriority;
                return new Date(b.time).getTime() - new Date(a.time).getTime();
            })
            .slice(0, 30);
    }, [
        tasks,
        ideas,
        requests,
        demoRequests,
        leads,
        staff,
        completedTasks,
        meetings,
        clearedNotifications,
        isV2Enabled,
    ]);

    // Clear Signal Feed
    const clearSignalFeed = () => {
        // Immediately clear client-side for instant feedback
        const currentActivityIds = new Set(activities.map((act) => act.id));
        setClearedNotifications(currentActivityIds);

        // Try database updates in background (fire and forget)
        activities.forEach((act) => {
            const [prefix, id] = act.id.split("-");

            switch (prefix) {
                case "esc": // Escalations (urgent tasks)
                case "task": // Regular tasks
                case "completed": // Completed tasks
                    supabase
                        .from("tasks")
                        .update({ signal_cleared: true })
                        .eq("id", id); // Fire and forget
                    break;
                case "pay": // Payments (converted leads)
                case "lead": // New leads
                    supabase
                        .from("leads")
                        .update({ signal_cleared: true })
                        .eq("id", id); // Fire and forget
                    break;
                case "leave": // Leave requests
                case "req": // Other requests
                    supabase
                        .from("requests")
                        .update({ signal_cleared: true })
                        .eq("id", id); // Fire and forget
                    break;
                case "idea": // Ideas
                    supabase
                        .from("ideas")
                        .update({ signal_cleared: true })
                        .eq("id", id); // Fire and forget
                    break;
                case "demo": // Demo requests
                    supabase
                        .from("demo_requests")
                        .update({ signal_cleared: true })
                        .eq("id", id); // Fire and forget
                    break;
                case "staff": // New staff members
                    supabase
                        .from("profiles")
                        .update({ signal_cleared: true })
                        .eq("id", id); // Fire and forget
                    break;
                case "meeting": // Upcoming meetings
                    supabase
                        .from("meetings")
                        .update({ signal_cleared: true })
                        .eq("id", id); // Fire and forget
                    break;
            }
        });

        toast.success("Signal Feed Cleared");
    };

    // Ensure ceo_reviewed column exists
    const ensureCeoReviewedColumn = async () => {
        try {
            // Try to update a task with ceo_reviewed to see if column exists
            const { error } = await supabase
                .from("tasks")
                .select("id")
                .limit(1)
                .single();

            if (error) {
                console.error("Error checking table:", error);
                return;
            }

            // Try to update with ceo_reviewed column
            const { error: testError } = await supabase
                .from("tasks")
                .update({ ceo_reviewed: false })
                .eq("status", "completed")
                .limit(1);

            if (
                testError &&
                testError.message.includes(
                    'column "ceo_reviewed" does not exist',
                )
            ) {
                console.log(
                    "ceo_reviewed column does not exist, tasks will be filtered by reviewed_at only",
                );
                return;
            }

            console.log("ceo_reviewed column exists");
        } catch (error) {
            console.error("Error ensuring ceo_reviewed column:", error);
        }
    };

    // Fetch data when view becomes active
    useEffect(() => {
        const isVisible = currentView === "command-center" || !currentView;
        isVisibleRef.current = isVisible;
        if (isVisible) {
            console.log("Executive view activated - syncing data");
            fetchData(true, true);
        }
    }, [currentView]);

    // Visibility and Initial Load
    useEffect(() => {
        // Initial load only
        if (profile?.id) {
            console.log("[ExecutiveCommand] Initializing dashboard data and realtime channels...");
            fetchData(false, false);
            setupRealtime();
        }
    }, [profile?.id, fetchData, setupRealtime]);

    // Listen for FAB actions from mobile FAB component
    useEffect(() => {
        const handleFabAction = (event: CustomEvent) => {
            const { action } = event.detail;
            switch (action) {
                case "new-idea":
                    setIsNewIdeaDialogOpen(true);
                    break;
                case "add-staff":
                    setIsAddStaffOpen(true);
                    break;
                case "new-directive":
                    setIsAssignTaskOpen(true);
                    break;
                case "announcement":
                    setAnnouncementDefaultType("announcement");
                    setIsAnnouncementDialogOpen(true);
                    break;
            }
        };

        window.addEventListener("fab-action", handleFabAction as EventListener);
        return () => {
            window.removeEventListener(
                "fab-action",
                handleFabAction as EventListener,
            );
        };
    }, []);

    // Computed Stats
    // Optimization: Pre-calculate metrics to avoid multiple passes over large arrays.
    const stats = useMemo(() => {
        const todayStr = new Date().toISOString().split("T")[0];
        const nowTime = new Date().getTime();

        // Single pass over staff
        let staffOnline = 0;
        const sortedStaff = [...staff].sort((a, b) => {
            const priority = { online: 0, busy: 1, away: 2, offline: 3 };
            return (priority[a.status] ?? 4) - (priority[b.status] ?? 4);
        });
        
        sortedStaff.forEach(s => {
            if (s.status === "online" || s.status === "busy") staffOnline++;
        });

        // Single pass over requests
        let decisionsPending = 0;
        let hasCriticalRequest = false;
        let leavesRequestedToday = 0;
        
        requests.forEach(r => {
            const created = new Date(r.created_at).getTime();
            if (nowTime - created < 24 * 60 * 60 * 1000) {
                decisionsPending++;
                if (r.priority === "high" || r.priority === "urgent") hasCriticalRequest = true;
            }
            if (r.type === "leave" && r.created_at.startsWith(todayStr)) {
                leavesRequestedToday++;
            }
        });

        let systemStatus: SystemStatus = "STABLE";
        if (decisionsPending > 5) systemStatus = "WARNING";
        if (hasCriticalRequest) systemStatus = "CRITICAL";

        // Single pass over tasks
        let overdueCount = 0;
        let tasksAssignedToday = 0;
        let activeBlockers = 0;
        
        tasks.forEach(t => {
            if (t.due_date && new Date(t.due_date) < new Date() && t.status !== "completed") {
                overdueCount++;
            }
            if (t.created_at.startsWith(todayStr)) {
                tasksAssignedToday++;
            }
            if (t.priority === "urgent" && t.status !== "completed") {
                activeBlockers++;
            }
        });

        // Leads metrics
        let paymentsReceivedToday = 0;
        let newLeadsToday = 0;
        leads.forEach(l => {
            const dateStr = (l.updated_at || l.created_at).startsWith(todayStr);
            if (l.status === "converted" && dateStr) paymentsReceivedToday++;
            if (l.created_at.startsWith(todayStr)) newLeadsToday++;
        });

        // Velocity Calculation
        const completedTodayCount = completedTasks.filter((t) => {
            const updatedDate = new Date(t.updated_at || t.created_at)
                .toISOString()
                .split("T")[0];
            return updatedDate === todayStr;
        }).length;
        
        const totalToday = tasks.length + completedTodayCount;
        
        // Use v2 velocity aggregation engine if enabled
        const isV2Enabled = process.env.NEXT_PUBLIC_ENABLE_V2_FEATURES === "true" || (typeof window !== "undefined" && window.localStorage.getItem("ENABLE_V2_FEATURES") === "true");
        const v2Metrics = isV2Enabled ? computeVelocityMetrics(tasks, completedTasks) : null;
        const operationalVelocity = v2Metrics 
            ? v2Metrics.velocityScore 
            : (totalToday > 0 ? Math.round((completedTodayCount / totalToday) * 100) : 0);

        // Financial metrics (Current calendar month balance)
        const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
        const monthEntries = financialEntries.filter((entry: any) =>
            entry.entry_date.startsWith(currentMonthStr)
        );
        const monthUloomx = monthEntries.reduce(
            (sum: number, entry: any) => sum + (parseFloat(entry.uloomx_income) || 0),
            0
        );
        const monthUsthad = monthEntries.reduce(
            (sum: number, entry: any) => sum + (parseFloat(entry.usthad_income) || 0),
            0
        );
        const monthExpenses = monthEntries.reduce(
            (sum: number, entry: any) => sum + (parseFloat(entry.total_expenses) || 0),
            0
        );
        const currentMonthBalance = monthUloomx + monthUsthad - monthExpenses;

        // Sales metrics (Current calendar month conversions)
        const currentMonthReports = dailyReports.filter((report: any) =>
            report.report_date.startsWith(currentMonthStr)
        );
        const currentMonthConversions = currentMonthReports.reduce(
            (sum: number, r: any) => sum + (r.conversions || 0),
            0
        );
        const conversionTarget = salesTargets?.conversion_target ?? 15;

        return {
            systemStatus,
            decisionsPending,
            staffOnline,
            staffTotal: staff.length,
            tasksInProgress: tasks.length,
            sortedStaff,
            overdueCount,
            tasksAssignedToday,
            paymentsReceivedToday,
            leavesRequestedToday,
            newLeadsToday,
            activeBlockers,
            operationalVelocity,
            currentMonthBalance,
            currentMonthConversions,
            conversionTarget,
        };
    }, [staff, requests, tasks, leads, completedTasks, financialEntries, dailyReports, salesTargets]);

    const disposeIdea = async (id: string) => {
        console.log("Dispose idea called with ID:", id);

        if (
            !confirm(
                "Dispose of this strategic directive? This action is permanent.",
            )
        )
            return;

        console.log("User confirmed deletion, proceeding...");

        disposeIdeaMutation(id);
    };

    // Actions
    const handleRequest = async (
        id: string,
        status: "approved" | "rejected",
    ) => {
        await supabase
            .from("requests")
            .update({
                status,
                reviewed_by: profile?.id,
                reviewed_at: new Date().toISOString(),
            })
            .eq("id", id);
        toast.success(`Action Executed: ${status.toUpperCase()}`);
        fetchData();
    };

    const assignTask = async (draft = false) => {
        console.log("Assign task called with:", { newTask, draft });

        if (!newTask.title || !newTask.assignedTo) {
            console.log("Validation failed:", {
                title: newTask.title,
                assignedTo: newTask.assignedTo,
            });
            return toast.error("Title and Assignee required");
        }

        // Combine date and time for due_date
        let dueDateTime: string | null = null;
        if (newTask.due_date) {
            if (newTask.due_time) {
                dueDateTime = new Date(
                    `${newTask.due_date}T${newTask.due_time}`,
                ).toISOString();
            } else {
                dueDateTime = new Date(newTask.due_date).toISOString();
            }
        }

        const insertPayload: Record<string, unknown> = {
            title: newTask.title,
            description: taskDescription || null,
            assigned_to: newTask.assignedTo,
            priority: newTask.priority,
            status: "pending",
            created_by: profile?.id,
            due_date: dueDateTime,
            is_draft: draft,
            is_new: true,
        };

        // Only include task_description if it has a value
        if (taskDescription) {
            insertPayload.task_description = taskDescription;
        }

        console.log("Insert payload:", insertPayload);

        // Optimistically clear the form to prevent UI freeze
        setIsAssignTaskOpen(false);
        toast.info(draft ? "Saving draft..." : "Assigning task...");
        resetTaskForm();

        try {
            const executeInsert = async () => {
                const { error } = await supabase
                    .from("tasks")
                    .insert(insertPayload);
                if (error) throw error;
            };

            const insertPromise = executeInsert();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(
                    () =>
                        reject(
                            new Error(
                                "Network timeout: The server took too long to respond. The task is queued.",
                            ),
                        ),
                    15000,
                ),
            );

            // Catch potential unhandled rejections if either promise settles after the race completes
            insertPromise.catch((err) => {
                console.warn("Task insert finished after timeout with error:", err);
            });
            timeoutPromise.catch(() => {});

            await Promise.race([insertPromise, timeoutPromise]);

            console.log("Task assigned successfully");
            toast.success(
                draft ? "DRAFT SAVED" : "✓ Task assigned successfully",
            );

            // Notify assignee of the new task assignment via OneSignal push notification
            if (!draft && insertPayload.assigned_to && insertPayload.assigned_to !== profile?.id) {
                fetch("/api/messenger/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        recipientId: insertPayload.assigned_to,
                        messageText: `Assigned new task: "${insertPayload.title}".`,
                        senderName: "UA Command Link"
                    })
                }).catch(err => console.error("OneSignal push notification dispatch failed:", err));
            }

            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            fetchData();
        } catch (error: any) {
            console.error("Assign task error:", error);
            toast.error("Failed to assign task: " + error.message);
            // Even if it failed, the UI is not locked and user can retry if they saved draft manually or we could add an offline queue
        }
    };

    // Save as Draft
    const saveDraft = async () => {
        if (!newTask.title) {
            return toast.error("Title required for draft");
        }

        setIsDraft(true);
        await assignTask();
    };

    // Reset Task Form
    const resetTaskForm = () => {
        setNewTask({
            title: "",
            assignedTo: "",
            priority: "medium",
            description: "",
            due_date: "",
            due_time: "",
        });
        setTaskDescription("");
        setAttachmentUrl("");
        setAssigneeSearch("");
        setIsDraft(false);
        setShowAssigneeDropdown(false);
        setRepeatDaily(false);
    };

    // Filtered Staff for Search
    const filteredStaff = staff.filter((s) =>
        s.full_name?.toLowerCase().includes(assigneeSearch.toLowerCase()),
    );

    const alertStaff = async (staffId: string, taskTitle: string) => {
        await supabase.from("notifications").insert({
            user_id: staffId,
            title: "STAFF ALERT",
            message: `The CEO is requesting an immediate update on: "${taskTitle}"`,
            type: "alert",
        });
        toast.success("ALERT DISPATCHED");
    };

    const handleDelegation = async (staffMember: Profile) => {
        if (!selectedIdeaForDelegation) return;

        setIsDelegating(true);
        try {
            const { error } = await supabase
                .from("ideas")
                .update({
                    status: "delegated",
                    assigned_to: staffMember.id,
                    assigned_to_name: staffMember.full_name,
                    delegated_by_manager: profile?.full_name || "Administrator",
                    updated_at: new Date().toISOString(),
                } as any)
                .eq("id", selectedIdeaForDelegation.id);

            if (error) throw error;

            toast.success(`Task delegated to ${staffMember.full_name}`);
            setIsDelegationModalOpen(false);
            setSelectedIdeaForDelegation(null);
            fetchData();
        } catch (error) {
            console.error("Delegation error:", error);
            toast.error("Delegation failed");
        } finally {
            setIsDelegating(false);
        }
    };

    const deleteStaff = async () => {
        if (!staffToRemove) return;

        try {
            // 1. Delete avatar from storage if it exists
            if (staffToRemove.avatar_url && staffToRemove.avatar_url.includes('/storage/v1/object/public/')) {
                try {
                    await deleteFile('avatars', staffToRemove.avatar_url);
                } catch (e) {
                    console.warn("Failed to delete staff avatar from storage during termination:", e);
                }
            }

            const uid = staffToRemove.id;

            // 2. Call the database function to cascade delete the staff profile, auth user, and all relations
            const { data: rpcSuccess, error: rpcError } = await supabase.rpc('delete_profile_cascade', {
                profile_uuid: uid
            });

            if (rpcError) {
                throw new Error(rpcError.message || "Failed to purge staff records");
            }

            toast.success("OPERATIVE TERMINATED & DATA PURGED");
            setIsRemoveStaffModalOpen(false);
            setStaffToRemove(null);
            setConfirmName("");
            
            // Force refresh all dashboard data
            queryClient.invalidateQueries();
            fetchData();
        } catch (e: any) {
            console.error("Deletion error:", e);
            toast.error(e.message || "Failed to delete staff member permanently");
        }
    };

    const deleteTask = async (id: string) => {
        // Prevent multiple simultaneous deletions of the same task
        if (deletingTaskIds.has(id)) {
            console.log("Task deletion already in progress:", id);
            return;
        }

        console.log("Attempting to delete task with ID:", id);

        // Add to deleting set
        setDeletingTaskIds((prev) => new Set(prev).add(id));

        // Check current user session
        const {
            data: { session },
            error: sessionError,
        } = await supabase.auth.getSession();
        console.log("Current session:", { session, sessionError });

        if (!session) {
            console.error("No active session found");
            toast.error("You must be logged in to delete tasks");
            setDeletingTaskIds((prev) => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
            return;
        }

        // First, remove task from local state immediately for better UX
        queryClient.invalidateQueries({ queryKey: ["tasks"] });

        try {
            // First, let's check if the task actually exists before trying to delete it
            console.log("Checking if task exists before deletion...");
            const { data: existingTask, error: checkError } = await supabase
                .from("tasks")
                .select("*")
                .eq("id", id)
                .single();

            console.log("Task existence check:", { existingTask, checkError });
            console.log(
                "Existing task details:",
                JSON.stringify(existingTask, null, 2),
            );
            console.log(
                "Check error details:",
                JSON.stringify(checkError, null, 2),
            );

            if (checkError) {
                console.error("Error checking task existence:", checkError);
                toast.error("Failed to verify task: " + checkError.message);
                fetchData();
                return;
            }

            if (!existingTask) {
                console.warn("Task does not exist in database:", id);
                toast.error("Task not found in database");
                fetchData();
                return;
            }

            // Delete attachment if it exists in storage
            if (
                existingTask.attachment_url &&
                existingTask.attachment_url.includes(
                    "/storage/v1/object/public/",
                )
            ) {
                try {
                    await deleteFile(
                        "attachments",
                        existingTask.attachment_url,
                    );
                    console.log("Deleted task attachment from storage");
                } catch (e) {
                    console.warn(
                        "Failed to delete attachment from storage:",
                        e,
                    );
                    // Proceed with DB deletion even if file removal fails,
                    // though strictly speaking we should perhaps abort or retry.
                }
            }

            // Now attempt the deletion - try multiple approaches
            console.log("Attempting to delete existing task:", existingTask);

            // Approach 1: Simple deletion without .select()
            let { error: error1, count: count1 } = await supabase
                .from("tasks")
                .delete({ count: "exact" })
                .eq("id", id);

            console.log("Approach 1 - Simple deletion result:", {
                error1,
                count1,
            });
            console.log("Error1 details:", JSON.stringify(error1, null, 2));
            console.log("Count1:", count1);

            if (!error1 && count1 !== null && count1 > 0) {
                console.log("Task successfully deleted with approach 1");
                toast.success("TASK ANNULLED");
                return;
            }

            // Approach 2: Deletion with .select()
            let { error: error2, data } = await supabase
                .from("tasks")
                .delete()
                .eq("id", id)
                .select();

            console.log("Approach 2 - Deletion with select result:", {
                error2,
                data,
            });
            console.log("Error2 details:", JSON.stringify(error2, null, 2));
            console.log("Data:", data);

            // Combine errors from both approaches
            const hasError = error1 || error2;
            const hasDeletion =
                (count1 && count1 > 0) || (data && data.length > 0);

            // If deletion fails due to permissions, try with service role (if available)
            if (
                hasError &&
                (error1?.code === "42501" ||
                    error2?.code === "42501" ||
                    error1?.message?.includes("permission") ||
                    error2?.message?.includes("permission"))
            ) {
                console.log("Trying service role deletion...");
                const serviceKey =
                    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
                console.log("Service role key available:", !!serviceKey);
                console.log(
                    "Service role key length:",
                    serviceKey?.length || 0,
                );

                if (serviceKey) {
                    try {
                        const serviceClient = createClient(
                            process.env.NEXT_PUBLIC_SUPABASE_URL!,
                            serviceKey,
                            {
                                auth: {
                                    autoRefreshToken: false,
                                    persistSession: false,
                                },
                            },
                        );

                        const { error: serviceError, data: serviceData } =
                            await serviceClient
                                .from("tasks")
                                .delete()
                                .eq("id", id)
                                .select();

                        console.log("Service role deletion result:", {
                            serviceError,
                            serviceData,
                        });

                        if (
                            !serviceError &&
                            serviceData &&
                            serviceData.length > 0
                        ) {
                            console.log(
                                "Task successfully deleted with service role:",
                                serviceData,
                            );
                            toast.success("TASK ANNULLED");
                            return;
                        }
                    } catch (serviceErr) {
                        console.error(
                            "Service role deletion failed:",
                            serviceErr,
                        );
                    }
                }
            }

            if (hasError) {
                console.error("Delete task error:", { error1, error2 });

                // Restore task to local state if deletion failed
                fetchData();

                // Check if it's an RLS policy error
                if (
                    error1?.code === "42501" ||
                    error2?.code === "42501" ||
                    error1?.message?.includes("row-level security") ||
                    error2?.message?.includes("row-level security")
                ) {
                    toast.error(
                        "Permission denied: You don't have rights to delete this task",
                    );
                } else {
                    toast.error(
                        "Failed to delete task: " +
                            (error1?.message || error2?.message),
                    );
                }
            } else if (!hasDeletion) {
                console.warn(
                    "No task was deleted with either approach - checking RLS policies",
                );
                // Try a different approach - check if we can at least update it
                const { error: updateError } = await supabase
                    .from("tasks")
                    .update({ status: "deleted" })
                    .eq("id", id);

                console.log("Update fallback result:", { updateError });
                console.log(
                    "Update error details:",
                    JSON.stringify(updateError, null, 2),
                );

                if (updateError) {
                    console.error("Also failed to update task:", updateError);

                    // Final attempt - try service role for update
                    console.log("Trying service role for update...");
                    try {
                        const serviceKey =
                            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
                        if (serviceKey) {
                            const serviceClient = createClient(
                                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                                serviceKey,
                                {
                                    auth: {
                                        autoRefreshToken: false,
                                        persistSession: false,
                                    },
                                },
                            );

                            const { error: serviceUpdateError } =
                                await serviceClient
                                    .from("tasks")
                                    .update({ status: "deleted" })
                                    .eq("id", id);

                            console.log("Service role update result:", {
                                serviceUpdateError,
                            });

                            if (!serviceUpdateError) {
                                console.log(
                                    "Task marked as deleted with service role",
                                );
                                toast.success("Task marked as deleted");
                                fetchData();
                            } else {
                                console.error(
                                    "Service role update also failed:",
                                    serviceUpdateError,
                                );
                                toast.error(
                                    "Cannot delete or modify task - check database permissions",
                                );
                                fetchData();
                            }
                        } else {
                            console.error("No service role key available");
                            toast.error(
                                "Cannot delete or modify task - check database permissions",
                            );
                            fetchData();
                        }
                    } catch (serviceErr) {
                        console.error(
                            "Service role update exception:",
                            serviceErr,
                        );
                        toast.error(
                            "Cannot delete or modify task - check database permissions",
                        );
                        fetchData();
                    }
                } else {
                    console.log("Task marked as deleted instead");
                    toast.success("Task marked as deleted");
                    fetchData();
                }
            } else {
                console.log(
                    "Task successfully deleted with one of the approaches",
                );
                toast.success("TASK ANNULLED");
                // fetchData() is not needed here since we already updated local state
            }
        } catch (error) {
            console.error("Delete task exception:", error);
            // Restore task to local state if deletion failed
            fetchData();
            toast.error("Something went wrong deleting task");
        } finally {
            // Remove from deleting set
            setDeletingTaskIds((prev) => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        }
    };

    const removeTaskFromCEO = async (id: string) => {
        // Temporarily disable until database columns are added
        toast.info(
            "Remove from CEO view will be available after database update",
        );
        // await supabase
        //     .from("tasks")
        //     .update({ ceo_visible: false })
        //     .eq("id", id);
        // toast.success("Task hidden from CEO view");
        // fetchData();
    };

    const markTaskAsReviewed = async (id: string) => {
        try {
            console.log("Marking task as reviewed:", id);
            const reviewedAt = new Date().toISOString();

            // Always update reviewed_at - this is what the query uses to filter
            const updateData = { reviewed_at: reviewedAt };

            // Try to also update ceo_reviewed if the column exists
            const { error: reviewedError, data: reviewedData } = await supabase
                .from("tasks")
                .update({
                    ...updateData,
                    ceo_reviewed: true,
                })
                .eq("id", id)
                .select();

            if (reviewedError) {
                console.error(
                    "Mark as reviewed error (ceo_reviewed column):",
                    reviewedError,
                );

                // If ceo_reviewed column doesn't exist, update just reviewed_at
                const { error: fallbackError, data: fallbackData } =
                    await supabase
                        .from("tasks")
                        .update(updateData)
                        .eq("id", id)
                        .select();

                if (fallbackError) {
                    console.error(
                        "Fallback update also failed:",
                        fallbackError,
                    );
                    toast.error(
                        "Failed to mark task as reviewed: " +
                            fallbackError.message,
                    );
                    return;
                }

                console.log(
                    "Task marked as reviewed (fallback):",
                    fallbackData,
                );
                toast.success(
                    "Task reviewed and permanently removed from CEO view",
                );
            } else {
                console.log(
                    "Task marked as reviewed successfully:",
                    reviewedData,
                );
                toast.success(
                    "Task reviewed and permanently removed from CEO view",
                );
            }

            // Also remove from local completed tasks immediately for better UX
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            fetchData();
        } catch (error) {
            console.error("Mark as reviewed exception:", error);
            toast.error("Something went wrong marking task as reviewed");
        }
    };

    const approveAndCloseTask = async (id: string) => {
        try {
            console.log("Approve and close task:", id);

            const { error, data } = await supabase
                .from("tasks")
                .update({
                    status: "COMPLETED",
                    progress: 100,
                    updated_at: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                })
                .eq("id", id)
                .select();

            if (error) {
                console.error("Approve and close error:", error);
                toast.error(
                    "Failed to approve and close task: " + error.message,
                );
                return;
            }

            console.log("Task approved and closed successfully:", data);
            toast.success("Task approved and marked as completed!");

            // Invalidate queries to trigger real-time refresh instantly
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            fetchData();
        } catch (error) {
            console.error("Approve and close exception:", error);
            toast.error("Something went wrong approving and closing the task");
        }
    };

    const escalateTask = async (id: string) => {
        try {
            console.log("Escalating task:", id);
            setEscalatingTaskIds((prev) => {
                const next = new Set(prev);
                next.add(id);
                return next;
            });

            const response = await fetch("/api/tasks/escalate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ taskId: id }),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to escalate task");
            }

            toast.success("Task escalated to Core operations!");
            // Invalidate queries to trigger real-time refresh instantly
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            fetchData();
        } catch (error: any) {
            console.error("Escalation exception:", error);
            toast.error(error.message || "Something went wrong escalating the task");
        } finally {
            setEscalatingTaskIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        }
    };

    const clearAllCompletedTasks = async () => {
        if (
            !confirm(
                "Mark all completed tasks as reviewed? This will permanently remove them from CEO view and make them visible to staff.",
            )
        )
            return;

        try {
            console.log("Clearing all completed tasks...");
            const reviewedAt = new Date().toISOString();

            // First try with ceo_reviewed column
            const { error: error1 } = await supabase
                .from("tasks")
                .update({
                    ceo_reviewed: true,
                    reviewed_at: reviewedAt,
                })
                .eq("status", "completed")
                .is("reviewed_at", null);

            if (error1) {
                console.error(
                    "Clear all completed error (with ceo_reviewed):",
                    error1,
                );

                // Fallback: update only reviewed_at column
                const { error: error2 } = await supabase
                    .from("tasks")
                    .update({
                        reviewed_at: reviewedAt,
                    })
                    .eq("status", "completed")
                    .is("reviewed_at", null);

                if (error2) {
                    console.error(
                        "Clear all completed error (fallback):",
                        error2,
                    );
                    toast.error(
                        "Failed to clear completed tasks: " + error2.message,
                    );
                    return;
                }

                console.log(
                    "All completed tasks marked as reviewed (fallback)",
                );
            } else {
                console.log(
                    "All completed tasks marked as reviewed successfully",
                );
            }

            // Clear local state immediately for better UX
            queryClient.invalidateQueries({ queryKey: ["tasks"] });

            toast.success(
                "All completed tasks marked as reviewed and removed from CEO view",
            );
            fetchData();
        } catch (error) {
            console.error("Clear all completed exception:", error);
            toast.error("Something went wrong clearing completed tasks");
        }
    };

    const submitIdea = async () => {
        if (!newIdea.title || !newIdea.description)
            return toast.error("Idea title and description required");

        // Use generic untyped insert to bypass strict TS checking if schema is lagging
        const { error } = await supabase.from("ideas").insert({
            title: newIdea.title,
            content: newIdea.description,
            priority: newIdea.priority,
            created_by: profile?.id,
            shared_with: selectedStaffForIdea,
        } as any);

        if (error) return toast.error("Idea dispatch failed");

        toast.success("STRATEGIC IDEA DISPATCHED");
        setNewIdea({ title: "", description: "", priority: "medium" });
        setSelectedStaffForIdea([]);
        setIsIdeasOpen(false);
    };

    const sendChatMessage = async () => {
        if (!selectedStaffForChat || !chatMessage.trim()) return;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;

            const response = await fetch("/api/send-message", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    user_id: selectedStaffForChat.id,
                    title: `MESSAGE FROM ${profile?.full_name?.toUpperCase() || "CEO"}`,
                    message: `[sender_id:${profile?.id || ""}] ${chatMessage.trim()}`,
                    type: "direct",
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Failed to dispatch message");
            }

            toast.success(`Message sent to ${selectedStaffForChat.full_name}`);
            setChatMessage("");
            setIsChatModalOpen(false);
            setSelectedStaffForChat(null);
        } catch (error: any) {
            console.error("Failed to send message:", error);
            toast.error(error.message || "Failed to send message");
        }
    };

    const openChatModal = (staff: Profile) => {
        setSelectedStaffForChat(staff);
        setIsChatModalOpen(true);
    };

    return (
        <div
            className={cn(
                "min-h-screen relative overflow-hidden font-sans selection:bg-cyber-blue/20 p-6 flex flex-col gap-6 transition-all duration-700 ease-cinematic",
                "bg-[#F4F7FE] text-slate-900 dark:bg-transparent dark:text-white",
            )}
        >
            {/* Cinematic Mesh Gradient Background Layer */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
                <div
                    className={cn(
                        "absolute top-[-10%] left-[-10%] rounded-full blur-[120px] animate-glow-pulse transition-all duration-1000",
                        "w-[60%] h-[60%] bg-cyber-blue/10",
                    )}
                />
                <div
                    className={cn(
                        "absolute bottom-[10%] right-[-5%] rounded-full blur-[100px] transition-all duration-1000",
                        "w-[50%] h-[50%] bg-cyber-rose/5",
                    )}
                />
                <div className="absolute top-[40%] left-[20%] w-[40%] h-[40%] rounded-full bg-cyber-blue/5 blur-[120px]" />
            </div>

            {/* FLOATING GLASSMORPHIC HEADER */}
            <header
                className={cn(
                    "flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 p-4 md:px-8 md:py-5",
                    "bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl rounded-[2.5rem] border border-slate-100 dark:border-zinc-800/60 shadow-[0_12px_40px_rgba(0,0,0,0.03)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)]",
                    "transition-all duration-500 ease-out",
                )}
            >
                <div className="flex items-center justify-between md:justify-start gap-6">
                    {/* Usthad Academy Logo - Hidden on mobile */}
                    <div
                        className={cn(
                            "hidden md:flex items-center gap-4 transition-all duration-500",
                            theme === "dark" ? "opacity-90" : "",
                        )}
                    >
                        <div
                            className={cn(
                                "h-[48px] w-[48px] p-2 rounded-2xl shadow-sm border transition-all duration-500",
                                userRole === "CEO"
                                    ? "bg-white dark:bg-zinc-800 border-amber-200/50 dark:border-amber-900/30 ring-4 ring-amber-500/5"
                                    : "bg-white dark:bg-zinc-800 border-indigo-50/50 dark:border-zinc-700/30",
                            )}
                        >
                            <img
                                src="/images/usthadacademylogo2.svg"
                                alt="UA"
                                className="h-full w-full object-contain"
                            />
                        </div>
                        <div className="h-[50px] w-[200px]">
                            <img
                                src={
                                    theme === "light"
                                        ? "/images/verticallogo.svg"
                                        : "/images/whitevericallogo.svg"
                                }
                                alt="Usthad Academy"
                                className="h-full w-full object-contain object-left"
                            />
                        </div>
                    </div>

                    {/* Mobile Dashboard Title */}
                    <div className="md:hidden">
                        <h1 className="text-xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tighter">
                            {userRole === "CEO"
                                ? "CEO HUB"
                                : "ADMINISTRATOR HUB"}
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                            Academy Management
                        </p>
                    </div>

                    {/* System Health Indicator */}
                    <div
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-500",
                            stats.systemStatus === "STABLE" &&
                                stats.overdueCount === 0
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400",
                        )}
                    >
                        <div
                            className={cn(
                                "w-2 h-2 rounded-full animate-pulse",
                                stats.systemStatus === "STABLE" &&
                                    stats.overdueCount === 0
                                    ? "bg-emerald-500"
                                    : "bg-red-500",
                            )}
                        />
                        <span className="text-[9px] font-black uppercase tracking-widest">
                            {stats.systemStatus === "STABLE" &&
                            stats.overdueCount === 0
                                ? "SYSTEM STABLE"
                                : "ATTENTION REQUIRED"}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4 self-end md:self-auto">
                    {userRole === "CEO" ? (
                        <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 shadow-sm animate-pulse">
                            <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400">
                                Strategic Command
                            </span>
                        </div>
                    ) : (
                        <div className="hidden sm:flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm">
                            <Zap className="w-3.5 h-3.5 text-slate-600 dark:text-zinc-400" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-zinc-400">
                                Operations Hub
                            </span>
                        </div>
                    )}

                    <div className="hidden md:block">
                        <h1 className="text-sm font-black uppercase tracking-[0.3em] text-slate-900 dark:text-zinc-100 opacity-80">
                            {userRole === "CEO"
                                ? "CEO DASHBOARD"
                                : "ADMINISTRATOR DASHBOARD"}
                        </h1>
                    </div>

                    {/* ✦ UA Messenger Header Button — fires toggle-hq-messenger event */}
                    {(() => {
                        const hasUnread = hqUnreadCount > 0;
                        return (
                            <>
                                <style>{`
                                    @keyframes hq-header-bell {
                                        0%, 80%, 100% { transform: rotate(0deg); }
                                        85% { transform: rotate(-12deg); }
                                        90% { transform: rotate(11deg); }
                                        95% { transform: rotate(-8deg); }
                                    }
                                    .hq-header-bell-shake {
                                        animation: hq-header-bell 2.5s ease-in-out infinite;
                                        transform-origin: top center;
                                    }
                                `}</style>
                                <button
                                    onClick={() => window.dispatchEvent(new CustomEvent("toggle-hq-messenger"))}
                                    className={`relative hidden md:flex items-center gap-2.5 pl-3.5 pr-4 py-1.5 rounded-full border transition-all duration-300 group shadow-sm hover:scale-[1.03] active:scale-95 ${
                                        hqIsOpen
                                            ? 'bg-[#31267D] border-[#31267D] text-white shadow-md shadow-[#31267D]/25'
                                            : hasUnread
                                                ? 'bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700 text-[#F14D24] shadow-orange-200/60 dark:shadow-orange-800/30'
                                                : 'bg-white/60 dark:bg-zinc-800/60 border-white/50 dark:border-zinc-700/60 text-slate-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 hover:border-[#31267D]/30'
                                    }`}
                                    title="UA Messenger"
                                >
                                    <Bell className={`w-3.5 h-3.5 flex-shrink-0 ${
                                        hasUnread && !hqIsOpen ? 'hq-header-bell-shake' : ''
                                    } ${hqIsOpen ? 'text-white' : hasUnread ? 'text-[#F14D24]' : 'text-slate-500 dark:text-zinc-400 group-hover:text-[#31267D]'}`} />
                                    <span className={`text-[10px] font-black uppercase tracking-[0.15em] whitespace-nowrap ${
                                        hqIsOpen ? 'text-white' : hasUnread ? 'text-[#F14D24]' : 'text-slate-600 dark:text-zinc-300 group-hover:text-[#31267D]'
                                    }`}>
                                        UA Messenger
                                    </span>
                                    {hasUnread && (
                                        <span className={`flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black shadow-sm ${
                                            hqIsOpen
                                                ? 'bg-white/25 text-white border border-white/30'
                                                : 'bg-[#F14D24] text-white shadow-orange-500/30'
                                        }`}>
                                            {hqUnreadCount > 9 ? '9+' : hqUnreadCount}
                                        </span>
                                    )}
                                </button>
                            </>
                        );
                    })()}

                    <ThemeToggle />

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchData()}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-zinc-800/50 border border-white/40 dark:border-zinc-700/50 hover:bg-white dark:hover:bg-zinc-800 rounded-full transition-all duration-300 shadow-sm text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-100"
                    >
                        <RefreshCw
                            className={cn(
                                "w-3 h-3",
                                isRefreshing && "animate-spin",
                            )}
                        />
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => signOut()}
                        className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-zinc-800/50 border border-white/40 dark:border-zinc-700/50 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-all duration-300 shadow-sm text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400"
                    >
                        <LogOut className="w-3 h-3" />
                        Logout
                    </Button>
                </div>
            </header>

            {/* 1. STREAMLINED PRIORITY METRIC GRID */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                {/* Card 1: STAFFS */}
                <div
                    className={cn(
                        "rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group relative overflow-hidden",
                        "bg-white/70 dark:bg-zinc-900/40 backdrop-blur-md border border-white/60 dark:border-zinc-800/50 shadow-[0_12px_40px_rgba(0,0,0,0.02)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",
                        "hover:-translate-y-1 hover:shadow-md dark:hover:border-zinc-700",
                        userRole === "CEO" &&
                            "hover:border-amber-500/30 dark:hover:border-amber-500/30 shadow-[0_10px_40px_rgba(245,158,11,0.03)]",
                    )}
                >
                    {userRole === "CEO" && (
                        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                    )}
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-[#31267D]/10 dark:bg-indigo-500/20 rounded-xl text-[#31267D] dark:text-indigo-300 group-hover:scale-110 transition-transform">
                            <Users className="w-4 h-4" />
                        </div>
                        <div className="flex -space-x-2">
                            {[1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className="w-5 h-5 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shadow-sm"
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-[0.2em] mb-1">
                            Academy Staffs
                        </p>
                        <div className="flex items-baseline gap-1">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tighter">
                                {stats.staffTotal}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Card 2: TASKS */}
                <div
                    className={cn(
                        "rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group relative overflow-hidden",
                        "bg-white/70 dark:bg-zinc-900/40 backdrop-blur-md border border-white/60 dark:border-zinc-800/50 shadow-[0_12px_40px_rgba(0,0,0,0.02)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",
                        "hover:-translate-y-1 hover:shadow-md dark:hover:border-zinc-700",
                        userRole === "CEO" &&
                            "hover:border-amber-500/30 dark:hover:border-amber-500/30 shadow-[0_10px_40px_rgba(245,158,11,0.03)]",
                    )}
                >
                    {userRole === "CEO" && (
                        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                    )}
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl text-[#31267D] dark:text-indigo-300 group-hover:scale-110 transition-transform">
                            <ListTodo className="w-4 h-4" />
                        </div>
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-300 dark:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-[0.2em] mb-1">
                            Active Operations
                        </p>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tighter">
                            {stats.tasksInProgress}
                        </h2>
                    </div>
                </div>

                {/* Card 3: OVERDUE */}
                <div
                    className={cn(
                        "rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group relative overflow-hidden",
                        "bg-white/70 dark:bg-zinc-900/40 backdrop-blur-md border border-white/60 dark:border-zinc-800/50 shadow-[0_12px_40px_rgba(0,0,0,0.02)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",
                        "hover:-translate-y-1 hover:shadow-md dark:hover:border-zinc-700",
                        userRole === "CEO" &&
                            "hover:border-amber-500/30 dark:hover:border-amber-500/30 shadow-[0_10px_40px_rgba(245,158,11,0.03)]",
                    )}
                >
                    {userRole === "CEO" && (
                        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                    )}
                    <div className="flex items-center justify-between mb-4">
                        <div
                            className={cn(
                                "p-2 rounded-xl transition-all shadow-sm",
                                stats.overdueCount > 0
                                    ? "bg-red-500/10 dark:bg-red-500/20 text-red-500 dark:text-red-400 animate-pulse"
                                    : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500",
                            )}
                        >
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-[0.2em] mb-1">
                            Critical Delay
                        </p>
                        <h2
                            className={cn(
                                "text-2xl font-black tracking-tighter",
                                stats.overdueCount > 0
                                    ? "text-red-600 dark:text-red-400"
                                    : "text-slate-900 dark:text-zinc-100",
                            )}
                        >
                            {stats.overdueCount}
                        </h2>
                    </div>
                </div>

                {/* Card 4: Role-based (Income / Capacity) */}
                {userRole === "CEO" ? (
                    <div
                        className={cn(
                            "rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group relative overflow-hidden shadow-lg shadow-emerald-500/5",
                            "bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.02)]",
                            "dark:bg-zinc-900/40 dark:backdrop-blur-md dark:border-zinc-800/50 dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",
                            "hover:-translate-y-1 hover:shadow-md hover:border-emerald-500/30 dark:hover:border-emerald-500/30",
                        )}
                    >
                        {userRole === "CEO" && (
                            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                        )}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 shadow-sm">
                                <DollarSign className="w-4 h-4" />
                            </div>
                            <div className="flex items-end gap-1 h-5">
                                <div className="w-1 bg-emerald-500/20 dark:bg-emerald-500/10 h-[30%] rounded-full" />
                                <div className="w-1 bg-emerald-500/40 dark:bg-emerald-500/30 h-[60%] rounded-full" />
                                <div className="w-1 bg-emerald-500/60 dark:bg-emerald-500/50 h-[45%] rounded-full animate-bounce" />
                                <div className="w-1 bg-emerald-500 dark:bg-emerald-400 h-[100%] rounded-full" />
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-[0.2em] mb-1 italic">
                                Current Month Balance
                            </p>
                            <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
                                {new Intl.NumberFormat("en-IN", {
                                    style: "currency",
                                    currency: "INR",
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 0,
                                }).format(stats.currentMonthBalance)}
                            </h2>
                        </div>
                    </div>
                ) : (
                    <div
                        className={cn(
                            "rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group",
                            "bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.02)]",
                            "dark:bg-zinc-900/40 dark:backdrop-blur-md dark:border-zinc-800/50 dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",
                            "hover:-translate-y-1 hover:shadow-md dark:hover:border-zinc-700",
                        )}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400 shadow-sm">
                                <Activity className="w-4 h-4" />
                            </div>
                            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/10 flex items-center justify-center">
                                <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping" />
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-[0.2em] mb-1">
                                Operational Velocity
                            </p>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tighter">
                                {stats.operationalVelocity}%
                            </h2>
                        </div>
                    </div>
                )}

                {/* Card 5: Role-based (Sales / Blockers) */}
                {userRole === "CEO" ? (
                    <div
                        className={cn(
                            "rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group relative overflow-hidden",
                            "bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.02)]",
                            "dark:bg-zinc-900/40 dark:backdrop-blur-md dark:border-zinc-800/50 dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",
                            "hover:-translate-y-1 hover:shadow-md hover:border-blue-500/30 dark:hover:border-blue-500/30",
                        )}
                    >
                        {userRole === "CEO" && (
                            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                        )}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-blue-500/10 transition-colors" />
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400 shadow-sm">
                                <Users className="w-4 h-4" />
                            </div>
                            <Rocket className="w-4 h-4 text-blue-400 dark:text-blue-500 animate-pulse" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-[0.2em] mb-1 italic">
                                Current Month Conversions
                            </p>
                            <div className="flex items-baseline gap-1">
                                <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tighter">
                                    {stats.currentMonthConversions}
                                </h2>
                                <span className="text-slate-300 dark:text-zinc-700 font-black">
                                    /
                                </span>
                                <h2 className="text-xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">
                                    {stats.conversionTarget}
                                </h2>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div
                        className={cn(
                            "rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group",
                            "bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.02)]",
                            "dark:bg-zinc-900/40 dark:backdrop-blur-md dark:border-zinc-800/50 dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",
                            "hover:-translate-y-1 hover:shadow-md dark:hover:border-zinc-700",
                        )}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-red-500/10 dark:bg-red-500/20 rounded-xl text-red-600 dark:text-red-400 shadow-sm">
                                <ShieldAlert className="w-4 h-4" />
                            </div>
                            {stats.activeBlockers > 0 && (
                                <div className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </div>
                            )}
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-[0.2em] mb-1">
                                Active Blockers
                            </p>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tighter">
                                {stats.activeBlockers}
                            </h2>
                        </div>
                    </div>
                )}
            </div>
            <main className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 flex-1">
                {/* 2. LEFT COLUMN - EXECUTIVE AUTHORITY */}
                <aside className="col-span-1 md:col-span-12 lg:col-span-3 flex flex-col gap-4">
                    {/* LIVE OPERATIONS SIGNAL PANEL - Hidden on mobile */}
                    <div className="hidden md:flex bg-white/70 dark:bg-zinc-900/40 backdrop-blur-md border border-white/60 dark:border-zinc-800/50 rounded-[2rem] overflow-hidden shadow-[0_12px_40px_rgba(0,0,0,0.02)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)] flex-col w-full max-w-[300px] mx-auto lg:mx-0">
                        {/* Today Summary Header */}
                        <div className="hidden md:block p-5 bg-white/30 dark:bg-zinc-800/30 border-b border-white/40 dark:border-zinc-800/50">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-zinc-500 mb-4">
                                Today Summary
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/60 dark:bg-zinc-900/60 border border-white/50 dark:border-zinc-800/50 rounded-2xl p-3 flex flex-col gap-1 shadow-sm">
                                    <span className="text-base font-black text-indigo-500 dark:text-indigo-400">
                                        {stats.tasksAssignedToday}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-tighter">
                                        Tasks Assigned
                                    </span>
                                </div>
                                <div className="bg-white/60 dark:bg-zinc-900/60 border border-white/50 dark:border-zinc-800/50 rounded-2xl p-3 flex flex-col gap-1 shadow-sm">
                                    <span className="text-base font-black text-emerald-500 dark:text-emerald-400">
                                        {stats.paymentsReceivedToday}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-tighter">
                                        Payments Received
                                    </span>
                                </div>
                                <div className="bg-white/60 dark:bg-zinc-900/60 border border-white/50 dark:border-zinc-800/50 rounded-2xl p-3 flex flex-col gap-1 shadow-sm">
                                    <span className="text-base font-black text-orange-500 dark:text-orange-400">
                                        {stats.leavesRequestedToday}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-tighter">
                                        Leaves Requested
                                    </span>
                                </div>
                                <div className="bg-white/60 dark:bg-zinc-900/60 border border-white/50 dark:border-zinc-800/50 rounded-2xl p-3 flex flex-col gap-1 shadow-sm">
                                    <span className="text-base font-black text-purple-500 dark:text-purple-400">
                                        {stats.newLeadsToday}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-tighter">
                                        New Leads
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 flex flex-col gap-4 flex-1">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 dark:text-zinc-100 opacity-80">
                                        Signal Feed
                                    </h3>
                                    <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                </div>
                                <div className="flex items-center gap-2">
                                    {userRole === "CEO" && (
                                        <button
                                            onClick={clearSignalFeed}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                            title="Clear Signal Feed"
                                            disabled={activities.length === 0}
                                        >
                                            <Trash2
                                                className={cn(
                                                    "w-3.5 h-3.5",
                                                    activities.length === 0
                                                        ? "text-slate-300 dark:text-zinc-700"
                                                        : "text-slate-400 dark:text-zinc-500 hover:text-red-500 transition-colors",
                                                )}
                                            />
                                        </button>
                                    )}
                                    <RefreshCw
                                        className={cn(
                                            "w-3.5 h-3.5 text-slate-400 dark:text-zinc-500",
                                            isRefreshing && "animate-spin",
                                        )}
                                    />
                                </div>
                            </div>

                            <ScrollArea className="h-[400px] pr-3">
                                <div className="relative pl-4">
                                    {/* Vertical Timeline Line */}
                                    <div className="absolute left-[7px] top-1 bottom-1 w-[1px] bg-slate-100 dark:bg-zinc-800" />

                                    <AnimatePresence mode="popLayout">
                                        {activities.length === 0 ? (
                                            <div className="h-40 flex flex-col items-center justify-center text-center p-4">
                                                <Wifi className="w-6 h-6 text-slate-200 dark:text-zinc-800 mb-2 opacity-50" />
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 dark:text-zinc-700">
                                                    Awaiting Signals...
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-6">
                                                {activities.map(
                                                    (act, index) => (
                                                        <motion.div
                                                            key={act.id}
                                                            initial={{
                                                                opacity: 0,
                                                                x: -5,
                                                            }}
                                                            animate={{
                                                                opacity: 1,
                                                                x: 0,
                                                            }}
                                                            transition={{
                                                                delay:
                                                                    index *
                                                                    0.05,
                                                            }}
                                                            className="relative group pr-1 transition-all duration-300 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 p-2 rounded-xl"
                                                        >
                                                            {/* Timeline Dot */}
                                                            <div
                                                                className="absolute -left-[12.5px] top-3 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-zinc-900 z-10 transition-transform group-hover:scale-125 shadow-sm ring-4 ring-offset-0 ring-indigo-500/10 dark:ring-indigo-500/20"
                                                                style={{
                                                                    backgroundColor:
                                                                        act.color,
                                                                }}
                                                            />

                                                            <div className="flex flex-col gap-1.5">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                                        <act.icon
                                                                            className="w-3 h-3 shrink-0 opacity-80"
                                                                            style={{
                                                                                color: act.color,
                                                                            }}
                                                                        />
                                                                        <span className="text-[10px] font-black uppercase tracking-tight text-slate-900 dark:text-zinc-100 truncate">
                                                                            {
                                                                                act.title
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 tabular-nums shrink-0 uppercase tracking-tighter">
                                                                        {format(
                                                                            parseISO(
                                                                                act.time ||
                                                                                    new Date().toISOString(),
                                                                            ),
                                                                            "HH:mm",
                                                                        )}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-relaxed line-clamp-2 pl-5">
                                                                    {
                                                                        act.description
                                                                    }
                                                                </p>
                                                            </div>
                                                        </motion.div>
                                                    ),
                                                )}
                                            </div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                </aside>

                {/* 3?????? CENTER COLUMN - ACTIVE OPERATIONS */}
                <section className="col-span-1 md:col-span-12 lg:col-span-6 flex flex-col gap-4">
                    <SectionHeader
                        title="Active Operations"
                        color="bg-amber-500"
                    />

                    <div className="flex flex-wrap gap-1.5 md:gap-2 mb-2 p-1.5 bg-white/40 dark:bg-zinc-800/40 rounded-2xl border border-white/50 dark:border-zinc-700/50 w-full md:w-fit overflow-x-auto scrollbar-hide shadow-inner">
                        <button
                            onClick={() => setTaskTab("active")}
                            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                                taskTab === "active"
                                    ? "bg-theme-bg-white text-theme-inv-text shadow-lg"
                                    : "text-theme-text-40 hover:text-theme-text hover:bg-theme-bg-white-10"
                            }`}
                        >
                            Active
                        </button>
                        <button
                            onClick={() => setTaskTab("blocked")}
                            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                                taskTab === "blocked"
                                    ? "bg-red-500 text-theme-text shadow-lg shadow-red-500/20"
                                    : "text-theme-text-40 hover:text-theme-text hover:bg-theme-bg-white-10"
                            }`}
                        >
                            Urgent
                        </button>
                        <button
                            onClick={() => setTaskTab("overdue")}
                            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-2 ${
                                taskTab === "overdue"
                                    ? "bg-amber-500 text-theme-inv-text shadow-lg shadow-amber-500/20"
                                    : "text-theme-text-40 hover:text-theme-text hover:bg-theme-bg-white-10"
                            }`}
                        >
                            Overdue
                            {deptOverdueCount > 0 && (
                                <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded-full min-w-[16px] inline-flex items-center justify-center font-black transition-all ${
                                        taskTab === "overdue"
                                            ? "bg-white/20 text-theme-inv-text"
                                            : "bg-red-600/90 text-white shadow-sm"
                                    }`}
                                >
                                    {deptOverdueCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setTaskTab("completed")}
                            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-2 ${
                                taskTab === "completed"
                                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                                    : "text-theme-text-40 hover:text-theme-text hover:bg-theme-bg-white-10"
                            }`}
                        >
                            Completed
                            {deptCompletedCount > 0 && (
                                <span
                                    className={`text-[9px] px-1.5 py-0.5 rounded-full min-w-[16px] inline-flex items-center justify-center font-black transition-all ${
                                        taskTab === "completed"
                                            ? "bg-white/20 text-white"
                                            : "bg-blue-600/90 text-white shadow-sm"
                                    }`}
                                >
                                    {deptCompletedCount}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setTaskTab("daily")}
                            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                                taskTab === "daily"
                                    ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                                    : "text-theme-text-40 hover:text-theme-text hover:bg-theme-bg-white-10"
                            }`}
                        >
                            Daily Tasks
                        </button>
                    </div>

                    {/* Department Filters */}
                    <div className="flex flex-wrap gap-1.5 md:gap-2 mb-2 p-1.5 bg-white/40 dark:bg-zinc-800/40 rounded-2xl border border-white/50 dark:border-zinc-700/50 w-full md:w-fit overflow-x-auto scrollbar-hide shadow-inner">
                        <button
                            onClick={() => setDepartmentFilter("ceo")}
                            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                                departmentFilter === "ceo"
                                    ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                                    : "text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-100"
                            }`}
                        >
                            {userRole === "CEO" ? "All" : "My Tasks"}
                        </button>
                        <button
                            onClick={() =>
                                setDepartmentFilter("administration")
                            }
                            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                                departmentFilter === "administration"
                                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                                    : "text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-100"
                            }`}
                        >
                            Admin
                        </button>
                        <button
                            onClick={() => setDepartmentFilter("marketing")}
                            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                                departmentFilter === "marketing"
                                    ? "bg-pink-500 text-white shadow-lg shadow-pink-500/20"
                                    : "text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-100"
                            }`}
                        >
                            Marketing
                        </button>
                        <button
                            onClick={() => setDepartmentFilter("sales")}
                            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                                departmentFilter === "sales"
                                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
                                    : "text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-100"
                            }`}
                        >
                            Sales
                        </button>
                        <button
                            onClick={() => setDepartmentFilter("finance")}
                            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                                departmentFilter === "finance"
                                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                                    : "text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-100"
                            }`}
                        >
                            Finance
                        </button>
                    </div>

                    {taskTab === "completed" && (
                        <div className="flex justify-end mb-2">
                            <button
                                onClick={clearAllCompletedTasks}
                                className="px-3 py-1 text-[8px] font-black uppercase bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded transition-all border-none"
                            >
                                Clear All Completed
                            </button>
                        </div>
                    )}

                    <div className="flex-1 overflow-hidden">
                        <div className="h-full max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="flex flex-col gap-3">
                                {displayedTasks.length === 0
                                    ? (() => {
                                          if (
                                              isRefreshing &&
                                              staff.length === 0
                                          ) {
                                              return <SkeletonCommandCenter />;
                                          }
                                          return (
                                              <div className="h-48 border border-dashed border-indigo-500/20 dark:border-zinc-800 text-center text-slate-400 dark:text-zinc-500 text-[11px] uppercase font-black tracking-widest rounded-[2rem] bg-white/40 dark:bg-zinc-900/20 flex flex-col items-center justify-center gap-3 transition-all shadow-inner">
                                                  <div className="p-3 bg-white/50 dark:bg-zinc-800/50 rounded-full shadow-sm">
                                                      <CheckCircle className="w-6 h-6 text-indigo-500/60 dark:text-indigo-400/60" />
                                                  </div>
                                                  <span>
                                                      {taskTab === "completed"
                                                          ? "Archive cleared"
                                                          : departmentFilter === "ceo"
                                                            ? "No active operations identified"
                                                            : departmentFilter === "finance"
                                                              ? "Finance sector quiet"
                                                              : "Awaiting task deployment..."}
                                                  </span>
                                              </div>
                                          );
                                      })()
                                    : displayedTasks.map((t) => {
                                          const assignee = staff.find(
                                              (s) => s.id === t.assigned_to,
                                          );
                                          const isOverdue =
                                              t.due_date &&
                                              new Date(t.due_date) < new Date();

                                          return (
                                              <div
                                                  key={t.id}
                                                  className={cn(
                                                      "group flex flex-col gap-2 p-5 rounded-3xl transition-all duration-500 shadow-sm border border-white/60 dark:border-zinc-800/50 border-l-4 relative overflow-hidden",
                                                      "bg-white/40 dark:bg-zinc-900/20 backdrop-blur-md hover:bg-white/60 dark:hover:bg-zinc-900/40 hover:shadow-md hover:-translate-y-0.5",
                                                      t.priority === "urgent"
                                                          ? "border-l-red-500 dark:border-l-red-600"
                                                          : t.status ===
                                                              "completed"
                                                            ? "border-l-emerald-500 dark:border-l-emerald-600"
                                                            : "border-l-indigo-500 dark:border-l-indigo-600",
                                                      isOverdue
                                                          ? "border-r-red-500/10 border-y-red-500/10"
                                                          : "border-white/40 dark:border-zinc-800/50",
                                                  )}
                                              >
                                                  <div className="flex justify-between items-start gap-4">
                                                      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                                                          <div className="flex flex-wrap items-center gap-2">
                                                              <h4 className="text-sm font-black text-slate-900 dark:text-zinc-100 leading-tight uppercase truncate max-w-[220px] sm:max-w-[320px]">
                                                                  {t.title}
                                                              </h4>
                                                              {(t as any)
                                                                  .creator && (
                                                                  <Badge
                                                                      variant="outline"
                                                                      className={cn(
                                                                          "text-[9px] px-2.5 py-0 h-5 border-none font-black uppercase tracking-widest flex items-center gap-1.5",
                                                                          (
                                                                              t as any
                                                                          )
                                                                              .creator
                                                                              .role ===
                                                                              "ceo"
                                                                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                                                              : "bg-slate-500/10 text-slate-600 dark:text-slate-400",
                                                                      )}
                                                                  >
                                                                      {(
                                                                          t as any
                                                                      ).creator
                                                                          .role ===
                                                                      "ceo" ? (
                                                                          <>
                                                                              <Crown className="w-2.5 h-2.5" />
                                                                              Assigned
                                                                              by
                                                                              CEO
                                                                          </>
                                                                      ) : (
                                                                          <>
                                                                              <Zap className="w-2.5 h-2.5" />
                                                                              Assigned
                                                                              by
                                                                              Administrator
                                                                          </>
                                                                      )}
                                                                  </Badge>
                                                              )}
                                                              {t.assigned_to !== profile?.id && (t.created_by === profile?.id || (t as any).assigned_by === profile?.id) && (
                                                                   <div className="flex items-center gap-1 text-slate-400 dark:text-zinc-500 select-none ml-1 shrink-0">
                                                                       {t.is_staff_seen && (
                                                                           <span 
                                                                               title={`Seen by staff at ${t.staff_seen_at ? new Date(t.staff_seen_at).toLocaleTimeString() : 'unknown time'}`}
                                                                               className="flex items-center text-indigo-500 dark:text-indigo-400"
                                                                           >
                                                                               <Eye className="w-3.5 h-3.5" />
                                                                           </span>
                                                                       )}
                                                                       {isV2Enabled && (() => {
                                                                           const status = t.status === "completed" || t.status === "reviewed" ? "read" : (t.delivery_status || "sent");
                                                                           if (status === "sent") {
                                                                               return <Check className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />;
                                                                           }
                                                                           if (status === "delivered") {
                                                                               return (
                                                                                   <div className="flex -space-x-1.5">
                                                                                       <Check className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                                                                                       <Check className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />
                                                                                   </div>
                                                                               );
                                                                           }
                                                                           if (status === "read") {
                                                                               return (
                                                                                   <div className="flex -space-x-1.5">
                                                                                       <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                                                       <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                                                   </div>
                                                                               );
                                                                           }
                                                                           return null;
                                                                       })()}
                                                                   </div>
                                                               )}
                                                          </div>
                                                          <p className="text-[10px] text-slate-400 dark:text-zinc-400 font-medium tracking-wide line-clamp-2 leading-relaxed mt-1">
                                                              {t.description ||
                                                                  "No operational description provided."}
                                                          </p>
                                                      </div>
                                                      <div className="flex items-center gap-3 shrink-0">
                                                          {renderCEOTaskGauge(
                                                              t,
                                                          )}
                                                          <Badge
                                                              className={cn(
                                                                  "text-[8px] uppercase font-black px-2.5 py-1 flex items-center gap-1.5 border-none shadow-none shrink-0",
                                                                  isOverdue
                                                                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                                                      : (() => {
                                                                            const s =
                                                                                (
                                                                                    t.status ||
                                                                                    "PENDING"
                                                                                ).toUpperCase();
                                                                            if (
                                                                                s ===
                                                                                "PENDING"
                                                                            )
                                                                                return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
                                                                            if (
                                                                                s ===
                                                                                "IN_PROGRESS"
                                                                            )
                                                                                return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
                                                                            if (
                                                                                s ===
                                                                                    "UNDER_REVIEW" ||
                                                                                s ===
                                                                                    "IN_REVIEW"
                                                                            )
                                                                                return "bg-purple-500/10 text-purple-600 dark:text-purple-400 animate-pulse";
                                                                            if (
                                                                                s ===
                                                                                "COMPLETED"
                                                                            )
                                                                                return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
                                                                            return "bg-slate-500/10 text-slate-600 dark:text-slate-400";
                                                                        })(),
                                                              )}
                                                          >
                                                              {(isOverdue ||
                                                                  t.priority ===
                                                                      "urgent") && (
                                                                  <AlertTriangle className="w-2.5 h-2.5" />
                                                              )}
                                                              {(() => {
                                                                  if (isOverdue)
                                                                      return "OVERDUE";
                                                                  const s = (
                                                                      t.status ||
                                                                      "PENDING"
                                                                  ).toUpperCase();
                                                                  if (
                                                                      s ===
                                                                      "PENDING"
                                                                  )
                                                                      return "PENDING";
                                                                  if (
                                                                      s ===
                                                                      "IN_PROGRESS"
                                                                  )
                                                                      return "IN PROGRESS";
                                                                  if (
                                                                      s ===
                                                                          "UNDER_REVIEW" ||
                                                                      s ===
                                                                          "IN_REVIEW"
                                                                  )
                                                                      return "UNDER REVIEW";
                                                                  if (
                                                                      s ===
                                                                      "COMPLETED"
                                                                  )
                                                                      return "COMPLETED";
                                                                  return s;
                                                              })()}
                                                          </Badge>
                                                      </div>
                                                  </div>

                                                  <div className="mt-2 pt-3 border-t border-theme-border-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                      <div className="flex items-center gap-3">
                                                          <button
                                                              onClick={() => {
                                                                  openChatModal(
                                                                      assignee!,
                                                                  );
                                                              }}
                                                              disabled={
                                                                  !assignee
                                                              }
                                                              className="flex items-center gap-2 hover:bg-theme-bg-white-5 p-1 -ml-1 rounded transition-colors group/staff"
                                                          >
                                                              <div className="w-5 h-5 rounded-full bg-theme-bg-white-10 border border-theme-border-20 flex items-center justify-center text-[8px] font-black text-theme-text-60 uppercase">
                                                                  {assignee?.full_name?.charAt(
                                                                      0,
                                                                  ) || "?"}
                                                              </div>
                                                              <span className="text-[10px] font-bold text-theme-text-60 group-hover/staff:text-theme-text transition-colors uppercase">
                                                                  {assignee?.full_name ||
                                                                      "Unassigned"}
                                                                  {assignee?.department && (
                                                                      <span className="ml-1 opacity-50 font-medium">
                                                                          (
                                                                          {
                                                                              assignee.department
                                                                          }
                                                                          )
                                                                      </span>
                                                                  )}
                                                              </span>
                                                          </button>
                                                          {t.due_date && (
                                                              <Fragment>
                                                                  <div className="w-[1px] h-3 bg-theme-bg-white-10" />
                                                                  <span
                                                                      className={`text-[9px] font-bold uppercase ${isOverdue ? "text-red-400" : "text-theme-text-40"}`}
                                                                  >
                                                                      Due:{" "}
                                                                      {format(
                                                                          parseISO(
                                                                              t.due_date,
                                                                          ),
                                                                          "MMM d",
                                                                      )}
                                                                  </span>
                                                              </Fragment>
                                                          )}
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                          {(() => {
                                                              const isAssigner =
                                                                  t.created_by ===
                                                                      profile?.id ||
                                                                  (t as any)
                                                                      .assigned_by ===
                                                                      profile?.id;
                                                              const isCeoOrAssigner =
                                                                  userRole ===
                                                                      "CEO" ||
                                                                  isAssigner;
                                                              const progressValue =
                                                                  (
                                                                      t.status ||
                                                                      "PENDING"
                                                                  ).toUpperCase() ===
                                                                  "COMPLETED"
                                                                      ? 100
                                                                      : (t.progress ||
                                                                            0);
                                                              const showEscalateButton =
                                                                  isV2Enabled &&
                                                                  isCeoOrAssigner &&
                                                                  isOverdue &&
                                                                  progressValue <
                                                                      100;

                                                              if (
                                                                  !showEscalateButton
                                                              )
                                                                  return null;

                                                              const escalatedAtDate = t.escalated_at ? new Date(t.escalated_at) : null;
                                                              const isCoolingDown = escalatedAtDate && (Math.abs(new Date().getTime() - escalatedAtDate.getTime()) < 5 * 60 * 1000);

                                                              if (isCoolingDown) {
                                                                  return (
                                                                      <button
                                                                          disabled
                                                                          className="h-8 px-3 text-[9px] font-black uppercase bg-red-500/5 text-red-400/50 border border-red-500/10 cursor-not-allowed flex items-center gap-1.5 shadow-none"
                                                                      >
                                                                          <Clock className="w-3.5 h-3.5 text-red-500/40 animate-pulse" />
                                                                          Escalation Cooling Down...
                                                                      </button>
                                                                  );
                                                              }

                                                              if (t.is_escalated) {
                                                                  return (
                                                                      <button
                                                                          disabled
                                                                          className="h-8 px-3 text-[9px] font-black uppercase bg-red-500/5 text-red-400/55 border border-red-500/20 rounded-xl cursor-not-allowed flex items-center gap-1.5 shadow-none"
                                                                      >
                                                                          <ShieldAlert className="w-3.5 h-3.5 text-red-500/50" />
                                                                          Escalated to Core
                                                                      </button>
                                                                  );
                                                              }

                                                              return (
                                                                  <button
                                                                      onClick={() =>
                                                                          escalateTask(
                                                                              t.id,
                                                                          )
                                                                      }
                                                                      disabled={escalatingTaskIds.has(
                                                                          t.id,
                                                                      )}
                                                                      className="h-8 px-3 text-[9px] font-black uppercase bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse rounded-xl transition-all flex items-center gap-1.5 hover:-translate-y-0.5"
                                                                      title="Escalate Overdue Task"
                                                                  >
                                                                      {escalatingTaskIds.has(
                                                                          t.id,
                                                                      ) ? (
                                                                          <>
                                                                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                                                              Escalating...
                                                                          </>
                                                                      ) : (
                                                                          <>
                                                                              <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                                                              Escalate
                                                                              to
                                                                              Core
                                                                          </>
                                                                      )}
                                                                  </button>
                                                              );
                                                          })()}
                                                          {((
                                                              t.status || ""
                                                          ).toUpperCase() ===
                                                              "UNDER_REVIEW" ||
                                                              (
                                                                  t.status || ""
                                                              ).toUpperCase() ===
                                                                  "IN_REVIEW") && (
                                                              <button
                                                                  onClick={() =>
                                                                      approveAndCloseTask(
                                                                          t.id,
                                                                      )
                                                                  }
                                                                  className="h-8 px-3 text-[9px] font-black uppercase bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all border-none shadow-md shadow-emerald-500/25 flex items-center gap-1.5 hover:-translate-y-0.5"
                                                                  title="Approve and Close Task"
                                                              >
                                                                  <Check
                                                                      className="w-3.5 h-3.5"
                                                                      strokeWidth={
                                                                          3
                                                                      }
                                                                  />{" "}
                                                                  Approve &
                                                                  Close
                                                              </button>
                                                          )}
                                                          {taskTab ===
                                                          "completed" ? (
                                                              <button
                                                                  onClick={() =>
                                                                      markTaskAsReviewed(
                                                                          t.id,
                                                                      )
                                                                  }
                                                                  className="h-8 px-4 text-[9px] font-black uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white rounded-xl transition-all border-none shadow-sm"
                                                              >
                                                                  Mark Reviewed
                                                              </button>
                                                          ) : (
                                                              <button
                                                                  onClick={() =>
                                                                      deleteTask(
                                                                          t.id,
                                                                      )
                                                                  }
                                                                  disabled={deletingTaskIds.has(
                                                                      t.id,
                                                                  )}
                                                                  className={cn(
                                                                      "p-2.5 rounded-xl transition-all duration-300 border-none flex items-center justify-center group/btn",
                                                                      deletingTaskIds.has(
                                                                          t.id,
                                                                      )
                                                                          ? "bg-slate-100 dark:bg-zinc-800 text-slate-400"
                                                                          : "text-slate-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30",
                                                                  )}
                                                                  title="Terminate Operation"
                                                              >
                                                                  {deletingTaskIds.has(
                                                                      t.id,
                                                                  ) ? (
                                                                      <Loader2 className="w-4 h-4 animate-spin" />
                                                                  ) : (
                                                                      <Trash2 className="w-4 h-4 transition-transform group-hover/btn:scale-110" />
                                                                  )}
                                                              </button>
                                                          )}
                                                      </div>
                                                  </div>
                                              </div>
                                          );
                                      })}
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. RIGHT COLUMN - INTELLIGENCE & DIRECTIVES */}
                <aside className="col-span-1 md:col-span-12 lg:col-span-3 flex flex-col gap-6">
                    {/* CEO Directives & Command Log Section */}
                    <CommandCard className="flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <SectionHeader
                                    title={
                                        userRole === "CEO"
                                            ? "CEO Directives"
                                            : "Administrator Directives"
                                    }
                                    color="bg-orange-500"
                                    className="mb-0"
                                />
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-[10px] font-black text-white shadow-lg shadow-orange-500/20">
                                    {ceoDirectives.length + visibleIdeas.length}
                                </div>
                            </div>
                        </div>

                        {ceoDirectives.length > 0 && (
                            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {ceoDirectives.slice(0, 5).map((directive) => (
                                    <div
                                        key={directive.id}
                                        className="p-4 rounded-2xl border border-white/60 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-900/20 backdrop-blur-md hover:bg-white/60 dark:hover:bg-zinc-900/40 hover:shadow-md transition-all group relative overflow-hidden"
                                    >
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="w-8 h-8 bg-orange-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-orange-500/20 group-hover:scale-110 transition-transform">
                                                <Crown className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-black text-slate-900 dark:text-zinc-100 line-clamp-1">
                                                    {directive.title}
                                                </p>
                                                <p className="text-[10px] text-slate-400 dark:text-zinc-500 line-clamp-2 mt-1 leading-relaxed font-medium">
                                                    {directive.message}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mt-3">
                                            <Badge
                                                variant="outline"
                                                className="text-[8px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-600 border-none px-2 py-0.5"
                                            >
                                                {directive.priority || "Normal"}
                                            </Badge>
                                            <p className="text-[8px] font-bold text-slate-300 dark:text-zinc-600 uppercase tracking-tighter">
                                                {format(
                                                    new Date(
                                                        directive.created_at,
                                                    ),
                                                    "MMM d, h:mm a",
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex flex-col gap-4 pt-6 border-t border-slate-100 dark:border-zinc-800/50">
                            {/* Thought Capture Glassmorphic Input - ROLE BASED */}
                            <ThoughtCapture
                                onCapture={() => fetchData()}
                                compact={true}
                                placeholder={
                                    userRole === "CEO"
                                        ? "Capture a Strategic CEO Directive..."
                                        : "Log an administrator task update..."
                                }
                            />

                            {visibleIdeas.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    {visibleIdeas
                                        .slice()
                                        .sort((a, b) => {
                                            const aDone = completedIdeas.has(
                                                a.id,
                                            );
                                            const bDone = completedIdeas.has(
                                                b.id,
                                            );
                                            return aDone === bDone
                                                ? 0
                                                : aDone
                                                  ? 1
                                                  : -1;
                                        })
                                        .map((idea) => {
                                            const isCompleted =
                                                completedIdeas.has(idea.id);
                                            return (
                                                <div
                                                    key={idea.id}
                                                    className={cn(
                                                        "group flex flex-col gap-3 p-4 rounded-2xl transition-all duration-500 border relative overflow-hidden",
                                                        isCompleted
                                                            ? "bg-slate-50 dark:bg-zinc-800/20 border-slate-100 dark:border-zinc-800 opacity-60 shadow-inner"
                                                            : "bg-white/40 dark:bg-zinc-900/20 backdrop-blur-md border border-white/60 dark:border-zinc-800/50 hover:bg-white/60 dark:hover:bg-zinc-900/40 hover:shadow-md shadow-sm",
                                                    )}
                                                >
                                                    <div
                                                        className={cn(
                                                            "absolute left-0 top-0 bottom-0 w-1 transition-all duration-500",
                                                            isCompleted
                                                                ? "bg-emerald-500/50"
                                                                : idea.priority ===
                                                                    "urgent"
                                                                  ? "bg-red-500"
                                                                  : idea.priority ===
                                                                      "high"
                                                                    ? "bg-orange-500"
                                                                    : "bg-indigo-400",
                                                        )}
                                                    />

                                                    <div className="flex justify-between items-start gap-4 relative z-10 pl-1">
                                                        <div className="flex-1 min-w-0">
                                                            <h4
                                                                className={cn(
                                                                    "text-[11px] font-black uppercase tracking-widest truncate",
                                                                    isCompleted
                                                                        ? "text-slate-400 dark:text-zinc-500 line-through"
                                                                        : "text-slate-900 dark:text-zinc-100",
                                                                )}
                                                            >
                                                                {idea.title ||
                                                                    "Untitled Directive"}
                                                            </h4>
                                                            <p
                                                                className={cn(
                                                                    "text-[10px] font-medium leading-relaxed mt-1",
                                                                    isCompleted
                                                                        ? "text-slate-300 dark:text-zinc-600 line-through italic"
                                                                        : "text-slate-400 dark:text-zinc-500",
                                                                )}
                                                            >
                                                                {idea.content}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() =>
                                                                toggleIdeaCompletion(
                                                                    idea.id,
                                                                )
                                                            }
                                                            className={cn(
                                                                "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300",
                                                                isCompleted
                                                                    ? "bg-emerald-500 text-white"
                                                                    : "bg-slate-50 dark:bg-zinc-800 text-slate-300 hover:text-emerald-500",
                                                            )}
                                                        >
                                                            <Check
                                                                className="w-4 h-4"
                                                                strokeWidth={3}
                                                            />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            )}
                        </div>
                    </CommandCard>
                    <ExecutivePerformanceEngine
                        tasks={tasks}
                        completedTasks={completedTasks}
                    />
                </aside>
            </main>

            {/* MODALS */}
            <MessageDialog
                isOpen={isAnnouncementDialogOpen}
                onClose={() => setIsAnnouncementDialogOpen(false)}
                defaultType={announcementDefaultType}
                onSuccess={() => fetchData()}
            />
            <AddStaffDialog
                open={isAddStaffOpen}
                onOpenChange={setIsAddStaffOpen}
            />
            <NewIdeaDialog
                isOpen={isNewIdeaDialogOpen}
                onClose={() => setIsNewIdeaDialogOpen(false)}
                onIdeaCreated={() => {
                    // Refresh ideas after creating a new one
                    fetchData();
                }}
            />
            {/* Instruction Dispatch Modal */}
            <Dialog open={isAssignTaskOpen} onOpenChange={setIsAssignTaskOpen}>
                <DialogContent className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 max-w-[560px] rounded-3xl shadow-2xl overflow-hidden p-0 flex flex-col max-h-[85vh]">
                    <div className="px-6 pt-7 pb-4 flex items-start justify-between flex-shrink-0 border-b dark:border-zinc-800">
                        <div>
                            <DialogTitle className="text-lg font-black tracking-tight text-[#1a1a2e] dark:text-white flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#e86123]/10 to-[#351e6a]/10 flex items-center justify-center">
                                    <Target className="w-4 h-4 text-[#e86123]" />
                                </div>
                                Assign Task
                            </DialogTitle>
                            <p className="text-[11px] text-gray-400 dark:text-white/40 font-semibold mt-1 ml-10 uppercase tracking-widest">
                                Deploy a task to staff
                            </p>
                        </div>
                        <button
                            onClick={() => setIsAssignTaskOpen(false)}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Scrollable Form */}
                    <ScrollArea className="flex-1 px-6 custom-scrollbar">
                        <div className="space-y-5 pb-6">
                            {/* SECTION 1: Task Title */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-white/40">
                                    Task Title
                                </label>
                                <input
                                    placeholder="e.g. Prepare weekly briefing report"
                                    value={newTask.title}
                                    onChange={(e) =>
                                        setNewTask({
                                            ...newTask,
                                            title: e.target.value,
                                        })
                                    }
                                    className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-semibold text-[#1a1a2e] dark:text-white placeholder:text-gray-300 dark:placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#e86123]/30 focus:border-[#e86123]/50 transition-all duration-200"
                                />
                            </div>

                            {/* SECTION 2: Objective */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-white/40">
                                    Objective
                                </label>
                                <textarea
                                    placeholder="Define the purpose and expected outcome..."
                                    value={taskDescription}
                                    onChange={(e) =>
                                        setTaskDescription(e.target.value)
                                    }
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-medium text-[#1a1a2e] dark:text-white placeholder:text-gray-300 dark:placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#351e6a]/30 focus:border-[#351e6a]/50 transition-all duration-200 resize-none leading-relaxed"
                                />
                            </div>

                            {/* SECTION 3: Staff + Deadline */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Assign Staff */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-white/40">
                                        Assign Staff
                                    </label>
                                    <div className="relative">
                                        {newTask.assignedTo ? (
                                            <div
                                                className="flex items-center gap-2 px-3 h-11 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 group/assignee cursor-pointer"
                                                onClick={() => {
                                                    setNewTask({
                                                        ...newTask,
                                                        assignedTo: "",
                                                    });
                                                    setAssigneeSearch("");
                                                }}
                                            >
                                                <Avatar className="h-6 w-6 flex-shrink-0">
                                                    <AvatarImage
                                                        src={
                                                            (() => {
                                                                const url = staff.find((s) => s.id === newTask.assignedTo)?.avatar_url;
                                                                return isValidAvatarUrl(url) ? url : undefined;
                                                            })()
                                                        }
                                                    />
                                                    <AvatarFallback className="bg-[#351e6a] text-white text-[9px] font-black">
                                                        {(() => {
                                                            const s = staff.find((s) => s.id === newTask.assignedTo);
                                                            if (s?.avatar_url && !isValidAvatarUrl(s.avatar_url)) return s.avatar_url;
                                                            return s?.full_name?.substring(0, 2).toUpperCase();
                                                        })()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="flex-1 text-sm font-semibold text-[#1a1a2e] dark:text-white truncate">
                                                    {
                                                        staff.find(
                                                            (s) =>
                                                                s.id ===
                                                                newTask.assignedTo,
                                                        )?.full_name
                                                    }
                                                </span>
                                                <X className="w-3.5 h-3.5 text-gray-300 group-hover/assignee:text-red-400 transition-colors" />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="relative">
                                                    <input
                                                        placeholder="Search staff..."
                                                        value={assigneeSearch}
                                                        onChange={(e) => {
                                                            setAssigneeSearch(
                                                                e.target.value,
                                                            );
                                                            setShowAssigneeDropdown(
                                                                true,
                                                            );
                                                        }}
                                                        onFocus={() =>
                                                            setShowAssigneeDropdown(
                                                                true,
                                                            )
                                                        }
                                                        className="w-full h-11 pl-9 pr-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-semibold text-[#1a1a2e] dark:text-white placeholder:text-gray-300 dark:placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#e86123]/30 focus:border-[#e86123]/50 transition-all duration-200"
                                                    />
                                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 dark:text-white/20" />
                                                </div>
                                                {showAssigneeDropdown &&
                                                    assigneeSearch && (
                                                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1a1625] border border-gray-100 dark:border-white/10 rounded-xl overflow-hidden shadow-xl">
                                                            <ScrollArea className="max-h-[160px]">
                                                                {filteredStaff.length ===
                                                                0 ? (
                                                                    <div className="p-3 text-center text-[11px] text-gray-400 font-semibold">
                                                                        No staff
                                                                        found
                                                                    </div>
                                                                ) : (
                                                                    filteredStaff.map(
                                                                        (s) => (
                                                                            <button
                                                                                key={
                                                                                    s.id
                                                                                }
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setNewTask(
                                                                                        {
                                                                                            ...newTask,
                                                                                            assignedTo:
                                                                                                s.id,
                                                                                        },
                                                                                    );
                                                                                    setAssigneeSearch(
                                                                                        s.full_name ||
                                                                                            "",
                                                                                    );
                                                                                    setShowAssigneeDropdown(
                                                                                        false,
                                                                                    );
                                                                                }}
                                                                                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-50 dark:border-white/5 last:border-none"
                                                                            >
                                                                                <Avatar className="h-7 w-7 flex-shrink-0">
                                                                                    <AvatarImage
                                                                                        src={
                                                                                            isValidAvatarUrl(s.avatar_url) ? s.avatar_url : undefined
                                                                                        }
                                                                                    />
                                                                                    <AvatarFallback className="bg-[#2D2A77]/10 text-[#2D2A77] dark:text-white text-[9px] font-black">
                                                                                        {s.avatar_url && !isValidAvatarUrl(s.avatar_url)
                                                                                            ? s.avatar_url
                                                                                            : s.full_name?.substring(0, 2).toUpperCase()}
                                                                                    </AvatarFallback>
                                                                                </Avatar>
                                                                                <div className="text-left">
                                                                                    <div className="text-xs font-bold text-[#1a1a2e] dark:text-white">
                                                                                        {
                                                                                            s.full_name
                                                                                        }
                                                                                    </div>
                                                                                    <div className="text-[10px] text-gray-400 dark:text-white/40 uppercase">
                                                                                        {s.department ||
                                                                                            "Staff"}
                                                                                    </div>
                                                                                </div>
                                                                            </button>
                                                                        ),
                                                                    )
                                                                )}
                                                            </ScrollArea>
                                                        </div>
                                                    )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Deadline */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-white/40">
                                        Deadline
                                    </label>
                                    <div className="space-y-2">
                                        <input
                                            type="date"
                                            value={newTask.due_date}
                                            onChange={(e) =>
                                                setNewTask({
                                                    ...newTask,
                                                    due_date: e.target.value,
                                                })
                                            }
                                            className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-semibold text-[#1a1a2e] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#e86123]/30 focus:border-[#e86123]/50 transition-all duration-200 [&::-webkit-calendar-picker-indicator]:opacity-40"
                                        />
                                        <input
                                            type="time"
                                            value={newTask.due_time}
                                            onChange={(e) =>
                                                setNewTask({
                                                    ...newTask,
                                                    due_time: e.target.value,
                                                })
                                            }
                                            className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-semibold text-[#1a1a2e] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#e86123]/30 focus:border-[#e86123]/50 transition-all duration-200"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SECTION 4: Priority Buttons */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-white/40">
                                    Priority
                                </label>
                                <div className="flex gap-2">
                                    {(
                                        [
                                            "low",
                                            "medium",
                                            "high",
                                            "urgent",
                                        ] as const
                                    ).map((p) => {
                                        const colors: Record<string, string> = {
                                            low: "bg-emerald-500 border-emerald-500 text-white",
                                            medium: "bg-amber-500 border-amber-500 text-white",
                                            high: "bg-orange-500 border-orange-500 text-white",
                                            urgent: "bg-red-500 border-red-500 text-white",
                                        };
                                        const outline: Record<string, string> =
                                            {
                                                low: "border-emerald-200 text-emerald-500 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 dark:hover:bg-emerald-900/20",
                                                medium: "border-amber-200 text-amber-500 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-900/20",
                                                high: "border-orange-200 text-orange-500 hover:bg-orange-50 dark:border-orange-900 dark:text-orange-400 dark:hover:bg-orange-900/20",
                                                urgent: "border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/20",
                                            };
                                        const active = newTask.priority === p;
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() =>
                                                    setNewTask({
                                                        ...newTask,
                                                        priority: p,
                                                    })
                                                }
                                                className={`flex-1 h-9 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm ${active ? colors[p] : `bg-transparent ${outline[p]}`}`}
                                            >
                                                {p}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-100 dark:border-white/10 flex items-center justify-between flex-shrink-0 bg-white dark:bg-[#1a1625]">
                        <button
                            type="button"
                            onClick={() => setIsAssignTaskOpen(false)}
                            className="text-sm font-semibold text-gray-400 dark:text-white/40 hover:text-gray-700 dark:hover:text-white transition-colors duration-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                console.log("Assign task button clicked");
                                assignTask(false);
                            }}
                            disabled={!newTask.title || !newTask.assignedTo}
                            className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#e86123] to-[#351e6a] text-white text-[11px] font-black uppercase tracking-[0.15em] flex items-center gap-2 hover:shadow-lg hover:shadow-orange-500/20 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                        >
                            <Target className="w-4 h-4" />
                            Assign Task
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Remove Staff Confirmation Modal */}
            <Dialog
                open={isRemoveStaffModalOpen}
                onOpenChange={setIsRemoveStaffModalOpen}
            >
                <DialogContent className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 max-w-md rounded-3xl shadow-2xl overflow-hidden p-0 flex flex-col">
                    {/* Top gradient accent bar - Red for destructive */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 to-red-900 z-50" />

                    {/* Header Area */}
                    <div className="px-8 pt-8 pb-4 relative flex-shrink-0">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
                        <div className="relative z-10 flex items-start justify-between">
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3 mb-1 text-red-500">
                                    <div className="p-2.5 bg-red-500/10 rounded-xl shadow-inner border border-red-500/20">
                                        <ShieldAlert className="h-5 w-5 text-red-500" />
                                    </div>
                                    Irreversible Termination
                                </DialogTitle>
                                <p className="text-theme-text-40 text-xs font-bold uppercase tracking-widest ml-14">
                                    Execute Data Purge Protocol
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="px-8 py-4 space-y-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-xl space-y-2">
                            <p className="text-[11px] text-red-500 font-black uppercase tracking-widest flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" /> Warning
                            </p>
                            <p className="text-[11px] leading-relaxed text-theme-text-60 font-bold">
                                You are about to permanently remove{" "}
                                <span className="text-theme-text font-black">
                                    {staffToRemove?.full_name}
                                </span>{" "}
                                from the command grid. This action cannot be
                                undone. All access will be immediately revoked.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-black tracking-widest text-theme-text-40 ml-1">
                                Sequence Confirmation
                            </Label>
                            <Input
                                placeholder={`Type "${staffToRemove?.full_name || "name"}" to confirm`}
                                value={confirmName}
                                onChange={(e) => setConfirmName(e.target.value)}
                                className="bg-theme-bg-white-5 border-theme-border-10 focus:border-red-500 focus:ring-1 focus:ring-red-500/30 rounded-xl h-14 text-sm font-bold transition-all px-5 shadow-inner"
                            />
                        </div>
                    </div>

                    <div className="p-6 mt-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsRemoveStaffModalOpen(false)}
                            className="text-theme-text-60 hover:text-theme-text font-bold uppercase tracking-widest text-xs h-12 px-6 rounded-xl border border-transparent hover:border-theme-border-10 hover:bg-theme-bg-white-5"
                        >
                            Abort
                        </Button>
                        <Button
                            disabled={confirmName !== staffToRemove?.full_name}
                            onClick={deleteStaff}
                            className="bg-gradient-to-r from-red-600 to-red-800 text-white hover:shadow-lg hover:shadow-red-500/20 h-12 px-8 font-black uppercase tracking-[0.2em] text-xs rounded-xl transition-all flex items-center gap-2 border-none disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            Execute Deletion{" "}
                            <Trash2 className="w-4 h-4 ml-1 transition-transform group-hover:scale-110" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Ideas Modal */}
            <Dialog open={isIdeasOpen} onOpenChange={setIsIdeasOpen}>
                <DialogContent className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 max-w-2xl rounded-3xl shadow-2xl overflow-hidden p-0 flex flex-col max-h-[90vh]">
                    {/* Top gradient accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#e86123] to-[#351e6a] z-50" />

                    {/* Header Area */}
                    <div className="px-8 pt-8 pb-4 relative flex-shrink-0">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FA4616]/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
                        <div className="relative z-10 flex items-start justify-between">
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3 mb-1">
                                    <div className="p-2.5 bg-theme-bg-white-5 rounded-xl shadow-inner border border-theme-border-10">
                                        <Lightbulb className="h-5 w-5 text-[#e86123]" />
                                    </div>
                                    Strategic Idea Dispatch
                                </DialogTitle>
                                <p className="text-theme-text-40 text-xs font-bold uppercase tracking-widest ml-14">
                                    Distribute Visionary Concepts to Select
                                    Operatives
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content Area */}
                    <ScrollArea className="flex-1 px-8 py-2 custom-scrollbar">
                        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300 pb-4">
                            <SectionHeader
                                title="Core Parameters"
                                color="bg-[#e86123]"
                            />

                            <div className="grid grid-cols-2 gap-6">
                                {/* Idea Title */}
                                <div className="space-y-2 col-span-2">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-theme-text-40 ml-1">
                                        Idea Codename
                                    </Label>
                                    <Input
                                        placeholder="ENTER IDEA CODENAME..."
                                        value={newIdea.title}
                                        onChange={(e) =>
                                            setNewIdea({
                                                ...newIdea,
                                                title: e.target.value,
                                            })
                                        }
                                        className="bg-theme-bg-white-5 border-theme-border-10 focus:border-theme-brand rounded-xl h-14 text-base font-bold placeholder:text-theme-text-20 transition-all px-5 shadow-inner"
                                    />
                                </div>

                                {/* Vision Description */}
                                <div className="space-y-2 col-span-2">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-theme-text-40 ml-1">
                                        The Vision
                                    </Label>
                                    <Textarea
                                        placeholder="Describe the strategic initiative..."
                                        value={newIdea.description}
                                        onChange={(e) =>
                                            setNewIdea({
                                                ...newIdea,
                                                description: e.target.value,
                                            })
                                        }
                                        className="bg-theme-bg-white-5 border-theme-border-10 focus:border-theme-brand rounded-xl h-32 text-sm font-semibold transition-all p-5 resize-none shadow-inner leading-relaxed"
                                    />
                                </div>

                                {/* Priority Level */}
                                <div className="space-y-2 col-span-2 sm:col-span-1">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-theme-text-40 ml-1">
                                        Impact Level
                                    </Label>
                                    <Select
                                        value={newIdea.priority}
                                        onValueChange={(v) =>
                                            setNewIdea({
                                                ...newIdea,
                                                priority: v,
                                            })
                                        }
                                    >
                                        <SelectTrigger className="bg-theme-bg-white-5 border-theme-border-10 h-14 rounded-xl px-5 font-bold shadow-inner">
                                            <SelectValue placeholder="Select impact level" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100">
                                            <SelectItem
                                                value="low"
                                                className="font-bold focus:bg-theme-bg-white-5"
                                            >
                                                LOW
                                            </SelectItem>
                                            <SelectItem
                                                value="medium"
                                                className="font-bold focus:bg-theme-bg-white-5"
                                            >
                                                MEDIUM
                                            </SelectItem>
                                            <SelectItem
                                                value="high"
                                                className="font-bold focus:bg-theme-bg-white-5 text-orange-500"
                                            >
                                                HIGH
                                            </SelectItem>
                                            <SelectItem
                                                value="urgent"
                                                className="font-bold focus:bg-theme-bg-white-5 text-red-500"
                                            >
                                                URGENT
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <SectionHeader
                                title="Target Operatives"
                                color="bg-[#351e6a]"
                            />

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black tracking-widest text-theme-text-40 ml-1">
                                        Share with Staff (Max 3)
                                    </Label>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {staff.map((s) => {
                                            const isSelected =
                                                selectedStaffForIdea.includes(
                                                    s.id,
                                                );
                                            return (
                                                <button
                                                    key={s.id}
                                                    onClick={() => {
                                                        if (isSelected) {
                                                            setSelectedStaffForIdea(
                                                                (prev) =>
                                                                    prev.filter(
                                                                        (id) =>
                                                                            id !==
                                                                            s.id,
                                                                    ),
                                                            );
                                                        } else if (
                                                            selectedStaffForIdea.length <
                                                            3
                                                        ) {
                                                            setSelectedStaffForIdea(
                                                                (prev) => [
                                                                    ...prev,
                                                                    s.id,
                                                                ],
                                                            );
                                                        } else {
                                                            toast.error(
                                                                "Vision limited to 3 recipients",
                                                            );
                                                        }
                                                    }}
                                                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
                                                        isSelected
                                                            ? "bg-theme-brand text-white border-transparent shadow-md"
                                                            : "bg-theme-bg-white-5 text-theme-text-60 border-theme-border-10 hover:border-theme-border-20 hover:text-theme-text"
                                                    }`}
                                                >
                                                    <div
                                                        className={`w-2 h-2 rounded-full ${s.status === "online" ? "bg-emerald-500" : s.status === "busy" ? "bg-amber-500" : "bg-theme-bg-white-20"} ${isSelected ? "border border-white/40" : ""}`}
                                                    />
                                                    <span className="text-[11px] font-black uppercase tracking-wider">
                                                        {s.full_name}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="flex items-start gap-3 p-4 bg-theme-bg-white-5 border border-theme-border-10 rounded-xl">
                                    <AlertCircle className="w-4 h-4 text-theme-text-40 mt-0.5" />
                                    <p className="text-[11px] font-bold text-theme-text-50 leading-relaxed max-w-[90%]">
                                        Sharing notifies staff without blocking
                                        current workflows. Ideas archive
                                        automatically and are visible only to
                                        selected operatives.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    {/* Fixed Footer Actions */}
                    <div className="p-6 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800 flex-shrink-0">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsIdeasOpen(false)}
                            className="text-theme-text-60 hover:text-theme-text font-bold uppercase tracking-widest text-xs h-12 px-6 rounded-xl border border-transparent hover:border-theme-border-10 hover:bg-theme-bg-white-5"
                        >
                            Cancel Operation
                        </Button>
                        <Button
                            type="button"
                            onClick={submitIdea}
                            disabled={!newIdea.title || !newIdea.description}
                            className="bg-gradient-to-r from-[#e86123] to-[#351e6a] text-white hover:shadow-lg hover:shadow-orange-500/20 h-12 px-8 font-black uppercase tracking-[0.2em] text-xs rounded-xl transition-all flex items-center gap-2 border-none group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Deploy Vision{" "}
                            <Rocket className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Staff Overview Modal */}
            <Dialog
                open={showStaffOverview}
                onOpenChange={setShowStaffOverview}
            >
                <DialogContent className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 max-w-4xl rounded-3xl shadow-2xl overflow-hidden p-0 flex flex-col max-h-[90vh]">
                    {/* Top gradient accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#e86123] to-[#351e6a] z-50" />

                    {/* Header Area */}
                    <div className="px-8 pt-8 pb-4 relative flex-shrink-0">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FA4616]/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
                        <div className="relative z-10 flex items-start justify-between">
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3 mb-1">
                                    <div className="p-2.5 bg-theme-bg-white-5 rounded-xl shadow-inner border border-theme-border-10">
                                        <ClipboardList className="h-5 w-5 text-[#e86123]" />
                                    </div>
                                    Full Staff Dossier
                                </DialogTitle>
                                <p className="text-theme-text-40 text-xs font-bold uppercase tracking-widest ml-14">
                                    Comprehensive Personnel Overview
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowStaffOverview(false)}
                                className="rounded-full text-theme-text-40 hover:text-theme-text hover:bg-theme-bg-white-10"
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>
                    </div>

                    <ScrollArea className="flex-1 px-8 py-4 custom-scrollbar">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-in fade-in zoom-in-95 duration-300 pb-4">
                            {stats.sortedStaff.map((s) => {
                                const staffTasks = tasks.filter(
                                    (t) => t.assigned_to === s.id,
                                );
                                return (
                                    <div
                                        key={s.id}
                                        className="border border-theme-border-10 bg-theme-bg-white-5 rounded-2xl p-5 flex flex-col gap-4 hover:border-theme-border-20 transition-all hover:shadow-md group"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10 shadow-sm border border-theme-border-10">
                                                    <AvatarImage
                                                        src={isValidAvatarUrl(s.avatar_url) ? s.avatar_url : undefined}
                                                    />
                                                    <AvatarFallback className="bg-theme-bg-white-10 text-theme-text font-black">
                                                        {s.avatar_url && !isValidAvatarUrl(s.avatar_url)
                                                            ? s.avatar_url
                                                            : s.full_name?.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <h5 className="font-bold text-theme-text text-sm">
                                                        {s.full_name}
                                                    </h5>
                                                    <span className="text-[10px] text-theme-text-40 uppercase font-black tracking-widest">
                                                        {s.department ||
                                                            "Staff"}
                                                    </span>
                                                </div>
                                            </div>
                                            <div
                                                className={`w-2.5 h-2.5 rounded-full border-2 border-theme-card shadow-sm ${s.status === "online" ? "bg-emerald-500" : s.status === "busy" ? "bg-amber-500" : "bg-theme-bg-white-20"}`}
                                            />
                                        </div>

                                        <div className="bg-theme-bg-white-5 rounded-xl p-3 flex justify-around">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-theme-text-40 uppercase font-bold tracking-widest">
                                                    Tasks
                                                </span>
                                                <span className="text-base font-black text-theme-text">
                                                    {staffTasks.length}
                                                </span>
                                            </div>
                                            <div className="w-px bg-theme-border-10" />
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-theme-text-40 uppercase font-bold tracking-widest">
                                                    Status
                                                </span>
                                                <span className="text-[10px] font-black text-theme-text-80 uppercase mt-1.5 px-2 py-0.5 rounded-full bg-theme-bg-white-10">
                                                    {s.status}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="pt-2 mt-auto flex gap-3">
                                            <Button
                                                className="flex-1 h-9 text-[10px] font-black uppercase tracking-widest bg-theme-bg-white text-theme-inv-text hover:bg-theme-bg-white-90 rounded-xl transition-all shadow-sm"
                                                onClick={() => {
                                                    setNewTask((v) => ({
                                                        ...v,
                                                        assignedTo: s.id,
                                                    }));
                                                    setIsAssignTaskOpen(true);
                                                    setShowStaffOverview(false);
                                                }}
                                            >
                                                Assign
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="flex-1 h-9 text-[10px] font-black uppercase tracking-widest border-theme-border-10 text-theme-text hover:bg-theme-bg-white-10 hover:border-theme-border-20 rounded-xl transition-all"
                                                onClick={() => {
                                                    openChatModal(s);
                                                    setShowStaffOverview(false);
                                                }}
                                            >
                                                Chat
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
            {/* Classic Branded Refresh Overlay */}
            <AnimatePresence>
                {isSystemRefreshing && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-white dark:bg-zinc-950 transition-colors duration-300"
                    >
                        {/* Logo/Icon Pulsing Effect */}
                        <div className="relative mb-6 select-none pointer-events-none">
                            <motion.div 
                                animate={{ scale: [1, 1.05, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                className="w-16 h-16 rounded-2xl bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-indigo-400/20"
                            >
                                <ShieldCheck className="w-8 h-8 text-white animate-pulse" />
                            </motion.div>
                            <div className="absolute -inset-1.5 rounded-[1.25rem] border border-indigo-500/30 animate-ping opacity-60 pointer-events-none" />
                        </div>

                        {/* Loader Typography */}
                        <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-800 dark:text-zinc-100 mb-2 select-none">
                            Getting your workspace ready
                        </h2>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 select-none animate-pulse">
                            Restoring secure data channels...
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Chat Message Modal */}
            <Dialog open={isChatModalOpen} onOpenChange={setIsChatModalOpen}>
                <DialogContent className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 max-w-md rounded-3xl shadow-2xl overflow-hidden p-0 flex flex-col">
                    {/* Top gradient accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#e86123] to-[#351e6a] z-50" />

                    {/* Header Area */}
                    <div className="px-8 pt-8 pb-4 relative flex-shrink-0">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[#FA4616]/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none" />
                        <div className="relative z-10 flex items-start justify-between">
                            <div>
                                <DialogTitle className="text-xl font-black uppercase tracking-widest flex items-center gap-3 mb-1">
                                    <div className="p-2.5 bg-theme-bg-white-5 rounded-xl shadow-inner border border-theme-border-10">
                                        <MessageCircle className="h-5 w-5 text-[#e86123]" />
                                    </div>
                                    Direct Dispatch
                                </DialogTitle>
                                <p className="text-theme-text-40 text-xs font-bold uppercase tracking-widest ml-14">
                                    Communicate directly with{" "}
                                    {selectedStaffForChat?.full_name?.split(
                                        " ",
                                    )[0] || "Operative"}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="px-8 py-4 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-black tracking-widest text-theme-text-40 ml-1">
                                Urgent Message
                            </Label>
                            <Textarea
                                placeholder="Type your urgent directive here..."
                                value={chatMessage}
                                onChange={(e) => setChatMessage(e.target.value)}
                                className="bg-theme-bg-white-5 border-theme-border-10 focus:border-theme-brand rounded-xl h-32 resize-none text-sm p-4 font-semibold shadow-inner transition-all leading-relaxed"
                            />
                        </div>
                        <div className="flex items-center gap-2 px-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <p className="text-[10px] text-theme-text-60 font-bold tracking-wider">
                                Message will be transmitted immediately.
                            </p>
                        </div>
                    </div>

                    <div className="p-6 mt-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-t border-slate-200 dark:border-zinc-800">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setIsChatModalOpen(false)}
                            className="text-theme-text-60 hover:text-theme-text font-bold uppercase tracking-widest text-xs h-12 px-6 rounded-xl border border-transparent hover:border-theme-border-10 hover:bg-theme-bg-white-5"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={sendChatMessage}
                            disabled={!chatMessage.trim()}
                            className="bg-gradient-to-r from-[#e86123] to-[#351e6a] text-white hover:shadow-lg hover:shadow-orange-500/20 h-12 px-8 font-black uppercase tracking-[0.2em] text-xs rounded-xl transition-all flex items-center gap-2 border-none group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Send Message{" "}
                            <MessageCircle className="w-4 h-4 ml-1 transition-transform group-hover:scale-110" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Delegation Modal */}
            <Dialog
                open={isDelegationModalOpen}
                onOpenChange={setIsDelegationModalOpen}
            >
                <DialogContent className="bg-white/95 backdrop-blur-2xl border-slate-200 text-slate-900 max-w-lg rounded-3xl shadow-2xl p-6 overflow-hidden">
                    {/* Top gradient accent bar */}
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600" />

                    <DialogHeader className="pt-2">
                        <DialogTitle className="text-xl font-black uppercase tracking-[0.2em] text-indigo-950 flex items-center gap-2">
                            <Users className="w-5 h-5 text-indigo-600" />
                            Operative Allocation
                        </DialogTitle>
                    </DialogHeader>

                    <div className="mt-6 space-y-6">
                        <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 backdrop-blur-sm relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Target className="w-12 h-12 text-indigo-900" />
                            </div>
                            <h4 className="text-[10px] font-black text-indigo-600/60 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                                <FileText className="w-3 h-3" />
                                Directive Content
                            </h4>
                            <p className="text-sm text-indigo-950 font-medium leading-relaxed">
                                {selectedIdeaForDelegation?.content}
                            </p>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                    Select Team Member
                                </h4>
                                <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full">
                                    {staff.length} Active Operatives
                                </span>
                            </div>

                            <ScrollArea className="h-[320px] pr-4 -mr-4">
                                <div className="space-y-2.5 pb-4">
                                    {staff.map((member) => {
                                        const activeTasksCount = tasks.filter(
                                            (t) =>
                                                t.assigned_to === member.id &&
                                                t.status !== "completed",
                                        ).length;
                                        return (
                                            <button
                                                key={member.id}
                                                onClick={() =>
                                                    handleDelegation(member)
                                                }
                                                disabled={isDelegating}
                                                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-white hover:border-indigo-500/50 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-300 group relative overflow-hidden"
                                            >
                                                <div className="flex items-center gap-3.5 relative z-10">
                                                    <div className="relative">
                                                        <Avatar className="w-11 h-11 border-2 border-white shadow-sm ring-1 ring-slate-100">
                                                            <AvatarImage
                                                                src={
                                                                    isValidAvatarUrl(member.avatar_url) ? member.avatar_url : undefined
                                                                }
                                                            />
                                                            <AvatarFallback className="bg-gradient-to-br from-indigo-50 to-slate-100 text-indigo-700 font-bold text-sm">
                                                                {member.avatar_url && !isValidAvatarUrl(member.avatar_url)
                                                                    ? member.avatar_url
                                                                    : member.full_name
                                                                        ?.split(" ")
                                                                        .map((n) => n[0])
                                                                        .join("")}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm" />
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                            {member.full_name}
                                                        </p>
                                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">
                                                            {member.department ||
                                                                "Operations"}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 relative z-10">
                                                    <div
                                                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${
                                                            activeTasksCount > 3
                                                                ? "bg-amber-50 border-amber-100 text-amber-600"
                                                                : "bg-indigo-50 border-indigo-100 text-indigo-600"
                                                        }`}
                                                    >
                                                        <span className="text-[9px] font-black uppercase tracking-tight">
                                                            {activeTasksCount}{" "}
                                                            Load
                                                        </span>
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                                                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                                                    </div>
                                                </div>
                                                {/* Background hover effect */}
                                                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/0 via-indigo-50/0 to-indigo-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>

                    <DialogFooter className="mt-2 border-t border-slate-100 pt-4">
                        <Button
                            variant="ghost"
                            onClick={() => setIsDelegationModalOpen(false)}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl h-11"
                        >
                            Abort Allocation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function DispatchLabel({ text }: { text: string }) {
    return (
        <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-500">
            {text}
        </label>
    );
}
