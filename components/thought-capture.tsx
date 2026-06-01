"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Brain, 
    Send,
    X,
    Sparkles,
    Clock,
    ChevronRight,
    Loader2
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase, Idea } from "@/lib/supabase";
import { toast } from "sonner";
import { autoTagContent, TagCategory } from "@/lib/ai-tagging";

interface ThoughtCaptureProps {
    onCapture?: (idea: Idea) => void;
    compact?: boolean;
    placeholder?: string;
}

export function ThoughtCapture({ onCapture, compact = false, placeholder }: ThoughtCaptureProps) {
    const { profile, userRole } = useAuth();
    const [isExpanded, setIsExpanded] = useState(false);

    const [content, setContent] = useState("");
    const [title, setTitle] = useState("");
    const [status, setStatus] = useState<"reminder" | "directive" | "high_priority">("directive");
    const [autoTags, setAutoTags] = useState<TagCategory[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showCinematic, setShowCinematic] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-tag as user types
    useEffect(() => {
        if (content || title) {
            const { tags } = autoTagContent(content, title);
            setAutoTags(tags);
        }
    }, [content, title]);

    // Handle click outside to collapse
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                if (!content && !title) {
                    setIsExpanded(false);
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [content, title]);

    const handleFocus = () => setIsExpanded(true);

    const handleSubmit = async () => {
        if (!content.trim()) {
            toast.error("Please enter your thought");
            return;
        }

        if (!profile?.id) {
            toast.error("User not authenticated. Please login again.");
            return;
        }

        setIsSubmitting(true);

        try {
            const ideaData = {
                title: title.trim() || null,
                content: content.trim(),
                priority: status === "high_priority" ? "high" : (status === "directive" ? "medium" : "low"),
                status: status, // Matches database: reminder, directive, or high_priority
                tags: autoTags,
                auto_tagged: true,
                created_by: profile.id,
                shared_with: [],
                archived: false,
                signal_cleared: false,
            };

            const { data, error } = await supabase
                .from("ideas")
                .insert(ideaData)
                .select()
                .single();

            if (error) throw error;

            setShowCinematic(true);

            setTimeout(() => {
                setContent("");
                setTitle("");
                setStatus("directive");
                setAutoTags([]);
                setIsExpanded(false);
                setShowCinematic(false);
                
                toast.success("Directive issued");
                onCapture?.(data);
            }, 1200);

        } catch (error) {
            console.error("Error capturing thought:", error);
            toast.error(`Failed to capture: ${(error as any).message}`);
            setIsSubmitting(false);
        }
    };

    return (
        <div ref={containerRef} className="relative">
            {/* Cinematic Fly Animation */}
            <AnimatePresence>
                {showCinematic && (
                    <motion.div
                        initial={{ opacity: 0, scale: 1, x: 0, y: 0 }}
                        animate={{ 
                            opacity: [0, 1, 1, 0],
                            scale: [1, 1.1, 0.8, 0.5],
                            x: [0, 50, 100, 200],
                            y: [0, -30, -60, -100]
                        }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className="fixed z-50 pointer-events-none"
                        style={{ 
                            left: containerRef.current?.getBoundingClientRect().left,
                            top: containerRef.current?.getBoundingClientRect().top 
                        }}
                    >
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/90 text-white text-sm font-bold shadow-2xl">
                            <Sparkles className="w-4 h-4" />
                            Captured!
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Container */}
            <motion.div
                layout
                initial={false}
                animate={{ 
                    height: isExpanded ? "auto" : compact ? "48px" : "56px",
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={`
                    relative overflow-hidden rounded-2xl
                    bg-white dark:bg-zinc-900/40
                    border border-slate-100 dark:border-zinc-800/50
                    shadow-xl
                    transition-all duration-300
                `}
            >
                {/* Glassmorphic Background Effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-indigo-500/10 pointer-events-none" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] opacity-30 pointer-events-none" />

                {/* Collapsed State - Quick Input */}
                {!isExpanded && (
                    <div className="relative flex items-center h-full px-4">
                        <Brain className="w-5 h-5 text-amber-500 mr-3 flex-shrink-0" />
                        <Input
                            ref={inputRef}
                            type="text"
                            placeholder={placeholder || (userRole === 'CEO' ? "Capture a CEO Directive..." : "Capture an Administrator Directive...")}
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onFocus={handleFocus}
                            className="flex-1 bg-transparent border-0 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-sm font-medium"
                        />
                        <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: content ? 1 : 0, x: content ? 0 : 10 }}
                            className="flex items-center gap-1"
                        >
                            <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase tracking-wider font-bold">
                                Press Enter
                            </span>
                            <ChevronRight className="w-4 h-4 text-amber-500/50" />
                        </motion.div>
                    </div>
                )}

                {/* Expanded State - Full Form */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-4 space-y-4"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                                        <Sparkles className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-zinc-100">{userRole === 'CEO' ? 'CEO Directive' : 'Administrator Directive'} Capture</span>
                                </div>
                                <button
                                    onClick={() => {
                                        setContent("");
                                        setTitle("");
                                        setIsExpanded(false);
                                    }}
                                    className="w-6 h-6 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                                >
                                    <X className="w-3 h-3 text-slate-400 dark:text-zinc-500" />
                                </button>
                            </div>

                            {/* Title Input - only show if user wants to add a title */}
                            {(title || isExpanded) && (
                                <Input
                                    type="text"
                                    placeholder="Directive Title (optional)..."
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="bg-slate-50 dark:bg-zinc-800/50 border-slate-100 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm font-bold"
                                />
                            )}

                            {/* Content Textarea */}
                            <textarea
                                placeholder={title ? "Add details..." : (placeholder || "Capture your strategic directive...")}
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                rows={title ? 2 : 3}
                                className="w-full bg-slate-50 dark:bg-zinc-800/50 border border-slate-100 dark:border-zinc-800 rounded-2xl p-4 text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-amber-500/50 focus:outline-none resize-none text-sm leading-relaxed font-medium"
                                autoFocus={!title}
                            />

                            {/* Action Buttons */}
                            <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-zinc-500">
                                    <Clock className="w-3 h-3" />
                                    <span className="font-bold tabular-nums">{content.length} chars</span>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setContent("");
                                            setTitle("");
                                            setIsExpanded(false);
                                        }}
                                        className="text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-zinc-100 hover:bg-slate-50 dark:hover:bg-zinc-800 text-xs font-bold"
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSubmit}
                                        disabled={isSubmitting || !content.trim()}
                                        className="bg-gradient-to-r from-[#31267D] to-[#1e1751] hover:opacity-90 text-white text-xs font-black uppercase tracking-widest px-6 rounded-xl shadow-lg shadow-indigo-500/20"
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Send className="w-3.5 h-3.5 mr-2" />
                                                Capture
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
