"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { SalesReportingPage } from "@/components/sales-reporting-page";
import { supabase, Profile } from "@/lib/supabase";

export default function SalesPage() {
    const { user, profile, loading } = useAuth();
    const [liveProfile, setLiveProfile] = useState<Profile | null>(profile);
    const [isChecking, setIsChecking] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const checkAccess = async () => {
            if (loading) return;
            if (!user) {
                router.push("/");
                return;
            }

            try {
                const { data } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", user.id)
                    .single();

                const p = (data as Profile) || profile;
                setLiveProfile(p);

                // Access restricted strictly to CEO, Admins, or Sales Managers with explicit edit permission
                const hasAccess = p && (
                    p.role === "ceo" ||
                    (p.role as string) === "admin" ||
                    (p.role as string) === "administrator" ||
                    (p.is_manager && (
                        p.manager_permissions?.sales_permission === "edit" ||
                        p.manager_permissions?.sales_permission === "both" ||
                        p.manager_permissions?.can_update_staff_sales === true
                    )) ||
                    p.manager_permissions?.sales_permission === "edit" ||
                    p.manager_permissions?.can_update_staff_sales === true
                );

                if (!hasAccess) {
                    router.push("/staff");
                }
            } catch (err) {
                console.error("SalesPage access error:", err);
                router.push("/staff");
            } finally {
                setIsChecking(false);
            }
        };

        checkAccess();
    }, [user, profile, loading, router]);

    if (loading || isChecking) {
        return (
            <div className="min-h-screen flex items-center justify-center text-slate-400 uppercase font-black tracking-widest text-[10px]" style={{ backgroundColor: "#F4F7FE" }}>
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin h-8 w-8 border-2 border-[#2F1E73]/20 border-t-[#2F1E73] rounded-full" />
                    Loading Sales Command...
                </div>
            </div>
        );
    }

    return <SalesReportingPage />;
}
