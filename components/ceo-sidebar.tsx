"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Users, Mail, ChevronRight, ChevronLeft, TrendingUp, LogOut, Wallet, Brain, Plus, Calendar, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, isValidAvatarUrl } from "@/lib/utils";
import { useBadgeCounts } from "@/hooks/use-badge-counts";
import { supabase } from "@/lib/supabase";
import { SystemSyncButton } from "./system-sync-button";
import { useAuth } from "@/lib/auth-context";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { LeaveRequestModal } from "@/components/LeaveRequestModal";
import { RequestModal } from "@/components/RequestModal";
import { ProfileModal } from "@/components/ProfileModal";

// Brand colors
const BRAND_COLORS = {
    indigo: "#31267D",
    orange: "#F14D24",
};

type NavItem = {
    id: string;
    label: string;
    icon: React.ElementType;
    badge?: number;
};

const topNavItems: NavItem[] = [
    {
        id: "command-center",
        label: "Dashboard",
        icon: LayoutDashboard,
    },
    {
        id: "financial-intelligence",
        label: "Financial Intel",
        icon: Wallet,
    },
    {
        id: "sales-intelligence",
        label: "Sales Intel",
        icon: TrendingUp,
    },
];

const middleNavItems: NavItem[] = [
    {
        id: "staff-management",
        label: "Staff Portal",
        icon: Users,
    },
    {
        id: "inbox",
        label: "Executive Inbox",
        icon: Mail,
    },
];

interface CEOSidebarProps {
    activeView: string;
    onMinimizedChange?: (isMinimized: boolean) => void;
    onViewChange?: (view: string) => void;
    unreadCommsCount?: number;
    isCommsOpen?: boolean;
}

