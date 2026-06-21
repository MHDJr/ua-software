"use client";

/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, Task, Profile } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useTabResiliency } from "./tab-resiliency-engine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, isValidAvatarUrl } from "@/lib/utils";
import { UAMessengerDrawer } from "@/components/ua-messenger-drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Clock,
    Power,
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
    ChevronDown,
    Calendar,
    Bell,
    FileText,
    UserCheck,
    Settings,
    MessageSquare,
    ArrowRight,
    Zap,
    Plus,
    Timer,
    LayoutDashboard,
    LogOut,
    X,
    Send,
    Info,
    Activity,
    Target,
    Sun,
    Moon,
    Coffee,
    Sparkles,
    Smile,
    Megaphone,
    History,
    Users,
    Video,
    MapPin,
    TrendingUp,
    Award,
    Check,
    Lightbulb,
    RefreshCw,
    ListTodo,
    BarChart3,
    Home,
    User,
    Wallet,
    Circle,
    Crown,
    Loader2,
} from "lucide-react";
import { MessageDialog } from "@/components/message-dialog";
import Link from "next/link";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-utils";
import { uploadPublicFile, deleteFile } from "@/lib/storage";
import MobileNavigation from "@/components/mobile-navigation";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInMinutes } from "date-fns";
import { RequestModal } from "@/components/RequestModal";
import { LeaveRequestModal } from "@/components/LeaveRequestModal";
import { MobileSyncCard } from "@/components/MobileSyncCard";
import { StaffTaskCard } from "@/components/StaffTaskCard";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// Confetti effect function
const triggerConfetti = () => {
    const colors = ["#2F1E73", "#F15A24", "#16a34a", "#f59e0b"];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement("div");
        confetti.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            width: 8px;
            height: 8px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            pointer-events: none;
            z-index: 9999;
            border-radius: 50%;
            transform: translate(-50%, -50%);
        `;
        document.body.appendChild(confetti);

        const angle = (Math.PI * 2 * i) / confettiCount;
        const velocity = 5 + Math.random() * 5;

        let opacity = 1;
        let scale = 1;
        let x = 0;
        let y = 0;

        const animate = () => {
            x += Math.cos(angle) * velocity;
            y += Math.sin(angle) * velocity + 2;
            opacity -= 0.02;
            scale -= 0.01;

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

// Format duration function
const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:00`;
};

// Modal Component
interface ModalProps {
    title: string;
    type: string;
    onClose: () => void;
    children: React.ReactNode;
    onSubmitSuccess?: () => void;
    setInteracting?: (interacting: boolean) => void;
}

