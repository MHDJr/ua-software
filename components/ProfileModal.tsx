"use client";

import React, { useState } from "react";
import { User, X, Plus } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-utils";
import { uploadPublicFile, deleteFile } from "@/lib/storage";
import { motion, AnimatePresence } from "framer-motion";
import { MobileSyncCard } from "@/components/MobileSyncCard";

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
    const { profile, user, refreshProfile } = useAuth();
    const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
    const [localPhone, setLocalPhone] = useState<string>("");

    // Synchronize local phone input state when profile loads
    React.useEffect(() => {
        if (profile) {
            setLocalPhone(profile.phone || "");
        }
    }, [profile]);

    const handlePhoneChange = async (val: string) => {
        setLocalPhone(val);
        if (!profile?.id && !user?.id) return;
        try {
            await supabase
                .from("profiles")
                .update({ phone: val })
                .eq("id", profile?.id || user?.id);
            await refreshProfile();
        } catch (err) {
            console.error("Error updating phone:", err);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[150] overflow-hidden flex justify-end">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="absolute inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Sidebar Drawer */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 200 }}
                        className="relative h-full w-full max-w-[400px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-l border-slate-100 dark:border-zinc-800 shadow-2xl flex flex-col justify-between"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-zinc-800/50 flex items-center justify-between select-none">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                    <User className="w-4 h-4" />
                                </div>
                                <h2 className="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase">
                                    Personnel File
                                </h2>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 flex items-center justify-center text-slate-500 dark:text-zinc-400 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Scrollable Body */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 flex flex-col items-center">
                            {/* Profile Photo Display with Upload */}
                            <div className="relative group cursor-pointer">
                                <div className="w-24 h-24 md:w-28 md:h-28 rounded-[2rem] border-4 border-white dark:border-zinc-800 shadow-lg overflow-hidden relative flex items-center justify-center bg-indigo-950 text-white font-bold text-3xl select-none">
                                    {isUploadingPhoto ? (
                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                            <div className="animate-spin h-6 w-6 border-2 border-white/20 border-t-white rounded-full" />
                                        </div>
                                    ) : profile?.avatar_url ? (
                                        <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        (profile?.full_name?.[0] || profile?.email?.[0] || "U").toUpperCase()
                                    )}

                                    {/* Overlay Camera Icon on Hover */}
                                    {!isUploadingPhoto && (
                                        <label className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1 transition-all duration-300 text-white text-[8px] font-black uppercase tracking-widest cursor-pointer select-none">
                                            <Plus className="w-4 h-4" />
                                            Upload Image
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={async (e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;

                                                    // Validate file format (type verification)
                                                    const validTypes = ["image/jpeg", "image/png", "image/webp"];
                                                    if (!validTypes.includes(file.type)) {
                                                        toast.error("Invalid image format. Only JPEG, PNG, and WEBP are accepted.");
                                                        return;
                                                    }

                                                    // Validate file size (under 2MB)
                                                    if (file.size > 2 * 1024 * 1024) {
                                                        toast.error("Max file size exceeded. Image must be under 2MB.");
                                                        return;
                                                    }

                                                    setIsUploadingPhoto(true);
                                                    try {
                                                        const compressedBlob = await compressImage(file, {
                                                            maxWidth: 800,
                                                            maxHeight: 800,
                                                            maxFileSizeKB: 200,
                                                            outputFormat: "image/webp"
                                                        });

                                                        const fileName = `${profile?.id || user?.id}-${Date.now()}.webp`;
                                                        const filePath = `avatars/${fileName}`;

                                                        // Delete old avatar if it exists in storage
                                                        if (profile?.avatar_url && profile.avatar_url.includes('/storage/v1/object/public/')) {
                                                            try {
                                                                await deleteFile('avatars', profile.avatar_url);
                                                            } catch (e) {
                                                                console.warn("Failed to delete old avatar:", e);
                                                            }
                                                        }

                                                        const publicUrl = await uploadPublicFile('avatars', filePath, compressedBlob);

                                                        const { error } = await supabase
                                                            .from("profiles")
                                                            .update({ avatar_url: publicUrl })
                                                            .eq("id", profile?.id || user?.id);

                                                        if (error) {
                                                            console.error("Photo DB update error:", error);
                                                            toast.error("Database update failed: " + error.message);
                                                            setIsUploadingPhoto(false);
                                                            return;
                                                        }

                                                        await refreshProfile();
                                                        toast.success("Profile photo updated successfully!");
                                                        setIsUploadingPhoto(false);
                                                    } catch (err: any) {
                                                        console.error("Upload process error:", err);
                                                        toast.error(err.message || "Failed to update profile photo");
                                                        setIsUploadingPhoto(false);
                                                    }
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* File Size Warning Label */}
                            <p className="text-[11px] font-medium text-slate-500 dark:text-zinc-400 text-center max-w-[240px] mt-1 select-none">
                                ⚠️ <span className="font-bold text-amber-600 dark:text-amber-500">Note:</span> Maximum image size is <span className="font-bold text-slate-700 dark:text-slate-200">3MB</span>. Recommended formats: PNG, JPG, or WEBP.
                            </p>

                            {/* Interactive Profile Information List */}
                            <div className="w-full space-y-4 text-left">
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/50">
                                    <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-1 select-none">
                                        Full Identification Name
                                    </span>
                                    <span className="text-xs font-black text-slate-900 dark:text-zinc-100 uppercase">
                                        {profile?.full_name || "Unidentified Personnel"}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/50">
                                        <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-1 select-none">
                                            Assigned Role
                                        </span>
                                        <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase">
                                            {profile?.role || "Staff Member"}
                                        </span>
                                    </div>

                                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/50">
                                        <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-1 select-none">
                                            Operational Sector
                                        </span>
                                        <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 uppercase">
                                            {profile?.department || "General Operations"}
                                        </span>
                                    </div>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/50">
                                    <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-1 select-none">
                                        Primary Communications Email
                                    </span>
                                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                                        {profile?.email || "No Email Registered"}
                                    </span>
                                </div>

                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-100 dark:border-zinc-800/50">
                                    <span className="text-[9px] font-black text-slate-400 dark:text-zinc-500 uppercase tracking-widest block mb-1 select-none">
                                        Operational Contact Number
                                    </span>
                                    <input
                                        type="text"
                                        value={localPhone}
                                        placeholder="Enter contact number..."
                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                        className="w-full bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-xs font-bold text-slate-900 dark:text-zinc-100 placeholder-slate-350"
                                    />
                                </div>

                                {/* Mobile Synchronization Card */}
                                <MobileSyncCard userId={profile?.id || user?.id || ""} size={130} />
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
