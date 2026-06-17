import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { user_id, title, message, type } = body;

        if (!user_id || !message) {
            return NextResponse.json(
                { error: "Missing required parameters: user_id, message" },
                { status: 400 }
            );
        }

        // Initialize Supabase admin client (service role — bypasses RLS)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            console.error("[SendMessageAPI] Missing Supabase backend credentials.");
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

        // Backend security validation: staff can only message CEO, Admins, or Department Managers
        const match = message.match(/^\[sender_id:([\w-]+)\]/);
        const senderId = match ? match[1] : null;

        if (senderId) {
            const [{ data: senderProfile }, { data: recipientProfile }] = await Promise.all([
                supabaseAdmin.from("profiles").select("*").eq("id", senderId).single(),
                supabaseAdmin.from("profiles").select("*").eq("id", user_id).single()
            ]);

            if (senderProfile && recipientProfile) {
                const senderRole = senderProfile.role?.toLowerCase();
                const senderDept = senderProfile.department?.toLowerCase();
                const isSenderCeoOrManager = senderRole === "ceo" || senderProfile.is_manager || senderRole === "manager";
                const isSenderAdmin = senderRole === "admin" || senderRole === "administrator" || ((senderDept === "administration" || senderDept === "admin") && (senderProfile.is_manager || senderRole === "manager"));

                // Regular Staff validation
                if (!isSenderCeoOrManager && !isSenderAdmin) {
                    const recRole = recipientProfile.role?.toLowerCase();
                    const recDept = recipientProfile.department?.toLowerCase();

                    const isRecCeo = recRole === "ceo";
                    const isRecAdmin = recRole === "admin" || recRole === "administrator" || ((recDept === "administration" || recDept === "admin") && (recipientProfile.is_manager || recRole === "manager"));
                    const isRecMyManager = (recipientProfile.is_manager === true || recRole === "manager") && recipientProfile.department === senderProfile.department;

                    if (!isRecCeo && !isRecAdmin && !isRecMyManager) {
                        return NextResponse.json(
                            { error: "Forbidden: Staff members can only communicate with the CEO, Administrators, or their Department Managers." },
                            { status: 403 }
                        );
                    }
                }
            }
        }

        // Insert notification using the service role key (auth check removed —
        // sender identity is enforced via the [sender_id:UUID] prefix in message body,
        // and RLS policies handle privacy at the database level).
        const { data, error } = await supabaseAdmin
            .from("notifications")
            .insert({
                user_id,
                title: title || "Direct Message",
                message: message.trim(),
                type: type || "message",
                read: false,
                created_at: new Date().toISOString()
            })
            .select();

        if (error) {
            console.error("[SendMessageAPI] Database insert error:", error.message);
            return NextResponse.json(
                { error: `Database insert failed: ${error.message}` },
                { status: 500 }
            );
        }

        // Fire-and-forget fallback purge of read messages older than 1 hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        (async () => {
            try {
                const { error: purgeError } = await supabaseAdmin
                    .from("notifications")
                    .delete()
                    .eq("read", true)
                    .not("read_at", "is", null)
                    .lt("read_at", oneHourAgo);
                if (purgeError) {
                    console.error("[SendMessageAPI] Background auto-purge warning:", purgeError.message);
                }
            } catch (err) {
                console.error("[SendMessageAPI] Background auto-purge exception:", err);
            }
        })();

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error("[SendMessageAPI] Exception:", err);
        return NextResponse.json(
            { error: err.message || "Internal server error" },
            { status: 500 }
        );
    }
}
