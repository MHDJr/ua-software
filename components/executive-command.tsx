"use client";

import React, { useState, useEffect, useMemo, Fragment, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, Profile, Task, Request, Broadcast, Knock, ActivityFeed, Attendance, SignupRequest, Meeting, ExecutiveReport, AgentStatus, Lead, LeadStatus, DemoRequest, TutorAvailability, TutorNotification, Programme, Idea, SalesSignals } from "@/lib/supabase";
import { createClient } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth-context";
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
import { cn } from "@/lib/utils";
import { format, parseISO, isPast, isToday, isTomorrow } from "date-fns";
import { useTabResiliency } from "./tab-resiliency-engine";
import { useIdeas } from "@/hooks/use-ideas";
import { useQueryClient } from "@tanstack/react-query";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { 
    useStaff, 
    useLeads, 
    useRequests, 
    useMeetings, 
    useCeoDirectives 
} from "@/hooks/use-dashboard-data";

// ============================================
// TYPES & CONSTANTS
// ============================================

type SystemStatus = "STABLE" | "WARNING" | "CRITICAL";

// ============================================
// UI COMPONENTS (MINIMAL & AUTHORITY FOCUSED)
// ============================================

const SectionHeader = React.memo(({
    title,
    color = "bg-theme-bg-white-20",
    className = "mb-4"
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
));
SectionHeader.displayName = "SectionHeader";

const CommandCard = React.memo(({
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
                className
            )}
        >
            {children}
        </div>
    );
});
CommandCard.displayName = "CommandCard";

