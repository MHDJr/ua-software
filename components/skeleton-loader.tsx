"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SkeletonCardProps {
    className?: string;
    delay?: number;
}

export function SkeletonPulse({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "relative overflow-hidden bg-slate-200/50 dark:bg-slate-800/50 rounded-lg",
                className,
            )}
        >
            <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-300/60 dark:via-slate-700/60 to-transparent"
                initial={{ x: "-100%" }}
                animate={{ x: "100%" }}
                transition={{
                    repeat: Infinity,
                    duration: 1.5,
                    ease: "easeInOut",
                }}
            />
        </div>
    );
}

export function SkeletonCard({ className, delay = 0 }: SkeletonCardProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.3 }}
            className={cn(
                "bg-white/50 dark:bg-zinc-900/50 border border-slate-200/50 dark:border-zinc-800/50 rounded-2xl p-5 shadow-sm",
                className,
            )}
        >
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <SkeletonPulse className="w-10 h-10 rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                        <SkeletonPulse className="h-4 w-3/4 rounded" />
                        <SkeletonPulse className="h-3 w-1/2 rounded" />
                    </div>
                </div>
                <SkeletonPulse className="h-8 w-1/3 rounded" />
                <SkeletonPulse className="h-3 w-full rounded" />
            </div>
        </motion.div>
    );
}

export function SkeletonStatCard({ delay = 0 }: { delay?: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay, duration: 0.3 }}
            className="bg-white/50 dark:bg-zinc-900/50 border border-slate-200/50 dark:border-zinc-800/50 rounded-2xl p-5 shadow-sm"
        >
            <div className="flex items-start justify-between mb-3">
                <SkeletonPulse className="w-8 h-8 rounded-lg" />
                <SkeletonPulse className="w-12 h-5 rounded-full" />
            </div>
            <SkeletonPulse className="h-8 w-24 rounded mb-2" />
            <SkeletonPulse className="h-4 w-32 rounded" />
        </motion.div>
    );
}

export function SkeletonListItem({ delay = 0 }: { delay?: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay, duration: 0.3 }}
            className="flex items-center gap-4 p-4 border-b border-slate-100 dark:border-zinc-800 last:border-0"
        >
            <SkeletonPulse className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
                <SkeletonPulse className="h-4 w-3/4 rounded" />
                <SkeletonPulse className="h-3 w-1/2 rounded" />
            </div>
            <SkeletonPulse className="w-16 h-6 rounded-full" />
        </motion.div>
    );
}

export function SkeletonSidebar() {
    return (
        <div className="fixed left-0 top-0 h-screen w-[80px] md:w-[260px] bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-r border-slate-200 dark:border-zinc-800 z-50 p-4">
            {/* Logo Section */}
            <div className="flex items-center gap-3 mb-8 px-2">
                <SkeletonPulse className="w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="hidden md:block flex-1 space-y-2">
                    <SkeletonPulse className="h-5 w-32 rounded" />
                    <SkeletonPulse className="h-3 w-24 rounded" />
                </div>
            </div>

            {/* Navigation Items */}
            <div className="space-y-2">
                {[...Array(6)].map((_, i) => (
                    <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-xl"
                    >
                        <SkeletonPulse className="w-5 h-5 rounded" />
                        <div className="hidden md:block flex-1 space-y-2">
                            <SkeletonPulse className="h-4 w-3/4 rounded" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer */}
            <div className="absolute bottom-4 left-4 right-4 space-y-3">
                <SkeletonPulse className="h-10 w-full rounded-xl hidden md:block" />
                <div className="flex items-center gap-3 p-2">
                    <SkeletonPulse className="w-10 h-10 rounded-full flex-shrink-0" />
                    <div className="hidden md:block flex-1 space-y-2">
                        <SkeletonPulse className="h-4 w-24 rounded" />
                        <SkeletonPulse className="h-3 w-16 rounded" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function SkeletonCommandCenter() {
    return (
        <div className="min-h-screen bg-[#F9FAFB] dark:bg-zinc-950 ml-0 md:ml-[80px] pt-[60px] md:pt-0">
            <div className="p-4 md:p-6 lg:p-8">
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <SkeletonPulse className="w-12 h-12 rounded-xl" />
                        <div className="space-y-2">
                            <SkeletonPulse className="h-6 w-48 rounded" />
                            <SkeletonPulse className="h-4 w-32 rounded" />
                        </div>
                    </div>
                    <SkeletonPulse className="w-10 h-10 rounded-full" />
                </div>

                {/* Metric Grid Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                    {[...Array(5)].map((_, i) => (
                        <SkeletonStatCard key={i} delay={0.1 + i * 0.05} />
                    ))}
                </div>

                {/* Main Content Grid Skeleton */}
                <div className="grid grid-cols-12 gap-6">
                    {/* Left Column */}
                    <div className="col-span-12 lg:col-span-3 space-y-4">
                        <SkeletonCard delay={0.3} className="min-h-[400px]" />
                    </div>

                    {/* Middle Column */}
                    <div className="col-span-12 lg:col-span-6 space-y-4">
                        <SkeletonCard delay={0.4} className="min-h-[500px]" />
                    </div>

                    {/* Right Column */}
                    <div className="col-span-12 lg:col-span-3 space-y-4">
                        <SkeletonCard delay={0.5} className="min-h-[400px]" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function SkeletonPage({ children }: { children?: React.ReactNode }) {
    return (
        <>
            <SkeletonSidebar />
            {children || <SkeletonCommandCenter />}
        </>
    );
}
