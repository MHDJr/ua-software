"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
    Loader2,
    AlertTriangle,
    Lock,
    Eye,
    EyeOff,
    Fingerprint,
    ShieldCheck,
    ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

export function AuthPage() {
    const { signIn } = useAuth();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isResetMode, setIsResetMode] = useState(false);
    const [resetEmailSent, setResetEmailSent] = useState(false);
    const [maskedEmail, setMaskedEmail] = useState("");

    const [signInForm, setSignInForm] = useState({
        username: "",
        password: "",
        rememberMe: false,
    });
    const [accessDenied, setAccessDenied] = useState(false);
    const [wrongCredentials, setWrongCredentials] = useState(false);

    const maskEmail = (email: string) => {
        const [name, domain] = email.split("@");
        if (name.length <= 4) return `${name[0]}***${name[name.length - 1]}@${domain}`;
        return `${name.substring(0, 3)}******${name.substring(name.length - 2)}@${domain}`;
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const input = signInForm.username.trim();
            if (!input) {
                toast.error("Please enter your username or email");
                setLoading(false);
                return;
            }

            let email = input;
            if (!input.includes("@")) {
                const { data: profile, error } = await supabase
                    .from("profiles")
                    .select("email")
                    .ilike("username", input)
                    .maybeSingle();
                
                if (error || !profile) {
                    throw new Error(error ? "System error during verification" : "User not found with this username");
                }
                email = profile.email;
            }

            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/reset-password/`,
            });

            if (resetError) throw resetError;

            setMaskedEmail(maskEmail(email));
            setResetEmailSent(true);
            toast.success("Security reset link dispatched.");
        } catch (error: any) {
            toast.error("RESET FAILED", {
                description: error.message || "Failed to dispatch reset link",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (typeof window !== "undefined") {
            const denied = window.localStorage.getItem("ACCESS_DENIED");
            if (denied === "true") {
                setAccessDenied(true);
                window.localStorage.removeItem("ACCESS_DENIED");
                toast.error("UNAUTHORIZED ACCESS DETECTED", {
                    description:
                        "Your account is not registered or approved for this academy.",
                    duration: 10000,
                });
            }

            const savedUsername = window.localStorage.getItem(
                "REMEMBER_ME_USERNAME",
            );
            const rememberMe = window.localStorage.getItem(
                "REMEMBER_ME_CHECKED",
            );
            if (savedUsername && rememberMe === "true") {
                setSignInForm((prev) => ({
                    ...prev,
                    username: savedUsername,
                    rememberMe: true,
                }));
            }
        }
    }, []);

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (signInForm.rememberMe) {
            window.localStorage.setItem(
                "REMEMBER_ME_USERNAME",
                signInForm.username,
            );
            window.localStorage.setItem("REMEMBER_ME_CHECKED", "true");
        } else {
            window.localStorage.removeItem("REMEMBER_ME_USERNAME");
            window.localStorage.setItem("REMEMBER_ME_CHECKED", "false");
        }

        try {
            const input = signInForm.username.trim();
            const isEmail = input.includes("@");
            if (isEmail) {
                await signIn(input, signInForm.password);
            } else {
                const { data: profile, error } = await supabase
                    .from("profiles")
                    .select("email")
                    .ilike("username", input)
                    .maybeSingle();
                if (error || !profile) {
                    throw new Error(
                        error
                            ? "System error during identity verification"
                            : "User not found with this username",
                    );
                }
                await signIn(profile.email, signInForm.password);
            }
            toast.success("Identity verified. Initializing secure session...");
        } catch (error: any) {
            if (
                error.message?.includes("Invalid login credentials") ||
                error.status === 400
            ) {
                setWrongCredentials(true);
                setAccessDenied(false);
                toast.error("SECURITY ALERT: WRONG CREDENTIALS", {
                    description:
                        "Authorization failed. Please verify your identity.",
                    duration: 5000,
                });
            } else {
                setAccessDenied(true);
                setWrongCredentials(false);
                toast.error("SECURITY ALERT: ACCESS DENIED", {
                    description: error.message || "Failed to sign in",
                    duration: 5000,
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        try {
            await supabase.auth.signOut();
            await supabase.auth.signInWithOAuth({
                provider: "google",
                options: {
                    redirectTo: `${window.location.origin}/auth/callback`,
                    queryParams: { access_type: "offline", prompt: "consent" },
                },
            });
        } catch (error: any) {
            toast.error(error.message || "Failed to sign in with Google.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-0 sm:p-4 bg-[#F8F9FC] relative overflow-hidden selection:bg-[#e86123]/30 selection:text-[#351e6a]">
            {/* Brand Atmosphere - Soft Lighter Tones */}
            <div className="orb w-[800px] h-[800px] bg-[#351e6a] absolute top-[-20%] left-[-20%] rounded-full opacity-[0.03] blur-[120px]" />
            <div className="orb w-[600px] h-[600px] bg-[#e86123] absolute bottom-[-10%] right-[-10%] rounded-full opacity-[0.05] blur-[100px]" />

            <main className="w-full h-full sm:h-auto sm:max-w-6xl bg-white sm:bg-white/80 sm:backdrop-blur-xl sm:rounded-[2.5rem] lg:rounded-[3.5rem] overflow-y-auto sm:overflow-hidden flex flex-col lg:flex-row sm:min-h-[680px] border-none sm:border sm:border-white sm:shadow-2xl relative z-10">
                {/* Left Panel: Executive Identity */}
                <div className="lg:w-2/5 p-8 sm:p-10 lg:p-14 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100 relative bg-gradient-to-br from-[#F1F5F9] to-[#F8F9FC] shrink-0">
                    <div className="absolute top-6 sm:top-8 right-8 sm:right-10">
                        <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#e86123] animate-pulse shadow-[0_0_8px_rgba(232,97,35,0.4)]" />
                            <span className="text-[9px] font-black text-[#64748B]/40 uppercase tracking-[0.3em]">
                                Encrypted
                            </span>
                        </div>
                    </div>

                    <div className="relative z-10 pt-4">
                        <div className="mb-10 sm:mb-14">
                            <div className="w-16 h-16 mb-6 sm:mb-8 p-3 rounded-2xl bg-white border border-slate-200 shadow-sm mx-auto lg:mx-0">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src="/images/usthadacademylogo2.svg"
                                    alt="Usthad Academy Logo"
                                    className="w-full h-full object-contain"
                                />
                            </div>
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#1E293B] tracking-tighter leading-tight mb-4 sm:mb-6 text-center lg:text-left">
                                Usthad <br className="hidden lg:block" />
                                <span className="text-[#351e6a]">Console.</span>
                            </h1>
                            <div className="w-12 h-1.5 bg-[#e86123] rounded-full mb-6 sm:mb-8 shadow-sm mx-auto lg:mx-0" />
                            <p className="text-[#64748B] text-sm font-medium leading-relaxed max-w-[280px] mx-auto lg:mx-0 text-center lg:text-left">
                                Welcome to the central node. This interface is
                                reserved for Executive Management to orchestrate
                                Academy operations.
                            </p>
                        </div>

                        <div className="hidden sm:flex flex-wrap gap-3 justify-center lg:justify-start">
                            <span className="px-3 py-1 bg-white rounded-full border border-slate-200 text-[9px] font-bold text-slate-500 tracking-widest uppercase shadow-sm">
                                v4.2.0 Stable
                            </span>
                            <span className="px-3 py-1 bg-white rounded-full border border-slate-200 text-[9px] font-bold text-slate-500 tracking-widest uppercase shadow-sm">
                                HQ Link: Up
                            </span>
                        </div>
                    </div>

                    <div className="mt-8 lg:mt-0 flex items-center justify-center lg:justify-between opacity-80">
                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-2">
                                <div className="w-7 h-7 rounded-full border-2 border-white bg-[#351e6a] flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                                    E
                                </div>
                                <div className="w-7 h-7 rounded-full border-2 border-white bg-[#e86123] flex items-center justify-center text-[9px] font-bold text-white shadow-sm">
                                    M
                                </div>
                            </div>
                            <span className="text-[9px] font-bold text-slate-500 tracking-widest uppercase">
                                Executive Tier
                            </span>
                        </div>
                    </div>
                </div>

                {/* Right Panel: The Portal */}
                <div className="lg:w-3/5 p-8 sm:p-12 lg:p-20 flex flex-col justify-center bg-white/40 grow">
                    <div className="max-w-md mx-auto w-full">
                        <header className="mb-10 sm:mb-14 text-center lg:text-left">
                            <h2 className="text-2xl sm:text-3xl font-black text-[#1E293B] mb-3 uppercase tracking-tight">
                                {isResetMode ? (resetEmailSent ? "Security Dispatched" : "Security Recovery") : "Identity Authentication"}
                            </h2>
                            <p className="text-[#64748B] text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em]">
                                {isResetMode ? (resetEmailSent ? "Check your authorized email inbox." : "Initialize credential recovery protocol.") : "Verify security clearance to proceed."}
                            </p>
                        </header>

                        {isResetMode && resetEmailSent ? (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="p-8 rounded-[2rem] bg-indigo-50/50 border border-indigo-100 flex flex-col items-center text-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-white border border-indigo-200 shadow-sm flex items-center justify-center text-[#351e6a]">
                                        <ShieldCheck className="w-8 h-8" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-black text-[#1E293B] uppercase tracking-tight">
                                            Reset Link Dispatched
                                        </p>
                                        <p className="text-xs text-[#64748B] font-medium leading-relaxed">
                                            A security key reset link has been sent to:
                                            <br />
                                            <span className="text-[#351e6a] font-black mt-1 block tracking-wider">{maskedEmail}</span>
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => {
                                        setIsResetMode(false);
                                        setResetEmailSent(false);
                                    }}
                                    className="w-full h-14 sm:h-16 rounded-2xl bg-[#F1F5F9] hover:bg-slate-200 text-[#1E293B] font-black text-xs uppercase tracking-[0.25em] transition-all"
                                >
                                    Return to Authentication
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={isResetMode ? handleResetPassword : handleSignIn} className="space-y-6 sm:space-y-8">
                                {/* Error States */}
                                {(accessDenied || wrongCredentials) && !isResetMode && (
                                    <div
                                        className={`p-4 rounded-2xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${accessDenied ? "bg-red-50 border-red-100 text-red-600" : "bg-amber-50 border-amber-100 text-amber-600"}`}
                                    >
                                        <AlertTriangle className="h-4 w-4 shrink-0 transition-transform animate-pulse" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                            {accessDenied
                                                ? "Security Alert: Access Denied"
                                                : "Security Alert: Verification Failed"}
                                        </span>
                                    </div>
                                )}

                                {/* Access Identifier */}
                                <div className="group space-y-2 sm:space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] group-focus-within:text-[#e86123] transition-colors ml-1">
                                        Access Identifier
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="Username or Email"
                                            value={signInForm.username}
                                            onChange={(e) =>
                                                setSignInForm({
                                                    ...signInForm,
                                                    username: e.target.value,
                                                })
                                            }
                                            required
                                            className="w-full bg-[#F1F5F9] border border-slate-200 rounded-2xl px-5 py-4 text-base font-bold text-[#1E293B] placeholder:text-[#64748B]/30 focus:bg-white focus:border-[#e86123] focus:ring-4 focus:ring-[#e86123]/10 outline-none transition-all shadow-sm h-14 sm:h-16"
                                        />
                                        <Lock className="absolute right-5 top-1/2 -translate-y-1/2 text-[#64748B]/20 h-4 w-4" />
                                    </div>
                                </div>

                                {!isResetMode && (
                                    <>
                                        {/* Security Key */}
                                        <div className="group space-y-2 sm:space-y-3">
                                            <div className="flex items-center justify-between px-1">
                                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#64748B] group-focus-within:text-[#e86123] transition-colors">
                                                    Security Key
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsResetMode(true)}
                                                    className="text-[9px] font-black uppercase tracking-widest text-[#351e6a] hover:text-[#e86123] transition-colors"
                                                >
                                                    Forgot?
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type={
                                                        showPassword ? "text" : "password"
                                                    }
                                                    placeholder="••••••••••••"
                                                    value={signInForm.password}
                                                    onChange={(e) =>
                                                        setSignInForm({
                                                            ...signInForm,
                                                            password: e.target.value,
                                                        })
                                                    }
                                                    required
                                                    className="w-full bg-[#F1F5F9] border border-slate-200 rounded-2xl px-5 py-3.5 text-base font-bold text-[#1E293B] placeholder:text-[#64748B]/30 focus:bg-white focus:border-[#e86123] focus:ring-4 focus:ring-[#e86123]/10 outline-none transition-all shadow-sm tracking-[0.3em] h-14 sm:h-16"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setShowPassword(!showPassword)
                                                    }
                                                    className="absolute right-5 top-1/2 -translate-y-1/2 text-[#64748B]/30 hover:text-[#1E293B] transition-colors"
                                                >
                                                    {showPassword ? (
                                                        <EyeOff className="h-4 w-4" />
                                                    ) : (
                                                        <Eye className="h-4 w-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Remember Workstation */}
                                        <div className="flex items-center gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSignInForm({
                                                        ...signInForm,
                                                        rememberMe: !signInForm.rememberMe,
                                                    })
                                                }
                                                className="relative flex items-center cursor-pointer p-2 -ml-2"
                                            >
                                                <div
                                                    className={`w-8 h-4 rounded-full transition-all duration-300 ${signInForm.rememberMe ? "bg-[#e86123]" : "bg-slate-200"}`}
                                                />
                                                <div
                                                    className={`absolute left-2.5 top-2.5 w-3 h-3 bg-white rounded-full transition-all duration-300 shadow-sm ${signInForm.rememberMe ? "translate-x-4" : ""}`}
                                                />
                                            </button>
                                            <span className="text-[10px] font-black text-[#64748B]/60 uppercase tracking-[0.15em] cursor-default">
                                                Trust this workstation
                                            </span>
                                        </div>
                                    </>
                                )}

                                {/* Action Button */}
                                <div className="pt-4 sm:pt-6 space-y-4">
                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full h-14 sm:h-16 rounded-2xl bg-gradient-to-r from-[#e86123] to-[#351e6a] hover:shadow-lg hover:shadow-orange-500/20 text-white font-black text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-4 transition-all hover:-translate-y-1 active:scale-[0.98] border-none group"
                                    >
                                        {loading ? (
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                        ) : (
                                            <>
                                                {isResetMode ? "Dispatch Reset Link" : "Access Console"}{" "}
                                                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                            </>
                                        )}
                                    </Button>

                                    {isResetMode ? (
                                        <button
                                            type="button"
                                            onClick={() => setIsResetMode(false)}
                                            className="w-full h-14 sm:h-16 rounded-2xl bg-white border border-slate-200 text-[10px] font-black text-[#64748B] uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center justify-center gap-3 shadow-sm"
                                        >
                                            Cancel Recovery
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleGoogleSignIn}
                                            disabled={loading}
                                            className="w-full h-14 sm:h-16 rounded-2xl bg-white border border-slate-200 text-[10px] font-black text-[#64748B] uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-3 shadow-sm"
                                        >
                                            <svg
                                                className="w-4 h-4"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    fill="currentColor"
                                                    d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
                                                />
                                            </svg>
                                            Management Google Access
                                        </button>
                                    )}
                                </div>
                            </form>
                        )}

                        {/* Biometric Mockup */}
                        <div className="mt-12 sm:mt-16 pt-6 sm:pt-8 border-t border-slate-100 flex items-center justify-between opacity-50 hover:opacity-100 transition-all duration-500">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border border-slate-200 flex items-center justify-center text-[#e86123] bg-slate-50 shadow-inner">
                                    <Fingerprint className="h-5 w-5 sm:h-6 sm:h-6" />
                                </div>
                                <div>
                                    <p className="text-[8px] sm:text-[9px] font-black uppercase text-[#1E293B] tracking-widest leading-none mb-1">
                                        Fingerprint Ready
                                    </p>
                                    <p className="text-[7px] sm:text-[8px] text-[#64748B] font-bold uppercase tracking-tighter">
                                        Secure Biometric Port
                                    </p>
                                </div>
                            </div>
                            <ShieldCheck className="h-5 w-5 sm:h-6 sm:h-6 text-slate-200" />
                        </div>
                    </div>
                </div>
            </main>

            <footer className="hidden sm:block absolute bottom-6 left-0 w-full text-center px-4 pointer-events-none">
                <p className="text-[8px] font-black text-[#64748B]/40 uppercase tracking-[0.5em]">
                    Proprietary Administrative System © 2026 USTHAD ACADEMY
                </p>
            </footer>

            <style jsx>{`
                .orb {
                    pointer-events: none;
                }
            `}</style>
        </div>
    );
}
