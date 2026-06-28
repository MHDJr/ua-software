"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Smartphone, Info, Share2, PlusSquare, AlertTriangle, ArrowRight, CheckCircle2, ShieldCheck, Loader2 } from "lucide-react";

function InstallPwaContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const userId = searchParams.get("uid") || "";

    const [platform, setPlatform] = useState<"android" | "ios" | null>(null);
    const [isSafari, setIsSafari] = useState(true);
    const [isStandalone, setIsStandalone] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const ua = navigator.userAgent;
            
            // Detect platform
            const isIOSDevice = /iPhone|iPad|iPod/i.test(ua);
            const isAndroidDevice = /Android/i.test(ua);
            
            if (isIOSDevice) {
                setPlatform("ios");
            } else if (isAndroidDevice) {
                setPlatform("android");
            }

            // Detect Safari on iOS
            const isSafariBrowser = isIOSDevice && 
                ua.includes("Safari") && 
                !ua.includes("CriOS") && // Chrome iOS
                !ua.includes("FxiOS") && // Firefox iOS
                !ua.includes("EdgiOS") && // Edge iOS
                !ua.includes("OPiOS"); // Opera iOS
            
            setIsSafari(isSafariBrowser);

            // Detect Standalone Mode (running inside installed PWA)
            const isStandaloneMode = window.matchMedia("(display-mode: standalone)").matches || 
                (navigator as any).standalone === true;
            
            setIsStandalone(isStandaloneMode);
            setChecking(false);

            // Auto-redirect if already inside the installed PWA
            if (isStandaloneMode) {
                const target = userId ? `/setup-notifications?uid=${userId}` : "/dashboard";
                setTimeout(() => {
                    router.push(target);
                }, 2000);
            }
        }
    }, [userId, router]);

    if (checking) {
        return (
            <div className="flex flex-col items-center gap-4 text-center">
                <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                <p className="text-sm font-semibold text-slate-400">Analyzing platform compatibility...</p>
            </div>
        );
    }

    if (isStandalone) {
        return (
            <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/5 mb-6 animate-pulse">
                    <CheckCircle2 className="w-8 h-8" />
                </div>
                <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider text-white">
                    PWA Installed
                </h1>
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1 mb-4">
                    Standalone Context Active
                </p>
                <p className="text-sm text-slate-300 leading-relaxed mb-6">
                    We detected that you are running within the installed mobile app! Redirecting you now to complete the notification configuration.
                </p>
                <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full animate-[loading_2s_ease-in-out_infinite]" style={{ width: "60%" }} />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden flex flex-col">
            {/* Abstract glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col items-center select-none mb-6">
                <img
                    src="/logo.png"
                    alt="Usthad Academy Logo"
                    className="h-16 w-auto object-contain drop-shadow-[0_4px_12px_rgba(49,38,125,0.15)]"
                />
                <h1 className="text-lg md:text-xl font-black uppercase tracking-wider text-white mt-4">
                    UA PWA Setup
                </h1>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mt-0.5">
                    Mobile Installation Portal
                </p>
            </div>

            {!platform ? (
                <div className="space-y-6 flex-1">
                    <p className="text-xs text-slate-300 leading-relaxed text-center p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        To enable instant push notifications for tasks, messages, and meetings, please select your smartphone platform:
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setPlatform("android")}
                            className="p-5 rounded-2xl bg-white/5 hover:bg-indigo-600/10 border border-white/10 hover:border-indigo-500/30 transition-all flex flex-col items-center gap-3 text-center"
                        >
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                <Smartphone className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold text-white uppercase tracking-wider">Android</span>
                        </button>

                        <button
                            onClick={() => setPlatform("ios")}
                            className="p-5 rounded-2xl bg-white/5 hover:bg-indigo-600/10 border border-white/10 hover:border-indigo-500/30 transition-all flex flex-col items-center gap-3 text-center"
                        >
                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                <Smartphone className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-bold text-white uppercase tracking-wider">iPhone / iOS</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6 flex-1">
                    {/* Platform-specific Header */}
                    <div className="flex items-center justify-between border-b border-white/10 pb-4">
                        <span className="text-xs font-black text-white uppercase tracking-wider">
                            Installing on {platform === "ios" ? "iPhone (iOS)" : "Android Phone"}
                        </span>
                        <button
                            onClick={() => setPlatform(null)}
                            className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest"
                        >
                            Change Device
                        </button>
                    </div>

                    {/* IOS WARNING: MUST OPEN IN SAFARI */}
                    {platform === "ios" && !isSafari && (
                        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs flex gap-3">
                            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                            <div>
                                <strong className="block uppercase tracking-wider text-[10px] mb-1">Safari Required</strong>
                                iOS only supports Home Screen installation via Safari. Please copy this page link and open it directly in Safari.
                            </div>
                        </div>
                    )}

                    {/* Step-by-Step interactive guide */}
                    <div className="space-y-4">
                        {platform === "ios" ? (
                            <>
                                <div className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 items-start">
                                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-[10px] font-bold mt-0.5">1</div>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        Tap the <strong className="text-white inline-flex items-center gap-1"><Share2 className="w-3.5 h-3.5" /> Share</strong> button in Safari (located at the bottom navigation bar).
                                    </p>
                                </div>

                                <div className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 items-start">
                                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-[10px] font-bold mt-0.5">2</div>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        Scroll down the list of options and tap <strong className="text-white inline-flex items-center gap-1"><PlusSquare className="w-3.5 h-3.5" /> Add to Home Screen</strong>.
                                    </p>
                                </div>

                                <div className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 items-start">
                                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-[10px] font-bold mt-0.5">3</div>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        Launch the app from your Home Screen, sign in, and enable notification permissions when prompted.
                                    </p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 items-start">
                                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-[10px] font-bold mt-0.5">1</div>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        Tap the browser menu button (three vertical dots <strong className="text-white">⋮</strong>) at the top-right of your browser.
                                    </p>
                                </div>

                                <div className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 items-start">
                                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-[10px] font-bold mt-0.5">2</div>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        Tap <strong className="text-white">Install app</strong> or <strong className="text-white">Add to Home Screen</strong>.
                                    </p>
                                </div>

                                <div className="flex gap-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 items-start">
                                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-[10px] font-bold mt-0.5">3</div>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        Open the installed app, and tap the <strong className="text-white">Activate Notifications</strong> banner on your dashboard.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Launch Web App Button */}
                    <div className="space-y-4 pt-2">
                        <button
                            onClick={() => {
                                const dest = userId ? `/setup-notifications?uid=${userId}` : "/dashboard";
                                router.push(dest);
                            }}
                            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs transition-all duration-300 shadow-lg shadow-indigo-600/20 active:scale-98"
                        >
                            <span>Open Setup Console</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Footer sync route */}
            <div className="w-full mt-6 pt-4 border-t border-white/5 flex items-center gap-2 justify-center text-[10px] text-slate-500 tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>PWA DEPLOYMENT GATEWAY</span>
            </div>
        </div>
    );
}

export default function InstallPwaPage() {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4 py-12">
            <Suspense fallback={
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                    <p className="text-xs font-semibold text-slate-400 tracking-wider">LOADING INSTALL MODULE...</p>
                </div>
            }>
                <InstallPwaContent />
            </Suspense>
        </div>
    );
}
