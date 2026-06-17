import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            return NextResponse.json(
                { error: "Server Configuration Error: Missing database credentials." },
                { status: 500 }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });

        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

        const { data, error } = await supabaseAdmin
            .from("notifications")
            .delete()
            .eq("read", true)
            .not("read_at", "is", null)
            .lt("read_at", oneHourAgo);

        if (error) {
            console.error("[PurgeMessagesCron] Database delete error:", error.message);
            return NextResponse.json(
                { error: `Database purge failed: ${error.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true, message: "Read notifications older than 1 hour deleted successfully." });
    } catch (err: any) {
        console.error("[PurgeMessagesCron] Exception:", err);
        return NextResponse.json(
            { error: err.message || "Internal server error" },
            { status: 500 }
        );
    }
}
