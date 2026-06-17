import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// Initialize web-push details if keys are present
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
    webpush.setVapidDetails(
        "mailto:support@usthadacademy.com",
        vapidPublicKey,
        vapidPrivateKey
    );
}

export async function POST(req: NextRequest) {
    // 1. Hard Gate Check
    if (process.env.NEXT_PUBLIC_ENABLE_V2_FEATURES !== "true") {
        return NextResponse.json(
            { error: "Access Denied: V2 Features package is not enabled." },
            { status: 403 }
        );
    }

    try {
        const bodyData = await req.json();
        const { user_id, title, body } = bodyData;

        if (!user_id || !title || !body) {
            return NextResponse.json(
                { error: "Missing required parameters: user_id, title, body" },
                { status: 400 }
            );
        }

        // 2. Initialize Service Role client to bypass RLS for systemic dispatch
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            console.error("[SendNotification] Missing Supabase backend keys (SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY).");
            return NextResponse.json(
                { error: "Server Configuration Error: Missing database credentials." },
                { status: 500 }
            );
        }

        const serviceSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });

        // 3. Look up active push tokens for target employee
        const { data: tokens, error: fetchError } = await serviceSupabase
            .from("staff_push_tokens")
            .select("id, subscription")
            .eq("user_id", user_id);

        if (fetchError) {
            console.error("[SendNotification] Error fetching tokens:", fetchError.message);
            return NextResponse.json(
                { error: "Database error fetching recipient credentials." },
                { status: 500 }
            );
        }

        if (!tokens || tokens.length === 0) {
            return NextResponse.json(
                { success: true, message: "No active push tokens registered for recipient." }
            );
        }

        console.log(`[SendNotification] Dispatching push to ${tokens.length} active devices for user: ${user_id}`);

        // 4. Dispatch Web Push notifications in parallel
        const payload = JSON.stringify({ title, body });
        
        const sendPromises = tokens.map(async (tokenRow: any) => {
            try {
                // Ensure subscription matches the expected web-push format
                await webpush.sendNotification(tokenRow.subscription, payload);
            } catch (err: any) {
                console.error(`[SendNotification] Failed dispatching push to token ID ${tokenRow.id}:`, err);
                
                // If token is expired or gone (410 Gone / 404 Not Found), delete it immediately
                if (err.statusCode === 410 || err.statusCode === 404) {
                    console.log(`[SendNotification] Removing stale/expired push token Row: ${tokenRow.id}`);
                    await serviceSupabase
                        .from("staff_push_tokens")
                        .delete()
                        .eq("id", tokenRow.id);
                }
            }
        });

        await Promise.all(sendPromises);

        return NextResponse.json({
            success: true,
            message: `Dispatched notifications to active devices.`,
        });

    } catch (err: any) {
        console.error("[SendNotification] Exception in route handler:", err);
        return NextResponse.json(
            { error: "Internal Server Error", details: err.message },
            { status: 500 }
        );
    }
}
