"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

interface LoaderOverlayProps {
    isVisible: boolean;
    message?: string;
    type?: "default" | "initialization";
    setIsLoading?: (loading: boolean) => void;
}

const INITIALIZATION_STEPS = [
    "Authenticating secure session...",
    "Syncing executive dashboard...",
    "Loading operational tasks...",
    "Initializing command modules...",
    "Finalizing system handshake...",
];

export function LoaderOverlay({
    isVisible,
    message,
    type = "default",
    setIsLoading,
}: LoaderOverlayProps) {
    const [stepIndex, setStepIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [forceHidden, setForceHidden] = useState(false);

    useEffect(() => {
        if (isVisible) {
            setForceHidden(false);
            const emergencyTimer = setTimeout(() => {
                console.warn("Emergency Escape Hatch triggered: Force-killing loader freeze.");
                setForceHidden(true);
                if (setIsLoading) {
                    setIsLoading(false);
                }
            }, 15000);

            return () => clearTimeout(emergencyTimer);
        }
    }, [isVisible, setIsLoading]);

    useEffect(() => {
        if (isVisible && type === "initialization") {
            const stepInterval = setInterval(() => {
                setStepIndex((prev) =>
                    prev < INITIALIZATION_STEPS.length - 1 ? prev + 1 : prev,
                );
            }, 400); // Reduced from 800ms

            const progressInterval = setInterval(() => {
                setProgress((prev) => {
                    if (prev >= 100) return 100;
                    return prev + 100 / (INITIALIZATION_STEPS.length * 2);
                });
            }, 100); // Reduced from 200ms

            return () => {
                clearInterval(stepInterval);
                clearInterval(progressInterval);
            };
        } else {
            setStepIndex(0);
            setProgress(0);
        }
    }, [isVisible, type]);

    if (type === "default") {
        return (
            <AnimatePresence>
                {isVisible && !forceHidden && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/60 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white border border-slate-100 p-8 rounded-2xl shadow-2xl shadow-slate-200/50 flex flex-col items-center gap-4"
                        >
                            <Loader2 className="w-8 h-8 text-[#e86123] animate-spin" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#2D2A77]">
                                {message || "Processing request..."}
                            </span>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        );
    }

    return (
        <AnimatePresence>
            {isVisible && !forceHidden && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#F8F9FC]"
                >
                    <div className="max-w-md w-full px-8 flex flex-col items-center">
                        <motion.div
                            animate={{
                                scale: [1, 1.05, 1],
                                opacity: [0.8, 1, 0.8],
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                            className="mb-12"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src="/images/usthadacademylogo2.svg"
                                alt="UA Logo"
                                className="h-20 w-20 object-contain grayscale opacity-80"
                            />
                        </motion.div>

                        <div className="text-center space-y-2 mb-10">
                            <motion.h2
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="text-xl font-black text-[#2D2A77] uppercase tracking-tighter"
                            >
                                Initializing Command Center
                            </motion.h2>
                            <motion.p
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]"
                            >
                                Loading operational modules...
                            </motion.p>
                        </div>

                        <div className="w-full max-w-[280px] space-y-6">
                            <div className="h-[2px] w-full bg-slate-100 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-[#e86123] to-[#f59e0b]"
                                    initial={{ width: "0%" }}
                                    animate={{ width: `${progress}%` }}
                                    transition={{
                                        duration: 0.5,
                                        ease: "linear",
                                    }}
                                />
                            </div>

                            <div className="h-4 flex justify-center">
                                <AnimatePresence mode="wait">
                                    <motion.span
                                        key={stepIndex}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.4 }}
                                        className="text-[9px] font-black text-[#2D2A77]/60 uppercase tracking-widest text-center"
                                    >
                                        {message ||
                                            INITIALIZATION_STEPS[stepIndex]}
                                    </motion.span>
                                </AnimatePresence>
                            </div>
                        </div>
                    </div>

                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-50/30 rounded-full blur-[120px]" />
                        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-orange-50/30 rounded-full blur-[120px]" />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
