"use client";

import { useState, useEffect } from "react";
import { X, Send, User, Megaphone, Loader2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Brand colors
const BRAND_COLORS = {
    indigo: "#31267D",
    orange: "#F14D24",
};

export type MessageType = "direct" | "global" | "announcement";

interface StaffProfile {
    id: string;
    full_name: string;
    email: string;
    role: string;
    department?: string;
    avatar_url?: string;
}

const ALL_STAFF_OPTION: StaffProfile = {
    id: "all",
    full_name: "All Staff",
    email: "all@workspace.com",
    role: "ALL WORKSPACE PERSONNEL",
    department: "GLOBAL",
};

interface MessageDialogProps {
    isOpen: boolean;
    onClose: () => void;
    defaultType?: MessageType;
    onSuccess?: () => void;
}

export function MessageDialog({ isOpen, onClose, defaultType = "direct", onSuccess }: MessageDialogProps) {
    const [messageType, setMessageType] = useState<MessageType>(defaultType);
    const [selectedStaff, setSelectedStaff] = useState<StaffProfile | null>(null);
    const [message, setMessage] = useState("");
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [staffList, setStaffList] = useState<StaffProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const { user, profile } = useAuth();

    // Global Announcement States
    const [announcementMessage, setAnnouncementMessage] = useState("");
    const [channelDestination, setChannelDestination] = useState<"CEO_BROADCAST" | "COMMUNITY_BOARD">("COMMUNITY_BOARD");
    const [announcementType, setAnnouncementType] = useState<"MEETING" | "NOTICE">("NOTICE");
    const [isDeployingAnnouncement, setIsDeployingAnnouncement] = useState(false);

    // Common configurations
    const [expiryDuration, setExpiryDuration] = useState<"5h" | "12h" | "1d" | "7d">("7d");
    const [isUrgent, setIsUrgent] = useState(false);

    const getExpiryDate = (duration: "5h" | "12h" | "1d" | "7d") => {
        const date = new Date();
        switch (duration) {
            case "5h":
                date.setHours(date.getHours() + 5);
                break;
            case "12h":
                date.setHours(date.getHours() + 12);
                break;
            case "1d":
                date.setDate(date.getDate() + 1);
                break;
            case "7d":
                date.setDate(date.getDate() + 7);
                break;
        }
        return date.toISOString();
    };

    useEffect(() => {
        if (isOpen) {
            setMessageType(defaultType);
            setIsUrgent(false);
            setExpiryDuration("7d");
        }
    }, [isOpen, defaultType]);

    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const { data, error } = await supabase
                    .from("profiles")
                    .select("*")
                    .neq("role", "ceo")
                    .neq("id", user?.id)
                    .order("full_name");

                if (error) throw error;
                setStaffList(data || []);
                if (data && data.length > 0) {
                    setSelectedStaff(ALL_STAFF_OPTION);
                }
            } catch (error) {
                console.error("Error fetching staff:", error);
            } finally {
                setLoading(false);
            }
        };

        if (isOpen && user) {
            fetchStaff();
        }
    }, [isOpen, user]);

    const handleDeployAnnouncement = async () => {
        if (!announcementMessage.trim()) {
            toast.error("Announcement message cannot be empty");
            return;
        }
        setIsDeployingAnnouncement(true);
        try {
            const expiryStr = getExpiryDate(expiryDuration);

            const { error } = await supabase
                .from("broadcasts")
                .insert({
                    message: announcementMessage.trim(),
                    target: channelDestination,
                    type: channelDestination === "COMMUNITY_BOARD" ? announcementType : null,
                    created_by: profile?.id || null,
                    expires_at: expiryStr
                });

            if (error) throw error;

            // If urgent is checked, insert high priority alerts into notifications table for all staff members
            if (isUrgent) {
                let targets: any[] = staffList;
                if (targets.length === 0) {
                    const { data } = await supabase
                        .from("profiles")
                        .select("id")
                        .neq("role", "ceo")
                        .neq("id", user?.id);
                    targets = data || [];
                }

                if (targets.length > 0) {
                    const senderRole = profile?.role === 'ceo' ? 'CEO' : 'Administrator';
                    const notificationAlerts = targets.map((staff) => ({
                        user_id: staff.id,
                        title: `URGENT BROADCAST FROM ${senderRole.toUpperCase()}`,
                        message: announcementMessage.trim(),
                        type: "alert",
                    }));
                    await supabase.from("notifications").insert(notificationAlerts);
                }
            }

            toast.success("Global Announcement deployed successfully!");
            setAnnouncementMessage("");
            setIsUrgent(false);
            setExpiryDuration("7d");
            
            if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("academyos-global-resync"));
            }

            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (error: any) {
            console.error("Failed to deploy announcement:", error);
            toast.error("Deployment failure: " + (error.message || "Unknown error"));
        } finally {
            setIsDeployingAnnouncement(false);
        }
    };

    const handleSend = async () => {
        if (messageType === "announcement") {
            await handleDeployAnnouncement();
            return;
        }

        if (!message.trim()) {
            toast.error("Message content cannot be empty");
            return;
        }

        setIsSending(true);
        try {
            if (messageType === "direct" && selectedStaff) {
                const senderRole = profile?.role === 'ceo' ? 'CEO' : 'Administrator';
                
                if (selectedStaff.id === "all") {
                    if (staffList.length > 0) {
                        const notifications = staffList.map((staff) => ({
                            user_id: staff.id,
                            title: isUrgent ? `URGENT MESSAGE FROM ${senderRole.toUpperCase()}` : `MESSAGE FROM ${senderRole.toUpperCase()}`,
                            message: message.trim(),
                            type: isUrgent ? "alert" : "direct",
                        }));
                        const { error } = await supabase.from("notifications").insert(notifications);
                        if (error) throw error;
                    }
                    toast.success("Message sent to all staff members");
                } else {
                    const { error } = await supabase.from("notifications").insert({
                        user_id: selectedStaff.id,
                        title: isUrgent ? `URGENT MESSAGE FROM ${senderRole.toUpperCase()}` : `MESSAGE FROM ${senderRole.toUpperCase()}`,
                        message: message.trim(),
                        type: isUrgent ? "alert" : "direct",
                    });
                    if (error) throw error;
                    toast.success(`Message sent to ${selectedStaff.full_name}`);
                }
            }
            setMessage("");
            setIsUrgent(false);
            setExpiryDuration("7d");
            
            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (error: any) {
            console.error("Failed to send message:", error);
            toast.error("Failed to send: " + error.message);
        } finally {
            setIsSending(false);
        }
    };

    if (!isOpen) return null;

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full">
                    <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                        <p className="text-gray-650 font-semibold">Loading staff...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[9999] flex items-start justify-center pt-[10vh] p-4">
            <div className="backdrop-blur-2xl bg-white/95 border border-white/25 rounded-3xl p-8 shadow-2xl max-w-md w-full max-h-[85vh] overflow-y-auto my-auto relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Communications Center</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Message Type Toggle */}
                <div className="flex bg-gray-100 rounded-full p-1 mb-6">
                    <button
                        onClick={() => setMessageType("direct")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-full transition-all duration-200 ${
                            messageType === "direct"
                                ? "bg-white shadow-sm"
                                : ""
                        }`}
                    >
                        <User className="w-4 h-4" style={{ color: messageType === "direct" ? BRAND_COLORS.indigo : "#6b7280" }} />
                        <span className="text-xs font-bold" style={{ color: messageType === "direct" ? BRAND_COLORS.indigo : "#6b7280" }}>
                            Message
                        </span>
                    </button>
                    <button
                        onClick={() => setMessageType("announcement")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-full transition-all duration-200 ${
                            messageType === "announcement"
                                ? "bg-white shadow-sm"
                                : ""
                        }`}
                    >
                        <Megaphone className="w-4 h-4" style={{ color: messageType === "announcement" ? BRAND_COLORS.indigo : "#6b7280" }} />
                        <span className="text-xs font-bold" style={{ color: messageType === "announcement" ? BRAND_COLORS.indigo : "#6b7280" }}>
                            Announcements
                        </span>
                    </button>
                </div>

                {/* Direct Message Fields */}
                {messageType === "direct" && (
                    <div className="mb-6">
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-700 mb-2">
                            Send To
                        </label>
                        <div className="relative">
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="w-full px-4 py-3 text-left bg-white border border-gray-200 rounded-xl shadow-sm hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 flex items-center justify-between"
                                disabled={staffList.length === 0}
                            >
                                {selectedStaff ? (
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs"
                                            style={{ backgroundColor: selectedStaff.id === "all" ? BRAND_COLORS.orange : BRAND_COLORS.indigo }}
                                        >
                                            {selectedStaff.full_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-gray-900">{selectedStaff.full_name}</div>
                                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{selectedStaff.role} {selectedStaff.department ? `• ${selectedStaff.department}` : ''}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-gray-500">No staff available</div>
                                )}
                                <X className="w-4 h-4 text-gray-400 transform rotate-180" />
                            </button>
                            
                            {isDropdownOpen && staffList.length > 0 && (
                                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                    {[ALL_STAFF_OPTION, ...staffList].map((staff) => (
                                        <button
                                            key={staff.id}
                                            onClick={() => {
                                                setSelectedStaff(staff);
                                                setIsDropdownOpen(false);
                                            }}
                                            className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 flex items-center gap-3 border-b border-gray-100 last:border-0"
                                        >
                                            <div
                                                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs"
                                                style={{ backgroundColor: staff.id === "all" ? BRAND_COLORS.orange : BRAND_COLORS.indigo }}
                                            >
                                                {staff.full_name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900">{staff.full_name}</div>
                                                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{staff.role} {staff.department ? `• ${staff.department}` : ''}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Direct Message Input */}
                {messageType === "direct" && (
                    <>
                        <div className="mb-6">
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-700 mb-2">
                                Message
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Enter your direct message..."
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm resize-none h-32 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-400 text-sm font-medium leading-relaxed"
                            />
                        </div>


                    </>
                )}

                {/* Announcements form layout */}
                {messageType === "announcement" && (
                    <div className="space-y-4 mb-6">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-700">
                                Announcement Content
                            </label>
                            <textarea
                                value={announcementMessage}
                                onChange={(e) => setAnnouncementMessage(e.target.value)}
                                placeholder="Type the announcement details..."
                                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm resize-none h-32 focus:outline-none focus:ring-2 focus:ring-blue-550 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-400 text-sm font-medium leading-relaxed"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-700">
                                    Announcement Type
                                </label>
                                <select
                                    value={announcementType}
                                    onChange={(e) => setAnnouncementType(e.target.value as any)}
                                    className="w-full text-xs p-3 rounded-xl border border-gray-200 bg-white text-gray-950 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                                >
                                    <option value="NOTICE">Notice</option>
                                    <option value="MEETING">Meeting</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-700">
                                    Display Duration
                                </label>
                                <select
                                    value={expiryDuration}
                                    onChange={(e) => setExpiryDuration(e.target.value as any)}
                                    className="w-full text-xs p-3 rounded-xl border border-gray-200 bg-white text-gray-950 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                                >
                                    <option value="5h">5 Hours</option>
                                    <option value="12h">12 Hours</option>
                                    <option value="1d">1 Day</option>
                                    <option value="7d">7 Days</option>
                                </select>
                            </div>
                        </div>


                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 justify-end pt-2 border-t border-gray-150">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-gray-650 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors duration-200"
                    >
                        Cancel
                    </button>
                    <Button
                        onClick={handleSend}
                        className="px-6 py-3 text-white font-black rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 text-xs uppercase tracking-widest"
                        style={{ 
                            backgroundColor: 
                                messageType === "announcement" ? "#31267D" : BRAND_COLORS.indigo 
                        }}
                        disabled={
                            messageType === "announcement" 
                                ? (isDeployingAnnouncement || !announcementMessage.trim())
                                : (isSending || (messageType === "direct" && !selectedStaff) || !message.trim())
                        }
                    >
                        {messageType === "announcement" ? (
                            isDeployingAnnouncement ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Deploying...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" /> Deploy
                                </>
                            )
                        ) : (
                            isSending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" /> Send Message
                                </>
                            )
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

interface MessageToggleProps {
    className?: string;
}

export function MessageToggle({ className }: MessageToggleProps) {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setIsDialogOpen(true)}
                className={`px-6 py-3 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-3 ${className}`}
                style={{ backgroundColor: BRAND_COLORS.indigo }}
            >
                <Send className="w-5 h-5" />
                Send Message
            </button>
            
            <MessageDialog isOpen={isDialogOpen} onClose={() => setIsDialogOpen(false)} />
        </>
    );
}
