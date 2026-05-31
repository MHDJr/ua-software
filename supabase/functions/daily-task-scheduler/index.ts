import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
    try {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers":
                "authorization, x-client-info, apikey, content-type",
        };

        // Only allow POST requests
        if (req.method === "OPTIONS") {
            return new Response("ok", { headers: corsHeaders });
        }

        // Get all active daily task templates
        const { data: templates, error: templateError } = await supabase
            .from("daily_task_templates")
            .select("*")
            .eq("is_active", true);

        if (templateError) {
            console.error("Error fetching templates:", templateError);
            return new Response(
                JSON.stringify({ error: templateError.message }),
                {
                    status: 500,
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                },
            );
        }

        const today = new Date().toISOString().split("T")[0];
        let tasksCreated = 0;

        // Create tasks for each template
        for (const template of templates || []) {
            // Check if task already exists for today
            const { data: existingTask } = await supabase
                .from("tasks")
                .select("id")
                .eq("assigned_to", template.staff_id)
                .eq("title", template.task_title)
                .gte("created_at", `${today}T00:00:00Z`)
                .lt("created_at", `${today}T23:59:59Z`)
                .maybeSingle();

            if (!existingTask) {
                const { error: insertError } = await supabase
                    .from("tasks")
                    .insert({
                        title: template.task_title,
                        description: template.task_description,
                        assigned_to: template.staff_id,
                        priority: template.priority || "medium",
                        created_by: template.created_by,
                        repeat_daily: true,
                        is_daily_task: true,
                        due_date: today,
                    });

                if (!insertError) {
                    tasksCreated++;

                    // Notify staff about new daily task
                    await supabase.from("notifications").insert({
                        user_id: template.staff_id,
                        title: "NEW DAILY TASK ASSIGNED",
                        message: `Your daily task: ${template.task_title}`,
                        type: "task",
                    });
                }
            }
        }

        // Check for overdue tasks and notify CEO
        const { data: overdueTasks, error: overdueError } = await supabase
            .from("tasks")
            .select("*, assigned_to:profiles!assigned_to(full_name, email)")
            .eq("status", "pending")
            .lt("due_date", today)
            .eq("overdue_notified", false);

        if (!overdueError && overdueTasks && overdueTasks.length > 0) {
            // Get CEO profile
            const { data: ceo } = await supabase
                .from("profiles")
                .select("id, email")
                .eq("role", "ceo")
                .maybeSingle();

            if (ceo) {
                const overdueList = overdueTasks
                    .map(
                        (t) =>
                            `- ${t.title} (${(t.assigned_to as any)?.full_name || "Unknown"})`,
                    )
                    .join("\n");

                // Notify CEO about overdue tasks
                await supabase.from("notifications").insert({
                    user_id: ceo.id,
                    title: "⚠️ OVERDUE TASKS ALERT",
                    message: `The following tasks are overdue:\n${overdueList}`,
                    type: "alert",
                });

                // Mark tasks as notified
                for (const task of overdueTasks) {
                    await supabase
                        .from("tasks")
                        .update({ overdue_notified: true })
                        .eq("id", task.id);
                }
            }
        }

        // --- 24-HOUR AUTO-CLEANUP LOGIC ---
        // Completed tasks and requests cleanup has been deferred to the end of the month
        // inside the monthly-report Edge Function to guarantee complete monthly reporting metrics.
        console.log("Daily task scheduler cleanup skipped (deferred to monthly-report function).");
        // --- END CLEANUP ---

        return new Response(
            JSON.stringify({
                success: true,
                tasksCreated,
                overdueNotified: overdueTasks?.length || 0,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );
    } catch (error) {
        console.error("Daily task scheduler error:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
