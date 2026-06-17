import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
    // 1. Hard Gate Check
    if (process.env.NEXT_PUBLIC_ENABLE_V2_FEATURES !== "true") {
        return NextResponse.json(
            { error: "Access Denied: V2 Features package is not enabled." },
            { status: 403 }
        );
    }

    try {
        const { taskId } = await req.json();

        if (!taskId) {
            return NextResponse.json(
                { error: "Missing required parameter: taskId" },
                { status: 400 }
            );
        }

        // 2. Initialize Service Role client to bypass RLS for database updates
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            console.error("[EscalateTask] Missing Supabase backend credentials (SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY).");
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

        // 3. Fetch Task info to get the assignee and title
        const { data: task, error: fetchError } = await serviceSupabase
            .from("tasks")
            .select("title, assigned_to")
            .eq("id", taskId)
            .single();

        if (fetchError || !task) {
            console.error("[EscalateTask] Task fetch error:", fetchError?.message || "Task not found");
            return NextResponse.json(
                { error: "Task not found or database fetch error." },
                { status: 404 }
            );
        }

        // 4. Perform database updates, log notifications, and trigger push worker in parallel
        const origin = req.nextUrl.origin;

        // a. Database Update (Update tasks table)
        const dbUpdatePromise = serviceSupabase
            .from("tasks")
            .update({
                is_escalated: true,
                priority: "urgent",
                updated_at: new Date().toISOString(),
                escalated_at: new Date().toISOString()
            })
            .eq("id", taskId);

        // b. Signal Feed Node (Insert to notifications table)
        const notificationPromise = serviceSupabase
            .from("notifications")
            .insert({
                user_id: task.assigned_to,
                title: "OPERATION ESCALATED",
                message: `OPERATION ESCALATED: "${task.title}" is critically overdue!`,
                type: "alert",
                read: false,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            });

        // c. Push Notification Dispatch
        const pushPromise = fetch(`${origin}/api/send-notification`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                user_id: task.assigned_to,
                title: "Critical Operational Delay",
                body: `CEO has escalated the task: ${task.title}. Action required immediately.`
            })
        }).then(async (res) => {
            if (!res.ok) {
                const text = await res.text();
                console.error(`[EscalateTask] Internal push invocation failed: ${text}`);
            } else {
                console.log("[EscalateTask] Internal push invocation dispatched successfully.");
            }
        }).catch((err) => {
            console.error("[EscalateTask] Exception invoking push endpoint:", err);
        });

        // Resolve all in parallel
        const [dbResult, notificationResult] = await Promise.all([
            dbUpdatePromise,
            notificationPromise,
            pushPromise
        ]);

        if (dbResult.error) {
            console.error("[EscalateTask] Task database update failed:", dbResult.error.message);
            return NextResponse.json(
                { error: `Database update failed: ${dbResult.error.message}` },
                { status: 500 }
            );
        }

        if (notificationResult.error) {
            console.warn("[EscalateTask] Notification log insertion failed:", notificationResult.error.message);
            // We do not fail the request if only the notification logging fails, but it is logged.
        }

        return NextResponse.json({
            success: true,
            message: "Task escalated successfully."
        });

    } catch (err: any) {
        console.error("[EscalateTask] Exception in route handler:", err);
        return NextResponse.json(
            { error: "Internal Server Error", details: err.message },
            { status: 500 }
        );
    }
}
