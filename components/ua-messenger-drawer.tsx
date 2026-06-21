"use client";
 
import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, MessageSquare, Send, Trash2, Loader2, Mail, Check, CheckCheck, RefreshCw, MessageCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn, isValidAvatarUrl } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
 
interface UAMessengerDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    profile: {
        id: string;
        full_name?: string;
        role?: string;
        avatar_url?: string;
        department?: string;
        is_manager?: boolean;
        designation?: string;
    } | null;
}
 
interface Thread {
    partner: any;
    messages: any[];
    latestMessage: any;
    unreadCount: number;
}
 
export function UAMessengerDrawer({ isOpen, onClose, profile }: UAMessengerDrawerProps) {
    const [receivedMessages, setReceivedMessages] = useState<any[]>([]);
    const [sentMessages, setSentMessages] = useState<any[]>([]);
    const [profilesList, setProfilesList] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
 
    // Navigation / Thread Deep-view states
    const [activeThreadPartnerId, setActiveThreadPartnerId] = useState<string | null>(null);
 
    // Composer states
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [selectedRecipientId, setSelectedRecipientId] = useState("");
    const [composerMessage, setComposerMessage] = useState("");
    const [isSendingComposer, setIsSendingComposer] = useState(false);
    const [deletingMessageId, setDeletingMessageId] = useState<string | null>(null);
 
    // Thread Reply states
    const [replyingToMessage, setReplyingToMessage] = useState<any | null>(null);
 
    const composerInputRef = useRef<HTMLTextAreaElement>(null);
    const threadInputRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
 
    const parseMessagePayload = (msgText: string) => {
        if (!msgText) return { senderId: null, cleanText: "" };
        const match = msgText.match(/^\[sender_id:([\w-]+)\](.*)/s);
        return {
            senderId: match ? match[1] : null,
            cleanText: match ? match[2].trim() : msgText
        };
    };
 
    const fetchData = async () => {
        if (!profile?.id) return;
        setLoading(true);
        try {
            // Fetch all profiles
            const { data: profs } = await supabase
                .from("profiles")
                .select("id, full_name, role, avatar_url, department, is_manager, designation");
            if (profs) setProfilesList(profs);
 
            // Fetch received notifications
            const { data: recData, error: recErr } = await supabase
                .from("notifications")
                .select("*")
                .eq("user_id", profile.id)
                .order("created_at", { ascending: false });
            if (!recErr && recData) setReceivedMessages(recData);
 
            // Fetch sent notifications
            const { data: sentData, error: sentErr } = await supabase
                .from("notifications")
                .select("*, recipient:profiles!user_id(id, full_name, avatar_url)")
                .like("message", `[sender_id:${profile.id}]%`)
                .order("created_at", { ascending: false });
            if (!sentErr && sentData) setSentMessages(sentData);
        } catch (err) {
            console.error("Error fetching comms data:", err);
        } finally {
            setLoading(false);
            window.dispatchEvent(new CustomEvent("hq-messenger-updated"));
        }
    };
 
    // Refresh and auto-fetch
    useEffect(() => {
        if (isOpen && profile?.id) {
            fetchData();
        }
        if (!isOpen) {
            window.dispatchEvent(new CustomEvent("close-hq-messenger"));
            setIsComposerOpen(false);
            setActiveThreadPartnerId(null);
            setReplyingToMessage(null);
        }
    }, [isOpen, profile?.id]);
 
    // Keyboard shortcut to toggle messenger drawer open/close or toggle thread directory (Ctrl+M / Cmd+M)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                // Toggle the messenger drawer open/close or toggle the new thread directory state view
                // DO NOT invoke inputElement.focus() or alter layout layers that slide over the quick prompt chips area
                window.dispatchEvent(new CustomEvent("toggle-hq-messenger"));
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);
 
    // Automatically mark active thread's messages as read
    useEffect(() => {
        if (activeThreadPartnerId && isOpen) {
            const threads = getThreads();
            const thread = threads.find(t => t.partner.id === activeThreadPartnerId);
            if (thread) {
                const unread = thread.messages.filter(m => !m.isSent && !m.read);
                if (unread.length > 0) {
                    const nowStr = new Date().toISOString();
                    supabase
                        .from("notifications")
                        .update({ read: true, read_at: nowStr })
                        .in("id", unread.map(m => m.id))
                        .then(({ error }) => {
                            if (!error) {
                                setReceivedMessages(prev => prev.map(m => 
                                    unread.some(um => um.id === m.id) ? { ...m, read: true, read_at: nowStr } : m
                                ));
                                window.dispatchEvent(new CustomEvent("hq-messenger-updated"));
                            }
                        });
                }
            }
        }
    }, [activeThreadPartnerId, receivedMessages, isOpen]);
 
    // Scroll deep-view to bottom on entry/new messages
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
 
    useEffect(() => {
        if (activeThreadPartnerId) {
            setTimeout(scrollToBottom, 100);
        }
    }, [activeThreadPartnerId, receivedMessages, sentMessages]);

    // Realtime Postgres changes subscription for new messages
    useEffect(() => {
        if (!profile?.id) return;

        const channelId = `ua-messenger-realtime-${profile.id}`;
        const channel = supabase
            .channel(channelId)
            .on(
                "postgres_changes",
                {
                    event: "INSERT",
                    schema: "public",
                    table: "notifications"
                },
                (payload) => {
                    const newMsg = payload.new;
                    if (newMsg.user_id !== profile.id) return;

                    const { senderId } = parseMessagePayload(newMsg.message);
                    if (!senderId) return;
 
                    // Refresh local data
                    fetchData();
 
                    // Fetch total unread notifications count from Supabase
                    supabase
                        .from("notifications")
                        .select("id", { count: "exact", head: true })
                        .eq("user_id", profile.id)
                        .eq("read", false)
                        .then(({ count }) => {
                            const unreadCount = count || 0;
 
                            // Display simple white toast notification if user is not looking at this thread
                            if (!isOpen || activeThreadPartnerId !== senderId) {
                                toast(`${unreadCount} new message${unreadCount > 1 ? "s" : ""} received`, {
                                    duration: 4000,
                                    style: {
                                        background: "#ffffff",
                                        color: "#0f172a",
                                        border: "1px solid #e2e8f0",
                                        borderRadius: "12px",
                                        fontSize: "12px",
                                        fontWeight: "600",
                                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)",
                                        fontFamily: "sans-serif"
                                    },
                                    action: !isOpen ? {
                                        label: "View",
                                        onClick: () => {
                                            window.dispatchEvent(new CustomEvent("toggle-hq-messenger"));
                                            setActiveThreadPartnerId(senderId);
                                        }
                                    } : undefined
                                });
                            }
                        });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, profilesList, isOpen, activeThreadPartnerId]);
 
    const isMessageExpired = (msg: any) => {
        const seenAt = msg.seen_at || msg.read_at;
        if (seenAt) {
            const tSeen = new Date(seenAt).getTime();
            const tCurrent = new Date().getTime();
            const diffHours = (tCurrent - tSeen) / (1000 * 60 * 60);
            return diffHours >= 12;
        }
        return false;
    };

    // Thread formatting logic
    const getThreads = (): Thread[] => {
        if (!profile?.id) return [];
        const threadMap = new Map<string, any[]>();
 
        // Process received messages
        receivedMessages.forEach(msg => {
            if (isMessageExpired(msg)) return;
            const { senderId } = parseMessagePayload(msg.message);
            if (senderId && senderId !== profile.id) {
                if (!threadMap.has(senderId)) {
                    threadMap.set(senderId, []);
                }
                threadMap.get(senderId)!.push({ ...msg, isSent: false });
            }
        });
 
        // Process sent messages
        sentMessages.forEach(msg => {
            if (isMessageExpired(msg)) return;
            const recipientId = msg.user_id;
            if (recipientId && recipientId !== profile.id) {
                if (!threadMap.has(recipientId)) {
                    threadMap.set(recipientId, []);
                }
                threadMap.get(recipientId)!.push({ ...msg, isSent: true });
            }
        });

        // Identify mustShowPartners: CEOs, Administrators, and active user's Department Manager
        const mustShowPartners = profilesList.filter(p => {
            if (p.id === profile.id) return false;
            
            const pRoleLower = p.role?.toLowerCase();
            const pDesignationLower = p.designation?.toLowerCase();
            
            const isPCeo = pRoleLower === "ceo" || pDesignationLower === "ceo";
            const isPAdmin = pRoleLower === "admin" || pRoleLower === "administrator" || pDesignationLower === "admin" || pDesignationLower === "administrator";
            const isPMyManager = p.department === profile.department && (p.is_manager === true || pRoleLower === "manager" || pDesignationLower === "manager");
            
            return isPCeo || isPAdmin || isPMyManager;
        });

        // Ensure mustShowPartners are always in the threadMap even if no messages sent
        mustShowPartners.forEach(p => {
            if (!threadMap.has(p.id)) {
                threadMap.set(p.id, []);
            }
        });
 
        const threads: Thread[] = [];
        threadMap.forEach((msgs, partnerId) => {
            const partner = profilesList.find(p => p.id === partnerId);
            if (!partner) return;
            const sortedMsgs = msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            const latestMessage = sortedMsgs.length > 0 ? sortedMsgs[sortedMsgs.length - 1] : undefined;
            const unreadCount = msgs.filter(m => !m.isSent && !m.read).length;
 
            threads.push({
                partner,
                messages: sortedMsgs,
                latestMessage,
                unreadCount
            });
        });
 
        return threads.sort((a, b) => {
            const timeA = a.latestMessage ? new Date(a.latestMessage.created_at).getTime() : 0;
            const timeB = b.latestMessage ? new Date(b.latestMessage.created_at).getTime() : 0;
            return timeB - timeA;
        });
    };
 
    const findRepliedToMessage = (msg: any, allMsgs: any[]) => {
        if (!msg.title?.toUpperCase().startsWith("REPLY")) return null;
        const index = allMsgs.findIndex(m => m.id === msg.id);
        if (index <= 0) return null;
        for (let i = index - 1; i >= 0; i--) {
            if (allMsgs[i].isSent !== msg.isSent) {
                return parseMessagePayload(allMsgs[i].message).cleanText;
            }
        }
        return null;
    };
 
    const handleDeleteMessage = async (msgId: string) => {
        if (!confirm("Are you sure you want to permanently delete this message?")) return;
        setDeletingMessageId(msgId);
        try {
            const { error } = await supabase
                .from("notifications")
                .delete()
                .eq("id", msgId);
            
            if (error) {
                toast.error("Failed to delete message: " + error.message);
            } else {
                toast.success("Message deleted successfully");
                setSentMessages(prev => prev.filter(m => m.id !== msgId));
                setReceivedMessages(prev => prev.filter(m => m.id !== msgId));
                if (replyingToMessage?.id === msgId) {
                    setReplyingToMessage(null);
                }
                window.dispatchEvent(new CustomEvent("hq-messenger-updated"));
            }
        } catch (err: any) {
            toast.error("Error: " + err.message);
        } finally {
            setDeletingMessageId(null);
        }
    };
 
    const isHigherOfficial = (p: any) => {
        if (!p) return false;
        const role = p.role?.toLowerCase();
        const designation = p.designation?.toLowerCase() || "";
        const dept = p.department?.toLowerCase();
        
        const isManager = p.is_manager === true || 
                          role === "manager" || 
                          designation.includes("manager") || 
                          designation.includes("head") || 
                          role === "director" || 
                          designation.includes("director");
                          
        const isAdmin = role === "admin" || role === "administrator" || designation.includes("admin") || designation.includes("administrator");
        const isAdminDeptManager = (dept === "administration" || dept === "admin") && isManager;
        
        return role === "ceo" || designation.includes("ceo") || isManager || isAdmin || isAdminDeptManager;
    };
 
    const getRecipientOptions = () => {
        if (!profile) return [];
        
        const roleLower = profile.role?.toLowerCase() || "";
        const designationLower = profile.designation?.toLowerCase() || "";
        const isCeo = roleLower === "ceo" || designationLower === "ceo";
        const isAdmin = roleLower === "admin" || roleLower === "administrator" || designationLower === "admin" || designationLower === "administrator";
        
        if (isCeo || isAdmin) {
            // CEO or Administrators get global organisation access
            return profilesList.filter(p => p.id !== profile.id);
        }
        
        const isManager = profile.is_manager === true || 
                          roleLower === "manager" || 
                          designationLower === "manager" || 
                          designationLower.includes("manager") || 
                          designationLower.includes("head") ||
                          roleLower === "director" ||
                          designationLower.includes("director");
        
        if (isManager) {
            // Get manager's department (case-insensitive)
            const managerDept = (profile.department || "").trim();
            const managerDeptLower = managerDept.toLowerCase();
            
            // Build the allowed departments array
            const allowedDepts = [managerDept];
            
            // Let's also include accounts/finance expansion just in case
            if (managerDeptLower === "finance" || managerDeptLower === "accounts" || managerDeptLower === "finance/accounts") {
                if (!allowedDepts.some(d => d.toLowerCase() === "finance")) allowedDepts.push("Finance");
                if (!allowedDepts.some(d => d.toLowerCase() === "accounts")) allowedDepts.push("Accounts");
                if (!allowedDepts.some(d => d.toLowerCase() === "finance/accounts")) allowedDepts.push("Finance/Accounts");
            }
            
            return profilesList.filter(p => {
                if (p.id === profile.id) return false;
                
                const targetRoleLower = p.role?.toLowerCase() || "";
                const targetDesignationLower = p.designation?.toLowerCase() || "";
                const isTargetCeo = targetRoleLower === "ceo" || targetDesignationLower === "ceo";
                const isTargetAdmin = targetRoleLower === "admin" || targetRoleLower === "administrator" || targetDesignationLower === "admin" || targetDesignationLower === "administrator";
                
                // CEO and Administrators are always visible to managers
                if (isTargetCeo || isTargetAdmin) return true;
                
                // Determine target staff department, defaulting to "Administration" just like in ManagerCommandCenter.tsx
                const staffDept = (p.department || "Administration").trim();
                const staffDeptLower = staffDept.toLowerCase();
                
                // 1. Marketing Manager can access and message ALL staff members in the system
                if (managerDeptLower === "marketing") {
                    return true;
                }
                
                // 2. Finance/Accounts managers can access Finance, Accounts, and Finance/Accounts staff
                if (managerDeptLower === "finance" || managerDeptLower === "accounts" || managerDeptLower === "finance/accounts") {
                    return staffDeptLower === "finance" || staffDeptLower === "accounts" || staffDeptLower === "finance/accounts";
                }
                
                // 3. Other managers (Sales, Administration, etc.) match exactly their department
                return staffDeptLower === managerDeptLower;
            });
        }
        
        // Active User is 'STAFF' (strict boundary routing)
        return profilesList.filter(p => {
            if (p.id === profile.id) return false;
            
            const targetRoleLower = p.role?.toLowerCase() || "";
            const targetDesignationLower = p.designation?.toLowerCase() || "";
            const isTargetCeo = targetRoleLower === "ceo" || targetDesignationLower === "ceo";
            const isTargetAdmin = targetRoleLower === "admin" || targetRoleLower === "administrator" || targetDesignationLower === "admin" || targetDesignationLower === "administrator";
            
            // Determine target's department and current user's department, defaulting to "Administration"
            const targetDeptLower = (p.department || "Administration").toLowerCase();
            const myDeptLower = (profile.department || "Administration").toLowerCase();
            
            let isMyDepartmentManager = targetDeptLower === myDeptLower;
            if (targetDeptLower === "marketing") {
                isMyDepartmentManager = myDeptLower === "marketing" || myDeptLower === "sales";
            } else if (targetDeptLower === "finance" || targetDeptLower === "accounts" || targetDeptLower === "finance/accounts") {
                isMyDepartmentManager = myDeptLower === "finance" || myDeptLower === "accounts" || myDeptLower === "finance/accounts";
            }
                 
            const isTargetManager = p.is_manager === true || 
                                    targetRoleLower === "manager" || 
                                    targetDesignationLower === "manager" ||
                                    targetDesignationLower.includes("manager") ||
                                    targetDesignationLower.includes("head") ||
                                    targetRoleLower === "director" ||
                                    targetDesignationLower.includes("director");
            
            const isMyManager = isMyDepartmentManager && isTargetManager;
            
            return isTargetCeo || isTargetAdmin || isMyManager;
        });
    };
 
    // Resolve personnel from registry for dynamic context-aware operation chips
    const getPersonnelManagers = () => {
        const salesManager = profilesList.find(p => p.department?.toLowerCase() === "sales" && (p.is_manager === true || p.role?.toLowerCase() === "manager" || p.designation?.toLowerCase() === "manager"))
            || profilesList.find(p => p.department?.toLowerCase() === "sales");
        
        const financeManager = profilesList.find(p => (p.department?.toLowerCase() === "finance" || p.department?.toLowerCase() === "accounts") && (p.is_manager === true || p.role?.toLowerCase() === "manager" || p.designation?.toLowerCase() === "manager"))
            || profilesList.find(p => p.department?.toLowerCase() === "finance" || p.department?.toLowerCase() === "accounts");
            
        const operationsManager = profilesList.find(p => (p.department?.toLowerCase() === "marketing" || p.department?.toLowerCase() === "operations" || p.department?.toLowerCase() === "marketing/operations") && (p.is_manager === true || p.role?.toLowerCase() === "manager" || p.designation?.toLowerCase() === "manager"))
            || profilesList.find(p => p.department?.toLowerCase() === "marketing" || p.department?.toLowerCase() === "operations");
            
        const administrators = profilesList.filter(p => 
            (p.role?.toLowerCase() === "admin" || p.role?.toLowerCase() === "administrator" ||
             p.designation?.toLowerCase() === "admin" || p.designation?.toLowerCase() === "administrator") && 
            p.id !== profile?.id
        );

        const ceoUser = profilesList.find(p => p.role?.toLowerCase() === "ceo" || p.designation?.toLowerCase() === "ceo");
        
        return {
            sales: salesManager,
            finance: financeManager,
            operations: operationsManager,
            admins: administrators,
            ceo: ceoUser
        };
    };
 
    const handleChipClick = (userId?: string, roleLabel?: string) => {
        if (userId) {
            setActiveThreadPartnerId(userId);
        } else {
            toast.error(`${roleLabel || "Manager"} is not registered in the system directory.`);
        }
    };
 
    const getRoleBadge = (partner: any) => {
        const role = partner?.role?.toLowerCase();
        const isManager = partner?.is_manager;
        
        if (role === "ceo") {
            return <span className="bg-red-50 text-red-600 border border-red-150 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider scale-90 origin-left">CEO</span>;
        }
        if (isManager || role === "manager") {
            return <span className="bg-blue-50 text-blue-600 border border-blue-150 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider scale-90 origin-left">Manager</span>;
        }
        return <span className="bg-slate-50 text-slate-600 border border-slate-200 text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider scale-90 origin-left">Staff</span>;
    };
 
    const handleSendComposerMessage = async () => {
        if (!selectedRecipientId || !composerMessage.trim() || !profile) return;
        setIsSendingComposer(true);
        try {
            const senderRoleName = profile.role === 'ceo' || profile.role?.toUpperCase() === 'CEO' 
                ? 'CEO' 
                : profile.is_manager 
                    ? `${profile.department} Manager` 
                    : 'Staff Member';
 
            const payload = `[sender_id:${profile.id}] ${composerMessage.trim()}`;
            
            if (selectedRecipientId === "all") {
                const roleLower = profile.role?.toLowerCase();
                const designationLower = profile.designation?.toLowerCase();
                const isCeo = roleLower === "ceo" || designationLower === "ceo";
                const isAdmin = roleLower === "admin" || roleLower === "administrator" || designationLower === "admin" || designationLower === "administrator";
                if (!isCeo && !isAdmin) {
                    toast.error("Unauthorized: Only CEO and Administrators are permitted to broadcast messages.");
                    setIsSendingComposer(false);
                    return;
                }
                const staffList = profilesList.filter(p => p.id !== profile.id);
                if (staffList.length > 0) {
                    await Promise.all(staffList.map(async (staff) => {
                        let apiSuccess = false;
                        try {
                            const response = await fetch("/api/send-message", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    user_id: staff.id,
                                    title: `BROADCAST FROM ${senderRoleName.toUpperCase()}`,
                                    message: payload,
                                    type: "direct",
                                }),
                            });
                            if (response.ok) apiSuccess = true;
                        } catch (err) {
                            console.warn("Broadcast API error, using fallback...", err);
                        }
 
                        if (!apiSuccess) {
                            await supabase.from("notifications").insert({
                                user_id: staff.id,
                                title: `BROADCAST FROM ${senderRoleName.toUpperCase()}`,
                                message: payload,
                                type: "direct",
                                read: false,
                                created_at: new Date().toISOString()
                            });
                        }
                    }));
                }
                toast.success("Broadcast sent to all staff members");
            } else {
                const targetProfile = profilesList.find(p => p.id === selectedRecipientId);
                const titleText = isHigherOfficial(profile) 
                    ? `DIRECTIVE FROM ${senderRoleName.toUpperCase()}`
                    : `REPORT FROM ${profile.full_name?.toUpperCase()}`;
 
                let apiSuccess = false;
                try {
                    const response = await fetch("/api/send-message", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            user_id: selectedRecipientId,
                            title: titleText,
                            message: payload,
                            type: "direct",
                        }),
                    });
                    if (response.ok) apiSuccess = true;
                } catch (err) {
                    console.warn("Direct Message API error, using fallback...", err);
                }
 
                if (!apiSuccess) {
                    await supabase.from("notifications").insert({
                        user_id: selectedRecipientId,
                        title: titleText,
                        message: payload,
                        type: "direct",
                        read: false,
                        created_at: new Date().toISOString()
                    });
                }
                toast.success(`Message sent to ${targetProfile?.full_name || "recipient"}`);
                // Smooth transition directly into the conversation deep-view
                setActiveThreadPartnerId(selectedRecipientId);
            }
 
            setComposerMessage("");
            setIsComposerOpen(false);
            fetchData();
        } catch (err: any) {
            toast.error(err.message || "Failed to dispatch message");
        } finally {
            setIsSendingComposer(false);
        }
    };
 
    const handleSendThreadMessage = async () => {
        if (!composerMessage.trim() || !profile || !activeThreadPartnerId) return;
        setIsSendingComposer(true);
        try {
            const senderRoleName = profile.role === 'ceo' || profile.role?.toUpperCase() === 'CEO' 
                ? 'CEO' 
                : profile.is_manager 
                    ? `${profile.department} Manager` 
                    : 'Staff Member';
 
            const payload = `[sender_id:${profile.id}] ${composerMessage.trim()}`;
            let titleText = isHigherOfficial(profile) 
                ? `DIRECTIVE FROM ${senderRoleName.toUpperCase()}`
                : `REPORT FROM ${profile.full_name?.toUpperCase()}`;
 
            if (replyingToMessage) {
                titleText = `REPLY: ${replyingToMessage.title || "DIRECTIVE"}`;
            }
 
            let apiSuccess = false;
            try {
                const response = await fetch("/api/send-message", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        user_id: activeThreadPartnerId,
                        title: titleText,
                        message: payload,
                        type: "direct",
                    }),
                });
                if (response.ok) apiSuccess = true;
            } catch (err) {
                console.warn("Thread Message API error, using fallback...", err);
            }
 
            if (!apiSuccess) {
                await supabase.from("notifications").insert({
                    user_id: activeThreadPartnerId,
                    title: titleText,
                    message: payload,
                    type: "direct",
                    read: false,
                    created_at: new Date().toISOString()
                });
            }
 
            setComposerMessage("");
            setReplyingToMessage(null);
            fetchData();
        } catch (err: any) {
            toast.error(err.message || "Failed to dispatch message");
        } finally {
            setIsSendingComposer(false);
        }
    };
 
    const activeThreads = getThreads();
    const recipientOptions = getRecipientOptions();
 
    // Deep view conversation details
    const activeThread = activeThreads.find(t => t.partner.id === activeThreadPartnerId);
    const partnerProfile = activeThread?.partner || profilesList.find(p => p.id === activeThreadPartnerId);
    const partnerName = partnerProfile?.full_name || "Staff Member";
    const partnerAvatar = partnerProfile?.avatar_url;
 
    const unreadCountTotal = activeThreads.reduce((acc, t) => acc + t.unreadCount, 0);
    const roleLowerVal = profile?.role?.toLowerCase();
    const designationLowerVal = profile?.designation?.toLowerCase();
    const isActiveCeo = roleLowerVal === "ceo" || designationLowerVal === "ceo";
    const isActiveAdmin = roleLowerVal === "admin" || roleLowerVal === "administrator" || designationLowerVal === "admin" || designationLowerVal === "administrator";
    const isCeoOrAdmin = isActiveCeo || isActiveAdmin;
    const managers = getPersonnelManagers();
 
    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/45 dark:bg-black/60 backdrop-blur-[2px] z-[90] transition-opacity duration-300"
                    onClick={onClose}
                />
            )}
 
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ x: "110%", opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: "110%", opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 28 }}
                        className="fixed right-4 top-4 bottom-4 w-80 md:w-[430px] flex flex-col z-[95] text-left font-sans"
                        style={{ filter: "drop-shadow(0 25px 60px rgba(0,0,0,0.18))" }}
                    >
                        {/* Frosted Glassmorphic Premium Panel */}
                        <div className="flex flex-col flex-1 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl overflow-hidden shadow-2xl relative transition-all duration-300">
                            
                            {/* Subtle Gradient Top Bar */}
                            <div className="h-1 w-full bg-gradient-to-r from-[#31267D] via-[#F14D24] to-[#31267D] opacity-80" />
 
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-900/60 flex-shrink-0 bg-transparent min-h-[70px]">
                                {activeThreadPartnerId === null ? (
                                    <div className="flex items-center gap-2.5">
                                        <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800/80">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img 
                                                src="/images/usthadacademylogo2.svg" 
                                                alt="UA Logo" 
                                                className="w-5 h-5 object-contain"
                                            />
                                            {unreadCountTotal > 0 && (
                                                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#F14D24] text-[8px] font-black text-white flex items-center justify-center shadow-sm animate-pulse z-10">
                                                    {unreadCountTotal > 9 ? "9+" : unreadCountTotal}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <h2 className="text-sm font-black tracking-tight text-slate-900 dark:text-white">UA Messenger</h2>
                                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Command Link</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => {
                                                setActiveThreadPartnerId(null);
                                                setReplyingToMessage(null);
                                            }}
                                            className="py-1 px-2.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-350 transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider active:scale-95"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5" /> Back
                                        </button>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <img 
                                                src={isValidAvatarUrl(partnerAvatar) ? partnerAvatar : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(partnerName)}`}
                                                alt={partnerName}
                                                className="w-8 h-8 rounded-full object-cover border border-slate-100 dark:border-slate-800 shadow-sm flex-shrink-0"
                                            />
                                            <div className="min-w-0">
                                                <h3 className="text-xs font-black text-slate-900 dark:text-white truncate max-w-[150px]">{partnerName}</h3>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {getRoleBadge(partnerProfile)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={fetchData}
                                        disabled={loading}
                                        className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition-colors disabled:opacity-50"
                                        title="Refresh"
                                    >
                                        <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                                    </button>
                                    <button 
                                        onClick={onClose}
                                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-800"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
 
                            {/* Scrollable Dashboard / Conversation Section */}
                            <div className="flex-grow overflow-y-auto px-6 pb-36 pt-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800 scrollbar-track-transparent">
                                {loading && activeThreads.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <Loader2 className="w-6 h-6 animate-spin text-[#31267D]" />
                                        <span className="text-slate-400 dark:text-slate-500 text-[10px] uppercase font-bold tracking-wider">Syncing communications...</span>
                                    </div>
                                ) : activeThreadPartnerId === null ? (
                                    // Thread List Dashboard view
                                    activeThreads.length === 0 ? (
                                        <div className="text-center py-16 flex flex-col items-center justify-center gap-3">
                                            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center animate-pulse">
                                                <Mail className="w-7 h-7 text-slate-300 dark:text-slate-650" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Inbox Clear</p>
                                                <p className="text-[9px] text-slate-350 dark:text-slate-600 mt-1 max-w-[200px] mx-auto leading-relaxed">Choose New Message to start a conversation thread.</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3.5 mt-1">
                                            {activeThreads.map((thread) => {
                                                const { partner, messages, latestMessage, unreadCount } = thread;
                                                const { cleanText } = latestMessage ? parseMessagePayload(latestMessage.message) : { cleanText: "No messages yet." };
                                                const formattedTime = latestMessage ? format(new Date(latestMessage.created_at), 'h:mm a') : "";
                                                const avatar = partner.avatar_url;
                                                const name = partner.full_name || "Staff Member";
 
                                                return (
                                                    <button
                                                        key={partner.id}
                                                        onClick={() => setActiveThreadPartnerId(partner.id)}
                                                        className="w-full flex items-center gap-3.5 p-3 rounded-2xl border border-slate-100 dark:border-slate-900/50 hover:border-[#31267D]/10 dark:hover:border-[#4f3fbf]/30 bg-white/50 dark:bg-slate-950/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/40 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 text-left font-sans cursor-pointer group relative"
                                                    >
                                                        <div className="relative shrink-0">
                                                            <img 
                                                                src={isValidAvatarUrl(avatar) ? avatar : `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`}
                                                                alt={name}
                                                                className="w-11 h-11 rounded-full object-cover border border-slate-100 dark:border-slate-800 shadow-sm animate-fade-in"
                                                            />
                                                            {unreadCount > 0 && (
                                                                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#F14D24] border-2 border-white dark:border-slate-950 animate-pulse" />
                                                            )}
                                                        </div>
                                                        
                                                        <div className="flex-grow min-w-0">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                                                                        {name}
                                                                    </span>
                                                                    {getRoleBadge(partner)}
                                                                </div>
                                                                {formattedTime && (
                                                                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                                                                        {formattedTime}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            
                                                            <div className="flex items-center justify-between gap-2 mt-1">
                                                                <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate max-w-[210px] md:max-w-[280px]">
                                                                    {latestMessage ? (latestMessage.isSent ? "You: " : "") : ""}{cleanText}
                                                                </p>
                                                                {unreadCount > 0 && (
                                                                    <span className="bg-[#F14D24] text-white text-[9px] font-black h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shadow-lg shadow-[#F14D24]/30 animate-pulse shrink-0">
                                                                        {unreadCount}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )
                                ) : (
                                    // Conversation Deep-view
                                    <div className="flex flex-col gap-1 mt-1 pb-16">
                                        {/* Ephemeral Warning Notice Banner */}
                                        <div className="text-[11px] font-medium tracking-wide py-2 px-3 text-center rounded-xl border border-slate-200/50 bg-slate-100/80 text-slate-600 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-800/50 mb-4 transition-all duration-300">
                                            ⏳ Messages automatically disappear 12 hours after they are seen.
                                        </div>

                                        {(activeThread?.messages || [])
                                            .filter(msg => !isMessageExpired(msg))
                                            .map((msg, index) => {
                                                const { cleanText } = parseMessagePayload(msg.message);
                                                const formattedTime = format(new Date(msg.created_at), 'h:mm a');
                                                const replyText = findRepliedToMessage(msg, activeThread?.messages || []);
 
                                                return (
                                                    <div
                                                        key={msg.id}
                                                        className={cn(
                                                            "flex w-full mb-3.5",
                                                            msg.isSent ? "justify-end" : "justify-start"
                                                        )}
                                                    >
                                                        <div 
                                                            className={cn(
                                                                "max-w-[85%] rounded-2xl px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] relative group font-sans border transition-colors",
                                                                msg.isSent 
                                                                    ? "rounded-tr-sm bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800/80 text-slate-800 dark:text-slate-100" 
                                                                    : "rounded-tl-sm bg-slate-100 dark:bg-slate-950 border-slate-200/40 dark:border-slate-800/50 text-slate-800 dark:text-slate-100"
                                                            )}
                                                        >
                                                            {/* Reply quote preview */}
                                                            {replyText && (
                                                                <div className={cn(
                                                                    "text-[10px] font-medium italic border-l-2 p-1.5 rounded mb-1.5",
                                                                    msg.isSent 
                                                                        ? "border-indigo-500 bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400"
                                                                        : "border-[#31267D]/60 bg-slate-200/50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400"
                                                                )}>
                                                                    Replying to: &quot;{replyText}&quot;
                                                                </div>
                                                            )}
                                                            
                                                            <p className="text-xs font-semibold leading-relaxed break-words">{cleanText}</p>
                                                            
                                                            <div className="flex items-center justify-end gap-1 mt-1">
                                                                <span className="text-[8px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider">{formattedTime}</span>
                                                                {msg.isSent && (
                                                                    <div className="flex items-center">
                                                                        {msg.read ? (
                                                                            <CheckCheck className="w-3 h-3 text-sky-500 stroke-[2.5]" />
                                                                        ) : (
                                                                            <Check className="w-3 h-3 text-slate-400 dark:text-slate-500 stroke-[2.5]" />
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            
                                                            {/* Hover Quick actions overlay */}
                                                            <div 
                                                                className={cn(
                                                                    "absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                                                                    msg.isSent ? "-left-8" : "-right-8"
                                                                )}
                                                            >
                                                                {!msg.isSent && (
                                                                    <button 
                                                                        onClick={() => setReplyingToMessage({ id: msg.id, text: cleanText, title: msg.title })}
                                                                        className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/50 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
                                                                        title="Reply"
                                                                    >
                                                                        <MessageCircle className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                {msg.isSent && (
                                                                    <button 
                                                                        onClick={() => handleDeleteMessage(msg.id)}
                                                                        disabled={deletingMessageId === msg.id}
                                                                        className="p-1.5 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900 border border-red-100/50 dark:border-red-900/40 rounded-lg text-red-400 hover:text-red-500 transition-colors"
                                                                        title="Delete"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        <div ref={messagesEndRef} />
                                    </div>
                                )}
                            </div>
 
                            {/* Bottom Messenger Send Bars */}
                            <div className="absolute bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-900 p-4 shrink-0 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] rounded-b-3xl z-40">
                                {activeThreadPartnerId === null ? (
                                    // Composer bar on Thread List Dashboard view
                                    !isComposerOpen ? (
                                        <div className="flex flex-col gap-3">
                                            {/* Dynamic Management Shortcut prompt capsules */}
                                            {isCeoOrAdmin && (
                                                <div className="flex flex-wrap gap-2 w-full mb-4 px-1">
                                                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5 pl-0.5 w-full">
                                                        Management Prompts
                                                    </p>
                                                    {/* Sales Chip */}
                                                    <button
                                                        onClick={() => handleChipClick(managers.sales?.id, "Sales Manager")}
                                                        className="bg-slate-50/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/65 dark:border-slate-800/60 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md text-xs text-slate-700 dark:text-slate-300 font-medium px-3.5 py-2 rounded-xl cursor-pointer transition-all duration-200 active:scale-[0.98] hover:border-slate-300 dark:hover:border-slate-700 shadow-sm text-left"
                                                    >
                                                        <span>Enquire about Sales with {managers.sales?.full_name || "Sales Manager"}? 📈</span>
                                                    </button>
                                                    
                                                    {/* Finance Chip */}
                                                    <button
                                                        onClick={() => handleChipClick(managers.finance?.id, "Finance Manager")}
                                                        className="bg-slate-50/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/65 dark:border-slate-800/60 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md text-xs text-slate-700 dark:text-slate-300 font-medium px-3.5 py-2 rounded-xl cursor-pointer transition-all duration-200 active:scale-[0.98] hover:border-slate-300 dark:hover:border-slate-700 shadow-sm text-left"
                                                    >
                                                        <span>Check Finance status with {managers.finance?.full_name || "Finance Manager"}? 📊</span>
                                                    </button>

                                                    {/* Operations Chip */}
                                                    <button
                                                        onClick={() => handleChipClick(managers.operations?.id, "Marketing Head")}
                                                        className="bg-slate-50/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/65 dark:border-slate-800/60 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md text-xs text-slate-700 dark:text-slate-300 font-medium px-3.5 py-2 rounded-xl cursor-pointer transition-all duration-200 active:scale-[0.98] hover:border-slate-300 dark:hover:border-slate-700 shadow-sm text-left"
                                                    >
                                                        <span>Review Operations with {managers.operations?.full_name || "Marketing Head/Operations"}? 🎯</span>
                                                    </button>

                                                    {/* CEO Chip - for Administrators */}
                                                    {isActiveAdmin && (
                                                        <button
                                                            onClick={() => handleChipClick(managers.ceo?.id, "CEO")}
                                                            className="bg-slate-50/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/65 dark:border-slate-800/60 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md text-xs text-slate-700 dark:text-slate-350 font-medium px-3.5 py-2 rounded-xl cursor-pointer transition-all duration-200 active:scale-[0.98] hover:border-slate-300 dark:hover:border-slate-700 shadow-sm text-left"
                                                        >
                                                            <span>Communicate with CEO {managers.ceo?.full_name || "CEO"}? 👑</span>
                                                        </button>
                                                    )}

                                                    {/* Admin Chips (Mapped dynamically) - for CEO only */}
                                                    {isActiveCeo && managers.admins.map((admin) => (
                                                        <button
                                                            key={admin.id}
                                                            onClick={() => handleChipClick(admin.id, "Administrator")}
                                                            className="bg-slate-50/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/65 dark:border-slate-800/60 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md text-xs text-slate-700 dark:text-slate-300 font-medium px-3.5 py-2 rounded-xl cursor-pointer transition-all duration-200 active:scale-[0.98] hover:border-slate-300 dark:hover:border-slate-700 shadow-sm text-left"
                                                        >
                                                            <span>Communicate with Admin {admin.full_name || "Administrator"}? 🛡️</span>
                                                        </button>
                                                    ))}
                                                    {isActiveCeo && managers.admins.length === 0 && (
                                                        <button
                                                            onClick={() => handleChipClick(undefined, "Administrator")}
                                                            className="bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/65 dark:border-slate-800/60 bg-white/40 dark:bg-slate-950/40 backdrop-blur-md text-xs text-slate-400 dark:text-slate-500 font-medium px-3.5 py-2 rounded-xl cursor-not-allowed opacity-60 transition-all duration-200 flex items-center justify-between"
                                                        >
                                                            <span>Communicate with Admin (Unassigned)? 🛡️</span>
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setIsComposerOpen(true);
                                                    setTimeout(() => composerInputRef.current?.focus(), 150);
                                                }}
                                                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#31267D] to-[#4f3fbf] hover:from-[#4f3fbf] hover:to-[#5e4dcf] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-md shadow-[#31267D]/20 hover:shadow-[#31267D]/35 hover:-translate-y-0.5 active:translate-y-0"
                                            >
                                                <MessageSquare className="w-4 h-4" />
                                                New Message (Ctrl+M)
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="border border-slate-200 dark:border-slate-800 focus-within:border-[#31267D]/60 focus-within:ring-1 focus-within:ring-[#31267D]/60 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-2 transition-all font-sans animate-fade-in">
                                            {/* Recipient Dropdown selector & close */}
                                            <div className="flex items-center justify-between gap-2 px-1 py-0.5">
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 pl-1 shrink-0">To:</span>
                                                <select
                                                    value={selectedRecipientId}
                                                    onChange={(e) => setSelectedRecipientId(e.target.value)}
                                                    className="flex-grow bg-transparent dark:bg-slate-900 border-0 outline-none text-xs text-slate-700 dark:text-slate-350 font-bold focus:ring-0 focus:outline-none cursor-pointer py-0.5 min-w-0"
                                                >
                                                    <option value="">Select Recipient...</option>
                                                    {(profile?.role?.toLowerCase() === 'ceo' || 
                                                       profile?.designation?.toLowerCase() === 'ceo' ||
                                                       profile?.role?.toLowerCase() === 'admin' || 
                                                       profile?.role?.toLowerCase() === 'administrator' ||
                                                       profile?.designation?.toLowerCase() === 'admin' ||
                                                       profile?.designation?.toLowerCase() === 'administrator') && (
                                                         <option value="all">All Staff (Broadcast)</option>
                                                     )}
                                                    {recipientOptions.map((p) => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.full_name} ({p.role?.toUpperCase() === 'CEO' ? 'CEO' : p.is_manager ? `${p.department} Manager` : p.role?.toUpperCase() || 'STAFF'})
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => {
                                                        setIsComposerOpen(false);
                                                        setSelectedRecipientId("");
                                                        setComposerMessage("");
                                                    }}
                                                    className="p-1 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors shrink-0"
                                                    title="Close composer"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
 
                                            <div className="border-t border-slate-200/60 dark:border-slate-800/60 my-1" />
 
                                            {/* New message input area */}
                                            <div className="flex gap-2 items-end">
                                                <textarea
                                                    ref={composerInputRef}
                                                    value={composerMessage}
                                                    onChange={(e) => setComposerMessage(e.target.value)}
                                                    placeholder="Type message here..."
                                                    className="flex-grow bg-transparent border-0 outline-none resize-none h-16 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 font-medium focus:ring-0 focus:outline-none px-1 py-1"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleSendComposerMessage();
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={handleSendComposerMessage}
                                                    disabled={isSendingComposer || !selectedRecipientId || !composerMessage.trim()}
                                                    className="bg-[#F14D24] hover:bg-[#e03f14] disabled:opacity-50 text-white rounded-xl p-2.5 flex items-center justify-center transition-colors shadow-md shadow-orange-500/10 h-9 w-9 shrink-0 self-end mb-1"
                                                >
                                                    {isSendingComposer ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Send className="w-3.5 h-3.5 text-white" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    // Deep view Chat Send Composer Bar
                                    <div className="flex flex-col">
                                        {/* Reply banner overlay if replying */}
                                        {replyingToMessage && (
                                            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-t-2xl px-3.5 py-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-semibold border-b-0 animate-fade-in">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <span className="text-[9px] font-black uppercase text-[#31267D] dark:text-[#4f3fbf] shrink-0">Replying:</span>
                                                    <span className="truncate italic font-medium">&quot;{replyingToMessage.text}&quot;</span>
                                                </div>
                                                <button 
                                                    onClick={() => setReplyingToMessage(null)}
                                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-650 transition-colors"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                        
                                        <div className={cn(
                                            "border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-2 transition-all font-sans focus-within:border-[#31267D]/60 focus-within:ring-1 focus-within:ring-[#31267D]/60",
                                            replyingToMessage && "rounded-t-none border-t-0"
                                        )}>
                                            <div className="flex gap-2 items-end">
                                                <textarea
                                                    ref={threadInputRef}
                                                    value={composerMessage}
                                                    onChange={(e) => setComposerMessage(e.target.value)}
                                                    placeholder={`Message ${partnerName}...`}
                                                    className="flex-grow bg-transparent border-0 outline-none resize-none h-16 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 font-medium focus:ring-0 focus:outline-none px-1 py-1"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleSendThreadMessage();
                                                        }
                                                    }}
                                                />
                                                <button
                                                    onClick={handleSendThreadMessage}
                                                    disabled={isSendingComposer || !composerMessage.trim()}
                                                    className="bg-[#F14D24] hover:bg-[#e03f14] disabled:opacity-50 text-white rounded-xl p-2.5 flex items-center justify-center transition-colors shadow-md shadow-orange-500/10 h-9 w-9 shrink-0 self-end mb-1"
                                                >
                                                    {isSendingComposer ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <Send className="w-3.5 h-3.5 text-white" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
