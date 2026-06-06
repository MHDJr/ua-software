"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import {
    Loader2,
    Send,
    X,
    Lightbulb,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface AddIdeaDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    staffList?: Array<{
        id: string;
        name: string;
        dept: string;
        role?: string;
    }>;
    currentUserId: string;
}

export default function AddIdeaDialog({
    open,
    onOpenChange,
    currentUserId,
}: AddIdeaDialogProps) {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [loading, setLoading] = useState(false);

    const resetForm = () => {
        setTitle("");
        setDescription("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error("Concept Title is required");
            return;
        }

        if (!description.trim()) {
            toast.error("Please explain the 'Why' for your idea");
            return;
        }

        setLoading(true);

        try {
            const ideaData = {
                title: title.trim(),
                content: description.trim(),
                created_by: currentUserId,
                category: "other",
                priority: "medium",
                status: "active",
            };

            const { data, error } = await supabase
                .from("ideas")
                .insert(ideaData)
                .select();

            if (error) {
                console.error("Submit error:", error);
                toast.error("Failed to submit idea: " + error.message);
            } else {
                toast.success("Idea submitted successfully!");
                resetForm();
                onOpenChange(false);
            }
        } catch (err: any) {
            console.error("Submit error:", err);
            toast.error("Failed to submit idea");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="p-0 overflow-hidden border border-slate-100 bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl [&>button]:hidden"
            >
                {/* Header */}
                <div
                    style={{ backgroundColor: "#2C2171" }}
                    className="p-6 text-white flex justify-between items-center"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-xl">
                            <Lightbulb className="w-5 h-5 text-orange-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black uppercase tracking-tight">
                                Innovation Spark
                            </h3>
                            <p className="text-[9px] text-white/50 font-bold uppercase tracking-widest">
                                Command Portal
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => onOpenChange(false)}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSubmit} className="p-8 space-y-4">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                            Concept Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="A catchy name for your idea"
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold text-slate-850"
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                            The &quot;Why&quot;
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Explain how this benefits the academy..."
                            className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-orange-500 outline-none text-sm font-bold min-h-[120px] text-slate-850"
                            required
                        />
                    </div>

                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="flex-1 py-4 border border-slate-200 rounded-2xl text-slate-400 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{ backgroundColor: "#F15A29" }}
                            className="flex-1 py-4 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-orange-100 flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            Execute
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
