"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Task, Profile } from "@/lib/supabase";

import {
    Users,
    Target,
    Rocket,
    CheckCircle2,
    CheckCircle,
    XCircle,
    Clock,
    Zap,
    Calendar,
    Search,
    ChevronDown,
    Send,
    ChevronRight,
    Bell,
    LogOut,
    Settings,
    Video,
    MapPin,
    FileText,
    Crown,
    Radio,
    Wifi,
    Power,
    AlertTriangle,
    LayoutDashboard,
    Sparkles,
    Coffee,
    Smile,
    Activity,
    Plus,
    Lightbulb,
    RefreshCw,
    AlertCircle,
    Briefcase,
    TrendingUp,
    UserCheck,
    MoreHorizontal,
    Filter,
    Check,
    X,
    Info,
    Sun,
    Moon,
    BarChart3,
    Shield,
    UserPlus,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import Link from "next/link";
import { RequestModal } from "@/components/RequestModal";
import { LeaveRequestModal } from "@/components/LeaveRequestModal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfileModal } from "@/components/ProfileModal";
import { cn } from "@/lib/utils";

// Brand colors - Professional Navy, White, Orange (Matching Staff Hub)
const BRAND = {
    navy: "#2F1E73",
    orange: "#F15A24",
    lightNavy: "#3F348C",
    softOrange: "#FEF2EE",
    bg: "#F4F7FE",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    cardBg: "#FFFFFF",
};

interface ManagerCommandCenterProps {
    className?: string;
    department?: "Sales" | "Marketing" | "Finance" | "Administration";
    dashboardTitle?: string;
}

export function ManagerCommandCenter({
    className,
    department: propDepartment,
    dashboardTitle,
}: ManagerCommandCenterProps) {
    const { profile, user, signOut } = useAuth();
    const router = useRouter();

    // Use prop department if provided, otherwise fallback to profile department
    const department = useMemo(() => {
        return propDepartment || (profile?.department as any) || "Sales";
    }, [propDepartment, profile]);

    // State
    const [staffData, setStaffData] = useState<any[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
    const [expandedTask, setExpandedTask] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("ALL");
    const [showCompleted, setShowCompleted] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    // Community Board (Ideas) state
    const [communityIdeas, setCommunityIdeas] = useState<any[]>([]);

    // Task assignment state (CEO style)
    const [isAssignTaskOpen, setIsAssignTaskOpen] = useState(false);
    const [newTask, setNewTask] = useState({
        title: "",
        assignedTo: "",
        priority: "medium",
        due_date: "",
        due_time: "",
    });
    const [taskDescription, setTaskDescription] = useState("");
    const [assigneeSearch, setAssigneeSearch] = useState("");
    const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
    const [isDraft, setIsDraft] = useState(false);
    const [repeatDaily, setRepeatDaily] = useState(false);

    // Request Modals state
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

    // Get manager's department access
    const managerDepartmentAccess = useMemo(() => {
        if (department) return [department];
        const dep = profile?.department as any;
        return dep ? [dep] : ["Sales"];
    }, [profile, department]);

    // Filter staff for the Personnel card (only department staff)
    const accessibleStaff = useMemo(() => {
        if (!managerDepartmentAccess) return staffData;
        return staffData.filter((staff) =>
            managerDepartmentAccess.includes(staff.department),
        );
    }, [staffData, managerDepartmentAccess]);

    // Filtered Staff for Search in Task Assignment (Department only)
    const filteredStaffForSearch = useMemo(() => {
        return accessibleStaff.filter((s) =>
            s.name.toLowerCase().includes(assigneeSearch.toLowerCase()),
        );
    }, [accessibleStaff, assigneeSearch]);

    // Fetching data
    const fetchTasks = async () => {
        if (!profile) return;
        try {
            let activeQuery = supabase
                .from("tasks")
                .select("*, creator:created_by(id, full_name, role, designation)")
                .in("status", ["pending", "in_progress"]);

            let completedQuery = supabase
                .from("tasks")
                .select("*, creator:created_by(id, full_name, role, designation)")
                .eq("status", "completed")
                .is("reviewed_at", null);

            if (managerDepartmentAccess) {
                const accessibleStaffIds = staffData
                    .filter(
                        (s) =>
                            s.department &&
                            managerDepartmentAccess.includes(s.department),
                    )
                    .map((s) => s.id);
                accessibleStaffIds.push(profile.id);

                activeQuery = activeQuery.in("assigned_to", accessibleStaffIds);
                completedQuery = completedQuery.in(
                    "assigned_to",
                    accessibleStaffIds,
                );
            }

            const [activeRes, completedRes] = await Promise.all([
                activeQuery.order("created_at", { ascending: false }),
                completedQuery.order("updated_at", { ascending: false }),
            ]);

            if (activeRes.data) setTasks(activeRes.data);
            if (completedRes.data) setCompletedTasks(completedRes.data);
        } catch (error) {
            console.error("Error fetching tasks:", error);
        }
    };

    const fetchStaffData = async () => {
        if (!profile) return;
        try {
            const { data } = await supabase
                .from("profiles")
                .select("*")
                .neq("role", "ceo")
                .neq("id", profile?.id as any)
                .order("full_name");

            if (data) {
                const transformedStaff = data.map((staff: any) => ({
                    id: staff.id,
                    name: staff.full_name,
                    role: staff.designation || staff.role || "Staff",
                    department: staff.department || "Administration",
                    email: staff.email,
                    status: staff.status || "offline",
                    avatar:
                        staff.full_name
                            ?.split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase() || "NA",
                    avatar_url: staff.avatar_url,
                }));
                setStaffData(transformedStaff);
            }
        } catch (error) {
            console.error("Error fetching staff data:", error);
        }
    };

    const fetchCommunityBoard = async () => {
        try {
            const { data, error } = await supabase
                .from("ideas")
                .select("*")
                .eq("archived", false)
                .order("created_at", { ascending: false })
                .limit(10);

            if (data) setCommunityIdeas(data);
        } catch (error) {
            console.error("Error fetching community board:", error);
        }
    };

    useEffect(() => {
        if (profile) {
            fetchStaffData();
            fetchCommunityBoard();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile]);

    useEffect(() => {
        if (profile && staffData.length > 0) {
            fetchTasks();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile, staffData]);

    // Task Assignment Logic (CEO style)
    const assignTask = async (draft = false) => {
        if (!newTask.title || !newTask.assignedTo) {
            return toast.error("Title and Assignee required");
        }

        let dueDateTime: string | null = null;
        if (newTask.due_date) {
            dueDateTime = newTask.due_time
                ? new Date(
                      `${newTask.due_date}T${newTask.due_time}`,
                  ).toISOString()
                : new Date(newTask.due_date).toISOString();
        }

        const insertPayload = {
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

        try {
            const { error } = await supabase
                .from("tasks")
                .insert(insertPayload);
            if (error) throw error;

            toast.success(
                draft ? "DRAFT SAVED" : "✓ Task assigned successfully",
            );
            setIsAssignTaskOpen(false);
            resetTaskForm();
            fetchTasks();
        } catch (error: any) {
            toast.error("Failed to assign task: " + error.message);
        }
    };

    const resetTaskForm = () => {
        setNewTask({
            title: "",
            assignedTo: "",
            priority: "medium",
            due_date: "",
            due_time: "",
        });
        setTaskDescription("");
        setAssigneeSearch("");
        setIsDraft(false);
        setShowAssigneeDropdown(false);
        setRepeatDaily(false);
    };

    const updateTaskProgress = async (id: string, progress: number) => {
        try {
            const { error } = await supabase
                .from("tasks")
                .update({
                    progress,
                    status: progress === 100 ? "completed" : "in_progress",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", id);
            if (error) throw error;
            if (progress === 100) {
                toast.success("Task completed!");
                fetchTasks();
            }
        } catch (error) {
            toast.error("Failed to update progress");
        }
    };

    const markTaskAsCompleted = async (id: string) => {
        try {
            const { error } = await supabase
                .from("tasks")
                .update({
                    status: "completed",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", id);
            if (error) throw error;
            toast.success("Task marked as completed");
            fetchTasks();
        } catch (error) {
            toast.error("Failed to update task");
        }
    };

    const markTaskAsReviewed = async (id: string) => {
        try {
            // Get current task to see existing reviewers
            const { data: taskData } = await supabase
                .from("tasks")
                .select("reviewed_by_info")
                .eq("id", id)
                .single();

            const myRole =
                profile?.role === "ceo"
                    ? "CEO"
                    : profile?.designation || profile?.role || "Manager";
            
            let newInfo = myRole;
            if (taskData?.reviewed_by_info) {
                const existing = taskData.reviewed_by_info;
                if (!existing.toLowerCase().includes(myRole.toLowerCase())) {
                    newInfo = `${existing} & ${myRole}`;
                } else {
                    newInfo = existing;
                }
            }

            const { error } = await supabase
                .from("tasks")
                .update({
                    reviewed_at: new Date().toISOString(),
                    reviewed_by_info: newInfo,
                })
                .eq("id", id);
            if (error) throw error;
            toast.success("Task marked as reviewed");
            fetchTasks();
        } catch (error) {
            toast.error("Failed to review task");
        }
    };

    const markAllAsReviewed = async () => {
        if (completedTasks.length === 0) return;
        if (
            !confirm(
                `Mark all ${completedTasks.length} completed tasks as reviewed?`,
            )
        )
            return;
        try {
            const { error } = await supabase
                .from("tasks")
                .update({ reviewed_at: new Date().toISOString() })
                .in(
                    "id",
                    completedTasks.map((t) => t.id),
                );
            if (error) throw error;
            toast.success("All tasks reviewed");
            fetchTasks();
        } catch (error) {
            toast.error("Failed to review all tasks");
        }
    };

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12)
            return {
                text: "Good Morning",
                icon: <Sun className="w-8 h-8 text-orange-400" />,
            };
        if (hour < 18)
            return {
                text: "Good Afternoon",
                icon: <Sun className="w-8 h-8 text-orange-500" />,
            };
        return {
            text: "Good Evening",
            icon: <Moon className="w-8 h-8 text-indigo-400" />,
        };
    }, []);

    const [currentDateTime, setCurrentDateTime] = useState("");
    useEffect(() => {
        const update = () =>
            setCurrentDateTime(format(new Date(), "EEEE, MMMM do | h:mm a"));
        update();
        const interval = setInterval(update, 60000);
        return () => clearInterval(interval);
    }, []);

    const filteredTasks = useMemo(() => {
        if (showCompleted) return completedTasks;
        return tasks.filter((task) => {
            if (activeTab === "ALL") return true;
            if (activeTab === "URGENT") return task.priority === "urgent";
            if (activeTab === "DAILY") return task.is_daily_task;
            return false;
        });
    }, [tasks, completedTasks, activeTab, showCompleted]);

    const getPriorityStyle = (priority: string) => {
        switch (priority) {
            case "urgent":
            case "high":
                return "bg-red-100 text-red-700 border-red-200";
            case "daily":
            case "medium":
                return "bg-blue-100 text-blue-700 border-blue-200";
            case "routine":
            case "low":
            case "normal":
                return "bg-slate-100 text-slate-700 border-slate-200";
            default:
                return "bg-slate-100 text-slate-700 border-slate-200";
        }
    };

    const getPriorityIcon = (priority: string) => {
        switch (priority) {
            case "urgent":
                return <AlertCircle className="w-3 h-3" />;
            case "high":
                return <TrendingUp className="w-3 h-3" />;
            case "medium":
                return <CheckCircle2 className="w-3 h-3" />;
            case "low":
                return <CheckCircle2 className="w-3 h-3" />;
            default:
                return <CheckCircle2 className="w-3 h-3" />;
        }
    };

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
                <span className="text-sm font-black text-slate-800 tracking-tight">
                    {progress}%
                </span>
                <div className="relative w-8 h-8 flex-shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            cx="16"
                            cy="16"
                            r={radius}
                            className="stroke-slate-100 fill-none"
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
                            <Check className="w-3 h-3 text-emerald-500" />
                        ) : s === "PENDING" ? (
                            <Zap className="w-2.5 h-2.5 text-orange-500 fill-orange-500/10" />
                        ) : s === "UNDER_REVIEW" || s === "IN_REVIEW" ? (
                            <Clock className="w-2.5 h-2.5 text-purple-500 animate-pulse" />
                        ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div
            className={`min-h-screen ${className}`}
            style={{ backgroundColor: BRAND.bg }}
        >
            {/* CLEAN ADMINISTRATOR-STYLE HEADER */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50 hidden md:block">
                <div className="max-w-[1700px] mx-auto px-4 md:px-8 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#2F1E73] rounded-xl flex items-center justify-center shadow-lg shadow-[#2F1E73]/20">
                                <div className="text-white text-[10px] font-black tracking-widest">
                                    UA
                                </div>
                            </div>
                            <div>
                                <h1 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                    {department} Management Portal
                                </h1>
                            </div>
                        </div>

                        {/* Profile & Logout */}
                        <div className="flex items-center gap-4">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                    {profile?.full_name || "Manager"}
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    {profile?.designation ||
                                        `${department} Department Head`}
                                </p>
                            </div>
                            <div
                                onClick={() => setIsProfileModalOpen(true)}
                                className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-lg overflow-hidden cursor-pointer hover:scale-105 transition-transform duration-300"
                                style={{
                                    background: `linear-gradient(135deg, ${BRAND.navy}, ${BRAND.orange})`,
                                }}
                            >
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    (profile?.full_name || "M")
                                        .split(" ")
                                        .map((n: string) => n[0])
                                        .join("")
                                        .slice(0, 2)
                                        .toUpperCase()
                                )}
                            </div>
                            <button
                                onClick={() => signOut()}
                                className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all border border-slate-100"
                            >
                                <Power className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="p-4 md:p-8 max-w-[1700px] mx-auto grid grid-cols-12 gap-4 md:gap-8">
                {/* Greeting Banner */}
                <div className="col-span-12">
                    <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 border border-slate-100 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between relative overflow-hidden">
                        <div className="flex items-center gap-3 md:gap-6 relative z-10">
                            <div className="w-12 h-12 md:w-20 md:h-20 bg-orange-50 rounded-xl md:rounded-[2rem] flex items-center justify-center shadow-inner shrink-0">
                                {greeting.icon}
                            </div>
                            <div>
                                <h1 className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight">
                                    {greeting.text},{" "}
                                    {profile?.full_name?.split(" ")[0] ||
                                        "Administrator"}
                                </h1>
                                <p className="text-sm text-slate-500 mt-1">
                                    {currentDateTime}
                                </p>
                            </div>
                        </div>

                        {/* Action Buttons (Request Modals) */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setIsLeaveModalOpen(true)}
                                className="px-4 py-2.5 bg-orange-50 text-orange-600 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-orange-100 transition-all border border-orange-200"
                            >
                                Leave Request
                            </button>
                            <button
                                onClick={() => setIsRequestModalOpen(true)}
                                className="px-4 py-2.5 bg-[#2F1E73] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#2F1E73]/90 transition-all shadow-md"
                            >
                                New Request
                            </button>
                        </div>
                    </div>
                </div>

                {/* Left Column - Community Board */}
                <div className="col-span-12 lg:col-span-3 space-y-6 order-3 lg:order-1">
                    {/* Community Board (Ideas) */}
                    <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-5 md:p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-5">
                            <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                                <Sparkles className="w-4 h-4 text-orange-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">
                                    Community Board
                                </h3>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-black">
                                    Live Signals
                                </p>
                            </div>
                        </div>
                        <ScrollArea className="h-[450px] pr-2">
                            <div className="space-y-3">
                                {communityIdeas.map((idea) => (
                                    <div
                                        key={idea.id}
                                        className="p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-orange-200 transition-all cursor-default group"
                                    >
                                        <p className="text-xs font-semibold text-slate-800 line-clamp-2 group-hover:text-[#2F1E73]">
                                            {idea.content}
                                        </p>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-[9px] text-slate-400 uppercase font-black">
                                                {format(
                                                    new Date(idea.created_at),
                                                    "MMM d",
                                                )}
                                            </span>
                                            {idea.status && (
                                                <Badge className="text-[8px] bg-[#2F1E73]/10 text-[#2F1E73] border-none">
                                                    {idea.status.replace(
                                                        "_",
                                                        " ",
                                                    )}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                {/* Middle Column - MISSION CONTROL */}
                <div className="col-span-12 lg:col-span-6 space-y-4 md:space-y-6 order-1 lg:order-2">
                    <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-4 md:p-0 border border-slate-100 md:border-0 md:bg-transparent shadow-sm md:shadow-none">
                        <div className="flex flex-col gap-3 md:px-2">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg md:text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2 md:gap-3">
                                        Mission Control{" "}
                                        <Target className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
                                    </h2>
                                    <p className="text-xs text-slate-400 font-medium hidden md:block">
                                        Directives for the {department} team
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsAssignTaskOpen(true)}
                                    className="px-4 py-2 bg-[#2F1E73] text-white rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#2F1E73]/90 transition-all flex items-center gap-2 shadow-lg"
                                >
                                    <Plus className="w-4 h-4" />
                                    Assign Task
                                </button>
                            </div>

                            <div className="flex bg-white md:bg-transparent p-1 rounded-xl md:rounded-2xl shadow-sm md:shadow-none border md:border-0 border-slate-100 overflow-x-auto scrollbar-hide">
                                {["ALL", "URGENT", "DAILY", "COMPLETED"].map(
                                    (tab) => (
                                        <button
                                            key={tab}
                                            onClick={() => {
                                                setActiveTab(tab);
                                                setShowCompleted(
                                                    tab === "COMPLETED",
                                                );
                                            }}
                                            className={`px-4 py-2 rounded-lg md:rounded-xl text-[10px] font-black transition-all flex items-center gap-2 whitespace-nowrap ${
                                                activeTab === tab
                                                    ? "text-white shadow-lg bg-[#2F1E73]"
                                                    : "text-slate-400 hover:text-slate-600"
                                            }`}
                                        >
                                            {tab}
                                            {tab === "COMPLETED" &&
                                                completedTasks.length > 0 && (
                                                    <span className="bg-blue-500 text-white text-[7px] px-1.5 py-0.5 rounded-full">
                                                        {completedTasks.length}
                                                    </span>
                                                )}
                                        </button>
                                    ),
                                )}
                            </div>
                        </div>

                        {/* Task List */}
                        <div className="mt-6 space-y-4">
                            {filteredTasks.length === 0 ? (
                                <div className="text-center py-12 bg-white rounded-3xl border border-slate-100">
                                    <CheckCircle className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                    <p className="text-sm text-slate-400 font-medium">
                                        No missions in current sector
                                    </p>
                                </div>
                            ) : (
                                filteredTasks.map((task) => {
                                    const assignee = staffData.find(
                                        (s) => s.id === task.assigned_to,
                                    ) || (task.assigned_to === profile?.id ? {
                                        name: profile?.full_name,
                                        role: profile?.designation || profile?.role || "Manager",
                                        avatar: profile?.full_name?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "MA"
                                    } : null);
                                    const isOverdue =
                                        task.due_date &&
                                        new Date(task.due_date) < new Date();

                                    return (
                                        <div
                                            key={task.id}
                                            className={cn(
                                                "group flex flex-col gap-2 p-5 rounded-3xl transition-all duration-500 shadow-sm border border-slate-100 border-l-4 relative overflow-hidden",
                                                "bg-white hover:bg-slate-50 hover:shadow-md hover:-translate-y-0.5",
                                                task.priority === "urgent"
                                                    ? "border-l-red-500"
                                                    : task.status === "completed"
                                                      ? "border-l-emerald-500"
                                                      : "border-l-[#2F1E73]",
                                                isOverdue
                                                    ? "border-r-red-500/10 border-y-red-500/10"
                                                    : "border-white",
                                                expandedTask === task.id &&
                                                    "ring-2 ring-[#2F1E73]/5",
                                            )}
                                        >
                                            <div
                                                className="flex justify-between items-start gap-4 cursor-pointer"
                                                onClick={() =>
                                                    setExpandedTask(
                                                        expandedTask === task.id
                                                            ? null
                                                            : task.id,
                                                    )
                                                }
                                            >
                                                <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h4 className="text-sm font-black text-slate-900 leading-tight uppercase truncate max-w-[220px] sm:max-w-[320px]">
                                                            {task.title}
                                                        </h4>
                                                        {(task as any).creator && (
                                                            <Badge
                                                                variant="outline"
                                                                className={cn(
                                                                    "text-[9px] px-2.5 py-0.5 h-5 border-none font-black uppercase tracking-widest flex items-center gap-1.5",
                                                                    (task as any)
                                                                        .creator
                                                                        ?.role ===
                                                                        "ceo"
                                                                        ? "bg-amber-500/10 text-amber-600 shadow-[0_0_8px_rgba(245,158,11,0.05)]"
                                                                        : "bg-indigo-500/10 text-indigo-600 shadow-[0_0_8px_rgba(99,102,241,0.05)]",
                                                                )}
                                                            >
                                                                {(task as any)
                                                                    .creator
                                                                    ?.role ===
                                                                "ceo" ? (
                                                                    <>
                                                                        <Crown className="w-2.5 h-2.5 text-amber-500 animate-pulse" />
                                                                        {(task as any)
                                                                            .creator
                                                                            ?.full_name ||
                                                                            "Saleem"}{" "}
                                                                        (CEO)
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Zap className="w-2.5 h-2.5 text-indigo-500 animate-pulse" />
                                                                        {(task as any)
                                                                            .creator
                                                                            ?.full_name ||
                                                                            "Administrator"}{" "}
                                                                        (
                                                                        {(task as any)
                                                                            .creator
                                                                            ?.designation ||
                                                                            "Manager"}
                                                                        )
                                                                    </>
                                                                )}
                                                            </Badge>
                                                        )}
                                                        {task.is_daily_task && (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-[9px] px-2.5 py-0.5 h-5 border-blue-200 text-blue-600 bg-blue-50 font-black uppercase tracking-widest"
                                                            >
                                                                DAILY
                                                            </Badge>
                                                        )}
                                                        {task.priority ===
                                                            "urgent" && (
                                                            <Badge className="bg-red-500 text-white border-none text-[8px] h-4 font-black uppercase tracking-widest">
                                                                URGENT
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 font-medium tracking-wide line-clamp-2 leading-relaxed mt-1">
                                                        {task.description ||
                                                            "No operational description provided."}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    {renderCEOTaskGauge(task)}
                                                    <ChevronDown
                                                        className={cn(
                                                            "w-4 h-4 text-slate-300 transition-transform duration-300",
                                                            expandedTask ===
                                                                task.id &&
                                                                "rotate-180 text-[#2F1E73]",
                                                        )}
                                                    />
                                                </div>
                                            </div>

                                            {/* Expandable Details & Progress Update */}
                                            <AnimatePresence>
                                                {expandedTask === task.id && (
                                                    <motion.div
                                                        initial={{
                                                            height: 0,
                                                            opacity: 0,
                                                        }}
                                                        animate={{
                                                            height: "auto",
                                                            opacity: 1,
                                                        }}
                                                        exit={{
                                                            height: 0,
                                                            opacity: 0,
                                                        }}
                                                        className="overflow-hidden"
                                                    >
                                                        <div className="pt-4 pb-2 space-y-4 border-t border-slate-50 mt-2">
                                                            {/* Only show progress slider for tasks assigned to the manager */}
                                                            {task.assigned_to ===
                                                                profile?.id &&
                                                                task.status !==
                                                                    "completed" && (
                                                                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="text-[10px] font-black text-[#2F1E73] uppercase tracking-widest">
                                                                                Update
                                                                                Progress
                                                                            </span>
                                                                            <span className="text-xs font-bold text-slate-900">
                                                                                {task.progress ||
                                                                                    0}
                                                                                %
                                                                            </span>
                                                                        </div>
                                                                        <input
                                                                            type="range"
                                                                            min="0"
                                                                            max="100"
                                                                            value={
                                                                                task.progress ||
                                                                                0
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) => {
                                                                                const val =
                                                                                    parseInt(
                                                                                        e
                                                                                            .target
                                                                                            .value,
                                                                                    );
                                                                                setTasks(
                                                                                    (
                                                                                        prev,
                                                                                    ) =>
                                                                                        prev.map(
                                                                                            (
                                                                                                t,
                                                                                            ) =>
                                                                                                t.id ===
                                                                                                task.id
                                                                                                    ? {
                                                                                                          ...t,
                                                                                                          progress:
                                                                                                              val,
                                                                                                      }
                                                                                                    : t,
                                                                                        ),
                                                                                );
                                                                            }}
                                                                            onMouseUp={(
                                                                                e: any,
                                                                            ) =>
                                                                                updateTaskProgress(
                                                                                    task.id,
                                                                                    parseInt(
                                                                                        e
                                                                                            .target
                                                                                            .value,
                                                                                    ),
                                                                                )
                                                                            }
                                                                            onTouchEnd={(
                                                                                e: any,
                                                                            ) =>
                                                                                updateTaskProgress(
                                                                                    task.id,
                                                                                    parseInt(
                                                                                        e
                                                                                            .target
                                                                                            .value,
                                                                                    ),
                                                                                )
                                                                            }
                                                                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#F15A24] focus:outline-none"
                                                                        />
                                                                    </div>
                                                                )}

                                                            <div className="p-3 bg-white border border-slate-100 rounded-xl">
                                                                <p className="text-xs text-slate-600 leading-relaxed italic">
                                                                    &quot;{task.description ||
                                                                        "No detailed description provided for this mission."}&quot;
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            <div className="mt-2 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] font-black text-slate-600 uppercase">
                                                            {assignee?.name?.charAt(
                                                                0,
                                                            ) || "?"}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-slate-600 uppercase">
                                                            {task.assigned_to ===
                                                            profile?.id
                                                                ? "Me"
                                                                : assignee?.name ||
                                                                  "Unassigned"}
                                                            <span className="ml-1 opacity-50 font-medium lowercase">
                                                                ({assignee?.role ||
                                                                    "Staff"})
                                                            </span>
                                                        </span>
                                                    </div>
                                                    {task.due_date && (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-[1px] h-3 bg-slate-200" />
                                                            <span
                                                                className={cn(
                                                                    "text-[9px] font-bold uppercase",
                                                                    isOverdue
                                                                        ? "text-red-400"
                                                                        : "text-slate-400",
                                                                )}
                                                            >
                                                                Due:{" "}
                                                                {format(
                                                                    new Date(
                                                                        task.due_date,
                                                                    ),
                                                                    "MMM d",
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {!showCompleted ? (
                                                        task.assigned_to ===
                                                            profile?.id && (
                                                            <button
                                                                onClick={() =>
                                                                    markTaskAsCompleted(
                                                                        task.id,
                                                                    )
                                                                }
                                                                className="h-8 px-4 text-[9px] font-black uppercase bg-[#2F1E73] text-white rounded-xl transition-all shadow-md shadow-[#2F1E73]/20 flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
                                                            >
                                                                <CheckCircle2 className="w-3.5 h-3.5" />{" "}
                                                                Complete
                                                            </button>
                                                        )
                                                    ) : (
                                                        task.assigned_to !==
                                                            profile?.id && (
                                                            <button
                                                                onClick={() =>
                                                                    markTaskAsReviewed(
                                                                        task.id,
                                                                    )
                                                                }
                                                                className="h-8 px-4 text-[9px] font-black uppercase bg-emerald-500 text-white rounded-xl transition-all shadow-md shadow-emerald-500/20 flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98]"
                                                            >
                                                                <CheckCircle className="w-3.5 h-3.5" />{" "}
                                                                Review Mission
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column - Department Personnel */}
                <div className="col-span-12 lg:col-span-3 space-y-6 order-2 lg:order-3">
                    <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-5 md:p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-2 mb-5">
                            <div className="w-8 h-8 bg-[#2F1E73]/10 rounded-lg flex items-center justify-center">
                                <Users className="w-4 h-4 text-[#2F1E73]" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tighter">
                                    {department} Department
                                </h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                    Active Personnel
                                </p>
                            </div>
                        </div>
                        <ScrollArea className="h-[500px] pr-2">
                            <div className="space-y-4">
                                {accessibleStaff.length === 0 ? (
                                    <div className="text-center py-8">
                                        <p className="text-xs text-slate-400 font-medium italic">No personnel found in this sector</p>
                                    </div>
                                ) : (
                                    accessibleStaff.map((staff) => (
                                        <div
                                            key={staff.id}
                                            className="flex items-center gap-3 group p-2 rounded-xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100"
                                        >
                                            <div className="relative">
                                                <Avatar className="h-10 w-10 border-2 border-slate-50 shadow-sm">
                                                    <AvatarImage
                                                        src={staff.avatar_url}
                                                    />
                                                    <AvatarFallback className="bg-[#2F1E73] text-white font-black text-xs">
                                                        {staff.avatar}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-slate-900 group-hover:text-[#2F1E73] transition-colors truncate uppercase tracking-tight">
                                                    {staff.name}
                                                </p>
                                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">
                                                    {staff.role}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setNewTask((prev) => ({
                                                        ...prev,
                                                        assignedTo: staff.id,
                                                    }));
                                                    setIsAssignTaskOpen(true);
                                                }}
                                                className="w-8 h-8 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 opacity-0 group-hover:opacity-100 hover:text-[#F15A24] transition-all"
                                            >
                                                <Plus className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </main>

            {/* CEO-STYLE TASK ASSIGNMENT DIALOG */}
            <Dialog open={isAssignTaskOpen} onOpenChange={setIsAssignTaskOpen}>
                <DialogContent className="bg-white border border-gray-100 text-slate-900 max-w-md rounded-3xl shadow-2xl overflow-hidden p-0 flex flex-col max-h-[85vh]">
                    <div className="px-6 pt-7 pb-4 flex items-start justify-between flex-shrink-0 border-b">
                        <div>
                            <DialogTitle className="text-lg font-black tracking-tight text-[#1a1a2e] flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#F15A24]/10 to-[#2F1E73]/10 flex items-center justify-center">
                                    <Target className="w-4 h-4 text-[#F15A24]" />
                                </div>
                                Deploy Mission
                            </DialogTitle>
                            <p className="text-[11px] text-gray-400 font-semibold mt-1 ml-10 uppercase tracking-widest">
                                {department} Strategic Deployment
                            </p>
                        </div>
                        <button
                            onClick={() => setIsAssignTaskOpen(false)}
                            className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <ScrollArea className="flex-1 px-6">
                        <div className="space-y-5 py-6">
                            {/* Task Title */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    Task Title
                                </label>
                                <input
                                    placeholder="e.g. Critical System Audit"
                                    value={newTask.title}
                                    onChange={(e) =>
                                        setNewTask({
                                            ...newTask,
                                            title: e.target.value,
                                        })
                                    }
                                    className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-[#1a1a2e] focus:outline-none focus:ring-2 focus:ring-[#F15A24]/30"
                                />
                            </div>

                            {/* Description */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    Objective
                                </label>
                                <textarea
                                    placeholder="Define purpose and expected outcome..."
                                    value={taskDescription}
                                    onChange={(e) =>
                                        setTaskDescription(e.target.value)
                                    }
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-medium text-[#1a1a2e] resize-none leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#F15A24]/30"
                                />
                            </div>

                            {/* Staff + Deadline */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        Assign Staff
                                    </label>
                                    <div className="relative">
                                        {newTask.assignedTo ? (
                                            <div
                                                className="flex items-center gap-2 px-3 h-11 rounded-xl border border-gray-200 bg-gray-50 cursor-pointer"
                                                onClick={() => {
                                                    setNewTask({
                                                        ...newTask,
                                                        assignedTo: "",
                                                    });
                                                    setAssigneeSearch("");
                                                }}
                                            >
                                                <div className="w-6 h-6 rounded-full bg-[#F15A24] text-white flex items-center justify-center text-[9px] font-black shadow-sm">
                                                    {
                                                        accessibleStaff.find(
                                                            (s) =>
                                                                s.id ===
                                                                newTask.assignedTo,
                                                        )?.avatar
                                                    }
                                                </div>
                                                <span className="flex-1 text-sm font-semibold truncate">
                                                    {
                                                        accessibleStaff.find(
                                                            (s) =>
                                                                s.id ===
                                                                newTask.assignedTo,
                                                        )?.name
                                                    }
                                                </span>
                                                <X className="w-3.5 h-3.5 text-gray-400" />
                                            </div>
                                        ) : (
                                            <>
                                                <input
                                                    placeholder="Search personnel..."
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
                                                    className="w-full h-11 pl-4 pr-4 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#F15A24]/20"
                                                />
                                                {showAssigneeDropdown &&
                                                    assigneeSearch && (
                                                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl overflow-hidden shadow-xl max-h-[160px] overflow-y-auto">
                                                            {filteredStaffForSearch.map(
                                                                (s) => (
                                                                    <button
                                                                        key={
                                                                            s.id
                                                                        }
                                                                        onClick={() => {
                                                                            setNewTask(
                                                                                {
                                                                                    ...newTask,
                                                                                    assignedTo:
                                                                                        s.id,
                                                                                },
                                                                            );
                                                                            setShowAssigneeDropdown(
                                                                                false,
                                                                            );
                                                                        }}
                                                                        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 transition-colors text-left border-b last:border-none"
                                                                    >
                                                                        <div className="w-7 h-7 rounded-full bg-[#2F1E73] text-white flex items-center justify-center text-[9px] font-black">
                                                                            {
                                                                                s.avatar
                                                                            }
                                                                        </div>
                                                                        <div className="text-xs font-bold text-slate-900">
                                                                            {
                                                                                s.name
                                                                            }
                                                                        </div>
                                                                    </button>
                                                                ),
                                                            )}
                                                        </div>
                                                    )}
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        Deadline
                                    </label>
                                    <input
                                        type="date"
                                        value={newTask.due_date}
                                        onChange={(e) =>
                                            setNewTask({
                                                ...newTask,
                                                due_date: e.target.value,
                                            })
                                        }
                                        className="w-full h-11 px-3 rounded-xl border border-gray-200 bg-gray-50 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#F15A24]/20"
                                    />
                                </div>
                            </div>

                            {/* Priority Selection */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                    Mission Priority
                                </label>
                                <div className="flex gap-2">
                                    {["low", "medium", "high", "urgent"].map(
                                        (p) => (
                                            <button
                                                key={p}
                                                onClick={() =>
                                                    setNewTask({
                                                        ...newTask,
                                                        priority: p,
                                                    })
                                                }
                                                className={`flex-1 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                                    newTask.priority === p
                                                        ? "bg-[#2F1E73] text-white shadow-md scale-[1.02]"
                                                        : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        ),
                                    )}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>

                    <div className="p-6 bg-gray-50/50 flex items-center justify-between gap-3 flex-shrink-0 border-t">
                        <button
                            onClick={() => setIsAssignTaskOpen(false)}
                            className="px-6 h-12 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => assignTask()}
                            className="flex-1 h-12 bg-gradient-to-r from-[#2F1E73] to-[#F15A24] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#2F1E73]/20 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                            Deploy Mission
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* REQUEST MODALS */}
            <RequestModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
            />
            <LeaveRequestModal
                isOpen={isLeaveModalOpen}
                onClose={() => setIsLeaveModalOpen(false)}
            />
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
            />

            {/* Confetti styles */}
            <style>{`
                @keyframes executive-shimmer {
                    0% { transform: translateX(-100%) rotate(45deg); }
                    100% { transform: translateX(100%) rotate(45deg); }
                }
            `}</style>
        </div>
    );
}