const Modal: React.FC<ModalProps> = ({ title, type, onClose, children, onSubmitSuccess, setInteracting }) => {
    const { profile } = useAuth();
    
    const handleSubmit = async () => {
        // Set user interacting to prevent refresh during submission
        if (setInteracting) setInteracting(true);
        
        if (!profile) {
            toast.error("Please login to submit requests");
            if (setInteracting) setInteracting(false);
            return;
        }

        try {
            // Collect form data based on type
            let requestData: any = {
                type: type,
                submitted_by: profile.id,
                status: 'pending',
                created_at: new Date().toISOString()
            };

            if (type === "permission") {
                // Get form values
                const form = document.querySelector('form') as HTMLFormElement;
                if (form) {
                    const formData = new FormData(form);
                    const subject = formData.get('subject') as string;
                    const priority = formData.get('priority') as string;
                    const justification = formData.get('justification') as string;
                    const cost = formData.get('cost') as string;
                    
                    // Include cost in description if provided
                    let description = `[${priority?.toUpperCase() || 'STANDARD'}] ${subject || 'No subject provided'}: ${justification || 'No justification provided'}`;
                    if (cost) {
                        description += ` | Cost: ${cost}`;
                    }
                    
                    requestData.title = "Permission Request";
                    requestData.description = description;
                    requestData.priority = priority || 'standard';
                }
            } else if (type === "leave") {
                // Get form values
                const form = document.querySelector('form') as HTMLFormElement;
                if (form) {
                    const formData = new FormData(form);
                    const category = formData.get('category') as string;
                    const reason = formData.get('reason') as string;
                    const startDate = formData.get('start_date') as string;
                    const endDate = formData.get('end_date') as string;
                    
                    requestData.title = "Leave Request";
                    requestData.description = `${category ? category.charAt(0).toUpperCase() + category.slice(1) + ' Leave' : 'Casual Leave'}: ${reason || 'No reason provided'}`;
                    requestData.dates = startDate && endDate ? `${startDate} - ${endDate}` : 'Date not specified';
                    requestData.priority = 'medium';
                    
                    // Calculate total days
                    if (startDate && endDate) {
                        const start = new Date(startDate);
                        const end = new Date(endDate);
                        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                        requestData.total_days = days;
                    }
                }
            } else if (type === "idea") {
                // Get form values
                const form = document.querySelector('form') as HTMLFormElement;
                if (form) {
                    const formData = new FormData(form);
                    const title = formData.get('idea_title') as string;
                    const description = formData.get('idea_description') as string;
                    
                    // Submit ideas to the ideas table instead of requests
                    const ideaData: any = {
                        title: title || "Idea Submission",
                        content: description || "No description provided",
                        created_by: profile.id
                    };
                    
                    // Add optional fields only if they exist in the schema
                    try {
                        // Try to include category, priority, and status if they exist
                        ideaData.category = "other";
                        ideaData.priority = 'medium';
                        ideaData.status = 'active';
                    } catch (schemaError) {
                        console.log("Some optional fields may not exist in schema, using minimal data");
                    }
                    
                    console.log("Submitting idea to ideas table:", ideaData);
                    
                    const { data, error } = await supabase.from('ideas').insert(ideaData).select();
                    
                    console.log("Idea submission result:", { data, error });
                    
                    if (error) {
                        console.error('Submit error:', error);
                        toast.error("Failed to submit idea: " + error.message);
                    } else {
                        console.log("Idea submitted successfully:", data);
                        toast.success("Idea submitted successfully!");
                        onClose();
                        // Call refresh callback
                        if (onSubmitSuccess) onSubmitSuccess();
                    }
                    return; // Exit early for ideas
                } else {
                    // Fallback for idea modal without form
                    const ideaData = {
                        title: "Idea Submission",
                        content: "Idea submitted from staff portal",
                        category: "other",
                        priority: 'medium',
                        status: 'active',
                        created_by: profile.id
                    };
                    
                    const { error } = await supabase.from('ideas').insert(ideaData);
                    
                    if (error) {
                        console.error('Submit error:', error);
                        toast.error("Failed to submit idea: " + error.message);
                    } else {
                        toast.success("Idea submitted successfully!");
                        onClose();
                        // Call refresh callback
                        if (onSubmitSuccess) onSubmitSuccess();
                    }
                    return; // Exit early for ideas
                }
            }

            // Submit to database for other request types
            const { error } = await supabase.from('requests').insert(requestData);
            
            if (error) {
                console.error('Submit error:', error);
                toast.error("Failed to submit request: " + error.message);
            } else {
                toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} request submitted successfully!`);
                onClose();
                // Call refresh callback
                if (onSubmitSuccess) onSubmitSuccess();
            }
        } catch (error) {
            console.error('Submit error:', error);
            toast.error("Failed to submit request");
        } finally {
            // Reset interaction state after submission
            if (setInteracting) setInteracting(false);
        }
    };

    return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
        ></div>
        <div className="relative bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
            <div
                style={{ backgroundColor: "#2C2171" }}
                className="p-6 text-white flex justify-between items-center"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-white/10 rounded-xl">
                        {type === "leave" && (
                            <Calendar className="w-5 h-5 text-orange-400" />
                        )}
                        {type === "permission" && (
                            <UserCheck className="w-5 h-5 text-orange-400" />
                        )}
                        {type === "work" && (
                            <Zap className="w-5 h-5 text-orange-400" />
                        )}
                        {type === "report" && (
                            <FileText className="w-5 h-5 text-orange-400" />
                        )}
                        {type === "idea" && (
                            <Lightbulb className="w-5 h-5 text-orange-400" />
                        )}
                    </div>
                    <div>
                        <h3 className="text-lg font-black uppercase tracking-tight">
                            {title}
                        </h3>
                        <p className="text-[9px] text-white/50 font-bold uppercase tracking-widest">
                            Command Portal
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>
            <div className="p-8 space-y-4">
                {children}
                <div className="pt-4 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 border border-slate-200 rounded-2xl text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        style={{ backgroundColor: "#F15A29" }}
                        className="flex-1 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-100 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                        <Send className="w-4 h-4" /> Execute
                    </button>
                </div>
            </div>
        </div>
    </div>
    );
};

// Pre-meeting tasks component
const PreMeetingTasksIndicator = ({ meetingId, userId, meetingTitle }: { meetingId: string; userId: string; meetingTitle?: string }) => {
    const [tasksCount, setTasksCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPreMeetingTasks = async () => {
            try {
                console.log("Fetching pre-meeting tasks for meeting:", meetingId, "user:", userId, "title:", meetingTitle);
                
                // Fetch all pending pre-meeting tasks for the user
                const { data: tasks, error } = await supabase
                    .from("tasks")
                    .select("*")
                    .eq("assigned_to", userId)
                    .eq("status", "pending")
                    .or(`title.ilike.%pre-meeting%,description.ilike.%preparatory task for summit%,description.ilike.%preparatory task for meeting%`);

                console.log("Pre-meeting tasks fetched:", tasks);
                console.log("Error:", error);

                if (!error && tasks) {
                    // Filter tasks that are actually related to this specific meeting
                    const meetingTasks = tasks.filter(task => {
                        const taskTitle = task.title?.toLowerCase() || '';
                        const taskDescription = task.description?.toLowerCase() || '';
                        
                        // Check if task mentions this specific meeting
                        const mentionsMeetingId = taskTitle.includes(meetingId) || taskDescription.includes(meetingId);
                        
                        // Check if task mentions meeting title (if available)
                        const mentionsMeetingTitle = meetingTitle && (
                            taskTitle.includes(meetingTitle.toLowerCase()) || 
                            taskDescription.includes(meetingTitle.toLowerCase())
                        );
                        
                        // Check for meeting-specific keywords in task
                        const hasMeetingSpecificKeywords = 
                            taskTitle.includes('summit') || taskDescription.includes('summit') ||
                            taskTitle.includes('meeting') || taskDescription.includes('meeting') ||
                            taskTitle.includes('conference') || taskDescription.includes('conference');
                        
                        // Only count tasks that are clearly related to this meeting
                        const isRelatedToThisMeeting = mentionsMeetingId || mentionsMeetingTitle;
                        
                        console.log("Task:", task.title);
                        console.log("  - Mentions meeting ID:", mentionsMeetingId);
                        console.log("  - Mentions meeting title:", mentionsMeetingTitle);
                        console.log("  - Has meeting keywords:", hasMeetingSpecificKeywords);
                        console.log("  - Is related to this meeting:", isRelatedToThisMeeting);
                        
                        // Only return tasks that are specifically related to this meeting
                        return isRelatedToThisMeeting;
                    });
                    
                    console.log("Final meeting tasks count:", meetingTasks.length);
                    setTasksCount(meetingTasks.length);
                } else {
                    console.log("No tasks found or error occurred");
                    setTasksCount(0);
                }
            } catch (error) {
                console.error("Error fetching pre-meeting tasks:", error);
                setTasksCount(0);
            } finally {
                setLoading(false);
            }
        };

        fetchPreMeetingTasks();
    }, [meetingId, userId, meetingTitle]);

    if (loading) {
        return (
            <div className="mt-2 p-2 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center gap-2">
                    <div className="animate-spin h-3 w-3 border border-orange-500 border-t-transparent rounded-full"></div>
                    <p className="text-[8px] font-bold text-orange-600">
                        Loading tasks...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="mt-2 p-2 bg-orange-50 rounded-lg border border-orange-200">
            <div className="flex items-center gap-2">
                <ListTodo className="w-3 h-3 text-orange-500" />
                <p className="text-[8px] font-bold text-orange-600">
                    Pre-meeting tasks: {tasksCount}
                </p>
                {tasksCount > 0 && (
                    <span className="text-[7px] bg-orange-500 text-white px-2 py-0.5 rounded-full">
                        Action Required
                    </span>
                )}
            </div>
        </div>
    );
};

// Helper to parse and format request tracker items
const formatTrackerRequest = (req: any) => {
    // 1. Determine Title
    let title = req.type?.replace("_", " ").toUpperCase() || "REQUEST";
    if (req.type === "access_elevation") title = "Access Elevation";
    else if (req.type === "role_change") title = "Role Elevation";
    else if (req.type === "permission") title = "Permission Access";
    else if (req.type === "leave") title = "Leave Authorization";
    else if (req.type === "budget") title = "Budget Allocation";
    
    // 2. Determine cleaned secondary metadata/description
    let detail = "";
    if (req.description) {
        let desc = req.description;
        // Check if it's a pipe-separated metadata string
        if (desc.startsWith("[") && desc.endsWith("]")) {
            const parts = desc.slice(1, -1).split("|");
            const systemPart = parts.find((p: string) => p.trim().startsWith("System:"));
            const justificationPart = parts.find((p: string) => p.trim().startsWith("Justification:"));
            
            const systemVal = systemPart ? systemPart.split(":")[1]?.trim() : "";
            const justificationVal = justificationPart ? justificationPart.split(":")[1]?.trim() : "";
            
            if (systemVal && justificationVal) {
                detail = `${systemVal} • "${justificationVal}"`;
            } else if (justificationVal) {
                detail = justificationVal;
            } else {
                detail = desc;
            }
        } else if (req.type === 'leave') {
            const descParts = desc.split(':');
            const category = descParts[0] || '';
            const reason = descParts[1] || desc;
            detail = category ? `${category} • "${reason.trim()}"` : reason.trim();
        } else if (desc.includes("|")) {
            // Replace pipes with elegant bullets
            detail = desc.split("|").map((p: string) => p.trim()).join(" • ");
        } else {
            detail = desc;
        }
    }
    
    // Truncate detail for scannability
    if (detail.length > 55) {
        detail = detail.slice(0, 52) + "...";
    }
    
    return { title, detail };
};

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

export default function StaffPortal() {
    const { user, refreshProfile } = useAuth();
    const router = useRouter();
    usePushSubscription();
    const isV2Enabled = process.env.NEXT_PUBLIC_ENABLE_V2_FEATURES === "true" || (typeof window !== "undefined" && window.localStorage.getItem("ENABLE_V2_FEATURES") === "true");
    const [profile, setProfile] = useState<Profile | null>(null);
    const [time, setTime] = useState("");
    const [vibe, setVibe] = useState("Focused");
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [expandedTask, setExpandedTask] = useState<string | null>(null);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
    const [taskCreators, setTaskCreators] = useState<Record<string, Profile>>(
        {},
    );
    const [broadcasts, setBroadcasts] = useState<any[]>([]);
    const [latestBroadcast, setLatestBroadcast] = useState<any | null>(null);
    const [communityAnnouncements, setCommunityAnnouncements] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [profiles, setProfiles] = useState<Profile[]>([]);

    // Message Actions and Reply States
    const [replyingToNotification, setReplyingToNotification] = useState<any | null>(null);
    const [replyMessage, setReplyMessage] = useState("");
    const [isSendingReply, setIsSendingReply] = useState(false);
    const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
    const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
    const [isBellOpen, setIsBellOpen] = useState(false);

    const parseMessagePayload = (msgText: string) => {
        if (!msgText) return { senderId: null, cleanText: "" };
        const match = msgText.match(/^\[sender_id:([\w-]+)\](.*)/s);
        return {
            senderId: match ? match[1] : null,
            cleanText: match ? match[2].trim() : msgText
        };
    };

    const handleSendReply = async () => {
        if (!replyingToNotification || !replyMessage.trim()) return;
        setIsSendingReply(true);
        try {
            const { senderId } = parseMessagePayload(replyingToNotification.message);
            let recipientId = senderId;
            
            // Fallback: If no sender_id is parsed, find the CEO id
            if (!recipientId) {
                recipientId = profiles.find(p => p.role === "ceo")?.id || null;
            }
            
            if (!recipientId) {
                throw new Error("Could not determine reply recipient. No sender ID found and no CEO profile available.");
            }
            
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            
            const response = await fetch("/api/send-message", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    user_id: recipientId,
                    title: `REPLY FROM ${profile?.full_name?.toUpperCase() || "STAFF"}`,
                    message: `[sender_id:${profile?.id || ""}] ${replyMessage.trim()}`,
                    type: "direct"
                })
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to send reply");
            }
            
            toast.success("Reply dispatched successfully");
            setReplyMessage("");
            setReplyingToNotification(null);
            fetchData(); // Sync live feed
        } catch (err: any) {
            console.error("Reply error:", err);
            toast.error(err.message || "Failed to send reply");
        } finally {
            setIsSendingReply(false);
        }
    };

    const handleSendInlineReply = async (notif: any) => {
        if (!replyMessage.trim()) return;
        setIsSendingReply(true);
        try {
            const { senderId } = parseMessagePayload(notif.message);
            let recipientId = senderId;
            
            // Fallback: If no sender_id is parsed, find the CEO id
            if (!recipientId) {
                recipientId = profiles.find(p => p.role === "ceo")?.id || null;
            }
            
            if (!recipientId) {
                throw new Error("Could not determine reply recipient. No sender ID found and no CEO profile available.");
            }
            
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            
            const response = await fetch("/api/send-message", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    user_id: recipientId,
                    title: `REPLY FROM ${profile?.full_name?.toUpperCase() || "STAFF"}`,
                    message: `[sender_id:${profile?.id || ""}] ${replyMessage.trim()}`,
                    type: "direct"
                })
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Failed to send reply");
            }
            
            toast.success("Reply dispatched successfully");
            setReplyMessage("");
            setActiveReplyId(null);
            fetchData(); // Sync live feed
        } catch (err: any) {
            console.error("Reply error:", err);
            toast.error(err.message || "Failed to send reply");
        } finally {
            setIsSendingReply(false);
        }
    };

    const handleMarkAsRead = async (notifId: string) => {
        try {
            const { error } = await supabase
                .from("notifications")
                .update({ read: true })
                .eq("id", notifId);
            if (error) throw error;
            
            // Update local state directly for instant feedback
            setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
            toast.success("Message marked as read");
        } catch (err: any) {
            console.error("Mark as read error:", err);
            toast.error("Failed to mark as read: " + err.message);
        }
    };
    // Add state to track user interactions
    const [isUserInteracting, setIsUserInteracting] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [userStatus, setUserStatus] = useState<"off_duty" | "on_mission">(
        "off_duty",
    );
    const [sessionStart, setSessionStart] = useState<Date | null>(null);
    const [sessionDuration, setSessionDuration] = useState(0);
    const [isOnDuty, setIsOnDuty] = useState(false);

    const [acknowledgedMessages, setAcknowledgedMessages] = useState<
        (number | string)[]
    >([]);
    // Task filter tabs state
    const [activeTab, setActiveTab] = useState("ALL");
    const [showCompleted, setShowCompleted] = useState(false);

    const handleResync = useCallback(() => {
        console.log(
            "[StaffPortal] Throttled resync event received. Refreshing data...",
        );
        fetchData();
    }, []);

    useEffect(() => {
        const handleToggle = () => setIsBellOpen(prev => !prev);
        window.addEventListener("toggle-hq-messenger", handleToggle);
        return () => window.removeEventListener("toggle-hq-messenger", handleToggle);
    }, []);

    useTabResiliency(handleResync, isRefreshing, setIsRefreshing);

    useEffect(() => {
        if (typeof window !== "undefined" && isV2Enabled) {
            const params = new URLSearchParams(window.location.search);
            if (params.get("escalated") === "true") {
                if (navigator.vibrate) {
                    navigator.vibrate([100, 50, 100]);
                }
                try {
                    const cleanUrl = window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                } catch (e) {
                    console.error("Url query param clean failed:", e);
                }
            }
        }
    }, [isV2Enabled]);

    // Manager task assignment state
    const [isAssignTaskOpen, setIsAssignTaskOpen] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [newTaskDesc, setNewTaskDesc] = useState("");
    const [newTaskPriority, setNewTaskPriority] = useState<"urgent" | "daily" | "routine">("daily");
    const [newTaskAssignee, setNewTaskAssignee] = useState("");
    const [isDeployingTask, setIsDeployingTask] = useState(false);

    const handleAssignTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) {
            toast.error("Please enter a task title");
            return;
        }
        if (!newTaskAssignee) {
            toast.error("Please select a staff member");
            return;
        }
        if (!profile) return;

        setIsDeployingTask(true);
        try {
            const { error } = await supabase
                .from('tasks')
                .insert({
                    assigned_to: newTaskAssignee,
                    title: newTaskTitle.trim(),
                    description: newTaskDesc.trim() || newTaskTitle.trim(),
                    priority: newTaskPriority === 'urgent' ? 'urgent' : newTaskPriority === 'daily' ? 'medium' : 'low',
                    priority_level: newTaskPriority,
                    task_type: 'assignment',
                    created_by: profile.id,
                    status: 'pending'
                });

            if (error) {
                console.error("Error creating task:", error);
                toast.error("Failed to assign task: " + error.message);
            } else {
                const assignedUser = profiles.find(p => p.id === newTaskAssignee);
                toast.success(`Task successfully assigned to ${assignedUser?.full_name || 'staff'}`);
                
                // Notify assignee of the new task assignment via OneSignal push notification
                if (newTaskAssignee !== profile.id) {
                    fetch("/api/messenger/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            recipientId: newTaskAssignee,
                            messageText: `Assigned new task: "${newTaskTitle.trim()}".`,
                            senderName: "UA Command Link"
                        })
                    }).catch(err => console.error("OneSignal push notification dispatch failed:", err));
                }

                // Reset form
                setNewTaskTitle("");
                setNewTaskDesc("");
                setNewTaskPriority("daily");
                setNewTaskAssignee("");
                setIsAssignTaskOpen(false);

                // Refresh data
                fetchData();
            }
        } catch (error) {
            console.error("Error in handleAssignTask:", error);
            toast.error("Failed to assign task");
        } finally {
            setIsDeployingTask(false);
        }
    };
    // Mobile bottom nav state
    const [mobileNavTab, setMobileNavTab] = useState("home");

    // Brand Palette
    const brand = {
        navy: "#2C2171",
        orange: "#F15A29",
        lightNavy: "#3F348C",
        softOrange: "#FEF2EE",
        bg: "#F4F7FE",
    };

    // 12-Hour Format Timer Logic
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            let hours = now.getHours();
            const minutes = now.getMinutes().toString().padStart(2, "0");
            const seconds = now.getSeconds().toString().padStart(2, "0");
            const ampm = hours >= 12 ? "PM" : "AM";
            hours = hours % 12;
            hours = hours ? hours : 12;
            setTime(`${hours}:${minutes}:${seconds} ${ampm}`);
        };

        updateTime();
        const timer = setInterval(updateTime, 1000);
    }, []);

    useEffect(() => {
        const handleOpenProfile = () => {
            console.log("Global open-profile-dialog event triggered in StaffPortal!");
            setIsProfileOpen(true);
        };
        if (typeof window !== "undefined") {
            window.addEventListener("open-profile-dialog", handleOpenProfile);
        }
        return () => {
            if (typeof window !== "undefined") {
                window.removeEventListener("open-profile-dialog", handleOpenProfile);
            }
        };
    }, []);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12)
            return {
                text: "Good Morning",
                icon: <Sun className="w-8 h-8 text-orange-400" />,
            };
        if (hour < 18)
            return {
                text: "Good Afternoon",
                icon: <Coffee className="w-8 h-8 text-orange-400" />,
            };
        return {
            text: "Good Evening",
            icon: <Moon className="w-8 h-8 text-orange-400" />,
        };
    };

    // Optimized fetch function with 15-second refresh
    const fetchData = useCallback(async () => {
        if (!profile) return;
        
        // Skip refresh if user is actively interacting
        if (isUserInteracting) {
            console.log('Skipping refresh - user is interacting');
            return;
        }
        
        if (!isInitialLoading) {
            setIsRefreshing(true);
        }

        try {
            // Batch all queries for better performance
            const [
                tasksData,
                completedTasksData,
                broadcastsData,
                requestsData,
                notificationsData,
                profilesData,
                participantsData,
                mNotificationsData,
            ] = await Promise.all([
                supabase
                    .from("tasks")
                    .select("*")
                    .eq("assigned_to", profile.id)
                    .in("status", ["pending", "in_progress", "in_review", "under_review", "PENDING", "IN_PROGRESS", "UNDER_REVIEW"])
                    .order("created_at", { ascending: false }),
                supabase
                    .from("tasks")
                    .select("*")
                    .eq("assigned_to", profile.id)
                    .in("status", ["completed", "COMPLETED"])
                    .order("updated_at", { ascending: false }),
                supabase
                    .from("broadcasts")
                    .select("*")
                    .gte("expires_at", new Date().toISOString())
                    .order("created_at", { ascending: false }),
                supabase
                    .from("requests")
                    .select("*, submitted_by:profiles!requests_submitted_by_fkey(id, full_name)")
                    .eq("submitted_by", profile.id)
                    .neq("type", "idea") // Exclude ideas from requests
                    .order("created_at", { ascending: false }),
                supabase
                    .from("notifications")
                    .select("*")
                    .eq("user_id", profile.id)
                    .order("created_at", { ascending: false })
                    .limit(20),
                supabase.from("profiles").select("*"),
                supabase
                    .from("meeting_participants")
                    .select("meeting_id, acknowledged_at")
                    .eq("user_id", profile.id),
                supabase
                    .from("meeting_notifications")
                    .select("*")
                    .eq("recipient_id", profile.id)
                    .is("read_at", null)
                    .order("created_at", { ascending: false }),
            ]);

            // Process data efficiently
            if (tasksData.data) {
                setTasks(tasksData.data);
                // Build creators map efficiently
                const creators: Record<string, Profile> = {};
                if (profilesData.data) {
                    const creatorIds = new Set(
                        tasksData.data.map((t: any) => t.created_by),
                    );
                    profilesData.data.forEach((p: Profile) => {
                        if (creatorIds.has(p.id)) creators[p.id] = p;
                    });
                }
                setTaskCreators(creators);
            }

            if (completedTasksData.data) {
                setCompletedTasks(completedTasksData.data);
            }

            if (broadcastsData.data) {
                setBroadcasts(broadcastsData.data);
                const ceoBroadcasts = broadcastsData.data.filter((b: any) => b.target === 'CEO_BROADCAST');
                setLatestBroadcast(ceoBroadcasts.length > 0 ? ceoBroadcasts[0] : null);
                
                const community = broadcastsData.data.filter((b: any) => b.target === 'COMMUNITY_BOARD');
                setCommunityAnnouncements(community);
            }
            if (requestsData.data) {
                setRequests(requestsData.data);
            } else {
                console.log('No requests data found');
            }
            if (notificationsData.data)
                setNotifications(notificationsData.data);
            if (profilesData.data) setProfiles(profilesData.data);

            // Process meetings data
            if (participantsData.data && participantsData.data.length > 0) {
                const meetingIds = participantsData.data.map(
                    (p) => p.meeting_id,
                );
                const { data: meetings } = await supabase
                    .from("meetings")
                    .select("*")
                    .in("id", meetingIds)
                    .gte("scheduled_at", new Date().toISOString())
                    .order("scheduled_at", { ascending: true });

                if (meetings) {
                    const merged = meetings.map((m) => ({
                        ...m,
                        acknowledged_at: participantsData.data.find(
                            (p) => p.meeting_id === m.id,
                        )?.acknowledged_at,
                    }));
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setIsRefreshing(false);
        }
    }, [profile, isUserInteracting, isInitialLoading]);

    const checkTodayAttendance = async () => {
        if (!profile) return;

        const { data: presenceData } = await supabase
            .from("staff_presence")
            .select("*")
            .eq("user_id", profile.id)
            .maybeSingle();
        if (presenceData) {
            setUserStatus(
                presenceData.status === "online" ? "on_mission" : "off_duty",
            );
            if (presenceData.session_start)
                setSessionStart(new Date(presenceData.session_start));
        }
    };

    const handleMissionToggle = async () => {
        if (!profile) return;

        if (userStatus === "off_duty") {
            // Start mission - create attendance record
            const { error: attendanceError } = await supabase
                .from("staff_attendance")
                .insert({
                    user_id: profile.id,
                    clock_in: new Date().toISOString(),
                    date: new Date().toISOString().split("T")[0],
                    status: "active",
                });

            // Update presence
            const { error: presenceError } = await supabase
                .from("staff_presence")
                .upsert({
                    user_id: profile.id,
                    status: "online",
                    updated_at: new Date().toISOString(),
                    session_start: new Date().toISOString(),
                });

            // Create CEO notification
            if (!attendanceError && !presenceError) {
                let targetCeoId = profiles.find(p => p.role === "ceo")?.id;
                if (!targetCeoId) {
                    const { data: ceoProfile } = await supabase
                        .from("profiles")
                        .select("id")
                        .eq("role", "ceo")
                        .limit(1)
                        .maybeSingle();
                    if (ceoProfile) targetCeoId = ceoProfile.id;
                }

                if (targetCeoId) {
                    try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const token = session?.access_token;
                        
                        await fetch("/api/send-message", {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                            },
                            body: JSON.stringify({
                                user_id: targetCeoId,
                                title: "Mission Start Alert",
                                message: `${profile.full_name || profile.email} is now ON MISSION`,
                                type: "alert"
                            })
                        });
                    } catch (err) {
                        console.error("Failed to notify CEO of mission start:", err);
                    }
                }

                setUserStatus("on_mission");
                setSessionStart(new Date());
                setIsOnDuty(true);
                localStorage.setItem("staff_active_session", "true");
                toast.success("Mission started - ON DUTY");
            }
        } else {
            // End mission - update attendance record
            const { error: attendanceError } = await supabase
                .from("staff_attendance")
                .update({
                    clock_out: new Date().toISOString(),
                    status: "completed",
                })
                .eq("user_id", profile.id)
                .eq("date", new Date().toISOString().split("T")[0])
                .is("clock_out", null);

            // Update presence
            const { error: presenceError } = await supabase
                .from("staff_presence")
                .update({
                    status: "offline",
                    updated_at: new Date().toISOString(),
                })
                .eq("user_id", profile.id);

            if (!attendanceError && !presenceError) {
                setUserStatus("off_duty");
                setSessionStart(null);
                setIsOnDuty(false);
                localStorage.removeItem("staff_active_session");
                toast.success("Mission ended - OFF DUTY");
            }
        }
    };

    // Load user profile and initial data
    useEffect(() => {
        if (!user) return;

        const loadProfile = async () => {
            const { data: profileData, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (error) {
                console.error("Profile load error:", error);
                return;
            }

            setProfile(profileData);
            setIsInitialLoading(false);
        };

        loadProfile();
    }, [user]);

    // Load data when profile is available
    useEffect(() => {
        if (!profile) return;

        // Instant load
        fetchData();
        checkTodayAttendance();

        // Optimized 15-second polling
        const interval = setInterval(fetchData, 15000);

        // Zero-Lag Real-Time Pipeline for Broadcasts & Notifications
        const instanceId = Math.random().toString(36).substring(7);
        const channel = supabase
            .channel(`broadcasts-realtime-${instanceId}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "broadcasts" },
                () => {
                    console.log("Real-time Broadcast Update Detected!");
                    fetchData();
                }
            )
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "notifications" },
                () => {
                    console.log("Real-time Notification Update Detected!");
                    fetchData();
                }
            )
            .subscribe();

        const handleHqUpdated = () => {
            console.log("HQ Messenger Update Detected!");
            fetchData();
        };
        window.addEventListener("hq-messenger-updated", handleHqUpdated);

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
            window.removeEventListener("hq-messenger-updated", handleHqUpdated);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [profile?.id, fetchData]);


    // Session timer effect
    useEffect(() => {
        if (sessionStart) {
            const interval = setInterval(() => {
                setSessionDuration(Math.floor((new Date().getTime() - sessionStart.getTime()) / 1000));
            }, 1000);

            return () => clearInterval(interval);
        }
    }, [sessionStart]);

    // UAAE V2: Automatically mark all tasks as read when they are loaded in the Staff Portal
    useEffect(() => {
        if (!isV2Enabled) return;
        
        const unreadTasks = tasks.filter((t) => (t as any).delivery_status !== "read");
        const unreadCompleted = completedTasks.filter((t) => (t as any).delivery_status !== "read");
        
        if (unreadTasks.length > 0 || unreadCompleted.length > 0) {
            const allUnreadIds = [
                ...unreadTasks.map((t) => t.id),
                ...unreadCompleted.map((t) => t.id)
            ];
            
            console.log("UAAE V2: Auto-marking tasks as read upon visibility:", allUnreadIds);
            
            const nowIso = new Date().toISOString();
            if (unreadTasks.length > 0) {
                setTasks((prev) =>
                    prev.map((t) =>
                        (t as any).delivery_status !== "read"
                            ? { ...t, delivery_status: "read", read_at: nowIso }
                            : t
                    )
                );
            }
            if (unreadCompleted.length > 0) {
                setCompletedTasks((prev) =>
                    prev.map((t) =>
                        (t as any).delivery_status !== "read"
                            ? { ...t, delivery_status: "read", read_at: nowIso }
                            : t
                    )
                );
            }
            
            supabase
                .from("tasks")
                .update({
                    delivery_status: "read",
                    read_at: nowIso
                })
                .in("id", allUnreadIds)
                .then(({ error }) => {
                    if (error) {
                        console.error("Failed to auto-update task read state in database:", error);
                    } else {
                        console.log("Successfully auto-marked tasks as read in database");
                    }
                });
        }
    }, [tasks, completedTasks, isV2Enabled]);

    // Filter tasks based on active tab
    const filteredTasks = useMemo(() => {
        const taskList = tasks.map((task) => ({
            ...task,
            priority: task.priority,
            category:
                task.priority === "urgent"
                    ? "URGENT"
                    : task.priority === "high"
                      ? "HIGH"
                      : "MEDIUM",
            description: task.description || "No description provided",
            status: ((task.status as any) === "PENDING" || (task.status as any) === "pending")
                ? "PENDING"
                : ((task.status as any) === "IN_PROGRESS" || (task.status as any) === "in_progress")
                    ? "IN_PROGRESS"
                    : ((task.status as any) === "UNDER_REVIEW" || (task.status as any) === "in_review" || (task.status as any) === "under_review")
                        ? "UNDER_REVIEW"
                        : ((task.status as any) === "COMPLETED" || (task.status as any) === "completed")
                            ? "COMPLETED"
                            : "PENDING",
            progress: typeof task.progress === "number" ? task.progress : 0,
            isDaily: task.is_daily_task || task.priority === "urgent",
            is_daily_task: task.is_daily_task,
            dueDate: task.due_date
                ? format(new Date(task.due_date), "MMM d, h:mm a")
                : null,
            due_date: task.due_date,
        }));

        if (activeTab === "ALL") return taskList;
        if (activeTab === "URGENT")
            return taskList.filter((task) => task.priority === "urgent");
        if (activeTab === "DAILY")
            return taskList.filter((task) => task.is_daily_task === true);
        return taskList;
    }, [tasks, activeTab]);

    const handleAcknowledge = (id: number | string) => {
        if (!acknowledgedMessages.includes(id)) {
            setAcknowledgedMessages([...acknowledgedMessages, id]);
        }
    };

    const removeCompletedTask = async (taskId: string) => {
        try {
            const { error } = await supabase
                .from("tasks")
                .delete()
                .eq("id", taskId);
                
            if (error) {
                console.error("Delete task error:", error);
                toast.error("Failed to delete task: " + error.message);
                return;
            }
            
            toast.success("Task permanently deleted");
            fetchData();
        } catch (error) {
            console.error("Delete task exception:", error);
            toast.error("Something went wrong deleting task");
        }
    };

    const clearAllCompletedTasks = async () => {
        if (!confirm("Delete all completed tasks permanently? This action cannot be undone.")) return;
        
        try {
            const { error } = await supabase
                .from("tasks")
                .delete()
                .eq("assigned_to", profile?.id)
                .eq("status", "completed");
                
            if (error) {
                console.error("Clear all completed error:", error);
                toast.error("Failed to delete completed tasks: " + error.message);
                return;
            }
            
            toast.success("All completed tasks permanently deleted");
            fetchData();
        } catch (error) {
            console.error("Clear all completed exception:", error);
            toast.error("Something went wrong deleting completed tasks");
        }
    };

    const startMission = async (taskId: string) => {
        try {
            console.log('Starting mission for task:', taskId);
            const { error } = await supabase
                .from("tasks")
                .update({ 
                    status: "IN_PROGRESS",
                    progress: 10,
                    updated_at: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
                .eq("id", taskId);
                
            if (error) {
                console.error("Start mission error:", error);
                toast.error("Failed to start mission: " + error.message);
                return;
            }
            
            toast.success("Mission started! Status set to IN PROGRESS");
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: "IN_PROGRESS", progress: 10 } : t));
        } catch (err) {
            console.error("Start mission exception:", err);
            toast.error("Something went wrong starting the mission");
        }
    };

    const updateTaskProgress = async (taskId: string, progressVal: number) => {
        try {
            console.log(`Updating task ${taskId} progress to:`, progressVal);
            const isCompleted = progressVal === 100;
            const targetTask = tasks.find(t => t.id === taskId);
            
            // Cache current state for rollback on error
            const previousTasks = [...tasks];
            const previousCompleted = [...completedTasks];

            // Update local state immediately for instant visual response
            if (isCompleted && targetTask) {
                const updated: Task = { ...targetTask, progress: 100, status: "COMPLETED" as any };
                setTasks(prev => prev.filter(t => t.id !== taskId));
                setCompletedTasks(prev => [updated, ...prev]);
            } else {
                setTasks(prev => prev.map(t => t.id === taskId ? { 
                    ...t, 
                    progress: progressVal,
                } : t));
            }

            const updatePayload: any = {
                progress: progressVal,
                updated_at: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            if (isCompleted) {
                updatePayload.status = "COMPLETED";
            }

            const { error } = await supabase
                .from("tasks")
                .update(updatePayload)
                .eq("id", taskId);
                
            if (error) {
                console.error("Update progress error:", error);
                toast.error("Failed to update progress in database");
                // Rollback on error
                setTasks(previousTasks);
                setCompletedTasks(previousCompleted);
                return;
            }
            if (isCompleted) {
                toast.success("Mission complete! Moved to completed tab.");
            }
        } catch (err) {
            console.error("Update progress exception:", err);
            toast.error("Something went wrong updating progress");
        }
    };

    const handleTaskClick = async (task: Task) => {
        const isOpening = expandedTask !== task.id;
        setExpandedTask(isOpening ? task.id : null);

        // UAAE V2 Read Receipt Logic Gated Tightly
        if (isOpening && isV2Enabled) {
            if ((task as any).delivery_status !== "read") {
                try {
                    // Update state locally for instant UI response
                    setTasks((prev) =>
                        prev.map((t) =>
                            t.id === task.id
                                ? { ...t, delivery_status: "read", read_at: new Date().toISOString() }
                                : t
                        )
                    );
                    setCompletedTasks((prev) =>
                        prev.map((t) =>
                            t.id === task.id
                                ? { ...t, delivery_status: "read", read_at: new Date().toISOString() }
                                : t
                        )
                    );

                    // Update Supabase ledger
                    const { error } = await supabase
                        .from("tasks")
                        .update({
                            delivery_status: "read",
                            read_at: new Date().toISOString()
                        })
                        .eq("id", task.id);
                        
                    if (error) {
                        console.error("Failed to update task read state:", error);
                        toast.error(`Read status update failed: ${error.message}`);
                    } else {
                        console.log("Successfully marked task as read in database");
                    }
                } catch (err: any) {
                    console.error("Failed to update task read state:", err);
                    toast.error(`Failed to update task read state: ${err.message}`);
                }
            }
        }
    };

    const handleMarkSeenLocal = useCallback((taskId: string) => {
        setTasks((prev) =>
            prev.map((t) =>
                t.id === taskId
                    ? { ...t, is_staff_seen: true, staff_seen_at: new Date().toISOString() }
                    : t
            )
        );
        setCompletedTasks((prev) =>
            prev.map((t) =>
                t.id === taskId
                    ? { ...t, is_staff_seen: true, staff_seen_at: new Date().toISOString() }
                    : t
            )
        );
    }, []);

    const submitForReview = async (taskId: string) => {
        try {
            console.log('Submitting task for review:', taskId);
            
            // Cache current state for rollback on error
            const previousTasks = [...tasks];
            const previousCompleted = [...completedTasks];

            // Optimistic move
            const targetTask = tasks.find(t => t.id === taskId);
            if (targetTask) {
                const updated: Task = { ...targetTask, progress: 100, status: "COMPLETED" as any };
                setTasks(prev => prev.filter(t => t.id !== taskId));
                setCompletedTasks(prev => [updated, ...prev]);
            }

            const { error } = await supabase
                .from("tasks")
                .update({ 
                    status: "COMPLETED",
                    progress: 100,
                    updated_at: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
                .eq("id", taskId);
                
            if (error) {
                console.error("Submit for review error:", error);
                toast.error("Failed to submit task for review: " + error.message);
                // Rollback
                setTasks(previousTasks);
                setCompletedTasks(previousCompleted);
                return;
            }
            
            toast.success("Task completed! Moved to completed section.");
        } catch (err) {
            console.error("Submit for review exception:", err);
            toast.error("Something went wrong submitting task for review");
        }
    };

    const markAsCompleted = async (taskId: string) => {
        try {
            console.log('Marking task as completed:', taskId);
            
            // Cache current state for rollback on error
            const previousTasks = [...tasks];
            const previousCompleted = [...completedTasks];

            // Optimistic move
            const targetTask = tasks.find(t => t.id === taskId);
            if (targetTask) {
                const updated: Task = { ...targetTask, progress: 100, status: "COMPLETED" as any };
                setTasks(prev => prev.filter(t => t.id !== taskId));
                setCompletedTasks(prev => [updated, ...prev]);
            }

            const { error } = await supabase
                .from("tasks")
                .update({ 
                    status: "COMPLETED",
                    progress: 100,
                    updated_at: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                })
                .eq("id", taskId);
                
            if (error) {
                console.error("Mark as completed error:", error);
                toast.error("Failed to mark task as completed: " + error.message);
                // Rollback
                setTasks(previousTasks);
                setCompletedTasks(previousCompleted);
                return;
            }
            
            toast.success("Task marked as completed!");
        } catch (err) {
            console.error("Mark as completed exception:", err);
            toast.error("Something went wrong marking task as completed");
        }
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            router.push("/");
        } catch (error) {
            console.error("Logout error:", error);
            toast.error("Failed to logout");
        }
    };

    const today = format(new Date(), "yyyy-MM-dd");
    const urgentToday = useMemo(
        () =>
            tasks.filter(
                (t) =>
                    t.priority === "urgent" &&
                    t.due_date === today &&
                    ["pending", "in_progress"].includes(t.status || ""),
            ),
        [tasks, today],
    );

    // Calculate efficiency
    const efficiency = useMemo(() => {
        const completedToday = tasks.filter(
            (t) => t.status === "completed",
        ).length;
        const totalTasks = tasks.length;
        return totalTasks > 0
            ? Math.round((completedToday / totalTasks) * 100)
            : 0;
    }, [tasks]);

    const canSendMessage = useMemo(() => {
        if (!profile) return false;
        const role = profile.role?.toLowerCase();
        const dept = profile.department?.toLowerCase();
        return role === "ceo" || role === "manager" || profile.is_manager || dept === "administration" || dept === "admin";
    }, [profile]);

    const isHigherOfficial = (senderProfile: Profile | null, title?: string) => {
        if (senderProfile) {
            const role = senderProfile.role?.toLowerCase();
            const dept = senderProfile.department?.toLowerCase();
            return role === "ceo" || role === "manager" || senderProfile.is_manager || dept === "administration" || dept === "admin";
        }
        const t = title?.toLowerCase() || "";
        return t.includes("ceo") || t.includes("manager") || t.includes("administrator");
    };

    const renderLiveFeedItem = (notif: any, isMobile: boolean = false) => {
        const isUrgent = notif.type === "alert";
        const { senderId, cleanText } = parseMessagePayload(notif.message);
        const senderProfile = profiles.find(p => p.id === senderId);
        const isFromHigher = isHigherOfficial(senderProfile || null, notif.title);
        const isUnread = !notif.read;

        const senderName = senderProfile 
            ? senderProfile.full_name 
            : (notif.title?.toUpperCase().includes("CEO") ? "SALIM PA (CEO)" : (notif.title || "USTHAD ACADEMY"));
            
        const senderDesignation = senderProfile 
            ? (senderProfile.role === "ceo" ? "CEO" : senderProfile.is_manager ? `${senderProfile.department} Manager` : senderProfile.role?.toUpperCase()) 
            : (notif.title?.toUpperCase().includes("CEO") ? "CEO" : "");

        const cardId = notif.id;

        return (
            <motion.div
                key={notif.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                    "p-4 border transition-all duration-300 relative overflow-hidden flex flex-col gap-2 group hover:scale-[1.02] bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 text-left",
                    isMobile ? "rounded-xl" : "rounded-2xl",
                    isUrgent && "bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20 hover:border-red-500/50 hover:bg-red-500/15 cursor-pointer",
                    isUnread && isFromHigher && "border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.12)] animate-[pulse_3s_infinite]"
                )}
                onClick={() => {
                    if (isV2Enabled && isUrgent && navigator.vibrate) {
                        navigator.vibrate([100, 50, 100]);
                    }
                }}
            >
                {/* High Priority Accent Bar */}
                {isUnread && isFromHigher && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-yellow-500 via-amber-500 to-yellow-600 shadow-[0_0_12px_#f59e0b] rounded-l-2xl animate-pulse" />
                )}

                {/* Card Header */}
                <div className="flex justify-between items-start gap-2">
                    <div className="flex flex-col gap-0.5 min-w-0">
                        <span className={cn(
                            "text-xs font-black tracking-wide flex items-center gap-1.5 truncate",
                            isFromHigher ? "text-amber-400 font-extrabold" : "text-white"
                        )}>
                            {senderName}
                            {senderDesignation && (
                                <span className="text-[8px] font-black tracking-widest text-[#F15A24] bg-[#F15A24]/10 px-1.5 py-0.5 rounded uppercase flex-shrink-0">
                                    {senderDesignation}
                                </span>
                            )}
                        </span>
                        <span className="text-[8px] text-white/35 font-bold uppercase tracking-wider">
                            {format(new Date(notif.created_at), 'MMM d, h:mm a')}
                        </span>
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                        {isUnread && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        )}
                        <Badge 
                            className={cn(
                                "text-[7px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border-none",
                                isUrgent 
                                    ? "bg-red-500 text-white animate-pulse" 
                                    : "bg-indigo-500/20 text-indigo-300"
                            )}
                        >
                            {notif.title || (isUrgent ? "URGENT ALERT" : "MESSAGE")}
                        </Badge>
                    </div>
                </div>

                {/* Message Body */}
                <p className="text-xs font-medium leading-relaxed text-slate-100 tracking-wide break-words mt-1">
                    {cleanText}
                </p>

                {/* Glassmorphic Action Footer */}
                <div className="flex items-center justify-between border-t border-white/5 pt-2 mt-2">
                    {isUnread ? (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notif.id);
                            }}
                            className="flex items-center gap-1.5 text-[8px] font-bold uppercase tracking-wider text-emerald-400 hover:text-emerald-350 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 rounded-lg transition-all"
                        >
                            <Check className="w-2.5 h-2.5" /> Read
                        </button>
                    ) : (
                        <span className="text-[8px] text-white/30 font-bold uppercase tracking-wider">✓ Read</span>
                    )}

                    {senderId && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveReplyId(prev => prev === cardId ? null : cardId);
                                setReplyMessage("");
                            }}
                            className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-655/30 px-2 py-1 rounded-lg transition-all"
                        >
                            <MessageSquare className="w-2.5 h-2.5" /> {activeReplyId === cardId ? "Cancel" : "Reply"}
                        </button>
                    )}
                </div>

                {/* Inline Reply Form with Framer Motion */}
                <AnimatePresence>
                    {activeReplyId === cardId && (
                        <motion.div
                            initial={{ height: 0, opacity: 0, marginTop: 0 }}
                            animate={{ height: "auto", opacity: 1, marginTop: 8 }}
                            exit={{ height: 0, opacity: 0, marginTop: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <form 
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSendInlineReply(notif);
                                }}
                                className="relative flex items-center bg-white/5 border border-white/10 rounded-xl p-1 focus-within:border-amber-500/50 transition-colors"
                            >
                                <input
                                    type="text"
                                    value={replyMessage}
                                    onChange={(e) => setReplyMessage(e.target.value)}
                                    placeholder={`Reply to ${senderName}...`}
                                    className="w-full bg-transparent text-xs text-white placeholder-white/35 px-3 py-2 focus:outline-none pr-10"
                                    disabled={isSendingReply}
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={isSendingReply || !replyMessage.trim()}
                                    className="absolute right-1 w-8 h-8 rounded-lg bg-indigo-650 hover:bg-indigo-550 text-white flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSendingReply ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Send className="w-3.5 h-3.5" />
                                    )}
                                </button>
                            </form>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        );
    };

    if (isInitialLoading) {
        return (
            <div className="min-h-screen bg-[#F4F7FE] flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-[#2F1E73] border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F4F7FE] text-slate-800 font-sans selection:bg-orange-100 pt-[calc(env(safe-area-inset-top)+4rem)] md:pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8 max-w-[100vw] overflow-x-hidden">
            {/* Mobile-Only Header Status Bar - Hidden (MobileBottomNav handles this) */}
            <div className="hidden md:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between sticky top-0 z-40">
                <div className="flex items-center gap-2">
                    <div className="relative h-8 w-8">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/images/usthadacademylogo2.svg"
                            alt="UA Logo"
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#2F1E73]">
                        Staff Hub
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div
                            className={`w-2 h-2 rounded-full ${isOnDuty ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}
                        ></div>
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">
                            {isOnDuty ? "On Duty" : "Off Duty"}
                        </span>
                    </div>
                    {/* Mobile Logout Button */}
                    <button
                        onClick={handleLogout}
                        className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 hover:bg-red-100 transition-colors"
                        title="Logout"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Desktop Header - Hidden on Mobile */}
            <header className="hidden md:flex h-20 bg-white border-b border-slate-200 items-center justify-between px-8 sticky top-0 z-50">
                <div className="flex items-center gap-6">
                    <div className="flex items-center gap-4">
                        {/* Logo with new image */}
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
                        {profile?.is_manager ? (
                            <div className="hidden md:flex items-center px-3 py-1.5 bg-[#F15A29]/10 rounded-lg border border-[#F15A29]/20 animate-pulse">
                                <span className="text-sm font-bold text-[#F15A29] uppercase tracking-wider flex items-center gap-1.5">
                                    <Crown className="w-4 h-4 text-[#F15A29]" />
                                    {profile?.department?.toUpperCase()} MANAGER CONTROL CENTER
                                </span>
                            </div>
                        ) : (
                            <div className="hidden md:flex items-center px-3 py-1.5 bg-[#2F1E73]/10 rounded-lg">
                                <span className="text-sm font-semibold text-[#2F1E73] uppercase tracking-wider">
                                    STAFF HUB | COMMAND CENTER
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <button
                        onClick={handleMissionToggle}
                        className={`hidden md:flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all ${
                            isOnDuty
                                ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                : "bg-slate-50 border-slate-200 text-slate-400"
                        }`}
                    >
                        <div
                            className={`w-2 h-2 rounded-full ${isOnDuty ? "bg-emerald-500 animate-pulse" : "bg-slate-300"}`}
                        ></div>
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            {isOnDuty ? "On Duty" : "On Break"}
                        </span>
                    </button>

                    <button
                        onClick={fetchData}
                        disabled={isRefreshing}
                        className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-100 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 rounded-full transition-all duration-300 shadow-sm text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Refresh
                    </button>

                    {/* Sales Report Button - Only for Sales Staff without Manager Access */}
                    {(profile?.department === "Sales" || profile?.role === "sales" || profile?.is_sales_staff) && !profile?.is_manager && (
                        <a
                            href="/sales"
                            className="relative group flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 hover:scale-[1.02]"
                            style={{
                                backgroundColor: brand.navy,
                                boxShadow: `0 4px 14px ${brand.navy}40`,
                            }}
                        >
                            <BarChart3 className="w-4 h-4 text-white" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                Sales Page
                            </span>
                        </a>
                    )}

                    {/* Accounts Button - Only for Accounts Staff without Manager Access */}
                    {(profile?.department === "Finance" || profile?.department === "Accounts" || profile?.role === "accounts") && !profile?.is_manager && (
                        <a
                            href="/accounts"
                            className="relative group flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 hover:scale-[1.02]"
                            style={{
                                backgroundColor: "#ff4d00",
                                boxShadow: `0 4px 14px rgba(255, 77, 0, 0.4)`,
                            }}
                        >
                            <Wallet className="w-4 h-4 text-white" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                Accounts
                            </span>
                        </a>
                    )}

                    {/* Manage Button - Only for Staff with Manager Access */}
                    {profile?.is_manager && (
                        <a
                            href="/ceo"
                            className="relative group flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 hover:scale-[1.02]"
                            style={{
                                backgroundColor: brand.orange,
                                boxShadow: `0 4px 14px ${brand.orange}40`,
                            }}
                        >
                            <Users className="w-4 h-4 text-white" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">
                                Manage
                            </span>
                        </a>
                    )}

                    {canSendMessage && (
                        <Button
                            onClick={() => setIsMessageDialogOpen(true)}
                            className="hidden md:flex items-center gap-2 px-4 py-2.5 bg-[#2F1E73] hover:bg-[#201552] text-white rounded-full transition-all duration-300 shadow-sm text-[10px] font-black uppercase tracking-widest border border-indigo-500/20"
                        >
                            <Send className="w-3 h-3 text-white" />
                            Send Message
                        </Button>
                    )}

                    {/* Header Bell Icon / UA Messenger Toggle */}
                    <div className="relative">
                        {(() => {
                            const count = notifications.filter(n => n.type === "direct" && !n.read).length;

                            return (
                                <>
                                    <style>{`
                                        @keyframes bell-shake {
                                            0%, 100% { transform: rotate(0deg); }
                                            15% { transform: rotate(-12deg); }
                                            30% { transform: rotate(10deg); }
                                            45% { transform: rotate(-8deg); }
                                            60% { transform: rotate(6deg); }
                                            75% { transform: rotate(-4deg); }
                                            90% { transform: rotate(2deg); }
                                        }
                                        .animate-bell-shake {
                                            animation: bell-shake 0.8s ease-in-out infinite;
                                            transform-origin: top center;
                                        }
                                    `}</style>
                                    <button
                                        onClick={() => setIsBellOpen(prev => !prev)}
                                        className={cn(
                                            "relative p-2.5 rounded-2xl transition-all duration-300 shadow-sm shrink-0 border",
                                            isBellOpen
                                                ? "bg-gradient-to-br from-[#31267D] to-[#4f3fbf] text-white border-[#31267D] shadow-[#31267D]/30"
                                                : count > 0 
                                                    ? "bg-orange-50 hover:bg-orange-100 text-orange-600 border-orange-200 ring-4 ring-orange-500/20 shadow-[0_0_15px_rgba(241,90,36,0.35)] animate-bell-shake" 
                                                    : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600"
                                        )}
                                        title="UA Messenger"
                                    >
                                        <Bell className="w-3.5 h-3.5" />
                                        {count > 0 && (
                                            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-[8px] font-black text-white shadow-lg animate-pulse">
                                                {count}
                                            </span>
                                        )}
                                    </button>
                                </>
                            );
                        })()}
                    </div>

                    <button
                        onClick={handleLogout}
                        className="hidden md:flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 hover:border-red-300 hover:bg-red-100 rounded-full transition-all duration-300 shadow-sm text-[10px] font-black uppercase tracking-widest text-red-600 hover:text-red-800"
                        title="Logout"
                    >
                        <LogOut className="w-3 h-3" />
                        Logout
                    </button>

                    <div
                        onClick={() => setIsProfileOpen(true)}
                        style={{ backgroundColor: brand.navy }}
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold shadow-md cursor-pointer hover:scale-105 transition-all duration-300 relative overflow-hidden shrink-0"
                    >
                        {profile?.avatar_url && isValidAvatarUrl(profile.avatar_url) ? (
                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : profile?.avatar_url ? (
                            <span className="text-lg">{profile.avatar_url}</span>
                        ) : (
                            profile?.full_name?.[0] || profile?.email?.[0] || "U"
                        )}
                    </div>
                </div>
            </header>

            <main className="p-4 md:p-8 max-w-[1700px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8">
                {/* Top Greeting Banner - Mobile Optimized */}
                <div className="col-span-1 md:col-span-12">
                    <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-4 md:p-8 border border-slate-100 shadow-sm flex flex-col gap-4 md:flex-row md:items-center md:justify-between relative overflow-hidden">
                        <div className="flex items-center gap-3 md:gap-6 relative z-10">
                            <div className="w-12 h-12 md:w-20 md:h-20 bg-orange-50 rounded-xl md:rounded-[2rem] flex items-center justify-center shadow-inner shrink-0">
                                {React.cloneElement(getGreeting().icon as React.ReactElement, { className: "w-5 h-5 md:w-8 md:h-8 text-orange-400" })}
                            </div>
                            <div className="min-w-0 flex-1">
                                {profile?.is_manager ? (
                                    <>
                                        <h2 className="text-lg md:text-3xl font-black text-slate-900 tracking-tighter uppercase leading-tight flex items-center gap-2 md:gap-3 flex-wrap">
                                            <span className="bg-gradient-to-r from-[#2F1E73] to-[#F15A29] bg-clip-text text-transparent flex items-center gap-2">
                                                <Crown className="w-5 h-5 md:w-8 md:h-8 text-[#F15A29] animate-bounce" />
                                                {profile?.department || "DEPARTMENT"} MANAGER COMMAND
                                            </span>
                                        </h2>
                                        <p className="hidden md:flex text-slate-400 font-bold text-sm mt-2 items-center gap-2 italic">
                                            &quot;Oversight, alignment, and velocity command console.&quot;{" "}
                                            <Sparkles className="w-4 h-4 text-orange-500 animate-pulse" />
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <h2 className="text-lg md:text-3xl font-black text-slate-900 tracking-tighter uppercase leading-tight">
                                            {getGreeting().text},{" "}
                                            <span style={{ color: brand.navy }}>
                                                {profile?.full_name
                                                    ?.split(" ")[0]
                                                    ?.toUpperCase() || "USER"}
                                            </span>
                                        </h2>
                                        <p className="hidden md:flex text-slate-400 font-bold text-sm mt-2 items-center gap-2 italic">
                                            &quot;Your focus is the academy&apos;s greatest asset
                                            today.&quot;{" "}
                                            <Sparkles className="w-4 h-4 text-orange-400" />
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Mobile Stats Row - Horizontal Cards */}
                        <div className="flex md:hidden items-center gap-2 relative z-10">
                            <div className="flex-1 bg-slate-50 rounded-xl p-2 border border-slate-100 text-center">
                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                    Score
                                </p>
                                <div className="flex items-center justify-center gap-1">
                                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                                    <span className="text-sm font-black text-slate-800">
                                        {efficiency}%
                                    </span>
                                </div>
                            </div>
                            <div className="flex-1 bg-slate-50 rounded-xl p-2 border border-slate-100 text-center">
                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                    Rank
                                </p>
                                <div className="flex items-center justify-center gap-1">
                                    <Award className="w-3 h-3 text-orange-500" />
                                    <span className="text-sm font-black text-slate-800">
                                        Top 5
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={() =>
                                    setVibe(
                                        vibe === "Focused"
                                            ? "Unstoppable"
                                            : "Focused",
                                    )
                                }
                                className="flex-1 bg-orange-50 rounded-xl p-2 border border-orange-100 text-center"
                            >
                                <p className="text-[8px] font-black uppercase text-slate-400 tracking-wider">
                                    Vibe
                                </p>
                                <p className="text-xs font-black text-orange-500 flex items-center justify-center gap-1">
                                    <Smile className="w-3 h-3" /> {vibe}
                                </p>
                            </button>
                        </div>

                        <div className="hidden xl:flex items-center gap-8 relative z-10 px-8 border-x border-slate-100">
                            <div className="text-center">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">
                                    Weekly Score
                                </p>
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                                    <span className="text-xl font-black text-slate-800">
                                        {efficiency}%
                                    </span>
                                </div>
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">
                                    Rank
                                </p>
                                <div className="flex items-center gap-2">
                                    <Award className="w-4 h-4 text-orange-500" />
                                    <span className="text-xl font-black text-slate-800">
                                        Top 5
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="hidden md:flex items-center gap-4 bg-slate-50 p-3 rounded-3xl border border-slate-100 relative z-10">
                            <div className="px-4 py-2 bg-white rounded-2xl shadow-sm min-w-[140px]">
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">
                                    Shift Clock (12h)
                                </p>
                                <p className="text-lg font-black text-slate-800 tabular-nums">
                                    {time}
                                </p>
                            </div>
                            <div className="h-10 w-[1px] bg-slate-200"></div>
                            <button
                                onClick={() =>
                                    setVibe(
                                        vibe === "Focused"
                                            ? "Unstoppable"
                                            : "Focused",
                                    )
                                }
                                className="flex flex-col items-center px-4 py-2 hover:bg-white rounded-2xl transition-all"
                            >
                                <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-1">
                                    Current Vibe
                                </p>
                                <p className="text-xs font-black text-orange-500 flex items-center gap-1 uppercase">
                                    <Smile className="w-3 h-3" /> {vibe}
                                </p>
                            </button>
                        </div>

                        <div className="absolute top-0 right-0 w-64 h-full bg-gradient-to-l from-orange-50/50 to-transparent pointer-events-none"></div>
                    </div>
                </div>

                {/* Mobile: Live Feed at Top (Removed - Migrated to Header Bell Popover) */}

                {/* Left Column - Hidden on mobile (moved to bottom or inside Mission Control flow) */}
                <div className="col-span-12 lg:col-span-3 space-y-6 hidden lg:block">
                    {/* Live Feed Sidebar Card (Removed - Migrated to Header Bell Popover) */}

                    {/* New Share Idea Card */}
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2rem] p-7 shadow-[0_12px_40px_rgba(0,0,0,0.02)] border border-white/60 dark:border-zinc-800/50 group hover:border-orange-200 transition-all duration-300">
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
                            Have a good idea for the Academy? Share it directly
                            with CEO.
                        </p>
                        <button
                            onClick={() => setActiveModal("idea")}
                            style={{ color: brand.orange }}
                            className="w-full py-3 bg-orange-50 hover:bg-orange-100 rounded-2xl font-black text-[9px] tracking-widest uppercase transition-colors flex items-center justify-center gap-2"
                        >
                            Submit Idea <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>

                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2rem] p-7 shadow-[0_12px_40px_rgba(0,0,0,0.02)] border border-white/60 dark:border-zinc-800/50 transition-all duration-300">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <History className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-black tracking-widest uppercase text-slate-400">
                                    Request Tracker
                                </span>
                            </div>
                            <button
                                onClick={async () => {
                                    // Permanently delete all non-pending requests from database
                                    const nonPendingRequests = requests.filter(req => req.status !== 'pending');
                                    
                                    if (nonPendingRequests.length === 0) {
                                        toast.info("No non-pending requests to clear");
                                        return;
                                    }
                                    
                                    try {
                                        // Use the new function to clear staff's own non-pending requests
                                        const { data, error } = await supabase.rpc('clear_my_requests');
                                            
                                        if (error) {
                                            console.error('Clear requests error:', error);
                                            toast.error("Failed to clear requests: " + error.message);
                                        } else {
                                            // Update local state to remove cleared requests
                                            setRequests(prev => prev.filter(req => req.status === 'pending'));
                                            const clearedCount = data || nonPendingRequests.length;
                                            toast.success(`Cleared ${clearedCount} non-pending requests permanently`);
                                        }
                                    } catch (error) {
                                        console.error('Clear requests error:', error);
                                        toast.error("Failed to clear requests");
                                    }
                                }}
                                className="text-xs text-red-500 hover:text-red-700 font-semibold uppercase tracking-wider hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                            >
                                Clear Requests
                            </button>
                        </div>
                        <div className="space-y-1">
                            <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
                                {requests.filter(req => req.status === 'pending' || req.status === 'rejected' || req.status === 'approved').map((req) => {
                                    const { title, detail } = formatTrackerRequest(req);
                                    
                                    return (
                                        <div
                                            key={req.id}
                                            className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-zinc-800/40 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-zinc-950/20 px-2 transition-all"
                                        >
                                            <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                                <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center shadow-sm shrink-0 border border-slate-100 dark:border-zinc-700/50">
                                                    <Calendar className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 tracking-wide">
                                                        {title}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium mt-1 truncate tracking-tight uppercase">
                                                        {detail ? `${detail} • ` : ""}{format(new Date(req.created_at), "MMM d, h:mm a")}
                                                    </p>
                                                </div>
                                            </div>
                                            <span
                                                className={`text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ml-3 ${
                                                    req.status === "approved"
                                                        ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"
                                                        : req.status === "pending"
                                                          ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30"
                                                          : "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30"
                                                }`}
                                            >
                                                {req.status?.toUpperCase() || "PENDING"}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {requests.filter(req => req.status === 'pending' || req.status === 'rejected' || req.status === 'approved').length === 0 && (
                                <div className="text-center py-6">
                                    <p className="text-[9px] text-slate-400 font-bold uppercase">No requests found</p>
                                    <p className="text-[8px] text-slate-500 mt-2">Submit a request to see it here</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Middle Column - MISSION CONTROL */}
                <div className="col-span-12 lg:col-span-6 space-y-4 md:space-y-6 order-2 lg:order-none">
                    {profile?.is_manager && (
                        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-[0_10px_30px_rgba(44,33,113,0.04)] relative overflow-hidden">
                            {/* Decorative elements */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#F15A29]/10 to-transparent rounded-full pointer-events-none"></div>
                            <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-[#2C2171]/5 rounded-full pointer-events-none"></div>
                            
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-[#2C2171] flex items-center gap-2">
                                        <Crown className="w-4 h-4 text-[#F15A29]" />
                                        Manager Control Room
                                    </h3>
                                    <p className="text-[11px] text-slate-400 font-semibold uppercase mt-0.5 tracking-wide">
                                        Department: {profile.department}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsAssignTaskOpen(true)}
                                    className="h-10 px-5 text-[10px] font-black uppercase tracking-widest text-white rounded-2xl flex items-center gap-2 bg-gradient-to-r from-[#2C2171] to-[#3F348C] hover:from-[#3F348C] hover:to-[#2C2171] shadow-lg shadow-[#2C2171]/25 hover:shadow-xl transition-all duration-300 transform active:scale-95"
                                >
                                    <Plus className="w-4 h-4 text-orange-400" /> Assign Department Task
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Department Intelligence Access Link */}
                                <Link
                                    href={profile.department === "Finance" ? "/ceo/financial-intelligence" : "/ceo/sales"}
                                    className="group relative rounded-2xl p-5 border border-slate-100 hover:border-orange-200 bg-gradient-to-br from-slate-50/50 to-white hover:from-white hover:to-white transition-all duration-300 flex items-start gap-4 shadow-sm hover:shadow-md cursor-pointer overflow-hidden"
                                >
                                    {/* Glowing hover state */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-out"></div>
                                    
                                    <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-300">
                                        <TrendingUp className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide group-hover:text-[#2C2171] transition-colors">
                                            Access {profile.department === "Finance" ? "Finance" : "Sales"} Intelligence
                                        </h4>
                                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-1">
                                            Review strategic metrics, active daily signals, conversions, and departmental analytics.
                                        </p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-orange-500 group-hover:translate-x-1 transition-all self-center shrink-0" />
                                </Link>

                                {/* Department Staff List Overview Link or Summary */}
                                <div className="rounded-2xl p-5 border border-slate-100 bg-gradient-to-br from-slate-50/50 to-white flex items-start gap-4 shadow-sm relative overflow-hidden">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0 shadow-inner">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                            Department Workforce
                                        </h4>
                                        <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-1">
                                            Total personnel under your command:{" "}
                                            <span className="font-bold text-slate-800">
                                                {profiles.filter(p => p.department === profile.department && !p.is_manager && p.role !== 'ceo').length}
                                            </span>
                                        </p>
                                        <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider mt-1.5 flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                                            All systems operational
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-2xl md:rounded-[2.5rem] p-4 md:p-0 border border-slate-100 md:border-0 md:bg-transparent shadow-sm md:shadow-none">
                        <div className="flex flex-col gap-3 md:px-2">
                            <div>
                                <h2 className="text-lg md:text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-2 md:gap-3">
                                    Mission Control{" "}
                                    <Target className="w-4 h-4 md:w-5 md:h-5 text-orange-500" />
                                </h2>
                                <p className="text-xs text-slate-400 font-medium hidden md:block">
                                    Your primary objectives for this shift
                                </p>
                            </div>
                            {/* Mobile: Horizontal scrolling filter tabs */}
                            <div className="flex bg-white md:bg-transparent p-1 rounded-xl md:rounded-2xl shadow-sm md:shadow-none border md:border-0 border-slate-100 overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
                                {["ALL", "URGENT", "DAILY", "COMPLETED"].map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => {
                                            setActiveTab(tab);
                                            setShowCompleted(tab === "COMPLETED");
                                        }}
                                        className={`px-3 md:px-4 py-2.5 md:py-2 rounded-lg md:rounded-xl text-[10px] font-black transition-all flex items-center gap-2 whitespace-nowrap min-h-[44px] md:min-h-0 ${
                                            activeTab === tab
                                                ? "text-white shadow-lg"
                                                : "text-slate-400"
                                        }`}
                                        style={{
                                            backgroundColor:
                                                activeTab === tab
                                                    ? brand.navy
                                                    : "transparent",
                                        }}
                                    >
                                        {tab}
                                        {tab === "COMPLETED" && completedTasks.length > 0 && (
                                            <span className="bg-blue-500 text-white text-[7px] px-1.5 py-0.5 rounded-full">
                                                {completedTasks.length}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {showCompleted && (
                            <div className="flex justify-end mt-3 md:mt-4 md:mb-4">
                                <button
                                    onClick={clearAllCompletedTasks}
                                    className="px-3 py-2 md:py-1 text-[8px] font-black uppercase bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded transition-all border-none min-h-[36px] md:min-h-0"
                                >
                                    Delete All Completed
                                </button>
                            </div>
                        )}

                        {/* Mobile: Full-width card with task content */}
                        <div className="mt-4 md:mt-0 space-y-3 md:space-y-4">
                        {(showCompleted ? completedTasks : filteredTasks).length === 0 ? (
                            <div className="text-center py-8 md:py-12">
                                <div className="w-14 h-14 md:w-16 md:h-16 bg-slate-100 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-3 md:mb-4">
                                    {showCompleted ? (
                                        <CheckCircle2 className="w-6 h-6 md:w-8 md:h-8 text-slate-300" />
                                    ) : (
                                        <Target className="w-6 h-6 md:w-8 md:h-8 text-slate-300" />
                                    )}
                                </div>
                                <h3 className="text-base md:text-lg font-black text-slate-900 uppercase mb-2">
                                    {showCompleted ? "No Completed Tasks" : "No Active Tasks"}
                                </h3>
                                <p className="text-xs md:text-sm text-slate-400">
                                    {showCompleted
                                        ? "Tasks you complete will appear here"
                                        : "All caught up! No tasks assigned currently."}
                                </p>
                            </div>
                        ) : (
                            (showCompleted ? completedTasks : filteredTasks).map((task) => (
                                <StaffTaskCard
                                    key={task.id}
                                    task={task}
                                    showCompleted={showCompleted}
                                    handleTaskClick={handleTaskClick}
                                    expandedTask={expandedTask}
                                    taskCreators={taskCreators}
                                    removeCompletedTask={removeCompletedTask}
                                    startMission={startMission}
                                    updateTaskProgress={updateTaskProgress}
                                    setTasks={setTasks}
                                    markAsCompleted={markAsCompleted}
                                    submitForReview={submitForReview}
                                    profile={profile}
                                    isV2Enabled={isV2Enabled}
                                    onMarkSeenLocal={handleMarkSeenLocal}
                                />
                            ))
                        )}
                        </div>
                    </div>
                </div>

                {/* Mobile: Stacked Request Tracker & Action Portal (beneath Mission Control) */}
                <div id="mobile-request-tracker" className="col-span-12 lg:hidden order-3 space-y-4">
                    {/* Mobile Request Tracker */}
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-2xl p-5 shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-white/60 dark:border-zinc-800/60">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <History className="w-4 h-4 text-slate-400" />
                                <span className="text-xs font-black tracking-widest uppercase text-slate-400">
                                    Request Tracker
                                </span>
                            </div>
                            <button
                                onClick={async () => {
                                    const nonPendingRequests = requests.filter(req => req.status !== 'pending');
                                    if (nonPendingRequests.length === 0) {
                                        toast.info("No non-pending requests to clear");
                                        return;
                                    }
                                    try {
                                        const { data, error } = await supabase.rpc('clear_my_requests');
                                        if (error) {
                                            toast.error("Failed to clear requests: " + error.message);
                                        } else {
                                            setRequests(prev => prev.filter(req => req.status === 'pending'));
                                            toast.success(`Cleared ${data || nonPendingRequests.length} non-pending requests`);
                                        }
                                    } catch (error) {
                                        toast.error("Failed to clear requests");
                                    }
                                }}
                                className="text-[10px] text-red-500 hover:text-red-700 font-semibold uppercase tracking-wider"
                            >
                                Clear
                            </button>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                            {requests.filter(req => req.status === 'pending' || req.status === 'rejected' || req.status === 'approved').slice(0, 5).map((req) => {
                                const { title, detail } = formatTrackerRequest(req);
                                
                                return (
                                    <div
                                        key={req.id}
                                        className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-zinc-800/40 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-zinc-950/20 px-1 transition-all"
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                            <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center shadow-sm shrink-0 border border-slate-100 dark:border-zinc-700/50">
                                                <Calendar className="w-4 h-4 text-slate-500 dark:text-zinc-400" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-bold text-slate-900 dark:text-zinc-100 tracking-wide">
                                                    {title}
                                                </p>
                                                <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-medium mt-1 truncate tracking-tight uppercase">
                                                    {detail ? `${detail} • ` : ""}{format(new Date(req.created_at), "MMM d, h:mm a")}
                                                </p>
                                            </div>
                                        </div>
                                        <span
                                            className={`text-[8px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shrink-0 ml-3 ${
                                                req.status === "approved"
                                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30"
                                                    : req.status === "pending"
                                                      ? "bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30"
                                                      : "bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30"
                                            }`}
                                        >
                                            {req.status?.toUpperCase() || "PENDING"}
                                        </span>
                                    </div>
                                );
                            })}
                            {requests.filter(req => req.status === 'pending' || req.status === 'rejected' || req.status === 'approved').length === 0 && (
                                <div className="text-center py-4">
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">No requests found</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Mobile Action Portal */}
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.03)] border border-white/60 dark:border-zinc-800/60">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-xl" style={{ backgroundColor: brand.softOrange }}>
                                <FileText className="w-4 h-4" style={{ color: brand.orange }} />
                            </div>
                            <span className="text-xs font-black tracking-widest uppercase text-slate-400">
                                Action Portal
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: "new_request", label: "New Request", icon: Plus },
                                { id: "leave_request", label: "Leave", icon: Calendar },
                                { id: "idea", label: "Share Idea", icon: Lightbulb },
                            ].map((item, index, array) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        if (item.id === "new_request") {
                                            setIsRequestModalOpen(true);
                                        } else if (item.id === "leave_request") {
                                            setIsLeaveModalOpen(true);
                                        } else {
                                            setActiveModal(item.id);
                                        }
                                    }}
                                    style={{ backgroundColor: brand.navy }}
                                    className={cn(
                                        "p-4 rounded-2xl flex items-center justify-center gap-2 text-white hover:opacity-90 transition-all shadow-lg shadow-indigo-100/50 min-h-[60px]",
                                        index === array.length - 1 && index % 2 === 0 ? "col-span-2" : ""
                                    )}
                                >
                                    <item.icon className="w-4 h-4 text-orange-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">
                                        {item.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mobile: COMMUNITY & NOTICE BOARD */}
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-3xl p-6 shadow-[0_12px_40px_rgba(0,0,0,0.02)] border border-white/60 dark:border-zinc-800/50">
                        <div className="flex items-center gap-3 mb-5">
                            <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/20">
                                <Megaphone className="w-4 h-4 text-orange-500 animate-pulse" />
                            </div>
                            <span className="text-xs font-black tracking-widest uppercase text-slate-400">
                                Community Board
                            </span>
                        </div>
                        
                        <div className="space-y-3">
                            {communityAnnouncements.length > 0 ? (
                                communityAnnouncements.map((announcement) => {
                                    const type = announcement.type || "NOTICE";
                                    let icon = "📢";
                                    let typeColor = "text-blue-500 bg-blue-50 dark:bg-blue-950/20";
                                    let TypeIcon = Megaphone;

                                    if (type === "MEETING") {
                                        icon = "⏰";
                                        typeColor = "text-orange-500 bg-orange-50 dark:bg-orange-950/20";
                                        TypeIcon = Clock;
                                    } else if (type === "DEADLINE") {
                                        icon = "⏳";
                                        typeColor = "text-red-500 bg-red-50 dark:bg-red-950/20";
                                        TypeIcon = AlertTriangle;
                                    }

                                    return (
                                        <div 
                                            key={announcement.id}
                                            className="p-4 bg-slate-50/50 dark:bg-zinc-950/30 rounded-2xl border border-slate-100/50 dark:border-zinc-800/30 hover:border-orange-500/20 hover:bg-slate-50 dark:hover:bg-zinc-950/50 transition-all duration-350 shadow-sm"
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">{icon}</span>
                                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 ${typeColor}`}>
                                                        <TypeIcon className="w-3 h-3" />
                                                        {type}
                                                    </span>
                                                </div>
                                                <span className="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                                                    {format(new Date(announcement.created_at), "MMM d, h:mm a")}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-700 dark:text-zinc-300 font-semibold leading-relaxed">
                                                {announcement.message}
                                            </p>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8 text-slate-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest">
                                    No community announcements
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="col-span-12 lg:col-span-3 space-y-6 hidden lg:block">
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2rem] p-7 shadow-[0_12px_40px_rgba(0,0,0,0.02)] border border-white/60 dark:border-zinc-800/50 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-8">
                            <div
                                className="p-2 rounded-lg"
                                style={{ backgroundColor: brand.softOrange }}
                            >
                                <FileText
                                    className="w-4 h-4"
                                    style={{ color: brand.orange }}
                                />
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
                                    } else {
                                        setActiveModal(item.id);
                                    }
                                }}
                                    style={{ backgroundColor: brand.navy }}
                                    className="w-full p-4 rounded-2xl flex items-center justify-between text-white hover:opacity-90 transition-all group shadow-lg shadow-indigo-100"
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

                    {/* Desktop: COMMUNITY & NOTICE BOARD */}
                    <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2rem] p-7 shadow-[0_12px_40px_rgba(0,0,0,0.02)] border border-white/60 dark:border-zinc-800/50 transition-all duration-300">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/20">
                                <Megaphone className="w-4 h-4 text-orange-500 animate-pulse" />
                            </div>
                            <span className="text-xs font-black tracking-widest uppercase text-slate-400">
                                Community Board
                            </span>
                        </div>
                        
                        <div className="space-y-4">
                            {communityAnnouncements.length > 0 ? (
                                communityAnnouncements.map((announcement) => {
                                    const type = announcement.type || "NOTICE";
                                    let icon = "📢";
                                    let typeColor = "text-blue-500 bg-blue-50 dark:bg-blue-950/20";
                                    let TypeIcon = Megaphone;

                                    if (type === "MEETING") {
                                        icon = "⏰";
                                        typeColor = "text-orange-500 bg-orange-50 dark:bg-orange-950/20";
                                        TypeIcon = Clock;
                                    } else if (type === "DEADLINE") {
                                        icon = "⏳";
                                        typeColor = "text-red-500 bg-red-50 dark:bg-red-950/20";
                                        TypeIcon = AlertTriangle;
                                    }

                                    return (
                                        <div 
                                            key={announcement.id}
                                            className="p-4 bg-slate-50/50 dark:bg-zinc-950/30 rounded-2xl border border-slate-100/50 dark:border-zinc-800/30 hover:border-orange-500/20 hover:bg-slate-50 dark:hover:bg-zinc-950/50 transition-all duration-300 shadow-sm"
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm">{icon}</span>
                                                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 ${typeColor}`}>
                                                        <TypeIcon className="w-3 h-3" />
                                                        {type}
                                                    </span>
                                                </div>
                                                <span className="text-[8px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                                                    {format(new Date(announcement.created_at), "MMM d, h:mm a")}
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-700 dark:text-zinc-300 font-semibold leading-relaxed">
                                                {announcement.message}
                                            </p>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8 text-slate-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest">
                                    No community announcements
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Manager Task Assignment Modal */}
            <Dialog open={isAssignTaskOpen} onOpenChange={setIsAssignTaskOpen}>
                <DialogContent className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 max-w-md rounded-3xl shadow-2xl overflow-hidden p-0 flex flex-col max-h-[85vh]">
                    <div className="px-6 pt-7 pb-4 flex items-start justify-between flex-shrink-0 border-b dark:border-zinc-800">
                        <div>
                            <DialogTitle className="text-lg font-black tracking-tight text-[#2C2171] dark:text-white flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-orange-50 dark:bg-zinc-800 flex items-center justify-center">
                                    <Target className="w-4 h-4 text-orange-500" />
                                </div>
                                Deploy Department Task
                            </DialogTitle>
                            <p className="text-[11px] text-gray-400 dark:text-white/40 font-semibold mt-1 ml-10 uppercase tracking-widest">
                                Assign objectives to your department team
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleAssignTask} className="flex-1 flex flex-col overflow-hidden">
                        <ScrollArea className="flex-1 px-6 py-4 custom-scrollbar">
                            <div className="space-y-5 pb-6">
                                {/* Task Title */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Task Title
                                    </label>
                                    <input
                                        placeholder="e.g. Follow up on morning conversions"
                                        value={newTaskTitle}
                                        onChange={(e) => setNewTaskTitle(e.target.value)}
                                        className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
                                        required
                                    />
                                </div>

                                {/* Description */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        Objective / Description
                                    </label>
                                    <textarea
                                        placeholder="Detail the instructions or specific milestones..."
                                        value={newTaskDesc}
                                        onChange={(e) => setNewTaskDesc(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all resize-none leading-relaxed"
                                    />
                                </div>

                                {/* Assignee & Priority */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {/* Select Staff assignee (filtered by department) */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Assign Staff
                                        </label>
                                        <select
                                            value={newTaskAssignee}
                                            onChange={(e) => setNewTaskAssignee(e.target.value)}
                                            className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all cursor-pointer"
                                            required
                                        >
                                            <option value="">Select Personnel...</option>
                                            {profiles
                                                .filter(p => p.department === profile?.department && !p.is_manager && p.role !== 'ceo')
                                                .map((s) => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.full_name} ({s.designation || s.role || 'Staff'})
                                                    </option>
                                                ))
                                            }
                                        </select>
                                    </div>

                                    {/* Priority Level */}
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                            Priority Level
                                        </label>
                                        <select
                                            value={newTaskPriority}
                                            onChange={(e) => setNewTaskPriority(e.target.value as any)}
                                            className="w-full h-11 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all cursor-pointer"
                                        >
                                            <option value="routine">Routine Objective</option>
                                            <option value="daily">Daily Mission</option>
                                            <option value="urgent">Urgent Escalation</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>

                        <div className="px-6 py-4 bg-slate-50 border-t flex gap-3 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsAssignTaskOpen(false)}
                                className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isDeployingTask}
                                style={{ backgroundColor: brand.orange }}
                                className="flex-1 py-3 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-100 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                            >
                                {isDeployingTask ? (
                                    <>Deploying...</>
                                ) : (
                                    <>
                                        <Send className="w-3.5 h-3.5" /> Deploy
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Leave Request Modal */}
            <LeaveRequestModal
                isOpen={isLeaveModalOpen}
                onClose={() => setIsLeaveModalOpen(false)}
                onSubmitSuccess={() => fetchData()}
                setInteracting={setIsUserInteracting}
            />

            {/* General Request Modal */}
            <RequestModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                onSubmitSuccess={() => fetchData()}
                setInteracting={setIsUserInteracting}
            />

            {/* Direct Message Reply Modal */}
            <Dialog open={!!replyingToNotification} onOpenChange={(open) => { if (!open) setReplyingToNotification(null); }}>
                <DialogContent className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 max-w-md rounded-3xl shadow-2xl overflow-hidden p-0 flex flex-col">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 to-[#2C2171] z-50" />
                    
                    <div className="px-8 pt-8 pb-4 relative flex-shrink-0">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-black uppercase tracking-widest flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl">
                                    <MessageSquare className="h-4 w-4 text-indigo-500" />
                                </div>
                                Reply to Command
                            </DialogTitle>
                        </DialogHeader>
                        {replyingToNotification && (
                            <p className="text-slate-405 dark:text-zinc-505 text-xs mt-3 bg-slate-50 dark:bg-zinc-850 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 italic">
                                &quot;{parseMessagePayload(replyingToNotification.message).cleanText}&quot;
                            </p>
                        )}
                    </div>

                    <div className="px-8 py-4 space-y-4">
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400">
                                Message Content
                            </label>
                            <textarea
                                placeholder="Type your reply here..."
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 focus:border-indigo-500 rounded-xl h-28 resize-none text-sm p-4 font-semibold shadow-inner transition-all leading-relaxed focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="p-6 bg-slate-50 dark:bg-zinc-950 border-t border-slate-150 dark:border-zinc-800 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={() => setReplyingToNotification(null)}
                            className="px-5 py-2.5 text-slate-500 hover:text-slate-700 font-bold uppercase tracking-widest text-[10px] rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-900 transition-colors"
                        >
                            Cancel
                        </button>
                        <Button
                            onClick={handleSendReply}
                            disabled={isSendingReply || !replyMessage.trim()}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] px-6 py-2.5 rounded-xl transition-all flex items-center gap-1.5"
                        >
                            {isSendingReply ? "Sending..." : "Send Reply"}
                            <Send className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <MobileNavigation currentPage="home" />

            {isMessageDialogOpen && (
                <MessageDialog
                    isOpen={isMessageDialogOpen}
                    onClose={() => setIsMessageDialogOpen(false)}
                    onSuccess={fetchData}
                />
            )}

            {/* Profile Settings Modal */}
            {/* Profile Sidebar */}
            <div className={`fixed inset-0 z-50 overflow-hidden transition-all duration-300 ease-in-out ${isProfileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
                {/* Backdrop */}
                <div 
                    className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm transition-opacity duration-300"
                    onClick={() => setIsProfileOpen(false)}
                />
                
                {/* Sidebar Drawer */}
                <div className={`absolute top-0 right-0 h-full w-full max-w-[400px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-l border-slate-100 dark:border-zinc-800 shadow-2xl flex flex-col justify-between transition-transform duration-300 ease-in-out transform ${isProfileOpen ? "translate-x-0" : "translate-x-full"}`}>
                    
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 dark:border-zinc-800/50 flex items-center justify-between select-none">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <User className="w-4 h-4" />
                            </div>
                            <h2 className="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase">
                                Personnel File
                            </h2>
                        </div>
                        <button 
                            onClick={() => setIsProfileOpen(false)}
                            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 flex items-center justify-center text-slate-500 dark:text-zinc-400 transition-colors"
                        >
                            <span className="text-xs font-black">✕</span>
                        </button>
                    </div>

                    {/* Scrollable Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col items-center">
                        {/* Profile Photo Display with Upload */}
                        <div className="relative group cursor-pointer">
                            <div className="w-24 h-24 md:w-28 md:h-28 rounded-[2rem] border-4 border-white dark:border-zinc-800 shadow-lg overflow-hidden relative flex items-center justify-center bg-indigo-950 text-white font-bold text-3xl select-none">
                                {isUploadingPhoto ? (
                                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                        <div className="animate-spin h-6 w-6 border-2 border-white/20 border-t-white rounded-full" />
                                    </div>
                                ) : (profile?.avatar_url && isValidAvatarUrl(profile.avatar_url)) ? (
                                    <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    profile?.avatar_url || (profile?.full_name?.[0] || profile?.email?.[0] || "U")
                                )}
                                
                                {/* Overlay Camera Icon on Hover */}
                                {!isUploadingPhoto && (
                                    <label className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-all duration-300 text-white text-[8px] font-black uppercase tracking-widest cursor-pointer select-none">
                                        <Plus className="w-4 h-4" />
                                        Upload Image
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                
                                                // Validate file format (type verification)
                                                const validTypes = ["image/jpeg", "image/png", "image/webp"];
                                                if (!validTypes.includes(file.type)) {
                                                    toast.error("Invalid image format. Only JPEG, PNG, and WEBP are accepted.");
                                                    return;
                                                }
                                                
                                                // Validate file size (under 2MB)
                                                if (file.size > 2 * 1024 * 1024) {
                                                    toast.error("Max file size exceeded. Image must be under 2MB.");
                                                    return;
                                                }
                                                
                                                setIsUploadingPhoto(true);
                                                try {
                                                    // 1. Compress image client-side
                                                    const compressedBlob = await compressImage(file, {
                                                        maxWidth: 800, // Avatars don't need to be huge
                                                        maxHeight: 800,
                                                        maxFileSizeKB: 200, // Extra strict for avatars
                                                        outputFormat: "image/webp"
                                                    });

                                                    const fileName = `${profile?.id || user?.id}-${Date.now()}.webp`;
                                                    const filePath = `avatars/${fileName}`;

                                                    // 2. Delete old avatar if it exists in storage
                                                    if (profile?.avatar_url && profile.avatar_url.includes('/storage/v1/object/public/')) {
                                                        try {
                                                            await deleteFile('avatars', profile.avatar_url);
                                                        } catch (e) {
                                                            console.warn("Failed to delete old avatar:", e);
                                                            // Continue anyway to allow new upload
                                                        }
                                                    }

                                                    // 3. Upload to storage
                                                    const publicUrl = await uploadPublicFile('avatars', filePath, compressedBlob);
                                                    
                                                    // 4. Update Database with URL
                                                    const { error } = await supabase
                                                        .from("profiles")
                                                        .update({ avatar_url: publicUrl })
                                                        .eq("id", profile?.id || user?.id);
                                                            
                                                    if (error) {
                                                        console.error("Photo DB update error:", error);
                                                        toast.error("Database update failed: " + error.message);
                                                        setIsUploadingPhoto(false);
                                                        return;
                                                    }
                                                    
                                                    // Update local state
                                                    setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
                                                    // Synchronize global Auth Context profile
                                                    await refreshProfile();
                                                    toast.success("Profile photo updated successfully!");
                                                    setIsUploadingPhoto(false);
                                                } catch (err: any) {
                                                    console.error("Upload process error:", err);
                                                    toast.error(err.message || "Failed to update profile photo");
                                                    setIsUploadingPhoto(false);
                                                }
                                            }}
                                        />
                                    </label>
                                )}
                            </div>
                        </div>

                        {/* File Size Warning Label */}
                        <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 text-center max-w-[240px] mt-1 select-none">
                            ⚠️ <span className="font-bold text-amber-600 dark:text-amber-500">Note:</span> Maximum image size is <span className="font-bold text-slate-700 dark:text-slate-200">3MB</span>. Recommended formats: PNG, JPG, or WEBP.
                        </p>

                        {/* Interactive Profile Information List */}
                        <div className="w-full space-y-4">
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/50">
                                <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-1 select-none">
                                    Full Identification Name
                                </span>
                                <span className="text-xs font-black text-slate-900 dark:text-zinc-100 uppercase">
                                    {profile?.full_name || "Unidentified Personnel"}
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/50">
                                    <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-1 select-none">
                                        Assigned Role
                                    </span>
                                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">
                                        {profile?.role || "Staff Member"}
                                    </span>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/50">
                                    <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-1 select-none">
                                        Operational Sector
                                    </span>
                                    <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase">
                                        {profile?.department || "General Operations"}
                                    </span>
                                </div>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/50">
                                <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-1 select-none">
                                    Primary Communications Email
                                </span>
                                <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                                    {profile?.email || "No Email Registered"}
                                </span>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/50">
                                <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-1 select-none">
                                    Operational Contact Number
                                </span>
                                <input
                                    type="text"
                                    value={profile?.phone || ""}
                                    placeholder="Enter contact number..."
                                    onChange={async (e) => {
                                        const phoneVal = e.target.value;
                                        setProfile(prev => prev ? { ...prev, phone: phoneVal } : null);
                                        
                                        // Update Supabase
                                        await supabase
                                            .from("profiles")
                                            .update({ phone: phoneVal })
                                            .eq("id", profile?.id);
                                    }}
                                    className="w-full bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-xs font-bold text-slate-900 dark:text-zinc-100 placeholder-slate-350"
                                />
                            </div>

                            {/* Mobile Synchronization Card */}
                            <div className="pt-2 w-full">
                                <MobileSyncCard userId={profile?.id || ""} size={130} />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-6 border-t border-slate-100 dark:border-zinc-800/50 flex gap-3 select-none">
                        <button
                            onClick={() => setIsProfileOpen(false)}
                            className="flex-1 py-3 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all"
                        >
                            Close File
                        </button>
                    </div>
                </div>
            </div>


            {/* Legacy Modals */}
            {activeModal && (
                <Modal
                    title={
                        activeModal === "idea"
                            ? "Innovation Spark"
                            : activeModal.charAt(0).toUpperCase() +
                              activeModal.slice(1) +
                              " Request"
                    }
                    type={activeModal}
                    onClose={() => setActiveModal(null)}
                    onSubmitSuccess={() => fetchData()}
                    setInteracting={setIsUserInteracting}
                >
                    {activeModal === "idea" && (
                        <form className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                    Concept Title
                                </label>
                                <input
                                    name="idea_title"
                                    placeholder="A catchy name for your idea"
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                    The &quot;Why&quot;
                                </label>
                                <textarea
                                    name="idea_description"
                                    placeholder="Explain how this benefits the academy..."
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold min-h-[120px]"
                                    required
                                />
                            </div>
                        </form>
                    )}
                    {activeModal === "leave" && (
                        <form className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                    Leave Category
                                </label>
                                <select 
                                    name="category"
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold"
                                >
                                    <option value="">Select category...</option>
                                    <option value="casual">Casual Leave</option>
                                    <option value="medical">Medical Leave</option>
                                    <option value="duty">Duty Leave</option>
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        name="start_date"
                                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        name="end_date"
                                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                    Reason
                                </label>
                                <textarea
                                    name="reason"
                                    placeholder="Describe reason for leave..."
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold min-h-[100px]"
                                />
                            </div>
                        </form>
                    )}
                    {activeModal === "permission" && (
                        <form className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                    MISSION OBJECTIVE
                                </label>
                                <input
                                    type="text"
                                    name="subject"
                                    placeholder="e.g., Budget Approval for Marketing, Access to Server, New Hardware Purchase"
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                    PRIORITY LEVEL
                                </label>
                                <select 
                                    name="priority"
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold"
                                >
                                    <option value="low">Low: Non-urgent, review at leisure</option>
                                    <option value="standard">Standard: General operations</option>
                                    <option value="critical">Critical: Requires immediate action</option>
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                    IMPACT / JUSTIFICATION
                                </label>
                                <textarea
                                    name="justification"
                                    placeholder="Briefly describe the benefit or necessity..."
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold min-h-[100px]"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                    COST / RESOURCE (Optional)
                                </label>
                                <input
                                    type="text"
                                    name="cost"
                                    placeholder="e.g., ₹5000, 3 Hours, Team of 2"
                                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold"
                                />
                            </div>
                        </form>
                    )}
                    {activeModal === "work" && (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                                    Adjustment Type
                                </label>
                                <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold">
                                    <option>Extra Hours</option>
                                    <option>Shift Swap</option>
                                    <option>Remote Working</option>
                                </select>
                            </div>
                        </div>
                    )}
                </Modal>
            )}

            {/* ===== UA Messenger Drawer — Frosted White Glass (ROOT-LEVEL fixed) ===== */}
            <UAMessengerDrawer 
                isOpen={isBellOpen}
                onClose={() => {
                    setIsBellOpen(false);
                    fetchData();
                }}
                profile={profile}
            />

        </div>
    );
}
