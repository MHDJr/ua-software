"use client";

import React, { useState } from "react";
import {
    Zap,
    Loader2,
    Send,
    Mic,
    Video,
    Volume2,
    Users,
    Bell,
    MessageSquare,
    Shield,
    Cpu,
    PhoneCall,
    ClipboardList,
} from "lucide-react";
import AssignTask from "./AssignTask";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/lib/supabase";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ExecutiveActionsProps {
    staffList: any[];
    currentUserId: string;
}

export default function ExecutiveActions({
    staffList,
    currentUserId,
}: ExecutiveActionsProps) {
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    // Broadcast State
    const [broadcastMessage, setBroadcastMessage] = useState("");
    const [broadcastType, setBroadcastType] = useState<
        "announcement" | "alert" | "directive"
    >("announcement");

    // Quick Actions State
    const [selectedAction, setSelectedAction] = useState<string | null>(null);


    // Call Staff Dialog State
    const [callStaffOpen, setCallStaffOpen] = useState(false);
    const [targetStaff, setTargetStaff] = useState("");

    async function handleBroadcast(e: React.FormEvent) {
        e.preventDefault();
        if (!broadcastMessage.trim()) {
            toast.error("Message is required.");
            return;
        }
        setLoading(true);

        try {
            // Insert notification into database
            const { error } = await supabase.from("notifications").insert({
                title:
                    broadcastType === "alert"
                        ? "URGENT BROADCAST"
                        : broadcastType === "directive"
                          ? "EXECUTIVE DIRECTIVE"
                          : "ANNOUNCEMENT",
                message: broadcastMessage.trim(),
                type: broadcastType,
                is_read: false,
            });

            if (error) throw error;

            // If this is a directive, also insert into ceo_directives table with assigned_to = 'MANAGER'
            if (broadcastType === "directive") {
                const { error: directiveError } = await supabase.from("ceo_directives").insert({
                    title: "EXECUTIVE DIRECTIVE",
                    message: broadcastMessage.trim(),
                    priority: "high",
                    assigned_to: "MANAGER",
                    target_all_staff: false,
                    is_active: true,
                });

                if (directiveError) {
                    console.error("Failed to create directive:", directiveError);
                    toast.error("Broadcast sent but directive creation failed");
                } else {
                    toast.success("Directive assigned to ADMINISTRATOR");
                }
            }

            // Call the broadcast API if it exists
            try {
                await fetch("/api/admin/broadcast-push", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title:
                            broadcastType === "alert"
                                ? "URGENT"
                                : broadcastType === "directive"
                                  ? "DIRECTIVE"
                                  : "Announcement",
                        body: broadcastMessage,
                    }),
                });
            } catch (apiError) {
                console.log("Push broadcast API not available");
            }

            setOpen(false);
            setBroadcastMessage("");
            setBroadcastType("announcement");
            toast.success("Broadcast sent successfully");
        } catch (error: any) {
            toast.error("Failed to send broadcast: " + error.message);
        } finally {
            setLoading(false);
        }
    }


    async function handleCallStaff(e: React.FormEvent) {
        e.preventDefault();
        if (!targetStaff) {
            toast.error("Please select a staff member.");
            return;
        }
        setLoading(true);

        try {
            await supabase.from("notifications").insert({
                user_id: targetStaff,
                title: "CEO CALLING",
                message: "CEO is calling you to the cabin immediately.",
                type: "alert",
            });

            setCallStaffOpen(false);
            setTargetStaff("");
            toast.success("Staff member notified");
        } catch (error: any) {
            toast.error("Failed to call staff: " + error.message);
        } finally {
            setLoading(false);
        }
    }

    // Monochromatic, serious command buttons
    const quickActions = [
        {
            id: "assign-task",
            icon: ClipboardList,
            label: "Delegate Responsibility",
            isAssignTask: true,
        },
        {
            id: "call-staff",
            icon: PhoneCall,
            label: "Summon Staff",
            onClick: () => setCallStaffOpen(true),
        },
    ];

    return (
        <>
            {/* Command Actions Grid - Monochromatic, Serious */}
            <div className="grid grid-cols-3 gap-2 mb-4">
                {quickActions.map((action) => (
                    <React.Fragment key={action.id}>
                        {action.isAssignTask ? (
                            <AssignTask
                                staffList={staffList}
                                currentUserId={currentUserId}
                                variant="quick-action"
                            />
                        ) : (
                            <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                onClick={() => {
                                    setSelectedAction(action.id);
                                    action.onClick?.();
                                    setTimeout(
                                        () => setSelectedAction(null),
                                        500,
                                    );
                                }}
                                className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-exec-charcoal-light border border-white/10 hover:border-white/20 transition-all duration-300"
                            >
                                <action.icon className="h-4 w-4 text-white/70" />
                                <span className="text-[9px] font-medium text-white/60 uppercase tracking-wide">
                                    {action.label}
                                </span>
                            </motion.button>
                        )}
                    </React.Fragment>
                ))}
            </div>

            {/* Issue Directive Button */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-exec-charcoal-light border border-white/10 hover:border-white/20 transition-all duration-300"
                    >
                        <Send className="h-4 w-4 text-white/70" />
                        <span className="text-xs font-medium text-white/60 uppercase tracking-wide">
                            Issue Directive
                        </span>
                    </motion.button>
                </DialogTrigger>
                <DialogContent className="bg-exec-charcoal border-white/10 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold uppercase tracking-wider text-white flex items-center gap-2">
                            <MessageSquare className="h-4 w-4" /> Executive
                            Broadcast
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleBroadcast} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label className="text-white/70 text-xs uppercase tracking-wide">
                                Broadcast Type
                            </Label>
                            <div className="flex gap-2">
                                {[
                                    {
                                        value: "announcement",
                                        label: "Announcement",
                                        icon: Volume2,
                                    },
                                    {
                                        value: "alert",
                                        label: "Alert",
                                        icon: Bell,
                                    },
                                    {
                                        value: "directive",
                                        label: "Directive",
                                        icon: Shield,
                                    },
                                ].map((type) => (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() =>
                                            setBroadcastType(type.value as any)
                                        }
                                        className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-all ${
                                            broadcastType === type.value
                                                ? "bg-primary text-black"
                                                : "bg-white/5 text-white/50 hover:bg-white/10"
                                        }`}
                                    >
                                        <type.icon className="h-3 h-3 mx-auto mb-1" />
                                        {type.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label
                                htmlFor="message"
                                className="text-white/70 text-xs uppercase tracking-wide"
                            >
                                Message
                            </Label>
                            <Textarea
                                id="message"
                                placeholder="Type your broadcast message..."
                                value={broadcastMessage}
                                onChange={(e) =>
                                    setBroadcastMessage(e.target.value)
                                }
                                rows={4}
                                className="bg-exec-black border-white/10 resize-none text-white"
                            />
                        </div>
                        <DialogFooter className="pt-2">
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="border-white/10 hover:bg-white/5"
                                >
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="bg-primary hover:bg-primary/90 text-black"
                            >
                                {loading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="mr-2 h-4 w-4" />
                                )}
                                Broadcast
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>


            {/* Call Staff Dialog */}
            <Dialog open={callStaffOpen} onOpenChange={setCallStaffOpen}>
                <DialogContent className="bg-exec-charcoal border-white/10 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-semibold uppercase tracking-wider text-white flex items-center gap-2">
                            <PhoneCall className="h-4 w-4" /> Call Staff to
                            Cabin
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleCallStaff} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label className="text-white/70 text-xs uppercase tracking-wide">
                                Select Staff Member
                            </Label>
                            <Select
                                onValueChange={setTargetStaff}
                                value={targetStaff}
                            >
                                <SelectTrigger className="bg-exec-black border-white/10">
                                    <SelectValue placeholder="Choose a person..." />
                                </SelectTrigger>
                                <SelectContent className="bg-exec-charcoal border-white/10 text-white">
                                    {staffList.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {s.name} ({s.dept})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <p className="text-[10px] text-white/40 bg-white/5 p-3 rounded border border-white/5">
                            This will send a high-priority alert to the staff
                            member&apos;s dashboard.
                        </p>
                        <DialogFooter className="pt-2">
                            <DialogClose asChild>
                                <Button
                                    variant="outline"
                                    className="border-white/10 hover:bg-white/5"
                                >
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="bg-primary hover:bg-primary/90 text-black"
                            >
                                {loading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Initiate Call
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
