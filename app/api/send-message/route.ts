import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { sendPushNotification } from "@/lib/notifications";

export async function POST(req: NextRequest) {
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
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            console.error("[SendMessageAPI] Server configuration error: Missing database credentials.");
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
        // Sender identity is encoded in the message body as [sender_id:UUID]
        const match = typeof message === "string" ? message.match(/^\[sender_id:([\w-]+)\]/) : null;
        const senderId = match ? match[1] : null;

        if (senderId && senderId !== "all") {
            try {
                // Validate profiles in parallel to ensure sender has permission to message recipient
                const [{ data: senderProfile }, { data: recipientProfile }] = await Promise.all([
                    supabaseAdmin.from("profiles").select("*").eq("id", senderId).single(),
                    supabaseAdmin.from("profiles").select("*").eq("id", user_id).single()
                ]);

                if (senderProfile && recipientProfile) {
                    const senderRole = senderProfile.role?.toLowerCase();
                    const senderDept = senderProfile.department?.toLowerCase();
                    
                    // CEO and Managers (or Admins) can message anyone
                    const isSenderCeoOrManager = senderRole === "ceo" || senderProfile.is_manager || senderRole === "manager";
                    const isSenderAdmin = senderRole === "admin" || senderRole === "administrator" || 
                        ((senderDept === "administration" || senderDept === "admin") && (senderProfile.is_manager || senderRole === "manager"));

                    // If sender is regular staff, restrict recipient options
                    if (!isSenderCeoOrManager && !isSenderAdmin) {
                        const recRole = recipientProfile.role?.toLowerCase();
                        const recDept = recipientProfile.department?.toLowerCase();

                        const isRecCeo = recRole === "ceo";
                        const isRecAdmin = recRole === "admin" || recRole === "administrator" || 
                            ((recDept === "administration" || recDept === "admin") && (recipientProfile.is_manager || recRole === "manager"));
                        const isRecMyManager = (recipientProfile.is_manager === true || recRole === "manager") && recipientProfile.department === senderProfile.department;

                        if (!isRecCeo && !isRecAdmin && !isRecMyManager) {
                            return NextResponse.json(
                                { error: "Forbidden: Staff members can only communicate with the CEO, Administrators, or their Department Managers." },
                                { status: 403 }
                            );
                        }
                    }
                }
            } catch (err) {
                console.warn("[SendMessageAPI] Security validation skipped due to lookup error:", err);
            }
        }

        // Insert notification into the database
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

        // Trigger push notification using the unified notification engine
        try {
            // Clean message text if it has the sender prefix e.g. [sender_id:UUID]
            const cleanText = typeof message === "string" 
                ? message.replace(/^\[sender_id:[\w-]+\]/, "").trim() 
                : message;
            
            await sendPushNotification(
                user_id,
                title || "New Message Received",
                cleanText || "Check your messenger inbox for updates."
            );
        } catch (pushErr) {
            console.error("Failed to dispatch push notification:", pushErr);
        }

        return NextResponse.json({ success: true, data });
    } catch (err: any) {
        console.error("[SendMessageAPI] Global error:", err);
        return NextResponse.json(
            { error: err.message || "Internal server error" },
            { status: 500 }
        );
    }
}


