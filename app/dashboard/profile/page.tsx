"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, ShieldCheck, ArrowLeft, Phone, Mail, Award, Landmark, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { MobileSyncCard } from "@/components/MobileSyncCard";

export default function ProfilePage() {
    const router = useRouter();
    const { profile, user, refreshProfile, loading } = useAuth();
    const [localPhone, setLocalPhone] = useState<string>("");
    const [isUpdating, setIsUpdating] = useState(false);

    useEffect(() => {
        if (profile) {
            setLocalPhone(profile.phone || "");
        }
    }, [profile]);

    const handlePhoneChange = async (val: string) => {
        setLocalPhone(val);
    };

    const handleSavePhone = async () => {
        if (!profile?.id && !user?.id) return;
        setIsUpdating(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({ phone: localPhone })
                .eq("id", profile?.id || user?.id);
            
            if (error) throw error;
            await refreshProfile();
            toast.success("Operational contact number updated.");
        } catch (err: any) {
            console.error("Error updating phone:", err);
            toast.error(err.message || "Failed to update contact number.");
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
                    <p className="text-sm font-semibold text-slate-400">Loading Personnel File...</p>
                </div>
            </div>
        );
    }

    const userId = profile?.id || user?.id || "";
    const syncUrl = `https://dashboard.usthadacademy.com/setup-notifications?uid=${userId}`;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-slate-100 flex flex-col items-center px-4 py-8 md:py-16">
            <div className="w-full max-w-4xl">
                {/* Header Actions */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={() => router.back()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-sm font-semibold text-slate-300"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Go Back
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-full border border-indigo-500/20">
                        Academy Security Core
                    </span>
                </div>

                {/* Profile Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left: General Identity info */}
                    <div className="lg:col-span-7 space-y-6">
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl">
                            <div className="flex items-center gap-5 mb-8">
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-indigo-500 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-500/20 overflow-hidden">
                                    {profile?.avatar_url ? (
                                        <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                                    ) : (
                                        (profile?.full_name?.[0] || profile?.email?.[0] || "U").toUpperCase()
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-xl md:text-2xl font-black tracking-tight text-white uppercase">
                                        {profile?.full_name || "Unidentified Personnel"}
                                    </h1>
                                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1">
                                        {profile?.role || "Staff Member"}
                                    </p>
                                </div>
                            </div>

                            {/* Details Fields */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                    <Award className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Assigned Role</span>
                                        <span className="text-sm font-semibold text-slate-200 capitalize">{profile?.role || "Staff"}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                    <Landmark className="w-5 h-5 text-orange-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Operational Sector</span>
                                        <span className="text-sm font-semibold text-slate-200 capitalize">{profile?.department || "General Operations"}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                    <Mail className="w-5 h-5 text-teal-400 flex-shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Communications Email</span>
                                        <span className="text-sm font-semibold text-slate-200">{profile?.email || "No Email Registered"}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                    <Phone className="w-5 h-5 text-pink-400 flex-shrink-0" />
                                    <div className="flex-1">
                                        <label htmlFor="phone" className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                                            Operational Contact Number
                                        </label>
                                        <input
                                            type="text"
                                            id="phone"
                                            value={localPhone}
                                            placeholder="Enter contact number..."
                                            onChange={(e) => handlePhoneChange(e.target.value)}
                                            className="w-full bg-transparent border-none focus:outline-none focus:ring-0 p-0 text-sm font-semibold text-slate-200 placeholder-slate-600 mt-0.5"
                                        />
                                    </div>
                                    <button
                                        onClick={handleSavePhone}
                                        disabled={isUpdating || localPhone === (profile?.phone || "")}
                                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-xs font-bold uppercase tracking-wider text-white"
                                    >
                                        {isUpdating ? "Saving..." : "Save"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Premium Frosted Sync Card */}
                    <div className="lg:col-span-5 flex items-center justify-center">
                        <MobileSyncCard userId={userId} size={180} />
                    </div>
                </div>
            </div>
        </div>
    );
}
