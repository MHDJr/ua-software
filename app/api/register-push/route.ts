import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { user_id, subscription, device_info } = body;

        if (!user_id || !subscription) {
            return NextResponse.json(
                { error: "Missing required fields: user_id, subscription" },
                { status: 400 }
            );
        }

        // Initialize Supabase admin client (service role) to bypass RLS
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            console.error("[RegisterPushAPI] Server configuration error: Missing database credentials.");
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

        // 1. Verify that user profile exists in database
        const { data: profile, error: profileErr } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("id", user_id)
            .maybeSingle();

        if (profileErr || !profile) {
            return NextResponse.json(
                { error: "Forbidden: Target user profile does not exist." },
                { status: 403 }
            );
        }

        // 2. Check if this exact subscription is already registered for this user
        const { data: existing } = await supabaseAdmin
            .from("staff_push_tokens")
            .select("id")
            .eq("user_id", user_id)
            .eq("subscription", subscription)
            .maybeSingle();

        if (!existing) {
            // Insert new subscription
            const { error: insertError } = await supabaseAdmin
                .from("staff_push_tokens")
                .insert({
                    user_id,
                    subscription,
                    device_info: device_info || "Web Push Device",
                });

            if (insertError) {
                console.error("[RegisterPushAPI] Insert error:", insertError.message);
                return NextResponse.json(
                    { error: `Failed to insert push token: ${insertError.message}` },
                    { status: 500 }
                );
            }
            console.log(`[RegisterPushAPI] Registered new push token for user: ${user_id}`);
        } else {
            console.log(`[RegisterPushAPI] Push subscription already registered for user: ${user_id}`);
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("[RegisterPushAPI] Global exception:", err);
        return NextResponse.json(
            { error: err.message || "Internal server error" },
            { status: 500 }
        );
    }
}
