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
    History,
    Megaphone,
    ArrowRight,
    Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { UAMessengerDrawer } from "@/components/ua-messenger-drawer";
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
import AddIdeaDialog from "@/components/AddIdeaDialog";
import { cn, isValidAvatarUrl } from "@/lib/utils";

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

const formatTrackerRequest = (req: any) => {
    let title = req.type?.replace("_", " ").toUpperCase() || "REQUEST";
    if (req.type === "access_elevation") title = "Access Elevation";
    else if (req.type === "role_change") title = "Role Elevation";
    else if (req.type === "permission") title = "Permission Access";
    else if (req.type === "leave") title = "Leave Authorization";
    else if (req.type === "budget") title = "Budget Allocation";
    
    let detail = "";
    if (req.description) {
        let desc = req.description;
        if (desc.startsWith("[") && desc.endsWith("]")) {
            const parts = desc.slice(1, -1).split("|");
            const systemPart = parts.find((p: string) => p.trim().startsWith("System:"));
            const justificationPart = parts.find((p: string) => p.trim().startsWith("Justification:"));
            
            const systemVal = systemPart ? systemPart.split(":")[1]?.trim() : "";
            const justificationVal = justificationPart ? justificationPart.split(":")[1]?.trim() : "";
            
            if (systemVal && justificationVal) {
                detail = `${systemVal} • "${justificationVal}"`;
            } else if (justificationVal) {
                detail = `"${justificationVal}"`;
            }
        } else {
            detail = desc;
        }
    }
    return { title, detail };
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
    const isV2Enabled = process.env.NEXT_PUBLIC_ENABLE_V2_FEATURES === "true" || (typeof window !== "undefined" && window.localStorage.getItem("ENABLE_V2_FEATURES") === "true");

    // Use prop department if provided, otherwise fallback to profile department
    const department = useMemo(() => {
        return propDepartment || (profile?.department as any) || "Sales";
    }, [propDepartment, profile]);

    // State
    const [staffData, setStaffData] = useState<any[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
    const [expandedTask, setExpandedTask] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState("MY TASKS");
    const [showCompleted, setShowCompleted] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    // Community Board (Ideas) state
    const [communityIdeas, setCommunityIdeas] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [isIdeasOpen, setIsIdeasOpen] = useState(false);

    // UA Messenger state
    const [isBellOpen, setIsBellOpen] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);

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
        const primary = department || (profile?.department as any) || "Sales";
        const depts = [primary];

        // Authority Expansion: Marketing Manager can also access and assign tasks to Sales department
        if (primary === "Marketing") {
            depts.push("Sales");
        }

        return depts;
    }, [profile, department]);

    // Filter staff for the Personnel card (only department staff, unless Marketing Manager who gets all)
    const accessibleStaff = useMemo(() => {
        if (!managerDepartmentAccess) return staffData;
        if (department === "Marketing") {
            return staffData;
        }
        return staffData.filter((staff) =>
            managerDepartmentAccess.includes(staff.department),
        );
    }, [staffData, managerDepartmentAccess, department]);

    // Filtered Staff for Search in Task Assignment
    const filteredStaffForSearch = useMemo(() => {
        return accessibleStaff.filter((s) =>
            s.name.toLowerCase().includes(assigneeSearch.toLowerCase()),
        );
    }, [accessibleStaff, assigneeSearch]);

    const addIdeaStaffList = useMemo(() => {
        return staffData.map((s) => ({
            id: s.id,
            name: s.name,
            dept: s.department,
            role: s.role,
        }));
    }, [staffData]);

    // Fetch notifications for UA Messenger
    const fetchNotifications = React.useCallback(async () => {
        if (!profile?.id) return;
        try {
            const { data: notifs } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", profile.id)
                .eq("type", "direct")
                .order("created_at", { ascending: false });
            if (notifs) setNotifications(notifs);
        } catch (err) {
            console.error("UA Messenger fetch error:", err);
        }
    }, [profile?.id]);

    useEffect(() => {
        if (profile?.id) {
            fetchNotifications();
            const interval = setInterval(fetchNotifications, 30000);
            
            // Listen for immediate messenger updates
            window.addEventListener("hq-messenger-updated", fetchNotifications);
            
            return () => {
                clearInterval(interval);
                window.removeEventListener("hq-messenger-updated", fetchNotifications);
            };
        }
    }, [profile?.id, fetchNotifications]);

    useEffect(() => {
        const handleToggle = () => setIsBellOpen(prev => !prev);
        window.addEventListener("toggle-hq-messenger", handleToggle);
        return () => window.removeEventListener("toggle-hq-messenger", handleToggle);
    }, []);

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
                .in("status", ["completed", "COMPLETED"]);

            if (managerDepartmentAccess) {
                if (department === "Marketing") {
                    activeQuery = activeQuery.or(`created_by.eq.${profile.id},assigned_to.eq.${profile.id}`);
                    completedQuery = completedQuery.or(`created_by.eq.${profile.id},assigned_to.eq.${profile.id}`);
                } else {
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
            }

            const [activeRes, completedRes, requestsRes] = await Promise.all([
                activeQuery.order("created_at", { ascending: false }),
                completedQuery.order("updated_at", { ascending: false }),
                supabase
                    .from("requests")
                    .select("*, submitted_by:profiles!requests_submitted_by_fkey(id, full_name)")
                    .eq("submitted_by", profile.id)
                    .neq("type", "idea")
                    .order("created_at", { ascending: false }),
            ]);

            if (activeRes.data) setTasks(activeRes.data);
            if (completedRes.data) setCompletedTasks(completedRes.data);
            if (requestsRes.data) setRequests(requestsRes.data);
        } catch (error) {
            console.error("Error fetching tasks & requests:", error);
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
            const { data, error } = await supabase
                .from("tasks")
                .insert(insertPayload)
                .select("*, creator:created_by(id, full_name, role, designation)");
            if (error) throw error;

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

            setIsAssignTaskOpen(false);
            resetTaskForm();
            
            // Prepend the new task directly in local state to make updates instant
            if (data && data[0]) {
                setTasks((prev) => [data[0], ...prev]);
            } else {
                fetchTasks();
            }
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
        const isCompleted = progress === 100;
        const previousTasks = [...tasks];
        const previousCompleted = [...completedTasks];

        // Optimistically update local state if completed
        if (isCompleted) {
            const targetTask = tasks.find((t) => t.id === id);
            if (targetTask) {
                const updated: Task = { ...targetTask, status: "completed" as any, progress: 100 };
                setTasks((prev) => prev.filter((t) => t.id !== id));
                setCompletedTasks((prev) => [updated, ...prev]);
            }
        }

        try {
            const { error } = await supabase
                .from("tasks")
                .update({
                    progress,
                    status: isCompleted ? "completed" : "in_progress",
                    updated_at: new Date().toISOString(),
                })
                .eq("id", id);
            if (error) throw error;
            if (isCompleted) {
                toast.success("Task completed!");
            }
        } catch (error) {
            toast.error("Failed to update progress");
            // Rollback on failure
            setTasks(previousTasks);
            setCompletedTasks(previousCompleted);
        }
    };

    const markTaskAsCompleted = async (id: string) => {
        // Cache current states for potential rollback
        const previousTasks = [...tasks];
        const previousCompleted = [...completedTasks];

        // Optimistically update local state immediately
        const targetTask = tasks.find((t) => t.id === id);
        if (targetTask) {
            const updated: Task = { ...targetTask, status: "completed" as any, progress: 100 };
            setTasks((prev) => prev.filter((t) => t.id !== id));
            setCompletedTasks((prev) => [updated, ...prev]);
        }

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
        } catch (error) {
            toast.error("Failed to update task");
            // Rollback on failure
            setTasks(previousTasks);
            setCompletedTasks(previousCompleted);
        }
    };

    const markTaskAsReviewed = async (id: string) => {
        const myRole =
            profile?.role === "ceo"
                ? "CEO"
                : profile?.designation || profile?.role || "Manager";
        
        // Find existing task in completedTasks array locally to bypass DB read query
        const taskToReview = completedTasks.find((t) => t.id === id);
        const existing = taskToReview?.reviewed_by_info;
        
        let newInfo = myRole;
        if (existing) {
            if (!existing.toLowerCase().includes(myRole.toLowerCase())) {
                newInfo = `${existing} & ${myRole}`;
            } else {
                newInfo = existing;
            }
        }

        const nowStr = new Date().toISOString();
        const previousCompleted = [...completedTasks];

        // Optimistically update local state immediately
        setCompletedTasks((prev) =>
            prev.map((t) =>
                t.id === id
                    ? {
                          ...t,
                          reviewed_at: nowStr,
                          reviewed_by_info: newInfo,
                      }
                    : t,
            ),
        );

        try {
            const { error } = await supabase
                .from("tasks")
                .update({
                    reviewed_at: nowStr,
                    reviewed_by_info: newInfo,
                })
                .eq("id", id);
            if (error) throw error;
            toast.success("Task marked as reviewed");
        } catch (error) {
            toast.error("Failed to review task");
            // Rollback on failure
            setCompletedTasks(previousCompleted);
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
            if (activeTab === "MY TASKS") return task.assigned_to === profile?.id;
            if (activeTab === "ALL") return task.assigned_to !== profile?.id;
            if (activeTab === "URGENT") return task.priority === "urgent";
            if (activeTab === "DAILY") return task.is_daily_task;
            return false;
        });
    }, [tasks, completedTasks, activeTab, showCompleted, profile]);

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
            {/* PREMIUM FLOATING GLASSMORPHIC HEADER */}
            <header className="w-[calc(100%-2rem)] mx-auto mt-4 rounded-2xl md:rounded-3xl border border-slate-200/50 dark:border-zinc-800/40 shadow-xl bg-white/70 dark:bg-zinc-950/75 backdrop-blur-xl sticky top-4 z-50 transition-all duration-300">
                <div className="max-w-[1700px] mx-auto px-4 md:px-6 py-2.5">
                    <div className="flex items-center justify-between gap-4">
                        {/* Logo */}
                        <div className="flex items-center gap-3 group cursor-default shrink-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#2F1E73] to-[#F15A24] rounded-xl flex items-center justify-center shadow-lg shadow-[#2F1E73]/20 relative overflow-hidden group-hover:scale-105 transition-transform duration-300">
                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <div className="text-white text-[10px] font-black tracking-widest">
                                    UA
                                </div>
                            </div>
                            <div>
                                <h1 className="text-xs md:text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-1.5 group-hover:text-[#F15A24] transition-colors duration-200">
                                    {department} <span className="text-[#2F1E73] dark:text-purple-400 font-extrabold">Management</span>
                                </h1>
                                <p className="text-[8px] md:text-[9px] text-slate-400 dark:text-zinc-500 uppercase tracking-widest font-black leading-tight">
                                    Operational Command Center
                                </p>
                            </div>
                        </div>

                        {/* Mid Section: Active Sync Status & Quick Stats Widgets */}
                        <div className="hidden md:flex items-center gap-4 flex-1 justify-center">
                            {/* Sync Status */}
                            <div className="hidden lg:flex items-center gap-2 bg-[#2F1E73]/5 dark:bg-zinc-800/20 border border-slate-200/50 dark:border-zinc-800/30 px-3.5 py-1.5 rounded-full select-none">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                                    UA SYSTEM SYNCED
                                </span>
                            </div>

                            {/* Stats Badges */}
                            <div className="flex items-center gap-2.5">
                                <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/20 px-3 py-1.5 rounded-xl shadow-[0_2px_8px_rgba(245,158,11,0.02)]">
                                    <Target className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                        {tasks.length} Active Missions
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 bg-[#2F1E73]/5 border border-[#2F1E73]/10 dark:bg-purple-500/5 dark:border-purple-500/20 px-3 py-1.5 rounded-xl shadow-[0_2px_8px_rgba(47,30,115,0.02)]">
                                    <Users className="w-3.5 h-3.5 text-[#2F1E73] dark:text-purple-400" />
                                    <span className="text-[9px] font-black uppercase tracking-wider text-[#2F1E73] dark:text-purple-400">
                                        {accessibleStaff.length} Personnel
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Profile Menu Capsule & Sign Out */}
                        <div className="flex items-center gap-3 shrink-0">
                            {/* Unified Capsule */}
                            <div 
                                onClick={() => setIsProfileModalOpen(true)}
                                className="flex items-center gap-2.5 bg-slate-50/50 hover:bg-slate-100/80 dark:bg-zinc-900/40 dark:hover:bg-zinc-800/80 border border-slate-200/50 dark:border-zinc-800/60 pl-3 pr-2 py-1.5 rounded-xl transition-all duration-300 cursor-pointer group shadow-sm hover:scale-[1.02]"
                            >
                                <div className="text-right hidden sm:block">
                                    <p className="text-[11px] font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none group-hover:text-[#F15A24] transition-colors">
                                        {profile?.full_name || "Manager"}
                                    </p>
                                    <p className="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest leading-none mt-1">
                                        {profile?.designation || `${department} Head`}
                                    </p>
                                </div>
                                <div className="relative">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-xs shadow-inner overflow-hidden border border-white/20"
                                        style={{
                                            background: `linear-gradient(135deg, ${BRAND.navy}, ${BRAND.orange})`,
                                        }}
                                    >
                                        {profile?.avatar_url && isValidAvatarUrl(profile.avatar_url) ? (
                                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover animate-fade-in" />
                                        ) : profile?.avatar_url ? (
                                            <span className="text-sm">{profile.avatar_url}</span>
                                        ) : (
                                            (profile?.full_name || "M")
                                                .split(" ")
                                                .map((n: string) => n[0])
                                                .join("")
                                                .slice(0, 2)
                                                .toUpperCase()
                                        )}
                                    </div>
                                    {/* Pulse Online Dot */}
                                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-zinc-950 rounded-full animate-pulse"></span>
                                </div>
                            </div>

                            {/* Power Button */}
                            <button
                                onClick={() => signOut()}
                                className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-900 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all border border-slate-150 dark:border-zinc-800/80 shadow-sm hover:scale-105 active:scale-95"
                            >
                                <Power className="w-5 h-5" />
                            </button>

                            {/* UA Messenger Bell Button */}
                            {(() => {
                                const unreadCount = notifications.filter(n => n.type === "direct" && !n.read).length;
                                return (
                                    <>
                                        <style>{`
                                            @keyframes mgr-bell-shake {
                                                0%, 100% { transform: rotate(0deg); }
                                                15% { transform: rotate(-12deg); }
                                                30% { transform: rotate(10deg); }
                                                45% { transform: rotate(-8deg); }
                                                60% { transform: rotate(6deg); }
                                                75% { transform: rotate(-3deg); }
                                            }
                                            .mgr-bell-shake { animation: mgr-bell-shake 0.9s ease-in-out infinite; transform-origin: top center; }
                                        `}</style>
                                        <button
                                            onClick={() => setIsBellOpen(prev => !prev)}
                                            className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 border shadow-sm hover:scale-105 active:scale-95 ${
                                                isBellOpen
                                                    ? 'bg-gradient-to-br from-[#2F1E73] to-[#4f3fbf] text-white border-[#2F1E73] shadow-[#2F1E73]/30'
                                                    : unreadCount > 0
                                                        ? 'bg-orange-50 text-orange-600 border-orange-200 ring-2 ring-orange-500/20 shadow-orange-500/15'
                                                        : 'bg-slate-50 dark:bg-zinc-900 text-slate-400 border-slate-200 dark:border-zinc-800'
                                            }`}
                                            title="UA Messenger"
                                        >
                                            <Bell className={`w-4 h-4 ${unreadCount > 0 && !isBellOpen ? 'mgr-bell-shake' : ''}`} />
                                            {unreadCount > 0 && (
                                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#F14D24] text-[7px] font-black text-white flex items-center justify-center shadow-md animate-pulse">
                                                    {unreadCount > 9 ? "9+" : unreadCount}
                                                </span>
                                            )}
                                        </button>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </header>

            <main className="p-4 md:p-8 max-w-[1700px] mx-auto grid grid-cols-12 gap-4 md:gap-8">
                {/* Greeting Banner - MODERNIZED */}
                <div className="col-span-12">
                    <div className="relative group overflow-hidden">
                        {/* Interactive Background Layers */}
                        <div className="absolute inset-0 bg-white dark:bg-zinc-900 rounded-[2rem] md:rounded-[3rem] border border-slate-100 dark:border-zinc-800 shadow-xl shadow-slate-200/40 dark:shadow-black/20" />
                        <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-indigo-500/5 to-transparent rounded-r-[3rem] pointer-events-none" />
                        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl pointer-events-none" />
                        
                        <div className="relative p-5 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-4 md:gap-8">
                                {/* Dynamic Icon Housing */}
                                <div className="relative">
                                    <div className="w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-white to-slate-50 dark:from-zinc-800 dark:to-zinc-900 rounded-3xl md:rounded-[2.5rem] flex items-center justify-center shadow-lg border border-slate-100 dark:border-zinc-700/50 group-hover:scale-105 transition-transform duration-500">
                                        <div className="scale-125 md:scale-[1.75]">
                                            {greeting.icon}
                                        </div>
                                    </div>
                                    <motion.div 
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                        className="absolute -inset-2 rounded-[2.5rem] border border-dashed border-orange-500/20 pointer-events-none"
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                                            <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                                                Active Session
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                                                Systems Nominal
                                            </span>
                                        </div>
                                    </div>
                                    <h1 className="text-2xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none mb-3">
                                        {greeting.text},{" "}
                                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2F1E73] to-indigo-500 dark:from-indigo-400 dark:to-white">
                                            {profile?.full_name?.split(" ")[0] || "Administrator"}
                                        </span>
                                    </h1>
                                    <div className="flex items-center gap-3">
                                        <Calendar className="w-4 h-4 text-orange-500" />
                                        <p className="text-xs md:text-sm font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-widest">
                                            {currentDateTime}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Dashboard Meta Stats */}
                            <div className="hidden lg:flex items-center gap-4">
                                <div className="h-16 w-[1px] bg-slate-100 dark:bg-zinc-800 mx-4" />
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Target Sector</p>
                                    <h4 className="text-lg font-black text-[#2F1E73] dark:text-indigo-400 uppercase tracking-tight">
                                        {department} HQ
                                    </h4>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Left Column - Action Portal, Sparks, Request Tracker & Community Board */}
                <div className="col-span-12 lg:col-span-3 space-y-6 order-3 lg:order-1">
                    {/* Department Daily Controls - ADDED FOR FINANCE/SALES/MARKETING MANAGERS */}
                    {(department === "Finance" || department === "Sales" || department === "Marketing") && (
                        <div className="bg-[#1e1b4b] rounded-2xl md:rounded-[2.5rem] p-5 md:p-6 text-white shadow-[0_8px_30px_rgba(30,27,75,0.2)] relative overflow-hidden border border-indigo-500/20 group">
                            <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 bg-indigo-500 filter blur-[40px] group-hover:opacity-30 transition-opacity"></div>
                            
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-white/10 rounded-xl">
                                        {department === "Finance" ? (
                                            <Wallet className="w-5 h-5 text-indigo-300" />
                                        ) : (
                                            <TrendingUp className="w-5 h-5 text-indigo-300" />
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black tracking-widest uppercase text-indigo-200/70">
                                            {department === "Marketing" ? "Sales" : department} Control
                                        </span>
                                        <h4 className="text-xs font-black text-white uppercase">
                                            {department === "Marketing" ? "Intelligence" : "Daily Operations"}
                                        </h4>
                                    </div>
                                </div>
                                <p className="text-[11px] text-indigo-100/60 mb-5 leading-relaxed font-medium">
                                    {department === "Marketing"
                                        ? "Access real-time sales intelligence, lead analytics, and conversions."
                                        : `Record and transmit today's ${department.toLowerCase()} metrics to the CEO dashboard.`}
                                </p>
                                
                                {department !== "Marketing" && (
                                    <button
                                        onClick={() => {
                                            if (department === "Finance") router.push("/finance-manager/daily-finance");
                                            else router.push("/sales-manager/daily-sales");
                                        }}
                                        className="w-full py-3 bg-white text-indigo-900 hover:bg-indigo-50 rounded-2xl font-black text-[9px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 mb-3"
                                    >
                                        Update Daily {department} <ArrowRight className="w-3 h-3" />
                                    </button>
                                )}

                                <button
                                    onClick={() => {
                                        if (department === "Finance") router.push("/finance-manager/financial-intelligence");
                                        else if (department === "Marketing") router.push("/marketing-manager/sales-intelligence");
                                        else router.push("/sales-manager/sales-intelligence");
                                    }}
                                    className="w-full py-3 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/30 text-white rounded-2xl font-black text-[9px] tracking-widest uppercase transition-all flex items-center justify-center gap-2 active:scale-95"
                                >
                                    {department === "Finance" ? "Financial" : "Sales"} Intelligence <BarChart3 className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Action Portal */}
                    <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-5 md:p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                                <Plus className="w-4 h-4 text-[#F15A24]" />
                            </div>
                            <span className="text-xs font-black tracking-widest uppercase text-slate-400">
                                Action Portal
                            </span>
                        </div>
                        <div className="space-y-3">
                            {[
                                {
                                    id: "new_request",
                                    label: "New Request",
                                    icon: Plus,
                                },
                                {
                                    id: "leave_request",
                                    label: "Leave Request",
                                    icon: Calendar,
                                },
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        if (item.id === "new_request") {
                                            setIsRequestModalOpen(true);
                                        } else if (item.id === "leave_request") {
                                            setIsLeaveModalOpen(true);
                                        }
                                    }}
                                    className="w-full p-4 rounded-2xl flex items-center justify-between text-white hover:opacity-90 transition-all bg-[#2F1E73] group shadow-md"
                                >
                                    <div className="flex items-center gap-3">
                                        <item.icon className="w-4 h-4 text-orange-400" />
                                        <span className="text-[11px] font-black uppercase tracking-widest">
                                            {item.label}
                                        </span>
                                    </div>
                                    <Plus className="w-4 h-4 opacity-40 group-hover:rotate-90 transition-all" />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Share a Spark */}
                    <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-5 md:p-6 shadow-sm border border-slate-100 group hover:border-orange-250 transition-all">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-orange-50 rounded-xl">
                                <Lightbulb className="w-5 h-5 text-orange-500" />
                            </div>
                            <div>
                                <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                                    Innovation Lab
                                </span>
                                <h4 className="text-xs font-black text-slate-800 uppercase">
                                    Share a Spark
                                </h4>
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-5 leading-relaxed font-medium">
                            Have a good idea for the Academy? Share it directly with CEO.
                        </p>
                        <button
                            onClick={() => setIsIdeasOpen(true)}
                            className="w-full py-3 bg-orange-50 hover:bg-orange-100 rounded-2xl font-black text-[9px] tracking-widest uppercase text-[#F15A24] transition-colors flex items-center justify-center gap-2"
                        >
                            Submit Idea <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>

                    {/* Request Tracker */}
                    <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-5 md:p-6 shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <History className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-black tracking-widest uppercase text-slate-400">
                                    Request Tracker
                                </span>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                                {requests.map((req) => {
                                    const { title, detail } = formatTrackerRequest(req);
                                    return (
                                        <div
                                            key={req.id}
                                            className="flex items-center justify-between py-4 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50 px-2 transition-all"
                                        >
                                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shadow-sm shrink-0 border border-slate-100">
                                                    <Calendar className="w-4 h-4 text-slate-500" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-slate-900 tracking-wide">
                                                        {title}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 font-medium mt-1 truncate tracking-tight uppercase">
                                                        {detail ? `${detail} • ` : ""}{format(new Date(req.created_at), "MMM d, h:mm a")}
                                                    </p>
                                                </div>
                                            </div>
                                            <span
                                                className={`text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ml-3 ${
                                                    req.status === "approved"
                                                        ? "bg-emerald-55/10 text-emerald-600 border border-emerald-500/20"
                                                        : req.status === "pending"
                                                          ? "bg-amber-50 text-amber-600 border border-amber-100"
                                                          : "bg-rose-50 text-rose-600 border border-rose-100"
                                                }`}
                                            >
                                                {req.status?.toUpperCase() || "PENDING"}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {requests.length === 0 && (
                                <div className="text-center py-6">
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">No requests found</p>
                                    <p className="text-[8px] text-slate-500 mt-2">Submit a request to see it here</p>
                                </div>
                            )}
                        </div>
                    </div>

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
                        <ScrollArea className="h-[250px] pr-2">
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
                                {["MY TASKS", "ALL", "URGENT", "DAILY", "COMPLETED"].map(
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
                                            {tab === "MY TASKS" &&
                                                tasks.filter((t) => t.assigned_to === profile?.id).length > 0 && (
                                                    <span className={cn(
                                                        "text-[7px] px-1.5 py-0.5 rounded-full font-black",
                                                        activeTab === tab
                                                            ? "bg-amber-500 text-white animate-pulse"
                                                            : "bg-amber-100 text-amber-700"
                                                    )}>
                                                        {tasks.filter((t) => t.assigned_to === profile?.id).length}
                                                    </span>
                                                )}
                                            {tab === "ALL" &&
                                                tasks.filter((t) => t.assigned_to !== profile?.id).length > 0 && (
                                                    <span className={cn(
                                                        "text-[7px] px-1.5 py-0.5 rounded-full font-black",
                                                        activeTab === tab
                                                            ? "bg-indigo-500 text-white animate-pulse"
                                                            : "bg-indigo-100 text-indigo-700"
                                                    )}>
                                                        {tasks.filter((t) => t.assigned_to !== profile?.id).length}
                                                    </span>
                                                )}
                                            {tab === "URGENT" &&
                                                tasks.filter((t) => t.priority === "urgent").length > 0 && (
                                                    <span className={cn(
                                                        "text-[7px] px-1.5 py-0.5 rounded-full font-black",
                                                        activeTab === tab
                                                            ? "bg-red-500 text-white animate-pulse"
                                                            : "bg-red-100 text-red-700"
                                                    )}>
                                                        {tasks.filter((t) => t.priority === "urgent").length}
                                                    </span>
                                                )}
                                            {tab === "DAILY" &&
                                                tasks.filter((t) => t.is_daily_task).length > 0 && (
                                                    <span className={cn(
                                                        "text-[7px] px-1.5 py-0.5 rounded-full font-black",
                                                        activeTab === tab
                                                            ? "bg-emerald-500 text-white animate-pulse"
                                                            : "bg-emerald-100 text-emerald-700"
                                                    )}>
                                                        {tasks.filter((t) => t.is_daily_task).length}
                                                    </span>
                                                )}
                                            {tab === "COMPLETED" &&
                                                completedTasks.length > 0 && (
                                                    <span className={cn(
                                                        "text-[7px] px-1.5 py-0.5 rounded-full font-black",
                                                        activeTab === tab
                                                            ? "bg-blue-500 text-white animate-pulse"
                                                            : "bg-blue-100 text-blue-700"
                                                    )}>
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
                                                        {isV2Enabled && task.assigned_to !== profile?.id && (task.created_by === profile?.id || (task as any).assigned_by === profile?.id) && (
                                                             <div className="flex items-center gap-0.5 text-slate-400 dark:text-zinc-500 select-none ml-1 shrink-0">
                                                                 {(() => {
                                                                     const status = (task.status as any) === "completed" || (task.status as any) === "reviewed" ? "read" : ((task as any).delivery_status || "sent");
                                                                     if (status === "sent") {
                                                                         return <Check className="w-3.5 h-3.5 text-slate-400 dark:text-zinc-500" />;
                                                                     }
                                                                     if (status === "delivered") {
                                                                         return (
                                                                             <div className="flex -space-x-1.5">
                                                                                 <Check className="w-3.5 h-3.5 text-slate-400" />
                                                                                 <Check className="w-3.5 h-3.5 text-slate-400" />
                                                                             </div>
                                                                         );
                                                                     }
                                                                     if (status === "read") {
                                                                         return (
                                                                             <div className="flex -space-x-1.5">
                                                                                 <Check className="w-3.5 h-3.5 text-[#EF4A24]" />
                                                                                 <Check className="w-3.5 h-3.5 text-[#EF4A24]" />
                                                                             </div>
                                                                         );
                                                                     }
                                                                     return null;
                                                                 })()}
                                                             </div>
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
                                                            task.reviewed_at ? (
                                                                <span className="h-8 px-3 text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-500/20 flex items-center gap-1.5">
                                                                    <Check className="w-3 h-3 text-emerald-500" />
                                                                    Reviewed ({task.reviewed_by_info || "Management"})
                                                                </span>
                                                            ) : (
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
                                    {department === "Marketing" ? "Marketing & Sales" : department} Department
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
                                                        src={isValidAvatarUrl(staff.avatar_url) ? staff.avatar_url : undefined}
                                                    />
                                                    <AvatarFallback className="bg-[#2F1E73] text-white font-black text-xs">
                                                        {staff.avatar_url && !isValidAvatarUrl(staff.avatar_url)
                                                            ? staff.avatar_url
                                                            : staff.avatar}
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
                <DialogContent className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 max-w-md rounded-3xl shadow-2xl overflow-hidden p-0 flex flex-col max-h-[85vh]">
                    <div className="px-6 pt-7 pb-4 flex items-start justify-between flex-shrink-0 border-b dark:border-zinc-800">
                        <div>
                            <DialogTitle className="text-lg font-black tracking-tight text-[#1a1a2e] dark:text-white flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#F15A24]/10 to-[#2F1E73]/10 flex items-center justify-center">
                                    <Target className="w-4 h-4 text-[#F15A24]" />
                                </div>
                                Deploy Mission
                            </DialogTitle>
                            <p className="text-[11px] text-gray-400 dark:text-white/40 font-semibold mt-1 ml-10 uppercase tracking-widest">
                                {department} Strategic Deployment
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
                                    placeholder="e.g. Critical System Audit"
                                    value={newTask.title}
                                    onChange={(e) =>
                                        setNewTask({
                                            ...newTask,
                                            title: e.target.value,
                                        })
                                    }
                                    className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-semibold text-[#1a1a2e] dark:text-white placeholder:text-gray-300 dark:placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#F15A24]/30 focus:border-[#F15A24]/50 transition-all duration-200"
                                />
                            </div>

                            {/* SECTION 2: Objective */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 dark:text-white/40">
                                    Objective
                                </label>
                                <textarea
                                    placeholder="Define purpose and expected outcome..."
                                    value={taskDescription}
                                    onChange={(e) =>
                                        setTaskDescription(e.target.value)
                                    }
                                    rows={3}
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-medium text-[#1a1a2e] dark:text-white placeholder:text-gray-300 dark:placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#2F1E73]/30 focus:border-[#2F1E73]/50 transition-all duration-200 resize-none leading-relaxed"
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
                                                                const url = accessibleStaff.find((s) => s.id === newTask.assignedTo)?.avatar_url;
                                                                return isValidAvatarUrl(url) ? url : undefined;
                                                            })()
                                                        }
                                                    />
                                                    <AvatarFallback className="bg-[#2F1E73] text-white text-[9px] font-black">
                                                        {(() => {
                                                            const s = accessibleStaff.find((s) => s.id === newTask.assignedTo);
                                                            if (s?.avatar_url && !isValidAvatarUrl(s.avatar_url)) return s.avatar_url;
                                                            return s?.name?.substring(0, 2).toUpperCase();
                                                        })()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <span className="flex-1 text-sm font-semibold text-[#1a1a2e] dark:text-white truncate">
                                                    {
                                                        accessibleStaff.find(
                                                            (s) =>
                                                                s.id ===
                                                                newTask.assignedTo,
                                                        )?.name
                                                    }
                                                </span>
                                                <X className="w-3.5 h-3.5 text-gray-300 group-hover/assignee:text-red-400 transition-colors" />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="relative">
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
                                                        className="w-full h-11 pl-9 pr-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-semibold text-[#1a1a2e] dark:text-white placeholder:text-gray-300 dark:placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#F15A24]/30 focus:border-[#F15A24]/50 transition-all duration-200"
                                                    />
                                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 dark:text-white/20" />
                                                </div>
                                                {showAssigneeDropdown &&
                                                    assigneeSearch && (
                                                        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#1a1625] border border-gray-100 dark:border-white/10 rounded-xl overflow-hidden shadow-xl">
                                                            <ScrollArea className="max-h-[160px]">
                                                                {filteredStaffForSearch.length ===
                                                                0 ? (
                                                                    <div className="p-3 text-center text-[11px] text-gray-400 font-semibold">
                                                                        No staff found
                                                                    </div>
                                                                ) : (
                                                                    filteredStaffForSearch.map(
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
                                                                                        s.name ||
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
                                                                                            : s.name?.substring(0, 2).toUpperCase()}
                                                                                    </AvatarFallback>
                                                                                </Avatar>
                                                                                <div className="text-left">
                                                                                    <div className="text-xs font-bold text-[#1a1a2e] dark:text-white">
                                                                                        {
                                                                                            s.name
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
                                            className="w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-semibold text-[#1a1a2e] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F15A24]/30 focus:border-[#F15A24]/50 transition-all duration-200 [&::-webkit-calendar-picker-indicator]:opacity-40"
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
                                            className="w-full h-11 px-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-sm font-semibold text-[#1a1a2e] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F15A24]/30 focus:border-[#F15A24]/50 transition-all duration-200"
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
                                console.log('Deploy mission button clicked');
                                assignTask(false);
                            }}
                            disabled={!newTask.title || !newTask.assignedTo}
                            className="h-11 px-6 rounded-xl bg-gradient-to-r from-[#2F1E73] to-[#F15A24] text-white text-[11px] font-black uppercase tracking-[0.15em] flex items-center gap-2 hover:shadow-lg hover:shadow-[#2F1E73]/20 hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                        >
                            <Target className="w-4 h-4" />
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
            <AddIdeaDialog
                open={isIdeasOpen}
                onOpenChange={setIsIdeasOpen}
                staffList={addIdeaStaffList}
                currentUserId={profile?.id || ""}
            />

            {/* Confetti styles */}
            <style>{`
                @keyframes executive-shimmer {
                    0% { transform: translateX(-100%) rotate(45deg); }
                    100% { transform: translateX(100%) rotate(45deg); }
                }
            `}</style>

            {/* ===== UA Messenger Drawer — Frosted White Glass ===== */}
            <UAMessengerDrawer 
                isOpen={isBellOpen}
                onClose={() => {
                    setIsBellOpen(false);
                    fetchNotifications();
                }}
                profile={profile}
            />
        </div>
    );
}
