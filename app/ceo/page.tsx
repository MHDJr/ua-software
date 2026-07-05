"use client";

import { ExecutiveCommand } from "@/components/executive-command";
import { CEOSidebar } from "@/components/ceo-sidebar";
import { StaffManagement } from "@/components/staff-management";
import { CEOInbox } from "@/components/ceo-inbox";
import { ExecutiveSalesOverview } from "@/components/executive-sales-overview";
import { MobileFAB } from "@/components/mobile-fab";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useMemo, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Loader2, ShieldCheck, ShieldAlert, Plus, Target, Clock, UserPlus, Megaphone, MessageSquare, Bell, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { UAMessengerDrawer } from "@/components/ua-messenger-drawer";
import { toast } from "sonner";
import { useRef } from "react";

type CEOView = "command-center" | "inbox" | "staff-management" | "sales-intelligence" | "financial-intelligence";

function CEOPageContent() {
    const { profile, loading, userRole } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    
    // Initialize view from URL if present
    const [activeView, setActiveView] = useState<CEOView>("command-center");
    
    const [isSidebarMinimized, setIsSidebarMinimized] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
    
    // Comms Drawer States
    const [isCommsOpen, setIsCommsOpen] = useState(false);
    const [unreadCommsCount, setUnreadCommsCount] = useState(0);

    const fetchUnreadCommsCount = useCallback(async () => {
        if (!profile?.id) return;
        try {
            const { count, error } = await supabase
                .from("notifications")
                .select("*", { count: "exact", head: true })
                .eq("user_id", profile.id)
                .eq("type", "direct")
                .eq("read", false);
            if (!error && count !== null) {
                setUnreadCommsCount(count);
            }
        } catch (err) {
            console.error("Error fetching unread count:", err);
        }
    }, [profile?.id]);

    useEffect(() => {
        if (profile?.id) {
            fetchUnreadCommsCount();
            
            // Poll for unread count every 30 seconds
            const interval = setInterval(fetchUnreadCommsCount, 30000);
            
            // Listen for immediate messenger updates
            window.addEventListener("hq-messenger-updated", fetchUnreadCommsCount);
            
            return () => {
                clearInterval(interval);
                window.removeEventListener("hq-messenger-updated", fetchUnreadCommsCount);
            };
        }
    }, [profile?.id, fetchUnreadCommsCount]);

    useEffect(() => {
        if (!isCommsOpen && profile?.id) {
            fetchUnreadCommsCount();
        }
    }, [isCommsOpen, profile?.id, fetchUnreadCommsCount]);

    // Listen for toggle-hq-messenger event from header button
    useEffect(() => {
        const handleToggle = () => setIsCommsOpen(prev => !prev);
        window.addEventListener("toggle-hq-messenger", handleToggle);
        return () => window.removeEventListener("toggle-hq-messenger", handleToggle);
    }, []);

    // Listen for open-hq-messenger event (one-way open)
    useEffect(() => {
        const handleOpen = () => setIsCommsOpen(true);
        window.addEventListener("open-hq-messenger", handleOpen);
        return () => window.removeEventListener("open-hq-messenger", handleOpen);
    }, []);



    // Permission Guard: Only allow authorized roles
    const isAuthorized = useMemo(() => {
        if (loading) return true; // Assume authorized while loading
        if (!profile) return false;
        return profile.role === "ceo" || 
               profile.role === "manager" || 
               profile.is_manager === true;
    }, [profile, loading]);

    // Handle view transitions
    const handleViewChange = useCallback((view: string) => {
        if (view === activeView) return;
        
        setIsTransitioning(true);
        setActiveView(view as CEOView);
        
        // Update URL to reflect current view (shallow navigation)
        try {
            const url = new URL(window.location.href);
            url.searchParams.set("view", view);
            window.history.replaceState({}, "", url);
        } catch (e) {
            console.error("Navigation error:", e);
        }
        
        setTimeout(() => setIsTransitioning(false), 200);
    }, [activeView]);

    // Update active view if query param changes
    useEffect(() => {
        const viewParam = searchParams?.get("view") as CEOView;
        if (viewParam && viewParam !== activeView) {
            setActiveView(viewParam);
        } else if (!viewParam && activeView !== "command-center") {
            setActiveView("command-center");
        }
    }, [searchParams, activeView]);

    // Redirect unauthorized users (with a safety check)
    useEffect(() => {
        if (!loading && !isAuthorized && !profile) {
            const timer = setTimeout(() => {
                // Double check before redirecting
                if (!profile) {
                    console.log('Access Denied: Definitive redirect to home');
                    router.replace("/");
                }
            }, 1500); // 1.5s grace period for profile loading
            return () => clearTimeout(timer);
        }
    }, [isAuthorized, loading, profile, router]);

    // Navigate to dedicated pages
    useEffect(() => {
        if (activeView === "financial-intelligence") {
            router.push("/ceo/financial-intelligence");
        } else if (activeView === "sales-intelligence") {
            router.push("/ceo/sales");
        }
    }, [activeView, router]);

    // Listen for navigation actions
    useEffect(() => {
        const handleNavAction = (event: CustomEvent) => {
            const { view } = event.detail;
            handleViewChange(view);
        };

        window.addEventListener("nav-action", handleNavAction as EventListener);
        return () => {
            window.removeEventListener("nav-action", handleNavAction as EventListener);
        };
    }, [handleViewChange]);

    // Initial boot loader - Optimized to prevent "black screen" flash
    if (loading && !profile) {
        return (
            <div className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] flex flex-col items-center justify-center">
                <div className="relative mb-6 select-none pointer-events-none">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                </div>
                <h2 className="text-xs font-black uppercase tracking-[0.25em] text-slate-800 dark:text-zinc-100 mb-2">
                    Securing Environment
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500 animate-pulse">
                    Verifying Credentials...
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-[#09090b] overflow-x-hidden relative">
            {/* Global Block Overlay - Optimized to prevent "black screen" flash */}
            {!loading && !isAuthorized && !profile && (
                <div className="fixed inset-0 bg-[#f8fafc] dark:bg-[#09090b] z-[200] flex flex-col items-center justify-center text-center p-8">
                    <div className="relative mb-6 select-none pointer-events-none">
                        <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                            <ShieldAlert className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <h2 className="text-xl font-black mb-4 uppercase tracking-widest text-slate-900 dark:text-white">Verifying Credentials</h2>
                    <p className="text-slate-500 dark:text-white/60 mb-6 font-medium">Securing executive environment...</p>
                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                </div>
            )}

            {/* Global Loading/Transition Overlay */}
            {(isTransitioning || (loading && !profile)) && (
                <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] z-[100] flex items-center justify-center pointer-events-none transition-opacity duration-300">
                    <Loader2 className="w-8 h-8 text-[#31267D] animate-spin" />
                </div>
            )}

            {/* Desktop Sidebar - Hidden on mobile */}
            <div className="hidden md:block">
                <CEOSidebar
                    activeView={activeView}
                    onMinimizedChange={setIsSidebarMinimized}
                    onViewChange={handleViewChange}
                    unreadCommsCount={unreadCommsCount}
                    isCommsOpen={isCommsOpen}
                />
            </div>


            {/* Global Block Overlay / Backdrop for FAB */}
            {isActionMenuOpen && (
                <div 
                    className="fixed inset-0 z-[90] bg-black/10 dark:bg-black/30 backdrop-blur-[1px]" 
                    onClick={() => setIsActionMenuOpen(false)}
                />
            )}

            {/* 6?????? FLOATING QUICK ACTION BUTTON - Universal */}
            {!isCommsOpen && (
                <div className="fixed bottom-24 md:bottom-8 right-6 md:right-8 z-[100]">
                    <div className="relative">
                        {/* Expandable Menu */}
                        {isActionMenuOpen && (
                            <div
                                className="absolute bottom-full right-0 mb-4 flex flex-col gap-2 items-end transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 duration-200"
                            >
                                <button
                                    onClick={() => {
                                        window.dispatchEvent(new CustomEvent("fab-action", { detail: { action: "new-directive" } }));
                                        setIsActionMenuOpen(false);
                                    }}
                                    className="flex items-center gap-3 bg-theme-card text-theme-text border border-theme-border-10 px-4 py-3 rounded-2xl shadow-lg hover:bg-theme-bg-white-5 hover:border-theme-brand/30 transition-all hover:-translate-x-1"
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                        Assign Task
                                    </span>
                                    <div className="p-1.5 bg-[#2F1E73]/10 text-[#2F1E73] dark:text-purple-400 rounded-lg">
                                        <Target className="w-4 h-4" />
                                    </div>
                                </button>
                                <button
                                    onClick={() => {
                                        window.dispatchEvent(new CustomEvent("fab-action", { detail: { action: "announcement" } }));
                                        setIsActionMenuOpen(false);
                                    }}
                                    className="flex items-center gap-3 bg-theme-card text-theme-text border border-theme-border-10 px-4 py-3 rounded-2xl shadow-lg hover:bg-theme-bg-white-5 hover:border-theme-brand/30 transition-all hover:-translate-x-1"
                                >
                                    <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                        Send Broadcast
                                    </span>
                                    <div className="p-1.5 bg-[#F14D24]/10 text-[#F14D24] rounded-lg">
                                        <Megaphone className="w-4 h-4" />
                                    </div>
                                </button>
                                {(userRole === 'CEO' || userRole === 'MANAGER' || (profile && profile.role === 'ceo')) && (
                                    <button
                                        onClick={() => {
                                            window.dispatchEvent(new CustomEvent("fab-action", { detail: { action: "add-staff" } }));
                                            setIsActionMenuOpen(false);
                                        }}
                                        className="flex items-center gap-3 bg-theme-card text-theme-text border border-theme-border-10 px-4 py-3 rounded-2xl shadow-lg hover:bg-theme-bg-white-5 hover:border-theme-brand/30 transition-all hover:-translate-x-1"
                                    >
                                        <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
                                            Add Staff
                                        </span>
                                        <div className="p-1.5 bg-[#FA4616]/10 text-[#FA4616] rounded-lg">
                                            <UserPlus className="w-4 h-4" />
                                        </div>
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Main Button */}
                        <button
                            onClick={() => setIsActionMenuOpen(!isActionMenuOpen)}
                            className="w-14 h-14 bg-[#FA4616] hover:bg-[#e03f14] text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(250,70,22,0.4)] hover:shadow-[0_8px_30px_rgba(250,70,22,0.6)] transition-all hover:scale-110 cursor-pointer relative z-10"
                        >
                            <Plus
                                className={`w-6 h-6 transition-transform duration-300 ${isActionMenuOpen ? "rotate-45" : ""}`}
                            />
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Area - Optimized for performance */}
            <main 
                className={cn(
                    "min-h-screen transition-[margin] duration-300 ease-out ml-0 md:ml-[80px] pt-[60px] md:pt-0",
                )}
            >
                <Suspense fallback={
                    <div className="flex items-center justify-center h-full pt-20">
                        <Loader2 className="w-8 h-8 text-[#31267D] animate-spin" />
                    </div>
                }>
                    {activeView === "command-center" && <ExecutiveCommand currentView={activeView} />}
                    {activeView === "inbox" && <CEOInbox />}
                    {activeView === "staff-management" && (
                        (profile?.role === "ceo" || (profile?.is_manager && profile?.manager_permissions?.manage_staff === true)) ? (
                            <StaffManagement />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full pt-20">
                                <p className="text-red-500 font-bold uppercase text-xs">Access Denied</p>
                            </div>
                        )
                    )}
                    {activeView === "sales-intelligence" && <ExecutiveSalesOverview />}
                </Suspense>
            </main>




            <UAMessengerDrawer 
                isOpen={isCommsOpen}
                onClose={() => setIsCommsOpen(false)}
                profile={profile}
            />
        </div>
    );
}

export default function CEOPage() {
    return (
        <TooltipProvider>
            <Suspense fallback={
                <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                    <div className="animate-spin h-8 w-8 border-2 border-white/20 border-t-white rounded-full" />
                </div>
            }>
                <CEOPageContent />
            </Suspense>
        </TooltipProvider>
    );
}
