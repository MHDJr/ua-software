"use client";

import React, { useEffect, useState, useTransition, useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Search, 
    Sparkles, 
    LayoutDashboard, 
    Wallet, 
    TrendingUp, 
    Users, 
    Mail, 
    Loader2, 
    CornerDownLeft,
    Cpu,
    Terminal,
    ShieldCheck,
    Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

// Brand colors
const BRAND_COLORS = {
    indigo: "#31267D",
    orange: "#EF4A24",
};

// 1. Strict CEO Navigation Route Mapping
const EXECUTIVE_NAV_NODES = [
    {
        label: "Go to Executive Command Center",
        route: "/ceo",
        icon: LayoutDashboard,
        id: "nav-ceo-dashboard"
    },
    {
        label: "View Financial Intelligence",
        route: "/finance-intelligence",
        icon: Wallet,
        id: "nav-finance"
    },
    {
        label: "Inspect Sales Intelligence",
        route: "/sales-intelligence",
        icon: TrendingUp,
        id: "nav-sales"
    },
    {
        label: "Open Staff Management Portal",
        route: "/staff-management",
        icon: Users,
        id: "nav-staff-portal"
    },
    {
        label: "Access Executive Inbox",
        route: "/inbox",
        icon: Mail,
        id: "nav-inbox"
    }
];

const UA_PLACEHOLDERS = [
    "Instruct UAAE... (e.g., 'Assign urgent task to Muhammed: audit databases')",
    "Settle records... (e.g., 'Log finance: $4500 UloomX income, $2100 expenses')",
    "Issue directive... (e.g., 'Broadcast announcement: Staff review starts tomorrow')"
];

export default function CommandBar() {
    const { user, profile, loading } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    
    const isV2Enabled = process.env.NEXT_PUBLIC_ENABLE_V2_FEATURES === "true";

    useEffect(() => {
        if (!isV2Enabled) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsOpen((prev) => !prev);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isV2Enabled]);

    if (!isV2Enabled || loading || !user || !profile) return null;

    if (profile.role !== 'ceo') return null;

    return <CommandBarContent isOpen={isOpen} setIsOpen={setIsOpen} token={user.id} />;
}

interface CommandBarContentProps {
    isOpen: boolean;
    setIsOpen: (open: boolean) => void;
    token: string;
}

function CommandBarContent({ isOpen, setIsOpen, token }: CommandBarContentProps) {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [placeholderIdx, setPlaceholderIdx] = useState(0);
    const [isPending, startTransition] = useTransition();
    const [loadingMessage, setLoadingMessage] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            setPlaceholderIdx((prev) => (prev + 1) % UA_PLACEHOLDERS.length);
        }, 4000);
        return () => clearInterval(interval);
    }, [isOpen]);

    const handleNavigate = useCallback((path: string) => {
        setIsOpen(false);
        setSearch("");
        router.push(path);
    }, [router, setIsOpen]);

    const handleAISubmit = async (promptText: string) => {
        if (!promptText.trim()) return;
        setLoadingMessage("UAAE processing directive...");
        
        try {
            const response = await fetch("/api/command", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ prompt: promptText })
            });

            if (response.status === 502 || response.status === 503 || response.status === 504) {
                throw new Error("API_OVERLOAD");
            }

            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Failed to execute directive");

            if (result.target_table) {
                queryClient.invalidateQueries({ queryKey: [result.target_table] });
                if (result.target_table === "ceo_directives") {
                    queryClient.invalidateQueries({ queryKey: ["staff_directives"] });
                }
            }

            toast.success("Command Executed", {
                description: result.message,
                duration: 5000,
            });

            setIsOpen(false);
            setSearch("");
        } catch (error: any) {
            console.error("UAAE failure:", error);
            if (error.message === "API_OVERLOAD") {
                toast("Operating in local manual command mode.", {
                    description: "AI processing is currently overloaded.",
                    icon: <ShieldCheck className="h-4 w-4 text-amber-500" />,
                });
            } else {
                toast.error("Execution Failure", { description: error.message });
            }
        } finally {
            setLoadingMessage("");
        }
    };

    return (
        <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
            <AnimatePresence>
                {isOpen && (
                    <Dialog.Portal forceMount>
                        <Dialog.Overlay asChild forceMount>
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="fixed inset-0 z-[9999] bg-slate-900/30 backdrop-blur-md"
                            />
                        </Dialog.Overlay>
                        
                        <Dialog.Content 
                            asChild 
                            forceMount 
                            aria-describedby={undefined}
                        >
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95, y: "-48%", x: "-50%" }}
                                animate={{ opacity: 1, scale: 1, y: "-50%", x: "-50%" }}
                                exit={{ opacity: 0, scale: 0.95, y: "-48%", x: "-50%" }}
                                transition={{ type: "spring", duration: 0.5, bounce: 0.1 }}
                                className={cn(
                                    "fixed left-1/2 top-1/2 z-[10000] w-full max-w-xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,0.15)]",
                                    "bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[2.5rem]"
                                )}
                            >
                                <Dialog.Title className="sr-only">UAAE Command Menu</Dialog.Title>

                                <Command className="flex flex-col w-full h-full overflow-hidden bg-transparent" label="UAAE Executive Console">
                                    
                                    {/* Spotlight Brand Header */}
                                    <div className="relative px-8 py-6 bg-white/40 border-b border-black/5 overflow-hidden">
                                        {/* Subtle Background Spotlight */}
                                        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                                        
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-white shadow-lg shadow-indigo-500/10 flex items-center justify-center border border-indigo-50/50">
                                                    <img src="/images/usthadacademylogo2.svg" alt="UA Logo" className="w-8 h-8 object-contain" />
                                                </div>
                                                <div>
                                                    <h3 className="text-[13px] font-black uppercase tracking-[0.2em] text-[#31267D]">
                                                        Usthad <span className="text-[#EF4A24]">Academy</span>
                                                    </h3>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-1.5">
                                                        <Cpu className="h-3 w-3" />
                                                        UAAE Executive Interface
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-[#EF4A24]/5 border border-[#EF4A24]/10">
                                                <div className="h-1.5 w-1.5 rounded-full bg-[#EF4A24] animate-pulse shadow-[0_0_8px_rgba(239,74,36,0.6)]" />
                                                <span className="text-[9px] font-black tracking-widest text-[#EF4A24] uppercase">
                                                    V2.0 STABLE
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Glass Search Input */}
                                    <div className="flex items-center gap-4 px-8 py-5 relative border-b border-black/5">
                                        <div className="shrink-0">
                                            {loadingMessage ? (
                                                <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                                            ) : (
                                                <Zap className="h-5 w-5 text-indigo-500 fill-indigo-500/10" />
                                            )}
                                        </div>
                                        
                                        <div className="relative w-full flex items-center h-7">
                                            {search === "" && (
                                                <AnimatePresence mode="wait">
                                                    <motion.span
                                                        key={placeholderIdx}
                                                        initial={{ opacity: 0, x: 8 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -8 }}
                                                        className="absolute left-0 text-[15px] text-slate-400 pointer-events-none select-none truncate w-full font-medium"
                                                    >
                                                        {UA_PLACEHOLDERS[placeholderIdx]}
                                                    </motion.span>
                                                </AnimatePresence>
                                            )}
                                            
                                            <Command.Input
                                                value={search}
                                                onValueChange={setSearch}
                                                className="w-full bg-transparent text-[15px] outline-none border-none text-slate-800 placeholder:text-slate-300 font-medium"
                                                disabled={!!loadingMessage}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && search.trim() && !loadingMessage) {
                                                        e.preventDefault();
                                                        startTransition(() => handleAISubmit(search));
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Dynamic Navigation & AI Results */}
                                    <Command.List className="max-h-[340px] overflow-y-auto p-4 space-y-2 custom-scrollbar">
                                        
                                        <Command.Group 
                                            heading="Executive Pathways" 
                                            className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400"
                                        >
                                            {EXECUTIVE_NAV_NODES.map((node) => (
                                                <Command.Item
                                                    key={node.id}
                                                    value={node.label}
                                                    onSelect={() => handleNavigate(node.route)}
                                                    className={cn(
                                                        "flex items-center gap-4 px-4 py-3.5 rounded-[1.75rem] cursor-pointer transition-all duration-300",
                                                        "data-[selected=true]:bg-indigo-500/5 data-[selected=true]:shadow-[0_4px_20px_rgba(49,38,125,0.05)]",
                                                        "group"
                                                    )}
                                                >
                                                    <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center transition-all duration-300 group-data-[selected=true]:scale-110 group-data-[selected=true]:shadow-indigo-500/10 border border-slate-100 group-data-[selected=true]:border-indigo-100">
                                                        <node.icon className="h-4 w-4 text-slate-400 group-data-[selected=true]:text-indigo-600" />
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-bold text-slate-700 group-data-[selected=true]:text-[#31267D] tracking-tight">
                                                            {node.label}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest group-data-[selected=true]:text-indigo-400/60 transition-colors">
                                                            {node.route}
                                                        </span>
                                                    </div>
                                                </Command.Item>
                                            ))}
                                        </Command.Group>

                                        {search.trim().length > 0 && (
                                            <Command.Group 
                                                heading="Neural Operations"
                                                className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-[#EF4A24]/60"
                                            >
                                                <Command.Item
                                                    value={`ai-${search}`}
                                                    onSelect={() => handleAISubmit(search)}
                                                    className={cn(
                                                        "flex items-center gap-4 px-5 py-5 rounded-[2rem] cursor-pointer transition-all duration-500",
                                                        "bg-gradient-to-br from-[#EF4A24]/5 to-orange-500/[0.02] border border-[#EF4A24]/10",
                                                        "data-[selected=true]:from-[#EF4A24]/10 data-[selected=true]:border-[#EF4A24]/30",
                                                        "shadow-[0_8px_30px_rgba(239,74,36,0.05)]"
                                                    )}
                                                >
                                                    <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center shadow-md animate-subtle-bounce border border-orange-50">
                                                        <Sparkles className="h-5 w-5 text-[#EF4A24]" />
                                                    </div>
                                                    <div className="flex flex-col flex-1 overflow-hidden">
                                                        <span className="text-[15px] font-black text-slate-800 tracking-tight">
                                                            Process Executive Intent
                                                        </span>
                                                        <p className="text-xs text-slate-500 truncate italic">
                                                            "{search}"
                                                        </p>
                                                    </div>
                                                    <div className="px-3 py-1.5 rounded-xl bg-[#EF4A24]/10 text-[10px] font-black text-[#EF4A24] uppercase tracking-tighter">
                                                        Execute
                                                    </div>
                                                </Command.Item>
                                            </Command.Group>
                                        )}
                                        
                                        <Command.Empty className="py-12 text-center flex flex-col items-center gap-3">
                                            <div className="p-3 rounded-full bg-slate-50 border border-slate-100">
                                                <Search className="h-5 w-5 text-slate-300" />
                                            </div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                No path matched
                                            </p>
                                        </Command.Empty>
                                    </Command.List>

                                    {/* Elite Glass Footer */}
                                    <div className="flex items-center justify-between px-8 py-4 bg-slate-50/50 border-t border-black/5 text-[10px] font-bold text-slate-400 select-none tracking-widest uppercase">
                                        <div className="flex items-center gap-2">
                                            <Terminal className="h-4 w-4 text-[#31267D]" />
                                            <span>UA-OS v2.0 RESILIENCE ENGINE</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="flex items-center gap-1">
                                                <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[9px]">ESC</span>
                                                to close
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[9px]">↑↓</span>
                                                Navigate
                                            </span>
                                        </div>
                                    </div>
                                </Command>
                            </motion.div>
                        </Dialog.Content>
                    </Dialog.Portal>
                )}
            </AnimatePresence>
        </Dialog.Root>
    );
}
