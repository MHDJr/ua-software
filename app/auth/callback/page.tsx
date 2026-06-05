"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        const handleCallback = async () => {
            const { error } = await supabase.auth.getSession();
            if (error) {
                console.error("Error during auth callback:", error);
            }
            router.push("/");
        };

        handleCallback();
    }, [router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8F9FC]">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin h-8 w-8 border-2 border-[#2D2A77]/20 border-t-[#2D2A77] rounded-full" />
                <p className="text-[10px] font-black uppercase tracking-widest text-[#2D2A77]">
                    Finalizing Authentication...
                </p>
            </div>
        </div>
    );
}
