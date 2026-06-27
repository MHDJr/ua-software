"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck } from "lucide-react";

interface MobileSyncCardProps {
    userId: string;
    size?: number;
}

export function MobileSyncCard({ userId, size = 130 }: MobileSyncCardProps) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const syncUrl = baseUrl ? `${baseUrl}/setup-notifications?uid=${userId}` : '';

    return (
        <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-950/90 via-slate-900/90 to-zinc-950/95 dark:from-zinc-900/70 dark:via-zinc-950/80 dark:to-black/90 border border-slate-200 dark:border-zinc-800 shadow-lg flex flex-col items-center text-center w-full">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
                <ShieldCheck className="w-5 h-5 animate-pulse" />
            </div>
            <span className="text-[10px] font-black text-white uppercase tracking-widest block mb-1">
                Mobile Sync Route
            </span>
            <p className="text-[10px] text-slate-400 dark:text-zinc-400 leading-relaxed max-w-[280px] mb-4">
                Scan this QR code with your phone camera to set up OneSignal alerts for operational updates and CEO directives.
            </p>
            <div className="p-3 bg-white rounded-xl shadow-md mb-4 flex items-center justify-center">
                {userId && syncUrl ? (
                    <QRCodeSVG
                        value={syncUrl}
                        size={size}
                        level="H"
                        includeMargin={false}
                        className="w-full h-full"
                    />
                ) : (
                    <div style={{ width: size, height: size }} className="flex items-center justify-center text-slate-500 font-mono text-xs">
                        Generating QR...
                    </div>
                )}
            </div>
            <div className="w-full text-left text-[9px] leading-relaxed text-slate-400 dark:text-zinc-500 border-t border-slate-100/10 pt-3">
                <span className="font-bold text-slate-300 dark:text-zinc-400 block mb-0.5">
                    🔒 SECURE MOBILE PIPELINE
                </span>
                Links your Supabase security context to your mobile background alert receiver.
            </div>
        </div>
    );
}
