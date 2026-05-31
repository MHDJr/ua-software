"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneCall, AlertTriangle, Send, X, ShieldAlert, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function StaffNotificationOverlay({ event = {}, onClose }) {
    const [loading, setLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        // Play an alert sound when it mounts
        const audio = new Audio("/audio/alert_high.mp3");
        audio.play().catch(() => console.log("Audio play blocked"));
        
        return () => clearInterval(timer);
    }, []);

    const quickReplies = ["Coming Immediately", "In 5 Minutes", "Currently Occupied"];

    async function handleReply(choice) {
        setLoading(true);
        try {
            // In a real scenario, we'd send this back to Supabase or via socket
            // For now, we'll simulate the response
            toast.success(`Response sent: ${choice}`);
            
            // If there's a callback for replies, we'd use it here
            
            onClose && onClose();
        } catch (err) {
            toast.error("Failed to send reply");
        } finally {
            setLoading(false);
        }
    }

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                {/* Cinematic Background Blur/Overlay */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
                />

                {/* Pulsing Red Glow Effect */}
                <motion.div
                    animate={{ 
                        opacity: [0.3, 0.6, 0.3],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 bg-red-900/20 radial-gradient(circle, rgba(239,68,68,0.2) 0%, transparent 70%)"
                />

                {/* Notification Card */}
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    className="relative w-full max-w-lg bg-black border-2 border-red-500/50 rounded-[2rem] overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.3)]"
                >
                    {/* Header Scanner Line */}
                    <motion.div 
                        animate={{ top: ["0%", "100%", "0%"] }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute left-0 right-0 h-[2px] bg-red-500/50 shadow-[0_0_15px_red] z-10"
                    />

                    <div className="p-8 md:p-12">
                        <div className="flex flex-col items-center text-center space-y-6">
                            {/* Alert Icon Multi-layer */}
                            <div className="relative">
                                <motion.div 
                                    animate={{ scale: [1, 1.2, 1] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                    className="absolute inset-0 bg-red-500/20 rounded-full blur-xl"
                                />
                                <div className="relative bg-red-500 p-5 rounded-full shadow-[0_0_30px_rgba(239,68,68,0.5)]">
                                    <PhoneCall className="h-10 w-10 text-black animate-pulse" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Badge variant="outline" className="border-red-500/50 text-red-500 px-4 py-1 text-xs font-black uppercase tracking-[0.3em] font-mono">
                                    Priority Alpha Alert
                                </Badge>
                                <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">
                                    CEO is Calling
                                </h2>
                                <p className="text-red-400 font-mono text-[10px] uppercase tracking-widest animate-pulse">
                                    Report to Executive Suite Immediately
                                </p>
                            </div>

                            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
                                <div className="flex items-start gap-4 text-left">
                                    <ShieldAlert className="h-6 w-6 text-red-500 shrink-0 mt-1" />
                                    <div className="space-y-1">
                                        <p className="text-xs text-slate-500 uppercase font-black tracking-widest font-mono">Message from Saleem Pa</p>
                                        <p className="text-lg text-white font-medium italic">
                                            &quot;{event.message || 'Executive presence requested in my office. Proceed without delay.'}&quot;
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Response Actions */}
                            <div className="w-full space-y-4 pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <Button 
                                        onClick={() => handleReply("On my way")}
                                        disabled={loading}
                                        className="h-16 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest italic rounded-2xl shadow-lg shadow-red-900/40"
                                    >
                                        <Send className="mr-2 h-5 w-5" />
                                        ACKNOWLEDGE
                                    </Button>
                                    <Button 
                                        variant="outline"
                                        onClick={() => handleReply("In Class")}
                                        disabled={loading}
                                        className="h-16 border-white/10 bg-white/5 text-white font-black uppercase tracking-widest italic rounded-2xl hover:bg-white/10"
                                    >
                                        IN CLASS
                                    </Button>
                                </div>
                                <div className="flex justify-center">
                                    <button 
                                        onClick={() => onClose && onClose()}
                                        className="text-[10px] text-slate-500 hover:text-white uppercase font-bold tracking-[0.2em] transition-colors flex items-center gap-2"
                                    >
                                        <X className="h-3 w-3" /> Dismiss Alert
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer System Stats */}
                    <div className="bg-red-900/10 border-t border-red-500/20 px-8 py-3 flex justify-between items-center bg-black">
                        <div className="flex items-center gap-2 text-[8px] font-mono text-red-500/60 uppercase">
                            <Cpu className="h-3 w-3" />
                            System Uptime: 99.99%
                        </div>
                        <div className="text-[8px] font-mono text-red-500/60">
                            {currentTime.toLocaleTimeString()} | EX-ID: {event.staffId?.slice(0,8) || "UA-001"}
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
