"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { 
    User, ShieldCheck, ArrowLeft, Phone, Mail, Award, Landmark, 
    RefreshCw, Bell, BellOff, Trash2, ShieldAlert, Loader2, Sparkles 
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { MobileSyncCard } from "@/components/MobileSyncCard";
import { usePushSubscription } from "@/hooks/use-push-subscription";

export default function ProfilePage() {
    const router = useRouter();
    const { profile, user, refreshProfile, loading } = useAuth();
    const [localPhone, setLocalPhone] = useState<string>("");
    const [isUpdating, setIsUpdating] = useState(false);

    // Push subscription hook integration
    const {
        isSupported,
        permission,
        isSubscribed,
        loading: loadingSub,
        subscribeUser,
        unsubscribeUser,
        currentSubscription,
        syncState
    } = usePushSubscription();

    const [devices, setDevices] = useState<any[]>([]);
    const [loadingDevices, setLoadingDevices] = useState(true);
    const [isTestingPush, setIsTestingPush] = useState(false);

    const userId = profile?.id || user?.id || "";

    // Fetch user subscriptions
    const fetchDevices = useCallback(async () => {
        if (!userId) return;
        setLoadingDevices(true);
        try {
            const { data, error } = await supabase
                .from("push_subscriptions")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setDevices(data || []);
        } catch (err) {
            console.error("[ProfilePage] Error fetching devices:", err);
        } finally {
            setLoadingDevices(false);
        }
    }, [userId]);

    useEffect(() => {
        if (userId) {
            fetchDevices();
        }
    }, [userId, fetchDevices, isSubscribed]);

    useEffect(() => {
        if (profile) {
            setLocalPhone(profile.phone || "");
        }
    }, [profile]);

    const handlePhoneChange = async (val: string) => {
        setLocalPhone(val);
    };

    const handleSavePhone = async () => {
        if (!userId) return;
        setIsUpdating(true);
        try {
            const { error } = await supabase
                .from("profiles")
                .update({ phone: localPhone })
                .eq("id", userId);
            
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

    // Toggle push subscriptions
    const handleToggleNotifications = async () => {
        try {
            if (isSubscribed) {
                await unsubscribeUser();
                toast.success("Notifications disabled on this device.");
            } else {
                await subscribeUser();
                toast.success("Notifications successfully enabled!");
            }
            await fetchDevices();
        } catch (err: any) {
            console.error("Notification toggle failed:", err);
            toast.error(err.message || "Failed to toggle notifications.");
        }
    };

    // Dispatch self test notification
    const handleTestPush = async () => {
        if (!userId) return;
        setIsTestingPush(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

            const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session?.access_token || ""}`
                },
                body: JSON.stringify({
                    recipient_id: userId,
                    title: "🔔 PWA Notification Sync Confirmation",
                    body: `Your native device is linked! Tested successfully at ${new Date().toLocaleTimeString()}.`,
                    url: `/dashboard`
                })
            });

            const resData = await response.json();
            if (response.ok) {
                toast.success("Test push alert successfully broadcasted to all active links!");
                setTimeout(fetchDevices, 1500); // refresh list
            } else {
                throw new Error(resData.error || "Failed to dispatch test notification");
            }
        } catch (err: any) {
            console.error("[ProfilePage] Test push error:", err);
            toast.error(err.message || "Failed to send test notification.");
        } finally {
            setIsTestingPush(false);
        }
    };

    // Delete a linked subscription device
    const handleRemoveDevice = async (id: string, endpoint: string) => {
        try {
            const { error } = await supabase
                .from("push_subscriptions")
                .delete()
                .eq("id", id);

            if (error) throw error;

            // If the deleted device matches the active local registration, unsubscribe locally
            if (currentSubscription && currentSubscription.endpoint === endpoint) {
                await currentSubscription.unsubscribe();
                await syncState();
            }

            toast.success("Device token cleared successfully.");
            await fetchDevices();
        } catch (err: any) {
            console.error("[ProfilePage] Delete device error:", err);
            toast.error(err.message || "Failed to remove connected device.");
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
                    {/* Left: General Identity info & Notification Configuration */}
                    <div className="lg:col-span-7 space-y-6">
                        {/* 1. Profile Identity Info Card */}
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl">
                            <div className="flex items-center gap-5 mb-8">
                                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-indigo-500 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-indigo-500/20 overflow-hidden">
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

                        {/* 2. Notification Preferences settings */}
                        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
                            <div>
                                <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-indigo-400" />
                                    Push Notification Settings
                                </h2>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
                                    Configure native alerts for your devices
                                </p>
                            </div>

                            {/* Supported warning */}
                            {!isSupported ? (
                                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex gap-4 text-slate-400 items-start text-xs leading-relaxed">
                                    <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0" />
                                    <div>
                                        <span className="font-bold text-slate-300 block mb-0.5">Not Supported on this Browser</span>
                                        Web Push Notifications are not supported on this browser version or environment. Ensure you are on a secure origin (HTTPS) and not in private browsing.
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Action Toggle */}
                                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                                        <div className="flex-1">
                                            <span className="text-xs font-bold text-white uppercase tracking-wider block">
                                                {isSubscribed ? "Push Alerts Enabled" : "Push Alerts Disabled"}
                                            </span>
                                            <span className="text-[10px] text-slate-400 mt-0.5 block">
                                                {isSubscribed 
                                                    ? "This device is registered and active." 
                                                    : "Enable to receive updates on tasks, messages, and invites."
                                                }
                                            </span>
                                        </div>

                                        <button
                                            onClick={handleToggleNotifications}
                                            disabled={loadingSub}
                                            className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold uppercase tracking-wider text-xs transition-all ${
                                                isSubscribed 
                                                    ? "bg-white/10 hover:bg-red-500/10 hover:text-red-400 text-slate-300 border border-white/10 hover:border-red-500/20" 
                                                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                                            }`}
                                        >
                                            {loadingSub ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : isSubscribed ? (
                                                <>
                                                    <BellOff className="w-4 h-4" />
                                                    Disable
                                                </>
                                            ) : (
                                                <>
                                                    <Bell className="w-4 h-4" />
                                                    Enable
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Permission Denied Instruction Block */}
                                    {permission === "denied" && (
                                        <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 flex gap-4 text-red-400/90 items-start text-xs leading-relaxed">
                                            <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                                            <div>
                                                <strong className="block uppercase tracking-wider text-[10px] mb-1">
                                                    ⚠️ Notification Permissions Blocked
                                                </strong>
                                                You denied permission. To enable notifications, please open your browser's site settings or phone notification preferences and allow notifications for this application.
                                            </div>
                                        </div>
                                    )}

                                    {/* Self-Test Push Notification Trigger */}
                                    {isSubscribed && (
                                        <div className="pt-2">
                                            <button
                                                onClick={handleTestPush}
                                                disabled={isTestingPush}
                                                className="w-full py-3 border border-white/10 hover:border-indigo-500/30 hover:bg-indigo-500/5 rounded-xl flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-[10px] text-slate-300 hover:text-white transition-all duration-300"
                                            >
                                                {isTestingPush ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-4 h-4 text-indigo-400" />
                                                        Test Broadcast To My Devices
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* 3. Connected Devices Panel */}
                        {isSupported && (
                            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-6 md:p-8 shadow-xl space-y-6">
                                <div>
                                    <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                                        <RefreshCw className="w-5 h-5 text-indigo-400" />
                                        Linked Devices & Subscriptions
                                    </h2>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1">
                                        Manage your active push notification channels
                                    </p>
                                </div>

                                {loadingDevices ? (
                                    <div className="py-6 flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                                    </div>
                                ) : devices.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-500 italic">
                                        No active push subscription links found for this personnel file.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {devices.map((device) => {
                                            const isThisDevice = currentSubscription?.endpoint === device.endpoint;
                                            return (
                                                <div 
                                                    key={device.id} 
                                                    className={`p-4 rounded-2xl bg-white/[0.02] border transition-all flex items-center justify-between ${
                                                        isThisDevice 
                                                            ? "border-indigo-500/30 bg-indigo-500/[0.02]" 
                                                            : "border-white/5"
                                                    }`}
                                                >
                                                    <div className="min-w-0 flex-1 pr-4">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-white uppercase tracking-wider block">
                                                                {device.browser || "Unknown Browser"} on {device.platform || "Unknown OS"}
                                                            </span>
                                                            {isThisDevice && (
                                                                <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                                                                    Active Device
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-[9px] text-slate-500 mt-1 block">
                                                            Device Type: {device.device_type || "Desktop"} • Registered {new Date(device.created_at).toLocaleDateString()}
                                                        </span>
                                                        <span className="text-[9px] text-slate-500 block">
                                                            Last Sync Alert: {device.last_used_at ? new Date(device.last_used_at).toLocaleTimeString() : "Never"}
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={() => handleRemoveDevice(device.id, device.endpoint)}
                                                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                                        title="Remove subscription link"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right: Premium Frosted Sync Card */}
                    <div className="lg:col-span-5 flex flex-col items-center justify-start">
                        <MobileSyncCard userId={userId} size={180} />
                    </div>
                </div>
            </div>
        </div>
    );
}