export function CEOSidebar({ activeView, onMinimizedChange, onViewChange, unreadCommsCount, isCommsOpen }: CEOSidebarProps) {
    const [isMinimized, setIsMinimized] = useState(true);
    const [hoveredItem, setHoveredItem] = useState<string | null>(null);
    const { badgeCounts } = useBadgeCounts();
    const { userRole, profile } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    const handleToggleMinimized = () => {
        const newState = !isMinimized;
        setIsMinimized(newState);
        onMinimizedChange?.(newState);
    };

    const handleNavigate = (id: string) => {
        if (id === "financial-intelligence") {
            router.push("/ceo/financial-intelligence");
        } else if (id === "sales-intelligence") {
            router.push("/ceo/sales");
        } else if (id === "command-center") {
            if (onViewChange) {
                onViewChange(id);
            } else {
                router.push("/ceo");
            }
        } else {
            if (onViewChange) {
                onViewChange(id);
            } else {
                router.push(`/ceo?view=${id}`);
            }
        }
    };

    const handleLogout = async () => {
        try {
            await supabase.auth.signOut();
            router.push("/");
        } catch (error) {
            console.error("Logout error:", error);
        }
    };

    const renderNavItem = (item: NavItem) => {
        const isActive = activeView === item.id;
        const isHovered = hoveredItem === item.id;
        const Icon = item.icon;

        const badgeCount = (item.id === "staff-management") ? badgeCounts.pendingRequests : 
                           (item.id === "inbox") ? badgeCounts.unreadNotifications : 
                           (item.id === "comms") ? (unreadCommsCount ?? 0) : 0;

        return (
            <li key={item.id}>
                <button
                    onClick={() => handleNavigate(item.id)}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={cn(
                        "w-full flex items-center gap-3 transition-all duration-500 group relative",
                        isMinimized ? "justify-center px-0 py-4" : "px-4 py-4 rounded-2xl",
                        isActive 
                            ? "bg-gradient-to-r from-[#31267D]/15 to-transparent text-[#31267D]" 
                            : isHovered 
                                ? "bg-[#31267D]/5 text-[#31267D]" 
                                : "text-[var(--theme-text-40)] hover:text-[#31267D]"
                    )}
                    title={isMinimized ? item.label : undefined}
                >
                    <div className="relative flex items-center justify-center">
                        {/* Cinematic Radial Backglow */}
                        {isActive && (
                            <motion.div 
                                layoutId="backglow"
                                className="absolute inset-[-12px] rounded-full opacity-100 z-0"
                                style={{
                                    background: 'radial-gradient(circle, rgba(49, 38, 125, 0.12) 0%, transparent 70%)',
                                    filter: 'blur(4px)'
                                }}
                            />
                        )}
                        
                        <Icon
                            className={cn(
                                "w-5 h-5 transition-all duration-500 relative z-10",
                                isActive ? "text-[#31267D] scale-110" : "text-[var(--theme-text-30)] group-hover:text-[#31267D] group-hover:scale-110"
                            )}
                            strokeWidth={isActive ? 2.5 : 2}
                        />

                        {/* Micro Activity Dot */}
                        {badgeCount > 0 && isMinimized && (
                            <span className="absolute -top-1 -right-1 flex h-2 w-2 z-20">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500 border border-white"></span>
                            </span>
                        )}
                    </div>

                    {!isMinimized && (
                        <span
                            className={cn(
                                "text-[11px] font-black uppercase tracking-[0.15em] flex-1 text-left transition-all duration-500",
                                isActive ? "text-[#31267D] translate-x-1" : "text-[var(--theme-text-40)] group-hover:text-[#31267D] group-hover:translate-x-1"
                            )}
                        >
                            {item.label}
                        </span>
                    )}

                    {badgeCount > 0 && !isMinimized && (
                        <span
                            className="flex items-center justify-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-orange-500 text-white shadow-lg shadow-orange-500/20 animate-subtle-slide-up"
                        >
                            {badgeCount > 99 ? "99+" : badgeCount}
                        </span>
                    )}
                </button>
            </li>
        );
    };

    return (
        <aside
            className={cn(
                "fixed left-0 top-0 h-screen hidden md:flex flex-col z-50",
                "sidebar-theme-transition",
                "transition-all duration-700 ease-&lsqb;cubic-bezier(0.23,1,0.32,1)&rsqb;"
            )}
            style={{ 
                width: isMinimized ? 80 : 260,
            }}
        >
            {/* Cinematic Glass Container - Borderless look with faint transparent white border */}
            <div className={cn(
                "absolute inset-y-4 left-4 right-0 rounded-l-[2.5rem] border-y border-l",
                "border-white/50 dark:border-white/10",
                "bg-white/40 dark:bg-black/10 backdrop-blur-2xl shadow-[40px_0_100px_rgba(0,0,0,0.05)]"
            )} />

            <div className="relative h-full flex flex-col py-10 overflow-hidden">
                {/* Branding Section */}
                <div className={cn(
                    "pl-12 pr-8 mt-8 mb-12 transition-all duration-500",
                    isMinimized && "px-4 flex justify-center mt-6"
                )}>
                    <div className="relative group cursor-pointer">
                        <div
                            className="w-10 h-10 rounded-[1.25rem] flex items-center justify-center bg-white shadow-[0_10px_30px_rgba(49,38,125,0.15)] group-hover:shadow-[0_15px_40px_rgba(49,38,125,0.25)] transition-all duration-500 border border-indigo-50/50 overflow-hidden ring-4 ring-indigo-500/5"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                                src="/images/usthadacademylogo2.svg" 
                                alt="UA Logo" 
                                className="w-7 h-7 object-contain drop-shadow-[0_2px_4px_rgba(49,38,125,0.1)]"
                            />
                        </div>
                        {!isMinimized && (
                            <div className="absolute left-14 top-1/2 -translate-y-1/2 whitespace-nowrap">
                                <h1 className="text-sm font-black uppercase tracking-[0.25em] text-[#31267D]">AcademyOS</h1>
                                <p className="text-[7px] font-black uppercase tracking-[0.3em] text-[var(--theme-text-20)] mt-0.5">Strategic Command</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Primary Navigation - Top Group */}
                <nav className="flex-1 px-8 space-y-2 overflow-y-auto custom-scrollbar">
                    <ul className="space-y-1">
                        {topNavItems.map(renderNavItem)}
                    </ul>

                    {/* Subtle Divider - Minimal Spacing */}
                    <div className="py-2">
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#31267D]/10 to-transparent mx-auto opacity-50" />
                    </div>

                    {/* Secondary Navigation - Middle Group */}
                    <ul className="space-y-1">
                        {middleNavItems.map(renderNavItem)}
                    </ul>
                </nav>

                {/* Anchored Bottom Controls */}
                <div className="px-8 mt-auto pt-8 space-y-6">
                    <button
                        onClick={handleToggleMinimized}
                        className={cn(
                            "w-full flex items-center transition-all duration-500 group",
                            isMinimized ? "justify-center" : "gap-3 px-4 py-3 rounded-2xl hover:bg-[#31267D]/5"
                        )}
                    >
                        <div className="w-8 h-8 rounded-full bg-[#31267D]/5 flex items-center justify-center group-hover:bg-[#31267D]/10 group-hover:scale-110 transition-all duration-500">
                            {isMinimized ? (
                                <ChevronRight className="w-4 h-4 text-[#31267D]" />
                            ) : (
                                <ChevronLeft className="w-4 h-4 text-[#31267D]" />
                            )}
                        </div>
                        {!isMinimized && (
                            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--theme-text-30)] group-hover:text-[#31267D] transition-colors">Minimize Console</span>
                        )}
                    </button>

                    {userRole === 'CEO' && (
                        <div className={cn("px-1", isMinimized && "flex justify-center")}>
                            <SystemSyncButton variant={isMinimized ? "icon" : "full"} />
                        </div>
                    )}

                    {userRole !== "CEO" && (
                        <div className="flex flex-col gap-2">
                            {isMinimized ? (
                                <div className="flex flex-col gap-2 items-center">
                                    <button 
                                        onClick={() => setIsLeaveModalOpen(true)}
                                        className="w-8 h-8 rounded-full bg-[#31267D]/10 hover:bg-[#31267D]/20 text-[#31267D] flex items-center justify-center transition-all duration-300 hover:scale-105"
                                        title="Request Leave"
                                    >
                                        <Calendar className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => setIsRequestModalOpen(true)}
                                        className="w-8 h-8 rounded-full bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 flex items-center justify-center transition-all duration-300 hover:scale-105"
                                        title="New Request"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    <button 
                                        onClick={() => setIsLeaveModalOpen(true)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#31267D]/5 hover:bg-[#31267D]/10 text-[#31267D] text-[9px] font-black uppercase tracking-widest transition-all duration-300"
                                    >
                                        <Calendar className="w-3.5 h-3.5" />
                                        Request Leave
                                    </button>
                                    <button 
                                        onClick={() => setIsRequestModalOpen(true)}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-orange-500/20 transition-all duration-300"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        New Request
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="space-y-2">
                        <button
                            onClick={handleLogout}
                            className={cn(
                                "w-full flex items-center transition-all duration-500 group",
                                isMinimized ? "justify-center py-3" : "gap-3 px-4 py-3 rounded-2xl hover:bg-red-50"
                            )}
                        >
                            <LogOut className="w-5 h-5 text-red-400 group-hover:text-red-600 transition-all duration-500" strokeWidth={2} />
                            {!isMinimized && (
                                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-red-400 group-hover:text-red-600">Terminate</span>
                            )}
                        </button>

                        <div 
                            onClick={() => setIsProfileModalOpen(true)}
                            className={cn(
                                "flex items-center transition-all duration-700 cursor-pointer hover:bg-[#31267D]/5 dark:hover:bg-zinc-800/30",
                                isMinimized ? "justify-center py-4" : "gap-3 p-2 bg-[#31267D]/[0.03] rounded-[1.75rem] border border-[#31267D]/5"
                            )}
                        >
                            <Avatar className="w-10 h-10 border-2 border-white shadow-xl flex-shrink-0 transition-transform duration-500 hover:scale-105">
                                <AvatarImage src={
                                    profile?.avatar_url && isValidAvatarUrl(profile.avatar_url)
                                        ? profile.avatar_url
                                        : (!profile?.avatar_url && userRole === 'CEO')
                                            ? "/images/ceo.jpeg"
                                            : undefined
                                } />
                                <AvatarFallback className="bg-[#31267D] text-white font-black text-xs">
                                    {profile?.avatar_url && !isValidAvatarUrl(profile.avatar_url)
                                        ? profile.avatar_url
                                        : (profile?.full_name || 'U').split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                            </Avatar>
                            {!isMinimized && (
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-gray-900 truncate uppercase tracking-tighter">{profile?.full_name || 'Executive'}</p>
                                    <p className="text-[8px] font-bold text-[#31267D] uppercase tracking-[0.1em] opacity-60">{userRole}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {userRole !== "CEO" && (
                <>
                    <LeaveRequestModal
                        isOpen={isLeaveModalOpen}
                        onClose={() => setIsLeaveModalOpen(false)}
                        onSubmitSuccess={() => queryClient.invalidateQueries()}
                    />
                    <RequestModal
                        isOpen={isRequestModalOpen}
                        onClose={() => setIsRequestModalOpen(false)}
                        onSubmitSuccess={() => queryClient.invalidateQueries()}
                    />
                </>
            )}
            
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
            />
        </aside>
    );
}

export default CEOSidebar;
