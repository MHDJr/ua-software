"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OneSignal from "react-onesignal";
import { ShieldCheck, CheckCircle2, AlertTriangle, Bell, Loader2 } from "lucide-react";

function SetupNotificationContent() {
    const searchParams = useSearchParams();
    const userId = searchParams.get("uid");
    
    const [status, setStatus] = useState<"idle" | "requesting" | "success" | "error">("idle");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        if (typeof window !== 'undefined') {
            OneSignal.init({
                appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '25c17e4d-dd90-4551-a1bb-1fbf9be673bf',
                allowLocalhostAsSecureOrigin: true // Crucial local network bypass override rule
            }).catch(err => {
                console.warn("OneSignal initialization warning:", err);
            });
        }
    }, []);

    const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    };

    const handleActivate = async () => {
        if (!userId) {
            setStatus("error");
            setErrorMessage("No user identification (UID) detected. Please scan the QR code from your personnel console profile again.");
            return;
        }

        setStatus("requesting");
        try {
            // 1. OneSignal pipeline initialization & registration
            let oneSignalSuccess = false;
            try {
                await OneSignal.Notifications.requestPermission();
                if (OneSignal.Notifications.permission) {
                    await OneSignal.login(userId);
                    oneSignalSuccess = true;
                }
            } catch (oneSignalErr) {
                console.warn("OneSignal pipeline registration failed or skipped:", oneSignalErr);
            }

            // 2. Standard Web Push pipeline registration
            let webPushSuccess = false;
            try {
                if (typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window) {
                    const reg = await navigator.serviceWorker.ready;
                    const permission = await Notification.requestPermission();
                    if (permission === "granted") {
                        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BLR_mIupDbLl4cCWyEYLYptIhvbRzPSR6RNw9loLY2MgQw4XqVasmuAy-6AE9WB1B9Xbj9mSXTQWChDizudDO54';
                        if (vapidPublicKey) {
                            const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
                            const subscription = await reg.pushManager.subscribe({
                                userVisibleOnly: true,
                                applicationServerKey,
                            });

                            // Securely register the subscription with the backend
                            const registerRes = await fetch("/api/register-push", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    user_id: userId,
                                    subscription: subscription.toJSON(),
                                    device_info: `${navigator.userAgent} (QR Setup Mobile)`
                                })
                            });

                            if (registerRes.ok) {
                                webPushSuccess = true;
                                console.log("Standard Web Push pipeline activated successfully.");
                            } else {
                                const errData = await registerRes.json();
                                console.warn("Standard Web Push registration rejected by backend:", errData);
                            }
                        }
                    }
                }
            } catch (webPushErr) {
                console.warn("Standard Web Push pipeline registration failed or skipped:", webPushErr);
            }

            // 3. Validate overall success (if at least one pipeline worked)
            if (oneSignalSuccess || webPushSuccess) {
                setStatus("success");
            } else {
                setStatus("error");
                setErrorMessage("Notification permissions were denied or registration failed. Please enable notifications in your browser or device settings to continue.");
            }
        } catch (err: any) {
            console.error("Pipeline activation error:", err);
            setStatus("error");
            setErrorMessage(err.message || "An unexpected error occurred during device linking.");
        }
    };

    return (
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col items-center">
            {/* Abstract Decorative Lights */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Official Web Branding Logo */}
            <div className="relative mb-6 select-none">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src="/logo.png"
                    alt="Usthad Academy Logo"
                    className="h-16 w-auto object-contain drop-shadow-[0_4px_12px_rgba(49,38,125,0.15)]"
                />
            </div>

            <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider text-white text-center">
                UA Console
            </h1>
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1 mb-6 text-center">
                Notification Setup
            </p>

            {status === "idle" && (
                <div className="w-full space-y-6 flex flex-col items-center">
                    {/* Prompt container */}
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 text-center">
                        <p className="text-sm text-slate-300 leading-relaxed font-medium">
                            &ldquo;Would you like to receive active notifications from usthadacademy regarding newly assigned operational tasks, messaging directives, or updates from the CEO?&rdquo;
                        </p>
                    </div>

                    <div className="w-full space-y-4">
                        <button
                            onClick={handleActivate}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs transition-all duration-300 shadow-lg shadow-indigo-600/20 active:scale-98"
                        >
                            <Bell className="w-4 h-4" />
                            Activate Sync Route
                        </button>
                        
                        {!userId && (
                            <div className="flex items-center gap-2 text-amber-400 justify-center p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 text-[10px]">
                                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                <span>No UID parameter found. Scanning QR code is required.</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {status === "requesting" && (
                <div className="w-full py-8 flex flex-col items-center gap-4 text-center">
                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                    <h2 className="text-base font-bold text-white uppercase tracking-wider">
                        Awaiting Permission
                    </h2>
                    <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                        Please approve the native notification permission overlay prompt displayed on your smartphone.
                    </p>
                </div>
            )}

            {status === "success" && (
                <div className="w-full space-y-6 flex flex-col items-center text-center py-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/5 animate-pulse">
                        <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-emerald-400 uppercase tracking-widest">
                            System Link Confirmed
                        </h2>
                        <p className="text-xs text-slate-300 font-semibold mt-1">
                            Mobile Alert Pipeline Activated Successfully
                        </p>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-[11px] text-emerald-300/80 leading-relaxed text-left w-full">
                        ✨ **Pipeline Active:** Your smartphone will now trigger high-priority alerts whenever new tasks are assigned, messages arrive, or the CEO posts operational updates. You can close this screen.
                    </div>
                </div>
            )}

            {status === "error" && (
                <div className="w-full space-y-6 flex flex-col items-center text-center py-4">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shadow-lg shadow-red-500/5">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-base font-black text-red-400 uppercase tracking-widest">
                            Setup Failed
                        </h2>
                        <p className="text-xs text-slate-300 font-semibold mt-1">
                            System Synchronization Interrupted
                        </p>
                    </div>
                    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-[11px] text-red-400/80 leading-relaxed text-left w-full">
                        {errorMessage}
                    </div>
                    <button
                        onClick={() => setStatus("idle")}
                        className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-wider text-slate-300 transition-all"
                    >
                        Try Again
                    </button>
                </div>
            )}

            {/* Pipeline Routing Description */}
            <div className="w-full mt-6 pt-4 border-t border-white/5 flex items-center gap-2 justify-center text-[10px] text-slate-500 tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>ONE-SIGNAL SECURE ALERT TERMINAL</span>
            </div>
        </div>
    );
}

export default function SetupNotificationsPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-12">
            <Suspense fallback={
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    <p className="text-xs font-semibold text-slate-400 tracking-wider">LOADING MODULE...</p>
                </div>
            }>
                <SetupNotificationContent />
            </Suspense>
        </div>
    );
}
