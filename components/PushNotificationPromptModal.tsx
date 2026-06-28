"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { Bell, Check, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function PushNotificationPromptModal() {
    const { user } = useAuth();
    const { isSupported, permission, isSubscribed, subscribeUser, loading } = usePushSubscription();
    const [isOpen, setIsOpen] = useState(false);
    const [isActivating, setIsActivating] = useState(false);

    useEffect(() => {
        // Only prompt if:
        // 1. User is authenticated
        // 2. Browser supports push notifications
        // 3. Permission is not already granted
        // 4. They haven't already enabled notifications
        // 5. They haven't dismissed this prompt in the last 24 hours
        if (!user || !isSupported || permission === "granted" || isSubscribed || loading) {
            setIsOpen(false);
            return;
        }

        const lastDismissed = localStorage.getItem("ua-push-prompt-dismissed");
        const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours in ms
        const isCooldownActive = lastDismissed && (Date.now() - parseInt(lastDismissed, 10) < cooldownPeriod);

        if (!isCooldownActive) {
            // Delay showing slightly for better UX after page load
            const timer = setTimeout(() => {
                setIsOpen(true);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [user, isSupported, permission, isSubscribed, loading]);

    const handleEnable = async () => {
        setIsActivating(true);
        try {
            await subscribeUser();
            toast.success("Instant notification alerts activated!");
            setIsOpen(false);
        } catch (err: any) {
            console.error("[PushNotificationPromptModal] Enable error:", err);
            toast.error(err.message || "Failed to enable notifications.");
        } finally {
            setIsActivating(false);
        }
    };

    const handleDismiss = () => {
        localStorage.setItem("ua-push-prompt-dismissed", Date.now().toString());
        setIsOpen(false);
        toast.info("Notification prompt dismissed. You can enable them anytime from your profile settings.");
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
                {/* Modal Container */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    transition={{ type: "spring", duration: 0.5 }}
                    className="w-full max-w-md bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/40 border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col items-center"
                >
                    {/* Abstract Decorative Lights */}
                    <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

                    {/* Close Button */}
                    <button
                        onClick={handleDismiss}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-all"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Icon Header */}
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-6">
                        <Bell className="w-6 h-6 animate-bounce" />
                    </div>

                    {/* Titles */}
                    <h2 className="text-xl font-black text-white uppercase tracking-wider text-center">
                        Enable Instant Notifications
                    </h2>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-1 mb-6 text-center">
                        Never miss critical directives
                    </p>

                    {/* Features List */}
                    <div className="w-full space-y-3 mb-8">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-slate-300">
                            <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                <Check className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-semibold">New Tasks</span>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-slate-300">
                            <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                <Check className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-semibold">New Messages</span>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-slate-300">
                            <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                <Check className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-semibold">Meeting Invitations</span>
                        </div>

                        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 text-slate-300">
                            <div className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                <Check className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-xs font-semibold">Reminders</span>
                        </div>
                    </div>

                    {/* Submit Buttons */}
                    <div className="w-full flex flex-col gap-3">
                        <button
                            onClick={handleEnable}
                            disabled={isActivating}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs transition-all duration-300 shadow-lg shadow-indigo-600/20 active:scale-98"
                        >
                            {isActivating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <>
                                    <Bell className="w-4 h-4" />
                                    Enable Notifications
                                </>
                            )}
                        </button>
                        
                        <button
                            onClick={handleDismiss}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-bold uppercase tracking-widest text-xs transition-all duration-300 border border-white/5"
                        >
                            Maybe Later
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
