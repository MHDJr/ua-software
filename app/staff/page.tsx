"use client";

import StaffPortal from "@/components/staff-portal";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StaffPage() {
    const { profile, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!profile) {
                router.replace("/");
            } else if (profile.role === "ceo") {
                router.replace("/ceo");
            }
        }
    }, [profile, loading, router]);

    if (loading || !profile) {
        return (
            <div className="min-h-screen bg-[#050505] flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-white/20 border-t-white rounded-full" />
            </div>
        );
    }

    return <StaffPortal />;
}
