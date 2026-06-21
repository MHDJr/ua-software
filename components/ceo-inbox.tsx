"use client";

import React, { useState, useEffect } from "react";
import { Lightbulb, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useTabResiliency } from "./tab-resiliency-engine";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

// Brand colors
const BRAND_COLORS = {
    indigo: "#31267D",
    orange: "#F14D24",
};

// Idea type interface
interface Idea {
    id: string;
    title: string;
    description: string;
    category: string;
    priority: string;
    status: string;
    created_by: string;
    created_by_name?: string;
    created_at: string;
}

export function CEOInbox() {
    const { profile } = useAuth();
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [loading, setLoading] = useState(true);
    const [clearingAll, setClearingAll] = useState(false);

    // Tab Resiliency Engine Integration
    useTabResiliency(
        () => {
            fetchIdeas();
        },
        loading,
        setLoading
    );

    useEffect(() => {
        fetchIdeas();
    }, []);

    const fetchIdeas = async () => {
        try {
            setLoading(true);
            console.log("Fetching ideas from database...");

            const { data, error } = await supabase
                .from("ideas")
                .select(`
                    *,
                    profiles!ideas_created_by_fkey (
                        full_name,
                        username
                    )
                `)
                .eq("status", "active")
                .order("created_at", { ascending: false })
                .limit(50);

            if (error) {
                console.error("Error fetching ideas:", error);
                throw error;
            }

            // Transform ideas to display format
            const transformedIdeas: Idea[] = (data || []).map((idea: any) => {
                const creatorName = idea.profiles?.full_name || idea.profiles?.username || "Unknown";
                
                // Format timestamp
                const ideaTime = new Date(idea.created_at);
                const now = new Date();
                const diffInHours = Math.floor((now.getTime() - ideaTime.getTime()) / (1000 * 60 * 60));
                
                let timeString;
                if (diffInHours < 1) timeString = "Just now";
                else if (diffInHours < 24) timeString = `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
                else timeString = `${Math.floor(diffInHours / 24)} day${Math.floor(diffInHours / 24) > 1 ? 's' : ''} ago`;

                return {
                    id: idea.id,
                    title: idea.title,
                    description: idea.description,
                    category: idea.category,
                    priority: idea.priority,
                    status: idea.status,
                    created_by: idea.created_by,
                    created_by_name: creatorName,
                    created_at: timeString
                };
            });

            setIdeas(transformedIdeas);
        } catch (error) {
            console.error("Error fetching ideas:", error);
            setIdeas([]);
        } finally {
            setLoading(false);
        }
    };

    const clearAllIdeas = async () => {
        try {
            setClearingAll(true);
            console.log("Clearing all ideas...");
            
            const { error } = await supabase
                .from("ideas")
                .delete()
                .gte("created_at", "1970-01-01"); // Delete all ideas (WHERE clause required by RLS)

            if (error) throw error;

            toast.success("All ideas cleared successfully");
            fetchIdeas(); // Refresh the ideas list
        } catch (error: any) {
            console.error("Error clearing ideas:", error);
            toast.error(error.message || "Failed to clear ideas");
        } finally {
            setClearingAll(false);
        }
    };

    const deleteIdea = async (ideaId: string) => {
        try {
            console.log("Deleting idea:", ideaId);
            
            const { error } = await supabase
                .from("ideas")
                .delete()
                .eq("id", ideaId);

            if (error) throw error;

            toast.success("Idea deleted successfully");
            fetchIdeas(); // Refresh the ideas list
        } catch (error: any) {
            console.error("Error deleting idea:", error);
            toast.error(error.message || "Failed to delete idea");
        }
    };



    return (
        <div className="min-h-screen relative overflow-hidden font-sans p-6 flex flex-col gap-6 bg-[#F4F7FE] text-slate-900 dark:bg-transparent dark:text-white">
            {/* Cinematic Mesh Gradient Background Layer */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
                <div className="absolute top-[-10%] left-[-10%] rounded-full blur-[120px] w-[60%] h-[60%] bg-[#31267D]/10 dark:bg-indigo-500/10" />
                <div className="absolute bottom-[10%] right-[-5%] rounded-full blur-[100px] w-[50%] h-[50%] bg-[#F14D24]/5 dark:bg-[#F14D24]/5" />
            </div>

            {/* FLOATING GLASSMORPHIC HEADER */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 md:px-8 md:py-5 bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl rounded-[2.5rem] border border-slate-100 dark:border-zinc-800/60 shadow-[0_12px_40px_rgba(0,0,0,0.03)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl md:text-3xl font-black text-[#1e293b] dark:text-zinc-100 uppercase tracking-tight leading-tight truncate">
                        Command Intelligence
                    </h1>
                    <p className="text-xs md:text-sm italic text-slate-400 dark:text-zinc-400 mt-0.5 md:mt-1 line-clamp-2">
                        &quot;Executive Dashboard &amp; Capture Portal.&quot;
                    </p>
                </div>
            </header>

            {/* Main Content Grid - Full Width, Centered */}
            <div className="flex-1 w-full max-w-7xl mx-auto h-[calc(100vh-220px)] flex flex-col">
                {/* Spark Inbox - Full Width Column */}
                <div className="flex-1 backdrop-blur-lg bg-white/80 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/50 rounded-[2.5rem] p-6 md:p-8 shadow-[0_12px_40px_rgba(0,0,0,0.03)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] overflow-y-auto">
                    <div className="w-full">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-2xl md:text-3xl font-bold" style={{ color: BRAND_COLORS.indigo }}>
                                The &apos;Spark&apos; Inbox
                            </h2>
                            {ideas.length > 0 && (
                                <Button
                                    onClick={clearAllIdeas}
                                    disabled={clearingAll}
                                    variant="ghost"
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 text-red-500/70 border border-red-500/20 hover:bg-red-500/10 hover:text-red-650 hover:border-red-500/30"
                                >
                                    {clearingAll ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Clearing...
                                        </>
                                    ) : (
                                        <>
                                            <Trash2 className="w-4 h-4" />
                                            Clear All
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                        <p className="text-gray-500 dark:text-zinc-400 mb-6 text-sm">Innovation sparks from your team</p>

                        <div className="space-y-3">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                        <span className="text-gray-500 text-sm">Loading ideas...</span>
                                    </div>
                                </div>
                            ) : ideas.length === 0 ? (
                                <div className="text-center py-12">
                                    <Lightbulb className="w-12 h-12 text-gray-300 dark:text-zinc-700 mx-auto mb-3 animate-pulse" />
                                    <p className="text-gray-500 dark:text-zinc-400 text-sm font-bold uppercase tracking-wider">No ideas yet</p>
                                    <p className="text-gray-400 dark:text-zinc-500 text-xs mt-1">Innovation sparks submitted by staff will appear here</p>
                                </div>
                            ) : (
                                ideas.map((idea) => (
                                    <div
                                        key={idea.id}
                                        className="group bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-2xl p-5 hover:shadow-md hover:translate-x-1 transition-all duration-200 hover:border-gray-200 dark:hover:border-zinc-700 cursor-pointer shadow-sm relative overflow-hidden"
                                        style={{ borderLeftWidth: 4, borderLeftColor: BRAND_COLORS.orange }}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div
                                                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-sm font-bold shadow-md shadow-indigo-550/10"
                                                style={{ backgroundColor: BRAND_COLORS.indigo }}
                                            >
                                                {idea.created_by_name?.charAt(0).toUpperCase() || "U"}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate">{idea.created_by_name}</h3>
                                                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">{idea.created_at}</span>
                                                    </div>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteIdea(idea.id);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 hover:text-red-600 border border-transparent hover:border-red-250/30"
                                                        title="Delete idea"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <div className="space-y-2">
                                                    <h4 className="font-bold text-[#1e293b] dark:text-zinc-100 text-sm leading-tight truncate">{idea.title}</h4>
                                                    <div className="flex items-start gap-2 bg-slate-50 dark:bg-zinc-950/40 p-3 rounded-xl border border-slate-100/50 dark:border-zinc-800/50">
                                                        <Lightbulb
                                                            className="w-4 h-4 flex-shrink-0 mt-0.5 text-orange-500"
                                                        />
                                                        <p className="text-gray-650 dark:text-zinc-400 text-xs leading-relaxed whitespace-pre-wrap font-medium">{idea.description}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
