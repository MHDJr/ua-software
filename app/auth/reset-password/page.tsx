"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock, ShieldCheck, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Check if we have a recovery session or a code to exchange
        const checkSession = async () => {
            // 1. Check for PKCE code in query params
            const params = new URLSearchParams(window.location.search);
            const code = params.get("code");

            if (code) {
                const { error } = await supabase.auth.exchangeCodeForSession(code);
                if (error) {
                    console.error("Code exchange error:", error);
                    toast.error("Invalid or expired recovery code.");
                    // router.push("/auth"); // Don't redirect immediately, let user see error
                    return;
                }
            }

            // 2. Check for active session (either from hash or code exchange)
            const { data: { session } } = await supabase.auth.getSession();
            
            if (!session) {
                // 3. Fallback check for hash fragments (implicit flow)
                if (!window.location.hash.includes("type=recovery") && !code) {
                    toast.error("Invalid or expired reset link.");
                    router.push("/");
                }
            }
        };
        checkSession();
    }, [router]);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password.length < 6) {
            toast.error("Password must be at least 6 characters.");
            return;
        }

        if (password !== confirmPassword) {
            toast.error("Passwords do not match.");
            return;
        }

        if (loading) return;

        setLoading(true);
        console.log("[Auth] Initiating password update...");
        
        try {
            // 1. Update the password
            const { data, error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            console.log("[Auth] Password updated successfully for:", data.user?.email);

            // 2. IMPORTANT: Sign out to invalidate the recovery session completely
            // This ensures they must log in fresh with the new password and 
            // the reset link cannot be "re-used" in the same browser session.
            await supabase.auth.signOut();

            // 3. Update UI state
            setLoading(false);
            setIsSuccess(true);
            toast.success("Security key successfully updated.");
            
            // 4. Clean up the URL (remove codes/hashes)
            window.history.replaceState({}, document.title, window.location.pathname);

            // 5. Automatic redirect after delay
            setTimeout(() => {
                router.push("/");
            }, 5000);
        } catch (error: any) {
            console.error("[Auth] Reset error:", error);
            setLoading(false);
            toast.error(error.message || "Failed to update security key. The link may have expired.");
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8F9FC]">
                <div className="max-w-md w-full bg-white rounded-[2.5rem] p-10 shadow-2xl text-center">
                    <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h1 className="text-2xl font-black text-[#1E293B] mb-4 uppercase tracking-tight">Password Reset Complete</h1>
                    <p className="text-gray-500 text-sm font-medium mb-8">
                        Your identity has been re-secured. You will be redirected to the login portal momentarily.
                    </p>
                    <Button 
                        onClick={() => router.push("/")}
                        className="w-full h-14 bg-gradient-to-r from-[#e86123] to-[#351e6a] rounded-2xl text-white font-black uppercase tracking-widest text-xs"
                    >
                        Return to Portal
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#F8F9FC] relative overflow-hidden">
            {/* Background Orbs */}
            <div className="orb w-[800px] h-[800px] bg-[#351e6a] absolute top-[-20%] left-[-20%] rounded-full opacity-[0.03] blur-[120px]" />
            <div className="orb w-[600px] h-[600px] bg-[#e86123] absolute bottom-[-10%] right-[-10%] rounded-full opacity-[0.05] blur-[100px]" />

            <div className="max-w-md w-full relative z-10">
                <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 sm:p-10 shadow-2xl border border-white">
                    <header className="mb-10 text-center">
                        <div className="w-16 h-16 bg-[#351e6a]/5 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-[#351e6a]/10">
                            <ShieldCheck className="w-8 h-8 text-[#351e6a]" />
                        </div>
                        <h1 className="text-2xl font-black text-[#1E293B] mb-2 uppercase tracking-tight">Reset Password</h1>
                        <p className="text-[#64748B] text-[10px] font-bold uppercase tracking-[0.2em]">Secure Identity Re-verification</p>
                    </header>

                    <form onSubmit={handleReset} className="space-y-6">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] ml-1">New Security Key</Label>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="bg-[#F1F5F9] border-slate-200 rounded-2xl px-5 h-14 font-bold text-[#1E293B] focus:bg-white focus:border-[#e86123] transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-5 top-1/2 -translate-y-1/2 text-[#64748B]/30 hover:text-[#1E293B]"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] ml-1">Confirm Security Key</Label>
                            <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="bg-[#F1F5F9] border-slate-200 rounded-2xl px-5 h-14 font-bold text-[#1E293B] focus:bg-white focus:border-[#e86123] transition-all"
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-14 bg-gradient-to-r from-[#e86123] to-[#351e6a] rounded-2xl text-white font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-orange-500/20 hover:-translate-y-1 transition-all active:scale-[0.98]"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Security Key"}
                        </Button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-100 flex items-center justify-center">
                        <div className="flex items-center gap-2 opacity-50">
                            <Lock className="w-3 h-3 text-[#64748B]" />
                            <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-widest">End-to-End Encrypted</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