const ExecutivePerformanceEngine = React.memo(({ tasks, completedTasks }: { tasks: Task[], completedTasks: Task[] }) => {
    const { userRole } = useAuth();
    
    // 1. Operational Velocity Calculation
    const activeTasksCount = tasks.length;
    const completedTodayCount = completedTasks.filter(t => t.updated_at && isToday(parseISO(t.updated_at))).length;
    const totalToday = activeTasksCount + completedTodayCount;
    const velocity = totalToday > 0 ? Math.round((completedTodayCount / totalToday) * 100) : 84;

    // 2. Departmental Load Distribution
    const departments = ["Administration", "Marketing", "Sales", "Accounts"];
    const loadDist = departments.map(dept => {
        const count = tasks.filter(t => {
            const deptName = (t as any).assigned_to_user?.department?.toLowerCase() || "";
            return deptName === dept.toLowerCase();
        }).length;
        return { name: dept, count };
    });
    const maxLoad = Math.max(...loadDist.map(d => d.count), 1);

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
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500 group-hover:text-indigo-600 transition-colors">Today</span>
                    <ChevronDown className="w-3 h-3 text-slate-400 dark:text-zinc-500 group-hover:text-indigo-600 transition-colors" />
                </div>
            </div>

            {/* Operational Velocity Metric */}
            <div className="mb-8 p-5 rounded-[2rem] bg-slate-50/50 dark:bg-zinc-800/30 border border-slate-100 dark:border-zinc-800/50 shadow-inner">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-[0.15em]">Operational Velocity</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{velocity}%</span>
                </div>
                <div className="h-2.5 w-full bg-white dark:bg-zinc-900 rounded-full overflow-hidden flex p-0.5 border border-slate-100 dark:border-zinc-800 shadow-sm">
                    <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${velocity}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                    />
                </div>
                <div className="flex justify-between mt-3 px-1">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                        <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-tight">{completedTodayCount} Completed</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-zinc-700" />
                        <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-tight">{activeTasksCount} Pending</span>
                    </div>
                </div>
            </div>

            {/* Departmental Load Distribution */}
            <div className="mb-2">
                <div className="flex items-center gap-2 mb-5">
                    <Activity className="w-3.5 h-3.5 text-indigo-500/60 dark:text-indigo-400/60" />
                    <h4 className="text-[10px] font-black text-slate-900 dark:text-zinc-100 opacity-80 uppercase tracking-[0.2em]">Load Distribution</h4>
                </div>
                <div className="grid grid-cols-1 gap-3.5">
                    {loadDist.map(dept => (
                        <div key={dept.name} className="flex items-center justify-between group">
                            <div className="flex items-center gap-3 flex-1">
                                <span className={cn(
                                    "w-1.5 h-4 rounded-full transition-all duration-500 shadow-sm",
                                    dept.name === "Administration" ? "bg-slate-400 dark:bg-zinc-500" :
                                    dept.name === "Marketing" ? "bg-purple-500 dark:bg-purple-600" :
                                    dept.name === "Sales" ? "bg-orange-500 dark:bg-orange-600" : "bg-blue-500 dark:bg-blue-600"
                                )} />
                                <span className="text-[11px] font-black text-slate-400 dark:text-zinc-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{dept.name}</span>
                            </div>
                            <div className="flex items-center gap-3 w-32">
                                <div className="flex-1 h-1.5 bg-slate-50 dark:bg-zinc-800/50 rounded-full overflow-hidden shadow-inner border border-slate-100/50 dark:border-zinc-800/30">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${(dept.count / maxLoad) * 100}%` }}
                                        className={cn(
                                            "h-full rounded-full opacity-80 shadow-sm",
                                            dept.name === "Administration" ? "bg-slate-400 dark:bg-zinc-500" :
                                            dept.name === "Marketing" ? "bg-purple-500 dark:bg-purple-600" :
                                            dept.name === "Sales" ? "bg-orange-500 dark:bg-orange-600" : "bg-blue-500 dark:bg-blue-600"
                                        )}
                                    />
                                </div>
                                <span className="text-[11px] font-black text-slate-900 dark:text-zinc-100 w-5 text-right tabular-nums">{dept.count}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </CommandCard>
    );
});
ExecutivePerformanceEngine.displayName = "ExecutivePerformanceEngine";

const renderCEOTaskGauge = (t: Task) => {
    const s = (t.status || "PENDING").toUpperCase();
    const progress = s === "COMPLETED" ? 100 : (t.progress || 0);
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
                        className={cn("fill-none transition-all duration-500 ease-out", strokeColor)}
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
    const { profile, signOut, userRole } = useAuth();
    const { theme } = useTheme();
    const queryClient = useQueryClient();

    // ============================================
    // 1. STATE DECLARATIONS (TOP-LEVEL)
    // ============================================
    
    // Unified Real-Time Data Source with self-healing recovery
    const { data: realtimeTasks, setData: setRealtimeTasks, isOnline } = useRealtimeTable<Task>("tasks");
    
    // Deriving UI sets cleanly from the unified real-time data array
    const tasks = useMemo(() => realtimeTasks.filter(t => !['completed', 'deleted', 'COMPLETED'].includes(t.status || '')), [realtimeTasks]);
    const completedTasks = useMemo(() => realtimeTasks.filter(t => ['completed', 'COMPLETED'].includes(t.status || '') && !t.reviewed_at), [realtimeTasks]);
    
    // Simulate isFetching state since realtime is instant
    const isTasksFetching = false;
    const { data: staff = [], isFetching: isStaffFetching } = useStaff();
    const { data: requests = [], isFetching: isRequestsFetching } = useRequests();
    const { data: meetings = [], isFetching: isMeetingsFetching } = useMeetings();
    const { data: ceoDirectives = [], isFetching: isCeoDirectivesFetching } = useCeoDirectives();
    const { leads, demoRequests, isLoading: isLoadingLeads } = useLeads();
    const { 
        ideas, 
        isFetching: isIdeasFetching, 
        toggleIdea: toggleIdeaMutation,
        disposeIdea: disposeIdeaMutation 
    } = useIdeas();

    // UI & Filter States
    const [taskTab, setTaskTab] = useState<"active" | "blocked" | "overdue" | "daily" | "completed">("active");
    const [departmentFilter, setDepartmentFilter] = useState<"ceo" | "administration" | "marketing" | "sales" | "accounts">("ceo");
    const [meetingFilter, setMeetingFilter] = useState<"upcoming" | "today" | "week">("upcoming");
    const [currentTime, setCurrentTime] = useState(Date.now());
    const [isRefreshing, setIsRefreshing] = useState(true);
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
    const [selectedStaffForChat, setSelectedStaffForChat] = useState<Profile | null>(null);
    const [chatMessage, setChatMessage] = useState("");
    
    // Global Announcement States
    const [isAnnouncementDialogOpen, setIsAnnouncementDialogOpen] = useState(false);
    const [announcementDefaultType, setAnnouncementDefaultType] = useState<MessageType>("announcement");
    const [announcementMessage, setAnnouncementMessage] = useState("");
    const [isDeployingAnnouncement, setIsDeployingAnnouncement] = useState(false);
    const [channelDestination, setChannelDestination] = useState<"CEO_BROADCAST" | "COMMUNITY_BOARD">("CEO_BROADCAST");
    const [announcementType, setAnnouncementType] = useState<"MEETING" | "NOTICE" | "DEADLINE">("NOTICE");
    
    // Broadcast Board States
    const [broadcasts, setBroadcasts] = useState<any[]>([]);
    const [isDeletingBroadcast, setIsDeletingBroadcast] = useState<string | null>(null);
    
    // Tracking Sets
    const [completedIdeas, setCompletedIdeas] = useState<Set<string>>(new Set());
    const [deletingTaskIds, setDeletingTaskIds] = useState<Set<string>>(new Set());
    const [clearedNotifications, setClearedNotifications] = useState<Set<string>>(new Set());

    // Form States
    const [newIdea, setNewIdea] = useState({ title: "", description: "", priority: "medium" });
    const [selectedStaffForIdea, setSelectedStaffForIdea] = useState<string[]>([]);
    const [hoveredRequest, setHoveredRequest] = useState<any | null>(null);

    // Refs
    const channelsRef = useRef<any[]>([]);
    const isVisibleRef = useRef(true);
    const lastValidProfileIdRef = useRef<string | null>(profile?.id || null);

    // ============================================
    // 2. DERIVED STATE & MEMOS
    // ============================================

    // Periodic refresh for time-based filtering
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
        return () => clearInterval(interval);
    }, []);

    // Update completedIdeas set when ideas change
    useEffect(() => {
        const completedIds = ideas
            .filter((idea: any) => idea.completed)
            .map((idea: any) => idea.id);
        setCompletedIdeas(new Set(completedIds));
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
            const completedAt = idea.completed_at ? new Date(idea.completed_at) : new Date(idea.updated_at);
            return completedAt > oneHourAgo;
        });
    }, [ideas, currentTime]);

    // Optimize displayed tasks
    const displayedTasks = useMemo(() => {
        const sourceTasks = taskTab === "completed" ? completedTasks : tasks;

        return sourceTasks.filter((t) => {
            if (deletingTaskIds.has(t.id)) return false;
            
            const isOverdue = t.due_date && new Date(t.due_date) < new Date();
            const isDaily = t.is_daily_task === true || t.repeat_daily === true;

            // Department filtering
            if (departmentFilter !== "ceo") {
                const assignee = staff.find(s => s.id === t.assigned_to);
                const creator = staff.find(s => s.id === t.created_by);
                
                const assigneeDept = assignee?.department?.toLowerCase() || "";
                const creatorDept = creator?.department?.toLowerCase() || "";
                
                const matchesDept = (dept: string) => {
                    switch (departmentFilter) {
                        case "sales": return dept === "sales";
                        case "marketing": return dept === "marketing";
                        case "accounts": return dept === "accounts" || dept === "finance";
                        case "administration": return dept === "administration" || dept === "admin" || dept === "hr";
                        default: return false;
                    }
                };

                const isAssigneeMatch = matchesDept(assigneeDept);
                const isCreatorMatch = matchesDept(creatorDept);
                
                if (!isAssigneeMatch && !isCreatorMatch) return false;
            }

            // CEO/My Tasks filter (Only for active tabs, not completed)
            if (taskTab !== "completed") {
                if (departmentFilter === "ceo") {
                    if (userRole === 'MANAGER') {
                        const currentMe = profile?.id || lastValidProfileIdRef.current;
                        const isAssignedByCeo = (t as any).creator?.role === 'ceo';
                        const isAssignedToMe = t.assigned_to === currentMe;
                        if (!isAssignedByCeo || !isAssignedToMe) return false;
                    }
                }

                if (taskTab === "daily") return isDaily;
                if (taskTab === "overdue") return isOverdue;
                if (taskTab === "blocked") return t.priority === "urgent";
                return !isOverdue && t.priority !== "urgent";
            }

            return true;
        });
    }, [taskTab, tasks, completedTasks, deletingTaskIds, departmentFilter, staff, userRole, profile?.id]);

    // ============================================
    // 3. ACTIONS & LOGIC
    // ============================================

    const fetchBroadcasts = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from("broadcasts")
                .select("*, profile:profiles!created_by(id, full_name, avatar_url)")
                .order("created_at", { ascending: false });
            if (!error && data) {
                setBroadcasts(data);
            }
        } catch (err) {
            console.error("Failed to fetch broadcasts:", err);
        }
    }, []);

    const handleDeleteBroadcast = async (id: string) => {
        if (!confirm("Are you sure you want to permanently delete this broadcast?")) return;
        setIsDeletingBroadcast(id);
        try {
            const { error } = await supabase
                .from("broadcasts")
                .delete()
                .eq("id", id);
            
            if (error) {
                console.error("Failed to delete broadcast:", error);
                toast.error("Failed to delete broadcast: " + error.message);
            } else {
                toast.success("Broadcast deleted successfully!");
                setBroadcasts(prev => prev.filter(b => b.id !== id));
            }
        } catch (err: any) {
            console.error("Exception deleting broadcast:", err);
            toast.error("Error: " + err.message);
        } finally {
            setIsDeletingBroadcast(null);
        }
    };

    const fetchData = useCallback(async (force = false, silent = false) => {
        if (!silent) setIsRefreshing(true);
        try {
            // High-speed parallel invalidation
            await queryClient.invalidateQueries({
                predicate: (query) => 
                    query.queryKey[0] === 'tasks' || 
                    query.queryKey[0] === 'staff' ||
                    query.queryKey[0] === 'requests' ||
                    query.queryKey[0] === 'ideas' ||
                    query.queryKey[0] === 'meetings' ||
                    query.queryKey[0] === 'ceo_directives'
            });
            fetchBroadcasts();
        } catch (e) {
            console.error("Telemetry sync failed:", e);
        } finally {
            setIsRefreshing(false);
        }
    }, [queryClient, fetchBroadcasts]);

    const setupRealtime = useCallback(() => {
        channelsRef.current.forEach(ch => supabase.removeChannel(ch));
        
        const requestChannel = supabase.channel("requests-updates")
            .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, () => queryClient.invalidateQueries({ queryKey: ["requests"] }))
            .subscribe();

        const ideaChannel = supabase.channel("ideas-updates")
            .on("postgres_changes", { event: "*", schema: "public", table: "ideas" }, () => queryClient.invalidateQueries({ queryKey: ["ideas"] }))
            .subscribe();

        const broadcastChannel = supabase.channel("broadcast-updates-exec")
            .on("postgres_changes", { event: "*", schema: "public", table: "broadcasts" }, () => {
                fetchBroadcasts();
            })
            .subscribe();

        channelsRef.current = [requestChannel, ideaChannel, broadcastChannel];
    }, [queryClient, fetchBroadcasts]);

    useEffect(() => {
        setupRealtime();
        return () => channelsRef.current.forEach(ch => supabase.removeChannel(ch));
    }, [setupRealtime]);

    useTabResiliency(
        () => fetchData(true, true),
        isRefreshing,
        setIsRefreshing,
        () => setupRealtime()
    );

    // Toggle completion status
    const toggleIdeaCompletion = async (ideaId: string) => {
        // Find the current idea to get its completion status
        const currentIdea = ideas.find(idea => idea.id === ideaId);
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
            
            toast.success(`Cleared ${completedIds.length} completed directive${completedIds.length > 1 ? 's' : ''}`);
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
    const [selectedIdeaForDelegation, setSelectedIdeaForDelegation] = useState<Idea | null>(null);
    const [isDelegating, setIsDelegating] = useState(false);

    // Enhanced Task Form State
    const [taskDescription, setTaskDescription] = useState("");
    const [attachmentUrl, setAttachmentUrl] = useState("");
    const [assigneeSearch, setAssigneeSearch] = useState("");
    const [isDraft, setIsDraft] = useState(false);
    const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);

    // LIVE OPERATIONS DATA
    const activities = useMemo(() => {
        const items: any[] = [
            // Escalations (Urgent Tasks)
            ...tasks
                .filter((t) => t.priority === "urgent" && !(t as any).signal_cleared)
                .map((t) => ({
                    id: `esc-${t.id}`,
                    category: "escalation",
                    title: "Operation Escalated",
                    description: `Urgent: ${t.title}`,
                    time: t.updated_at || t.created_at,
                    icon: AlertCircle,
                    color: "#ef4444",
                    colorType: "red",
                    priority: "high",
                })),

            // New Staff Members
            ...staff
                .filter((s) => {
                    const createdAt = new Date(s.created_at);
                    const twoDaysAgo = new Date();
                    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
                    return createdAt > twoDaysAgo && !(s as any).signal_cleared;
                })
                .map((s) => ({
                    id: `staff-${s.id}`,
                    category: "staff",
                    title: "New Operative",
                    description: `${s.full_name} joined as ${s.department}`,
                    time: s.created_at,
                    icon: Users,
                    color: "#06b6d4",
                    colorType: "cyan",
                    priority: "medium",
                })),

            // Tasks (Normal/Pending) - Show all new assignments
            ...tasks
                .filter(
                    (t) => t.priority !== "urgent" && t.status === "pending" && !(t as any).signal_cleared,
                )
                .map((t) => ({
                    id: `task-${t.id}`,
                    category: "task",
                    title: "Task Dispatched",
                    description: `${t.title} assigned to ${staff.find((s) => s.id === t.assigned_to)?.full_name || "Operative"}`,
                    time: t.created_at,
                    icon: ClipboardList,
                    color: "#3b82f6",
                    colorType: "blue",
                    priority: "medium",
                })),

            // Completed Tasks (Recent)
            ...completedTasks
                .filter((t) => !(t as any).signal_cleared)
                .slice(0, 5)
                .map((t) => ({
                    id: `completed-${t.id}`,
                    category: "completed",
                    title: "Mission Complete",
                    description: `${t.title} completed by ${staff.find((s) => s.id === t.assigned_to)?.full_name || "Operative"}`,
                    time: t.updated_at,
                    icon: CheckCircle,
                    color: "#10b981",
                    colorType: "green",
                    priority: "low",
                })),

            // New Leads
            ...leads
                .filter((l) => l.status === "new" && !(l as any).signal_cleared)
                .map((l) => ({
                    id: `lead-${l.id}`,
                    category: "lead",
                    title: "New Lead",
                    description: `${l.lead_name}`,
                    time: l.created_at,
                    icon: UserPlus,
                    color: "#f59e0b",
                    colorType: "amber",
                    priority: "medium",
                })),

            // Payments (Converted Leads)
            ...leads
                .filter((l) => l.status === "converted" && !(l as any).signal_cleared)
                .map((l) => ({
                    id: `pay-${l.id}`,
                    category: "payment",
                    title: "Payment Received",
                    description: `Lead conversion: ${l.lead_name}`,
                    time: l.updated_at || l.created_at,
                    icon: DollarSign,
                    color: "#10b981",
                    colorType: "green",
                    priority: "high",
                })),

            // Leave Requests
            ...requests
                .filter((r) => r.type === "leave" && !(r as any).signal_cleared)
                .map((r) => ({
                    id: `leave-${r.id}`,
                    category: "leave",
                    title: "Leave Requested",
                    description: `${r.title} by ${staff.find((s) => s.id === r.submitted_by)?.full_name || "Operative"}`,
                    time: r.created_at,
                    icon: Calendar,
                    color: "#f97316",
                    colorType: "orange",
                    priority: "medium",
                })),

            // Other Requests (Equipment, etc.)
            ...requests
                .filter((r) => r.type !== "leave" && !(r as any).signal_cleared)
                .map((r) => ({
                    id: `req-${r.id}`,
                    category: "request",
                    title: "Resource Request",
                    description: `${r.title} by ${staff.find((s) => s.id === r.submitted_by)?.full_name || "Operative"}`,
                    time: r.created_at,
                    icon: Package,
                    color: "#8b5cf6",
                    colorType: "purple",
                    priority: "medium",
                })),

            // Ideas
            ...ideas.filter((i) => !(i as any).signal_cleared).map((i) => ({
                id: `idea-${i.id}`,
                category: "idea",
                title: "Strategic Idea",
                description: i.title || i.content?.slice(0, 40),
                time: i.created_at,
                icon: Lightbulb,
                color: "#8b5cf6",
                colorType: "purple",
                priority: "medium",
            })),

            // Demo Scheduling
            ...demoRequests.filter((d) => !(d as any).signal_cleared).map((d) => ({
                id: `demo-${d.id}`,
                category: "task",
                title: "Demo Scheduled",
                description: `Session for ${d.lead?.lead_name || "Lead"}`,
                time: d.created_at,
                icon: PhoneCall,
                color: "#3b82f6",
                colorType: "blue",
                priority: "medium",
            })),

        ];

        return items
            .filter((item) => !clearedNotifications.has(item.id))
            .sort((a, b) => {
                // Sort by priority first, then by time
                const priorityOrder = { high: 3, medium: 2, low: 1 };
                const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 1;
                const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 1;
                
                if (aPriority !== bPriority) {
                    return bPriority - aPriority;
                }
                
                return new Date(b.time).getTime() - new Date(a.time).getTime();
            })
            .slice(0, 50); // Increased from 20 to 50
    }, [tasks, ideas, requests, demoRequests, leads, staff, completedTasks, clearedNotifications]);

    
    // Clear Signal Feed
    const clearSignalFeed = () => {
        // Immediately clear client-side for instant feedback
        const currentActivityIds = new Set(activities.map((act) => act.id));
        setClearedNotifications(currentActivityIds);
        
        // Try database updates in background (fire and forget)
        activities.forEach((act) => {
            const [prefix, id] = act.id.split('-');
            
            switch (prefix) {
                case 'esc': // Escalations (urgent tasks)
                case 'task': // Regular tasks
                case 'completed': // Completed tasks
                    supabase
                        .from("tasks")
                        .update({ signal_cleared: true })
                        .eq("id", id); // Fire and forget
                    break;
                case 'pay': // Payments (converted leads)
                case 'lead': // New leads
                    supabase
                        .from("leads")
                        .update({ signal_cleared: true })
                        .eq("id", id); // Fire and forget
                    break;
                case 'leave': // Leave requests
                case 'req': // Other requests
                    supabase
                        .from("requests")
                        .update({ signal_cleared: true })
                        .eq("id", id); // Fire and forget
                    break;
                case 'idea': // Ideas
                    supabase
                        .from("ideas")
                        .update({ signal_cleared: true })
                        .eq("id", id); // Fire and forget
                    break;
                case 'demo': // Demo requests
                    supabase
                        .from("demo_requests")
                        .update({ signal_cleared: true })
                        .eq("id", id); // Fire and forget
                    break;
                case 'staff': // New staff members
                    supabase
                        .from("profiles")
                        .update({ signal_cleared: true })
                        .eq("id", id); // Fire and forget
                    break;
                case 'meeting': // Upcoming meetings
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
                console.error('Error checking table:', error);
                return;
            }

            // Try to update with ceo_reviewed column
            const { error: testError } = await supabase
                .from("tasks")
                .update({ ceo_reviewed: false })
                .eq("status", "completed")
                .limit(1);

            if (testError && testError.message.includes('column "ceo_reviewed" does not exist')) {
                console.log('ceo_reviewed column does not exist, tasks will be filtered by reviewed_at only');
                return;
            }

            console.log('ceo_reviewed column exists');
        } catch (error) {
            console.error('Error ensuring ceo_reviewed column:', error);
        }
    };

    useEffect(() => {
        if (profile?.id) lastValidProfileIdRef.current = profile.id;
    }, [profile?.id]);

    // Fetch data when view becomes active
    useEffect(() => {
        const isVisible = currentView === "command-center" || !currentView;
        isVisibleRef.current = isVisible;
        if (isVisible) {
            console.log('Executive view activated - syncing data');
            fetchData(true, true);
        }
    }, [currentView, fetchData]);

    // Visibility and Initial Load
    useEffect(() => {
        let isMounted = true;

        const handleFocusResync = () => {
            if (!document.hidden && isMounted && isVisibleRef.current) {
                console.log('Tab focused - triggering silent resync');
                fetchData(true, true);
                setupRealtime();
            }
        };

        // Initial load
        if (profile?.id) {
            fetchData(false, false);
            setupRealtime();
        }
        
        window.addEventListener("focus", handleFocusResync);
        document.addEventListener("visibilitychange", handleFocusResync);

        return () => {
            isMounted = false;
            window.removeEventListener("focus", handleFocusResync);
            document.removeEventListener("visibilitychange", handleFocusResync);
        };
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
            window.removeEventListener("fab-action", handleFabAction as EventListener);
        };
    }, []);

    // Computed Stats
    const stats = useMemo(() => {
        // Sort staff by availability: AVAILABLE ??? BUSY ??? IDLE ??? OFFLINE
        const sortedStaff = [...staff].sort((a, b) => {
            const priority = { online: 0, busy: 1, away: 2, offline: 3 };
            return (priority[a.status] ?? 4) - (priority[b.status] ?? 4);
        });

        const staffOnline = sortedStaff.filter(
            (s) => s.status === "online" || s.status === "busy",
        ).length;

        const recentRequests = requests.filter((r) => {
            const created = new Date(r.created_at).getTime();
            const now = new Date().getTime();
            return now - created < 24 * 60 * 60 * 1000;
        });

        let systemStatus: SystemStatus = "STABLE";
        if (recentRequests.length > 5) systemStatus = "WARNING";
        if (
            recentRequests.some(
                (r) => r.priority === "high" || r.priority === "urgent",
            )
        )
            systemStatus = "CRITICAL";

        // Calculate overdue tasks
        const allOverdueTasks = tasks.filter(
            (t) =>
                t.due_date &&
                new Date(t.due_date) < new Date() &&
                t.status !== "completed",
        );

        const todayStr = new Date().toISOString().split("T")[0];

        // Today Summary Metrics
        const tasksAssignedToday = tasks.filter((t) =>
            t.created_at.startsWith(todayStr),
        ).length;
        const paymentsReceivedToday = leads.filter(
            (l) =>
                l.status === "converted" &&
                (l.updated_at || l.created_at).startsWith(todayStr),
        ).length;
        const leavesRequestedToday = requests.filter(
            (r) => r.type === "leave" && r.created_at.startsWith(todayStr),
        ).length;
        const newLeadsToday = leads.filter((l) =>
            l.created_at.startsWith(todayStr),
        ).length;

        // Specialized Metrics for Manager
        const activeBlockers = tasks.filter(t => t.priority === "urgent" && t.status !== "completed").length;
        
        // Operational Velocity Calculation
        const completedTodayCount = completedTasks.filter(t => {
            const updatedDate = new Date(t.updated_at || t.created_at).toISOString().split("T")[0];
            return updatedDate === todayStr;
        }).length;
        const totalToday = tasks.length + completedTodayCount;
        const operationalVelocity = totalToday > 0 ? Math.round((completedTodayCount / totalToday) * 100) : 0;

        return {
            systemStatus,
            decisionsPending: recentRequests.length,
            staffOnline,
            staffTotal: staff.length,
            tasksInProgress: tasks.length,
            recentRequests,
            sortedStaff,
            overdueCount: allOverdueTasks.length,
            tasksAssignedToday,
            paymentsReceivedToday,
            leavesRequestedToday,
            newLeadsToday,
            activeBlockers,
            operationalVelocity,
        };
    }, [staff, requests, tasks, leads, completedTasks]);

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
        console.log('Assign task called with:', { newTask, draft });
        
        if (!newTask.title || !newTask.assignedTo) {
            console.log('Validation failed:', { title: newTask.title, assignedTo: newTask.assignedTo });
            return toast.error("Title and Assignee required");
        }

        // Combine date and time for due_date
        let dueDateTime: string | null = null;
        if (newTask.due_date) {
            if (newTask.due_time) {
                dueDateTime = new Date(`${newTask.due_date}T${newTask.due_time}`).toISOString();
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
            repeat_daily: repeatDaily,
            is_daily_task: repeatDaily,
        };

        // Only include task_description if it has a value
        if (taskDescription) {
            insertPayload.task_description = taskDescription;
        }

        console.log('Insert payload:', insertPayload);

        // Construct a mock task for optimistic insertion immediately
        const mockTask: Task = {
            id: `temp-${Date.now()}`,
            title: newTask.title,
            description: taskDescription || undefined,
            assigned_to: newTask.assignedTo,
            priority: newTask.priority as any,
            status: "pending",
            created_by: profile?.id || "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            due_date: dueDateTime || undefined,
            is_draft: draft,
            is_new: true,
            repeat_daily: repeatDaily,
            is_daily_task: repeatDaily,
            assigned_to_user: staff.find(s => s.id === newTask.assignedTo) ? {
                full_name: staff.find(s => s.id === newTask.assignedTo)?.full_name || "",
                department: staff.find(s => s.id === newTask.assignedTo)?.department || ""
            } : undefined,
            creator: profile ? {
                role: profile.role as any,
                is_manager: profile.is_manager
            } : undefined
        } as any;

        // Cache previous state
        const previousTasks = [...realtimeTasks];

        // Optimistically insert mock task to local state immediately
        setRealtimeTasks(prev => [mockTask, ...prev]);

        // Optimistically clear the form to prevent UI freeze
        setIsAssignTaskOpen(false);
        toast.info(draft ? "Saving draft..." : "Assigning task...");
        resetTaskForm();

        try {
            // Wake up auth session at the millisecond of mutation to prevent transient freezes
            await supabase.auth.getSession();

            const executeInsert = async () => {
                const { data, error } = await supabase
                    .from("tasks")
                    .insert(insertPayload)
                    .select();
                
                if (error) throw error;
                
                if (data && data[0]) {
                    // Update state to use the actual inserted DB ID while preserving relations
                    setRealtimeTasks(prev => 
                        prev.map(t => t.id === mockTask.id ? { ...data[0], assigned_to_user: mockTask.assigned_to_user, creator: mockTask.creator } : t)
                    );
                }
            };

            await Promise.race([
                executeInsert(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Network timeout: The server took too long to respond.")), 15000))
            ]);

            console.log('Task assigned successfully');
            toast.success(draft ? "DRAFT SAVED" : "✓ Task assigned successfully");
        } catch (error: any) {
            console.error("Assign task error:", error);
            toast.error("Failed to assign task: " + error.message);
            // Revert state if failed
            setRealtimeTasks(previousTasks);
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
                    status: 'delegated',
                    assigned_to: staffMember.id,
                    assigned_to_name: staffMember.full_name,
                    delegated_by_manager: profile?.full_name || 'Administrator',
                    updated_at: new Date().toISOString()
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
            const uid = staffToRemove.id;

            // 1. Cascade delete from dependent database tables sequentially client-side
            await supabase.from("tutor_notifications").delete().eq("tutor_id", uid);
            await supabase.from("class_schedules").delete().eq("tutor_id", uid);
            await supabase.from("classes").delete().eq("tutor_id", uid);
            await supabase.from("tutor_availability").delete().eq("tutor_id", uid);
            await supabase.from("daily_reports").delete().or(`profile_id.eq.${uid},user_id.eq.${uid}`);
            await supabase.from("knocks").delete().eq("knocked_by", uid);
            await supabase.from("attendance").delete().eq("user_id", uid);
            await supabase.from("activity_feed").delete().eq("user_id", uid);
            await supabase.from("notifications").delete().eq("user_id", uid);
            await supabase.from("requests").delete().or(`submitted_by.eq.${uid},reviewed_by.eq.${uid}`);
            await supabase.from("tasks").delete().or(`assigned_to.eq.${uid},created_by.eq.${uid}`);
            await supabase.from("ideas").delete().eq("created_by", uid);

            // 2. Try DB RPC
            const { error: cascadeError } = await supabase.rpc('delete_profile_cascade', {
                profile_uuid: uid
            });

            // 3. Force delete the profile row to ensure it is completely wiped
            const { error: deleteError } = await supabase.from("profiles").delete().eq("id", uid);

            if (deleteError && cascadeError) {
                // In case profile delete fails, try to soft-delete
                await supabase.from("profiles").update({ full_name: "[DELETED]", status: "offline" }).eq("id", uid);
            }

            toast.success("OPERATIVE TERMINATED & DATA PURGED");
            queryClient.invalidateQueries({ queryKey: ["staff"] });
            setIsRemoveStaffModalOpen(false);
            setStaffToRemove(null);
            setConfirmName("");
        } catch (e) {
            console.error("Termination failed:", e);
            toast.error("Termination failed");
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
        setDeletingTaskIds(prev => new Set(prev).add(id));
        
        // Cache current tasks
        const previousTasks = [...realtimeTasks];
        
        // Optimistically remove task from local state immediately for instant responsive feel
        setRealtimeTasks(prev => prev.filter(t => t.id !== id));
        toast.success("TASK ANNULLED");

        try {
            // Check current user session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                throw new Error("You must be logged in to delete tasks");
            }
            
            // Background check existence & delete attachment if any
            const { data: existingTask } = await supabase
                .from("tasks")
                .select("*")
                .eq("id", id)
                .single();
            
            if (existingTask) {
                if (existingTask.attachment_url && existingTask.attachment_url.includes('/storage/v1/object/public/')) {
                    try {
                        await deleteFile('attachments', existingTask.attachment_url);
                        console.log("Deleted task attachment from storage");
                    } catch (e) {
                        console.warn("Failed to delete attachment from storage:", e);
                    }
                }
            }
            
            // Delete from DB - Try Approach 1
            let { error: error1, count: count1 } = await supabase
                .from("tasks")
                .delete({ count: 'exact' })
                .eq("id", id);
            
            if (error1 || count1 === 0) {
                // Try Approach 2
                let { error: error2, data } = await supabase.from("tasks").delete().eq("id", id).select();
                
                if (error2 && error2.code === '42501') {
                    // Fallback to update status: deleted
                    const { error: updateError } = await supabase.from("tasks").update({ status: 'deleted' }).eq("id", id);
                    if (updateError) throw updateError;
                }
            }
        } catch (error: any) {
            console.error("Delete task exception:", error);
            toast.error("Failed to delete task. Reverting...");
            // Revert state on exception
            setRealtimeTasks(previousTasks);
        } finally {
            // Remove from deleting set
            setDeletingTaskIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        }
    };

    const removeTaskFromCEO = async (id: string) => {
        // Temporarily disable until database columns are added
        toast.info("Remove from CEO view will be available after database update");
        // await supabase
        //     .from("tasks")
        //     .update({ ceo_visible: false })
        //     .eq("id", id);
        // toast.success("Task hidden from CEO view");
        // fetchData();
    };

    const markTaskAsReviewed = async (id: string) => {
        try {
            // Wake up auth session at the millisecond of mutation to prevent transient freezes
            await supabase.auth.getSession();

            const myRole = profile?.role === "ceo" ? "CEO" : (profile?.designation || profile?.role || "Administrator");
            
            // Find existing task in local state array to bypass DB read query
            const taskToReview = realtimeTasks.find((t) => t.id === id);
            const existing = taskToReview?.reviewed_by_info;

            let newInfo = myRole;
            if (existing) {
                if (!existing.toLowerCase().includes(myRole.toLowerCase())) {
                    newInfo = `${existing} & ${myRole}`;
                } else {
                    newInfo = existing;
                }
            }

            console.log("Marking task as reviewed:", id);
            const reviewedAt = new Date().toISOString();

            // Cache current tasks for rollback
            const previousTasks = [...realtimeTasks];

            // Optimistically update local state immediately
            setRealtimeTasks((prev) =>
                prev.map((t) =>
                    t.id === id
                        ? {
                              ...t,
                              reviewed_at: reviewedAt,
                              ceo_reviewed: true,
                              reviewed_by_info: newInfo,
                          }
                        : t,
                ),
            );

            toast.success("Task reviewed and marked in system");

            const updateData = {
                reviewed_at: reviewedAt,
                reviewed_by_info: newInfo,
            };

            // Try to also update ceo_reviewed if the column exists
            const { error: reviewedError } = await supabase
                .from("tasks")
                .update({
                    ...updateData,
                    ceo_reviewed: true,
                })
                .eq("id", id);

            if (reviewedError) {
                console.error("Mark as reviewed error (ceo_reviewed column):", reviewedError);
                
                // If ceo_reviewed column doesn't exist, update just reviewed_at
                const { error: fallbackError } = await supabase
                    .from("tasks")
                    .update(updateData)
                    .eq("id", id);

                if (fallbackError) {
                    console.error("Fallback update also failed:", fallbackError);
                    toast.error("Failed to mark task as reviewed: " + fallbackError.message);
                    setRealtimeTasks(previousTasks);
                }
            }
        } catch (error) {
            console.error("Mark as reviewed exception:", error);
            toast.error("Something went wrong marking task as reviewed");
        }
    };

    const approveAndCloseTask = async (id: string) => {
        console.log('Approve and close task:', id);
        
        // Cache current tasks
        const previousTasks = [...realtimeTasks];

        // Optimistically update local state status to COMPLETED immediately
        setRealtimeTasks(prev => 
            prev.map(t => t.id === id ? { ...t, status: "COMPLETED", progress: 100, updated_at: new Date().toISOString() } : t)
        );
        
        toast.success("Task approved and marked as completed!");

        try {
            // Wake up auth session at the millisecond of mutation to prevent transient freezes
            await supabase.auth.getSession();

            const { error } = await supabase
                .from("tasks")
                .update({ 
                    status: "COMPLETED",
                    progress: 100,
                    updated_at: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
                .eq("id", id);

            if (error) {
                console.error("Approve and close error:", error);
                toast.error("Failed to approve and close task: " + error.message);
                setRealtimeTasks(previousTasks);
            }
        } catch (error) {
            console.error("Approve and close exception:", error);
            toast.error("Something went wrong approving and closing the task");
            setRealtimeTasks(previousTasks);
        }
    };

    const clearAllCompletedTasks = async () => {
        if (!confirm("Mark all completed tasks as reviewed? This will permanently remove them from CEO view and make them visible to staff.")) return;
        
        try {
            console.log("Clearing all completed tasks...");
            const reviewedAt = new Date().toISOString();
            
            // First try with ceo_reviewed column
            const { error: error1 } = await supabase
                .from("tasks")
                .update({ 
                    ceo_reviewed: true, 
                    reviewed_at: reviewedAt
                })
                .eq("status", "completed")
                .is("reviewed_at", null);
                
            if (error1) {
                console.error("Clear all completed error (with ceo_reviewed):", error1);
                
                // Fallback: update only reviewed_at column
                const { error: error2 } = await supabase
                    .from("tasks")
                    .update({ 
                        reviewed_at: reviewedAt
                    })
                    .eq("status", "completed")
                    .is("reviewed_at", null);
                
                if (error2) {
                    console.error("Clear all completed error (fallback):", error2);
                    toast.error("Failed to clear completed tasks: " + error2.message);
                    return;
                }
                
                console.log("All completed tasks marked as reviewed (fallback)");
            } else {
                console.log("All completed tasks marked as reviewed successfully");
            }
            
            // Clear local state immediately for better UX
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
            
            toast.success("All completed tasks marked as reviewed and removed from CEO view");
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

        await supabase.from("notifications").insert({
            user_id: selectedStaffForChat.id,
            title: "URGENT MESSAGE FROM CEO",
            message: chatMessage.trim(),
            type: "message",
        });

        toast.success(`Message sent to ${selectedStaffForChat.full_name}`);
        setChatMessage("");
        setIsChatModalOpen(false);
        setSelectedStaffForChat(null);
    };

    const openChatModal = (staff: Profile) => {
        setSelectedStaffForChat(staff);
        setIsChatModalOpen(true);
    };

    // Show skeleton loader while initial data is loading
    if (staff.length === 0 && isRefreshing) {
        return <SkeletonCommandCenter />;
    }

    return (
        <div className={cn(
            "min-h-screen relative overflow-hidden font-sans selection:bg-cyber-blue/20 p-6 flex flex-col gap-6 transition-all duration-700 ease-cinematic",
            "bg-[#F4F7FE] text-slate-900 dark:bg-transparent dark:text-white"
        )}>
            {/* Cinematic Mesh Gradient Background Layer */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
                <div className={cn(
                    "absolute top-[-10%] left-[-10%] rounded-full blur-[120px] animate-glow-pulse transition-all duration-1000",
                    "w-[60%] h-[60%] bg-cyber-blue/10"
                )} />
                <div className={cn(
                    "absolute bottom-[10%] right-[-5%] rounded-full blur-[100px] transition-all duration-1000",
                    "w-[50%] h-[50%] bg-cyber-rose/5"
                )} />
                <div className="absolute top-[40%] left-[20%] w-[40%] h-[40%] rounded-full bg-cyber-blue/5 blur-[120px]" />
            </div>

            {/* FLOATING GLASSMORPHIC HEADER */}
            <header className={cn(
                "flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 p-4 md:px-8 md:py-5",
                "bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl rounded-[2.5rem] border border-slate-100 dark:border-zinc-800/60 shadow-[0_12px_40px_rgba(0,0,0,0.03)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)]",                "transition-all duration-500 ease-out"
            )}>
                <div className="flex items-center justify-between md:justify-start gap-6">
                    {/* Usthad Academy Logo - Hidden on mobile */}
                    <div
                        className={cn(
                            "hidden md:flex items-center gap-4 transition-all duration-500",
                            theme === "dark" ? "opacity-90" : ""
                        )}
                    >
                        <div className={cn(
                            "h-[48px] w-[48px] p-2 rounded-2xl shadow-sm border transition-all duration-500",
                            userRole === 'CEO' 
                                ? "bg-white dark:bg-zinc-800 border-amber-200/50 dark:border-amber-900/30 ring-4 ring-amber-500/5" 
                                : "bg-white dark:bg-zinc-800 border-indigo-50/50 dark:border-zinc-700/30"
                        )}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/images/usthadacademylogo2.svg"
                                alt="UA"
                                className="h-full w-full object-contain"
                            />
                        </div>
                        <div className="h-[50px] w-[200px]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
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
                            {userRole === 'CEO' ? 'CEO HUB' : 'ADMINISTRATOR HUB'}
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Academy Management</p>
                    </div>

                    {/* System Health Indicator */}
                    <div
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-500",
                            stats.systemStatus === "STABLE" && stats.overdueCount === 0 
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                                : "bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400"
                        )}
                    >
                        <div
                            className={cn(
                                "w-2 h-2 rounded-full animate-pulse",
                                stats.systemStatus === "STABLE" && stats.overdueCount === 0 ? "bg-emerald-500" : "bg-red-500"
                            )}
                        />
                        <span className="text-[9px] font-black uppercase tracking-widest">
                            {stats.systemStatus === "STABLE" && stats.overdueCount === 0 ? "SYSTEM STABLE" : "ATTENTION REQUIRED"}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 md:gap-4 self-end md:self-auto">
                    {userRole === 'CEO' ? (
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
                            {userRole === 'CEO' ? 'CEO DASHBOARD' : 'ADMINISTRATOR DASHBOARD'}
                        </h1>
                    </div>

                    <ThemeToggle />
                    
                    {/* Visual Online/Offline Connection State Dot */}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/80 shadow-sm transition-all duration-300">
                        <div className={cn(
                            "w-2 h-2 rounded-full transition-all duration-500",
                            isOnline 
                                ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)] animate-pulse" 
                                : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                        )} />
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400 select-none">
                            {isOnline ? "Online" : "Offline"}
                        </span>
                    </div>
                    
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => fetchData()}
                        disabled={isRefreshing}
                        className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-zinc-800/50 border border-white/40 dark:border-zinc-700/50 hover:bg-white dark:hover:bg-zinc-800 rounded-full transition-all duration-300 shadow-sm text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-100"
                    >
                        <RefreshCw
                            className={cn("w-3 h-3", isRefreshing && "animate-spin")}
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
                <div className={cn(
                    "rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group relative overflow-hidden",
                    "bg-white/70 dark:bg-zinc-900/40 backdrop-blur-md border border-white/60 dark:border-zinc-800/50 shadow-[0_12px_40px_rgba(0,0,0,0.02)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",
                    "hover:-translate-y-1 hover:shadow-md dark:hover:border-zinc-700",
                    userRole === 'CEO' && "hover:border-amber-500/30 dark:hover:border-amber-500/30 shadow-[0_10px_40px_rgba(245,158,11,0.03)]"
                )}>
                    {userRole === 'CEO' && (
                        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                    )}
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-[#31267D]/10 dark:bg-indigo-500/20 rounded-xl text-[#31267D] dark:text-indigo-300 group-hover:scale-110 transition-transform">
                            <Users className="w-4 h-4" />
                        </div>
                        <div className="flex -space-x-2">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="w-5 h-5 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shadow-sm">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                </div>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-[0.2em] mb-1">Academy Staffs</p>
                        <div className="flex items-baseline gap-1">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tighter">
                                {stats.staffOnline}
                            </h2>
                            <span className="text-slate-300 dark:text-zinc-700 font-bold">/</span>
                            <h2 className="text-xl font-black text-slate-400 dark:text-zinc-500 tracking-tighter">
                                {stats.staffTotal}
                            </h2>
                        </div>
                    </div>
                </div>

                {/* Card 2: TASKS */}
                <div className={cn(
                    "rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group relative overflow-hidden",
                    "bg-white/70 dark:bg-zinc-900/40 backdrop-blur-md border border-white/60 dark:border-zinc-800/50 shadow-[0_12px_40px_rgba(0,0,0,0.02)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",
                    "hover:-translate-y-1 hover:shadow-md dark:hover:border-zinc-700",
                    userRole === 'CEO' && "hover:border-amber-500/30 dark:hover:border-amber-500/30 shadow-[0_10px_40px_rgba(245,158,11,0.03)]"
                )}>
                    {userRole === 'CEO' && (
                        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                    )}
                    <div className="flex items-center justify-between mb-4">
                        <div className="p-2 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl text-[#31267D] dark:text-indigo-300 group-hover:scale-110 transition-transform">
                            <ListTodo className="w-4 h-4" />
                        </div>
                        <TrendingUp className="w-3.5 h-3.5 text-indigo-300 dark:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-[0.2em] mb-1">Active Operations</p>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tighter">
                            {stats.tasksInProgress}
                        </h2>
                    </div>
                </div>

                {/* Card 3: OVERDUE */}
                <div className={cn(
                    "rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group relative overflow-hidden",
                    "bg-white/70 dark:bg-zinc-900/40 backdrop-blur-md border border-white/60 dark:border-zinc-800/50 shadow-[0_12px_40px_rgba(0,0,0,0.02)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",
                    "hover:-translate-y-1 hover:shadow-md dark:hover:border-zinc-700",
                    userRole === 'CEO' && "hover:border-amber-500/30 dark:hover:border-amber-500/30 shadow-[0_10px_40px_rgba(245,158,11,0.03)]"
                )}>
                    {userRole === 'CEO' && (
                        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse" />
                    )}
                    <div className="flex items-center justify-between mb-4">
                        <div className={cn(
                            "p-2 rounded-xl transition-all shadow-sm",
                            stats.overdueCount > 0 
                                ? "bg-red-500/10 dark:bg-red-500/20 text-red-500 dark:text-red-400 animate-pulse" 
                                : "bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500"
                        )}>
                            <AlertTriangle className="w-4 h-4" />
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-[0.2em] mb-1">Critical Delay</p>
                        <h2 className={cn(
                            "text-2xl font-black tracking-tighter",
                            stats.overdueCount > 0 ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-zinc-100"
                        )}>
                            {stats.overdueCount}
                        </h2>
                    </div>
                </div>

                {/* Card 4: Role-based (Income / Capacity) */}
                {userRole === 'CEO' ? (
                    <div className={cn(
                        "rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group relative overflow-hidden shadow-lg shadow-emerald-500/5",
                        "bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.02)]",
                        "dark:bg-zinc-900/40 dark:backdrop-blur-md dark:border-zinc-800/50 dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",                        "hover:-translate-y-1 hover:shadow-md hover:border-emerald-500/30 dark:hover:border-emerald-500/30"
                    )}>
                        {userRole === 'CEO' && (
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
                            <p className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-[0.2em] mb-1 italic">Today&apos;s Revenue</p>
                            <h2 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">
                                ${(stats.paymentsReceivedToday * 250).toLocaleString()}
                            </h2>
                        </div>
                    </div>
                ) : (
                    <div className={cn(
                        "rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group",
                        "bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.02)]",
                        "dark:bg-zinc-900/40 dark:backdrop-blur-md dark:border-zinc-800/50 dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",                        "hover:-translate-y-1 hover:shadow-md dark:hover:border-zinc-700"
                    )}>
                        <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-blue-500/10 dark:bg-blue-500/20 rounded-xl text-blue-600 dark:text-blue-400 shadow-sm">
                                <Activity className="w-4 h-4" />
                            </div>
                            <div className="w-8 h-8 rounded-full border-2 border-indigo-500/10 flex items-center justify-center">
                                <div className="w-1 h-1 rounded-full bg-indigo-500 animate-ping" />
                            </div>
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-[0.2em] mb-1">Operational Velocity</p>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tighter">
                                {stats.operationalVelocity}%
                            </h2>
                        </div>
                    </div>
                )}

                {/* Card 5: Role-based (Sales / Blockers) */}
                {userRole === 'CEO' ? (
                    <div className={cn(
                        "rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group relative overflow-hidden",
                        "bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.02)]",
                        "dark:bg-zinc-900/40 dark:backdrop-blur-md dark:border-zinc-800/50 dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",                        "hover:-translate-y-1 hover:shadow-md hover:border-blue-500/30 dark:hover:border-blue-500/30"
                    )}>
                        {userRole === 'CEO' && (
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
                            <p className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-[0.2em] mb-1 italic">Market Conversion</p>
                            <div className="flex items-baseline gap-1">
                                <h2 className="text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tighter">
                                    {stats.newLeadsToday}
                                </h2>
                                <span className="text-slate-300 dark:text-zinc-700 font-black">/</span>
                                <h2 className="text-xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">
                                    {stats.paymentsReceivedToday}
                                </h2>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className={cn(
                        "rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 group",
                        "bg-white/70 backdrop-blur-md border border-white/60 shadow-[0_12px_40px_rgba(0,0,0,0.02)]",
                        "dark:bg-zinc-900/40 dark:backdrop-blur-md dark:border-zinc-800/50 dark:shadow-[0_12px_40px_rgba(0,0,0,0.4)]",                        "hover:-translate-y-1 hover:shadow-md dark:hover:border-zinc-700"
                    )}>
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
                            <p className="text-[10px] font-black text-slate-400 dark:text-zinc-400 uppercase tracking-[0.2em] mb-1">Active Blockers</p>
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
                                    {userRole === 'CEO' && (
                                        <button
                                            onClick={clearSignalFeed}
                                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                            title="Clear Signal Feed"
                                            disabled={activities.length === 0}
                                        >
                                            <Trash2
                                                className={cn(
                                                    "w-3.5 h-3.5",
                                                    activities.length === 0 ? "text-slate-300 dark:text-zinc-700" : "text-slate-400 dark:text-zinc-500 hover:text-red-500 transition-colors"
                                                )}
                                            />
                                        </button>
                                    )}
                                    <RefreshCw
                                        className={cn("w-3.5 h-3.5 text-slate-400 dark:text-zinc-500", isRefreshing && "animate-spin")}
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
                                                            initial={{ opacity: 0, x: -5 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            transition={{ delay: index * 0.05 }}
                                                            className="relative group pr-1 transition-all duration-300 hover:bg-slate-50/50 dark:hover:bg-zinc-800/30 p-2 rounded-xl"
                                                        >
                                                            {/* Timeline Dot */}
                                                            <div
                                                                className="absolute -left-[12.5px] top-3 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-zinc-900 z-10 transition-transform group-hover:scale-125 shadow-sm ring-4 ring-offset-0 ring-indigo-500/10 dark:ring-indigo-500/20"
                                                                style={{ backgroundColor: act.color }}
                                                            />

                                                            <div className="flex flex-col gap-1.5">
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                                        <act.icon
                                                                            className="w-3 h-3 shrink-0 opacity-80"
                                                                            style={{ color: act.color }}
                                                                        />
                                                                        <span className="text-[10px] font-black uppercase tracking-tight text-slate-900 dark:text-zinc-100 truncate">
                                                                            {act.title}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[8px] font-bold text-slate-400 dark:text-zinc-500 tabular-nums shrink-0 uppercase tracking-tighter">
                                                                        {format(parseISO(act.time || new Date().toISOString()), "HH:mm")}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-relaxed line-clamp-2 pl-5">
                                                                    {act.description}
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

                    {departmentFilter === "ceo" && (
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
                                className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                                    taskTab === "overdue"
                                        ? "bg-amber-500 text-theme-inv-text shadow-lg shadow-amber-500/20"
                                        : "text-theme-text-40 hover:text-theme-text hover:bg-theme-bg-white-10"
                                }`}
                            >
                                Overdue
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
                                {completedTasks.length > 0 && (
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full min-w-[16px] inline-flex items-center justify-center font-black transition-all ${
                                        taskTab === "completed" 
                                            ? "bg-white/20 text-white" 
                                            : "bg-blue-600/90 text-white shadow-sm"
                                    }`}>
                                        {completedTasks.length}
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
                    )}

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
                            {userRole === 'CEO' ? 'All' : 'My Tasks'}
                        </button>
                        <button
                            onClick={() => setDepartmentFilter("administration")}
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
                            onClick={() => setDepartmentFilter("accounts")}
                            className={`px-3 md:px-4 py-1.5 md:py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex-shrink-0 ${
                                departmentFilter === "accounts"
                                    ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                                    : "text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-100"
                            }`}
                        >
                            Accounts
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
                            {displayedTasks.length === 0 ? (
                                (() => {
                                    if (isRefreshing && staff.length === 0) {
                                        return <SkeletonCommandCenter />;
                                    }
                                    return (
                                        <div className="h-48 border border-dashed border-indigo-500/20 dark:border-zinc-800 text-center text-slate-400 dark:text-zinc-500 text-[11px] uppercase font-black tracking-widest rounded-[2rem] bg-white/40 dark:bg-zinc-900/20 flex flex-col items-center justify-center gap-3 transition-all shadow-inner">
                                            <div className="p-3 bg-white/50 dark:bg-zinc-800/50 rounded-full shadow-sm">
                                                <CheckCircle className="w-6 h-6 text-indigo-500/60 dark:text-indigo-400/60" />
                                            </div>
                                            <span>
                                                {taskTab === "completed" ? "Archive cleared" : 
                                                 departmentFilter === "ceo" ? "No active operations identified" :
                                                 departmentFilter === "sales" ? "Sales sector quiet" :
                                                 departmentFilter === "marketing" ? "Marketing sector quiet" :
                                                 departmentFilter === "accounts" ? "Accounts sector quiet" :
                                                 departmentFilter === "administration" ? "Admin sector quiet" :
                                                 "Awaiting task deployment..."}
                                            </span>
                                        </div>
                                    );
                                })()
                            ) : (
                                displayedTasks.map((t) => {
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
                                                    : t.status === "completed"
                                                      ? "border-l-emerald-500 dark:border-l-emerald-600"
                                                      : "border-l-indigo-500 dark:border-l-indigo-600",
                                                isOverdue
                                                    ? "border-r-red-500/10 border-y-red-500/10"
                                                    : "border-white/40 dark:border-zinc-800/50"
                                            )}
                                        >
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="text-sm font-black text-slate-900 dark:text-zinc-100 leading-tight uppercase truncate max-w-[220px] sm:max-w-[320px]">
                                                        {t.title}
                                                    </h4>
                                                    {(t as any).creator && (
                                                        <Badge variant="outline" className={cn(
                                                            "text-[9px] px-2.5 py-0.5 h-5 border-none font-black uppercase tracking-widest flex items-center gap-1.5",
                                                            (t as any).creator.role === 'ceo' 
                                                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.05)]" 
                                                                : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.05)]"
                                                        )}>
                                                            {(t as any).creator.role === 'ceo' ? (
                                                                <>
                                                                    <Crown className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
                                                                    {(t as any).creator.full_name || "Saleem"} (CEO)
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Zap className="w-2.5 h-2.5 text-indigo-500 animate-pulse" />
                                                                    {(t as any).creator.full_name || "Administrator"} ({(t as any).creator.designation || "Administrator"})
                                                                </>
                                                            )}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-slate-400 dark:text-zinc-400 font-medium tracking-wide line-clamp-2 leading-relaxed mt-1">
                                                    {t.description ||
                                                        "No operational description provided."}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                {renderCEOTaskGauge(t)}
                                                <Badge
                                                    className={cn(
                                                        "text-[8px] uppercase font-black px-2.5 py-1 flex items-center gap-1.5 border-none shadow-none shrink-0",
                                                        isOverdue
                                                            ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                                            : (() => {
                                                                const s = (t.status || "PENDING").toUpperCase();
                                                                if (s === "PENDING") return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
                                                                if (s === "IN_PROGRESS") return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
                                                                if (s === "UNDER_REVIEW" || s === "IN_REVIEW") return "bg-purple-500/10 text-purple-600 dark:text-purple-400 animate-pulse";
                                                                if (s === "COMPLETED") return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
                                                                return "bg-slate-500/10 text-slate-600 dark:text-slate-400";
                                                            })()
                                                    )}
                                                >
                                                {(isOverdue || t.priority === "urgent") && (
                                                    <AlertTriangle className="w-2.5 h-2.5" />
                                                )}
                                                {(() => {
                                                    if (isOverdue) return "OVERDUE";
                                                    const s = (t.status || "PENDING").toUpperCase();
                                                    if (s === "PENDING") return "PENDING";
                                                    if (s === "IN_PROGRESS") return "IN PROGRESS";
                                                    if (s === "UNDER_REVIEW" || s === "IN_REVIEW") return "UNDER REVIEW";
                                                    if (s === "COMPLETED") return "COMPLETED";
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
                                                    disabled={!assignee}
                                                    className="flex items-center gap-2 hover:bg-theme-bg-white-5 p-1 -ml-1 rounded transition-colors group/staff"
                                                >
                                                    <div className="w-5 h-5 rounded-full bg-theme-bg-white-10 border border-theme-border-20 flex items-center justify-center text-[8px] font-black text-theme-text-60 uppercase">
                                                        {assignee?.full_name?.charAt(
                                                            0,
                                                        ) || "?"}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-theme-text-60 group-hover/staff:text-theme-text transition-colors uppercase">
                                                        {assignee?.full_name || "Unassigned"}
                                                        <span className="ml-1 opacity-50 font-medium">
                                                            ({assignee?.designation || assignee?.department || assignee?.role || "Staff"})
                                                        </span>
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
                                                {taskTab === "completed" ? (
                                                    (t.reviewed_at || (t as any).ceo_reviewed) ? (
                                                        <span className="h-8 px-3 text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 flex items-center gap-1.5">
                                                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                                                            Reviewed ({(t as any).reviewed_by_info || "Management"})
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={() => markTaskAsReviewed(t.id)}
                                                            className="h-8 px-4 text-[9px] font-black uppercase bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl transition-all border-none shadow-sm"
                                                        >
                                                            Mark Reviewed
                                                        </button>
                                                    )
                                                ) : (
                                                    <button
                                                        onClick={() => deleteTask(t.id)}
                                                        disabled={deletingTaskIds.has(t.id)}
                                                        className={cn(
                                                            "p-2.5 rounded-xl transition-all duration-300 border-none flex items-center justify-center group/btn",
                                                            deletingTaskIds.has(t.id)
                                                                ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400'
                                                                : 'text-slate-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30'
                                                        )}
                                                        title="Terminate Operation"
                                                    >
                                                        {deletingTaskIds.has(t.id) ? (
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
                            })
                        )}
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
                                    title={userRole === 'CEO' ? "CEO Directives" : "Administrator Directives"}
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
                                                <p className="text-sm font-black text-slate-900 dark:text-zinc-100 line-clamp-1">{directive.title}</p>
                                                <p className="text-[10px] text-slate-400 dark:text-zinc-500 line-clamp-2 mt-1 leading-relaxed font-medium">{directive.message}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between mt-3">
                                            <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-600 border-none px-2 py-0.5">
                                                {directive.priority || 'Normal'}
                                            </Badge>
                                            <p className="text-[8px] font-bold text-slate-300 dark:text-zinc-600 uppercase tracking-tighter">
                                                {format(new Date(directive.created_at), 'MMM d, h:mm a')}
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
                                placeholder={userRole === 'CEO' ? "Capture a Strategic CEO Directive..." : "Log an administrator task update..."}
                            />
                            
                            {visibleIdeas.length > 0 && (
                                <div className="flex flex-col gap-3">
                                    {visibleIdeas.slice().sort((a, b) => {
                                        const aDone = completedIdeas.has(a.id);
                                        const bDone = completedIdeas.has(b.id);
                                        return aDone === bDone ? 0 : aDone ? 1 : -1;
                                    }).map((idea) => {
                                        const isCompleted = completedIdeas.has(idea.id);
                                        return (
                                            <div
                                                key={idea.id}
                                                className={cn(
                                                    "group flex flex-col gap-3 p-4 rounded-2xl transition-all duration-500 border relative overflow-hidden",
                                                    isCompleted
                                                        ? "bg-slate-50 dark:bg-zinc-800/20 border-slate-100 dark:border-zinc-800 opacity-60 shadow-inner"
                                                        : "bg-white/40 dark:bg-zinc-900/20 backdrop-blur-md border border-white/60 dark:border-zinc-800/50 hover:bg-white/60 dark:hover:bg-zinc-900/40 hover:shadow-md shadow-sm"
                                                )}
                                            >
                                                <div className={cn(
                                                    "absolute left-0 top-0 bottom-0 w-1 transition-all duration-500",
                                                    isCompleted ? "bg-emerald-500/50" : (
                                                        idea.priority === 'urgent' ? "bg-red-500" : 
                                                        idea.priority === 'high' ? "bg-orange-500" : "bg-indigo-400"
                                                    )
                                                )} />

                                                <div className="flex justify-between items-start gap-4 relative z-10 pl-1">
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className={cn(
                                                            "text-[11px] font-black uppercase tracking-widest truncate",
                                                            isCompleted ? "text-slate-400 dark:text-zinc-500 line-through" : "text-slate-900 dark:text-zinc-100"
                                                        )}>
                                                            {idea.title || 'Untitled Directive'}
                                                        </h4>
                                                        <p className={cn(
                                                            "text-[10px] font-medium leading-relaxed mt-1",
                                                            isCompleted ? "text-slate-300 dark:text-zinc-600 line-through italic" : "text-slate-400 dark:text-zinc-500"
                                                        )}>
                                                            {idea.content}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleIdeaCompletion(idea.id)}
                                                        className={cn(
                                                            "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300",
                                                            isCompleted ? "bg-emerald-500 text-white" : "bg-slate-50 dark:bg-zinc-800 text-slate-300 hover:text-emerald-500"
                                                        )}
                                                    >
                                                        <Check className="w-4 h-4" strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </CommandCard>
                    
                    {/* Community Board & Broadcasts Section */}
                    <CommandCard className="flex flex-col gap-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <SectionHeader
                                    title="Community Board & Broadcasts"
                                    color="bg-indigo-500"
                                    className="mb-0"
                                />
                                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500 text-[10px] font-black text-white shadow-lg shadow-indigo-500/20">
                                    {broadcasts.length}
                                </div>
                            </div>
                        </div>

                        {broadcasts.length === 0 ? (
                            <div className="p-8 text-center bg-gray-50/50 dark:bg-zinc-900/10 rounded-2xl border border-dashed border-gray-200 dark:border-zinc-800">
                                <p className="text-[10px] text-gray-400 dark:text-zinc-500 font-bold uppercase tracking-widest">No active broadcasts found</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                {broadcasts.map((b) => {
                                    const isCommunity = b.target === "COMMUNITY_BOARD";
                                    const isCeo = userRole === 'CEO' || profile?.role === 'ceo';
                                    return (
                                        <div
                                            key={b.id}
                                            className="p-4 rounded-2xl border border-white/60 dark:border-zinc-800/50 bg-white/40 dark:bg-zinc-900/20 backdrop-blur-md hover:bg-white/60 dark:hover:bg-zinc-900/40 hover:shadow-md transition-all group relative overflow-hidden"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                        <Badge className={cn(
                                                            "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 border-none",
                                                            isCommunity 
                                                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" 
                                                                : "bg-[#31267D]/10 text-[#31267D] dark:text-indigo-400"
                                                        )}>
                                                            {isCommunity ? "Community Board" : "CEO Broadcast"}
                                                        </Badge>
                                                        {b.type && (
                                                            <Badge className="text-[8px] font-bold uppercase tracking-wide bg-gray-150/50 text-gray-650 dark:bg-zinc-800 dark:text-zinc-400 px-2 py-0.5 border-none">
                                                                {b.type}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-800 dark:text-zinc-200 leading-relaxed break-words">{b.message}</p>
                                                    
                                                    <div className="flex items-center gap-2 mt-3 text-[8px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-tight">
                                                        <span>Sent by {b.profile?.full_name || "Executive"}</span>
                                                        <span>•</span>
                                                        <span>{format(new Date(b.created_at), 'MMM d, h:mm a')}</span>
                                                    </div>
                                                </div>

                                                {isCeo && (
                                                    <button
                                                        onClick={() => handleDeleteBroadcast(b.id)}
                                                        disabled={isDeletingBroadcast === b.id}
                                                        className="p-1.5 rounded-xl bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 active:scale-95 shrink-0 self-start animate-in fade-in zoom-in-50 duration-200"
                                                        title="Delete Broadcast"
                                                    >
                                                        {isDeletingBroadcast === b.id ? (
                                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-3.5 h-3.5 stroke-[2px]" />
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CommandCard>

                    <ExecutivePerformanceEngine tasks={tasks} completedTasks={completedTasks} />
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
                <DialogContent className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 max-w-md rounded-3xl shadow-2xl overflow-hidden p-0 flex flex-col max-h-[85vh]">
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
                                                            staff.find(
                                                                (s) =>
                                                                    s.id ===
                                                                    newTask.assignedTo,
                                                            )?.avatar_url
                                                        }
                                                    />
                                                    <AvatarFallback className="bg-[#351e6a] text-white text-[9px] font-black">
                                                        {staff
                                                            .find(
                                                                (s) =>
                                                                    s.id ===
                                                                    newTask.assignedTo,
                                                            )
                                                            ?.full_name?.substring(
                                                                0,
                                                                2,
                                                            )
                                                            .toUpperCase()}
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
                                                                                            s.avatar_url
                                                                                        }
                                                                                    />
                                                                                    <AvatarFallback className="bg-[#2D2A77]/10 text-[#2D2A77] dark:text-white text-[9px] font-black">
                                                                                        {s.full_name
                                                                                            ?.substring(
                                                                                                0,
                                                                                                2,
                                                                                            )
                                                                                            .toUpperCase()}
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

                            {/* SECTION 5: Repeat Daily Option Switch */}
                            <div className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5">
                                <div className="space-y-0.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-[#1a1a2e] dark:text-white">
                                        Repeat Daily
                                    </label>
                                    <p className="text-[9px] text-gray-400 dark:text-white/40 leading-normal">
                                        Automatically assign this task to the selected staff member every day.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setRepeatDaily(!repeatDaily)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${repeatDaily ? "bg-orange-500" : "bg-gray-200 dark:bg-zinc-800"}`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${repeatDaily ? "translate-x-6" : "translate-x-1"}`}
                                    />
                                </button>
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
                                console.log('Assign task button clicked');
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
                <DialogContent className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 max-w-lg rounded-3xl shadow-2xl overflow-hidden p-0 flex flex-col max-h-[90vh]">
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
                                        <ClipboardList className="h-5 w-5 text-[#e86123]" />
                                    </div>
                                    Full Staff Dossier
                                </DialogTitle>
                                <p className="text-theme-text-40 text-xs font-bold uppercase tracking-widest ml-14">
                                    Comprehensive Personnel Overview
                                </p>
                            </div>
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
                                                        src={s.avatar_url}
                                                    />
                                                    <AvatarFallback className="bg-theme-bg-white-10 text-theme-text font-black">
                                                        {s.full_name
                                                            ?.substring(0, 2)
                                                            .toUpperCase()}
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
            <Dialog open={isDelegationModalOpen} onOpenChange={setIsDelegationModalOpen}>
                <DialogContent className="bg-white/95 backdrop-blur-2xl border-slate-200 text-slate-900 max-w-md rounded-3xl shadow-2xl p-6 overflow-hidden">
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
                                        const activeTasksCount = tasks.filter(t => t.assigned_to === member.id && t.status !== 'completed').length;
                                        return (
                                            <button
                                                key={member.id}
                                                onClick={() => handleDelegation(member)}
                                                disabled={isDelegating}
                                                className="w-full flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 bg-white hover:border-indigo-500/50 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-300 group relative overflow-hidden"
                                            >
                                                <div className="flex items-center gap-3.5 relative z-10">
                                                    <div className="relative">
                                                        <Avatar className="w-11 h-11 border-2 border-white shadow-sm ring-1 ring-slate-100">
                                                            <AvatarImage src={member.avatar_url} />
                                                            <AvatarFallback className="bg-gradient-to-br from-indigo-50 to-slate-100 text-indigo-700 font-bold text-sm">
                                                                {member.full_name?.split(' ').map(n => n[0]).join('')}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full shadow-sm" />
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                                                            {member.full_name}
                                                        </p>
                                                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mt-0.5">
                                                            {member.department || 'Operations'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1.5 relative z-10">
                                                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${
                                                        activeTasksCount > 3 
                                                            ? 'bg-amber-50 border-amber-100 text-amber-600' 
                                                            : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                                                    }`}>
                                                        <span className="text-[9px] font-black uppercase tracking-tight">
                                                            {activeTasksCount} Load
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
