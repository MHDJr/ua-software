import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendPushNotification } from "@/lib/notifications";

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get("authorization");
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return NextResponse.json({ error: "Unauthorized: Missing token" }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        
        // Create authenticated Supabase client for safe RLS execution
        const clientSupabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        });

        // Get user session to identify sender
        const { data: { user }, error: authError } = await clientSupabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized: Invalid token" }, { status: 401 });
        }

        // Fetch user profile
        const { data: profile, error: profileError } = await clientSupabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        // Strict authorization check: Only CEO and Administrators (managers, accounts, admin department)
        const isAuthorized = 
            profile.role === 'ceo' || 
            profile.role === 'manager' || 
            profile.is_manager || 
            profile.role === 'accounts' || 
            profile.department?.toLowerCase() === 'administration' ||
            profile.department?.toLowerCase() === 'admin';

        if (!isAuthorized) {
            return NextResponse.json({ error: "Forbidden: Access restricted to CEO and Administrators" }, { status: 403 });
        }

        // Parse JSON payload
        const { prompt } = await req.json();
        if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
            return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
        }

        if (!process.env.GROQ_API_KEY) {
            return NextResponse.json({ error: "GROQ_API_KEY environment variable is not configured" }, { status: 500 });
        }

        // Query Groq API
        const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: [
                    {
                        role: "system",
                        content: `You are an elite, concise assistant for Vappi, the CEO of Usthad Academy. 
Your job is to read a natural language request from the CEO and translate it into a valid JSON object for database settlement.

CRITICAL INSTRUCTION: Your response must be written in simple, clear, everyday English. Do not use advanced business vocabulary, complex corporate jargon, or confusing sentence structures. Keep sentences short, direct, and completely effortless to understand at a 3-second glance.

You must output raw JSON ONLY with keys: 
- 'action' (e.g., 'CREATE_DIRECTIVE', 'LOG_FINANCE', 'CREATE_TASK', 'CREATE_IDEA')
- 'target_table'
- 'payload'
- 'message' (This is the confirmation message shown to Vappi. It MUST follow the Simple English constraint).

Target tables and fields:
1. 'ceo_directives': For broadcasts/announcements. Payload: 'title', 'message', 'priority' (low/medium/high).
2. 'tasks': For assigning work. Payload: 'title', 'description', 'priority', 'assigned_to_name', 'due_days'.
3. 'financial_entries': For income/expenses. Payload: 'uloomx_income', 'usthad_income', 'total_expenses', 'notes'.
4. 'ideas': For reminders/thoughts. Payload: 'title', 'content', 'priority'.

Return JSON only. No explanation, no markdown.`
                    },
                    {
                        role: "user",
                        content: prompt.trim()
                    }
                ],
                temperature: 0.1,
                response_format: { type: "json_object" }
            })
        });

        if (!groqResponse.ok) {
            const errText = await groqResponse.text();
            console.error("Groq API error response:", errText);
            return NextResponse.json({ error: "Failed to communicate with Groq AI API" }, { status: 502 });
        }

        const groqData = await groqResponse.json();
        const rawJsonString = groqData.choices?.[0]?.message?.content;
        if (!rawJsonString) {
            return NextResponse.json({ error: "AI returned empty response" }, { status: 500 });
        }

        // Parse AI response
        let aiResult;
        try {
            aiResult = JSON.parse(rawJsonString.trim());
        } catch (err) {
            console.error("Failed to parse JSON returned from Groq:", rawJsonString);
            return NextResponse.json({ error: "Failed to parse AI intent parsing structure" }, { status: 500 });
        }

        const { action, target_table, payload } = aiResult;
        if (!action || !target_table || !payload) {
            return NextResponse.json({ error: "AI response missing core routing keys", detail: aiResult }, { status: 500 });
        }

        let settlementResult: any = null;
        let finalActionMessage = "";

        // DATABASE SETTLEMENT LOOP
        if (target_table === "ceo_directives") {
            const directivePayload = {
                title: payload.title || "EXECUTIVE DIRECTIVE",
                message: payload.message || payload.content || prompt,
                priority: payload.priority || "medium",
                target_all_staff: payload.target_all_staff ?? true,
                assigned_to: payload.assigned_to || "MANAGER",
                sender_id: user.id,
                sender_name: profile.full_name || "CEO",
                is_active: true,
                expires_at: payload.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Default 7 days
            };

            const { data, error } = await clientSupabase
                .from("ceo_directives")
                .insert(directivePayload)
                .select()
                .single();

            if (error) throw error;
            settlementResult = data;
            finalActionMessage = aiResult.message || `Created your directive: "${directivePayload.title}"`;

            // Broadcast to notifications if targeted to all staff
            if (directivePayload.target_all_staff) {
                await clientSupabase.from("notifications").insert({
                    title: "EXECUTIVE DIRECTIVE",
                    message: directivePayload.message,
                    read: false,
                    notification_type: "directive"
                });
            }

        } else if (target_table === "tasks") {
            let assigneeId: string | null = null;

            // Resolve name to user ID
            if (payload.assigned_to_name) {
                const { data: matchedProfiles } = await clientSupabase
                    .from("profiles")
                    .select("id, full_name")
                    .ilike("full_name", `%${payload.assigned_to_name}%`)
                    .limit(5);

                if (matchedProfiles && matchedProfiles.length > 0) {
                    assigneeId = matchedProfiles[0].id;
                } else {
                    assigneeId = user.id;
                }
            } else {
                assigneeId = user.id;
            }

            // Calculate due date
            let dueDate: string | null = null;
            if (payload.due_days) {
                dueDate = new Date(Date.now() + payload.due_days * 24 * 60 * 60 * 1000).toISOString();
            } else {
                dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // Default 3 days
            }

            const taskPayload = {
                title: payload.title || "New Task",
                description: payload.description || prompt,
                priority: payload.priority || "medium",
                assigned_to: assigneeId,
                status: "pending",
                due_date: dueDate,
                created_by: user.id,
                created_at: new Date().toISOString(),
                subtasks: JSON.stringify([])
            };

            const { data, error } = await clientSupabase
                .from("tasks")
                .insert(taskPayload)
                .select()
                .single();

            if (error) throw error;
            settlementResult = data;
            finalActionMessage = aiResult.message || `Task "${taskPayload.title}" is now active.`;

            // Notify assignee if not assigning to self
            if (assigneeId !== user.id) {
                await clientSupabase.from("notifications").insert({
                    user_id: assigneeId,
                    title: "NEW TASK DEPLOYED",
                    message: `CEO assigned task: "${taskPayload.title}".`,
                    read: false,
                    notification_type: "task"
                });

                // Trigger push notification using the unified notification engine
                try {
                    await sendPushNotification(
                        assigneeId,
                        "NEW TASK DEPLOYED",
                        `CEO assigned task: "${taskPayload.title}". Check dashboard monitor.`
                    );
                } catch (pushErr) {
                    console.error("Failed to dispatch task push notification:", pushErr);
                }
            }

        } else if (target_table === "financial_entries") {
            const financePayload = {
                user_id: user.id,
                uloomx_income: Number(payload.uloomx_income) || 0,
                usthad_income: Number(payload.usthad_income) || 0,
                total_expenses: Number(payload.total_expenses) || 0,
                notes: payload.notes || prompt,
                status: "approved", // Pre-approved since it is logged by admin/CEO
                submitted_by: user.id,
                entry_date: new Date().toISOString().split("T")[0]
            };

            const { data, error } = await clientSupabase
                .from("financial_entries")
                .insert(financePayload)
                .select()
                .single();

            if (error) throw error;
            settlementResult = data;
            finalActionMessage = aiResult.message || `Finance record saved successfully.`;

        } else if (target_table === "ideas") {
            const ideaPayload = {
                title: payload.title || "Captured Idea",
                content: payload.content || prompt,
                priority: payload.priority || "medium",
                status: "directive",
                created_by: user.id,
                shared_with: [],
                archived: false,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // Default 30 days
            };

            const { data, error } = await clientSupabase
                .from("ideas")
                .insert(ideaPayload)
                .select()
                .single();

            if (error) throw error;
            settlementResult = data;
            finalActionMessage = aiResult.message || `Saved your idea: "${ideaPayload.title}"`;
        } else {
            return NextResponse.json({ error: `Table '${target_table}' settlement is not supported` }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            action,
            target_table,
            message: finalActionMessage,
            data: settlementResult
        });

    } catch (error: any) {
        console.error("Error in command API route handler:", error);
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
    }
}
