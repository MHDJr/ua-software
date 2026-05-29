import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
    try {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers":
                "authorization, x-client-info, apikey, content-type",
        };

        if (req.method === "OPTIONS") {
            return new Response("ok", { headers: corsHeaders });
        }

        // 1. Fetch active profiles
        const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name, username, role, department, avatar_url, email")
            .neq("full_name", "[DELETED]");

        if (profilesError) throw profilesError;

        // 2. Fetch tasks for the current month aggregation
        const { data: tasks, error: tasksError } = await supabase
            .from("tasks")
            .select("assigned_to, status, title, created_at, updated_at");

        if (tasksError) throw tasksError;

        // 3. Compute stats per staff member
        const taskMap = new Map();
        tasks?.forEach((t) => {
            if (!t.assigned_to) return;
            if (!taskMap.has(t.assigned_to)) {
                taskMap.set(t.assigned_to, { total: 0, completed: 0 });
            }
            const stats = taskMap.get(t.assigned_to);
            stats.total++;
            const isCompleted = (t.status || "").toUpperCase() === "COMPLETED";
            if (isCompleted) stats.completed++;
        });

        // Format and sort staff data
        const staffData = (profiles || [])
            .map((p) => {
                const stats = taskMap.get(p.id) || { total: 0, completed: 0 };
                const yieldRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 100;
                return {
                    id: p.id,
                    name: p.full_name || p.username || "Unknown",
                    role: p.role || "Staff",
                    department: p.department || "Administration",
                    tasksTotal: stats.total,
                    tasksCompleted: stats.completed,
                    yieldRate,
                };
            });

        // Filter and sort for ranking
        const rankedStaff = [...staffData].sort((a, b) => {
            if (b.tasksCompleted !== a.tasksCompleted) {
                return b.tasksCompleted - a.tasksCompleted;
            }
            if (b.yieldRate !== a.yieldRate) {
                return b.yieldRate - a.yieldRate;
            }
            return b.tasksTotal - a.tasksTotal;
        });

        // 4. Calculate Employee of the Month
        const activePersonnel = rankedStaff.filter(s => s.tasksTotal > 0);
        const employeeOfTheMonth = activePersonnel.length > 0 ? activePersonnel[0] : rankedStaff[0];

        // 5. Aggregate Institutional Metrics
        const totalActiveStaff = staffData.length;
        const totalTasksAssigned = staffData.reduce((sum, s) => sum + s.tasksTotal, 0);
        const totalTasksCompleted = staffData.reduce((sum, s) => sum + s.tasksCompleted, 0);
        const operationalVelocity = totalTasksAssigned > 0 ? Math.round((totalTasksCompleted / totalTasksAssigned) * 100) : 100;

        // 6. Build the stunning HTML template
        const reportMonth = new Date().toLocaleString("en-US", { month: "long", year: "numeric" }).toUpperCase();
        
        let breakdownRows = "";
        rankedStaff.forEach((s, idx) => {
            const pending = s.tasksTotal - s.tasksCompleted;
            const rankLabel = idx === 0 ? "🥇 Rank 1" : idx === 1 ? "🥈 Rank 2" : idx === 2 ? "🥉 Rank 3" : `Rank ${idx + 1}`;
            breakdownRows += `
                <tr style="border-bottom: 1px solid #E5E7EB; text-transform: uppercase;">
                    <td style="padding: 12px 16px; font-size: 12px; font-weight: bold; color: #111827;">${rankLabel}</td>
                    <td style="padding: 12px 16px; font-size: 12px; font-weight: bold; color: #111827;">
                        <div>${s.name}</div>
                        <div style="font-size: 9px; font-weight: bold; color: #6B7280; margin-top: 2px;">${s.role} • ${s.department}</div>
                    </td>
                    <td style="padding: 12px 16px; font-size: 12px; text-align: center; color: #4B5563;">${s.tasksTotal}</td>
                    <td style="padding: 12px 16px; font-size: 12px; text-align: center; font-weight: bold; color: #059669;">${s.tasksCompleted}</td>
                    <td style="padding: 12px 16px; font-size: 12px; text-align: center; color: #6B7280;">${pending}</td>
                    <td style="padding: 12px 16px; font-size: 12px; text-align: right; font-weight: bold; color: #31267D;">${s.yieldRate}% Yield</td>
                </tr>
            `;
        });

        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Monthly Performance Report</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F3F4F6;">
            <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="border-collapse: collapse; margin-top: 40px; margin-bottom: 40px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #E5E7EB;">
                <!-- Header Top Bar -->
                <tr>
                    <td bgcolor="#31267D" style="padding: 24px 32px;">
                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                                <td>
                                    <h1 style="margin: 0; color: #FFFFFF; font-size: 18px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">MONTHLY PERFORMANCE BRIEFING</h1>
                                    <p style="margin: 4px 0 0 0; color: #F14D24; font-size: 9px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">Usthad Academy OS • Command Center</p>
                                </td>
                                <td align="right" style="color: #9CA3AF; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                                    ${reportMonth}
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>

                <!-- Content Area -->
                <tr>
                    <td style="padding: 32px;">
                        
                        <!-- Employee of the Month Highlight -->
                        ${employeeOfTheMonth ? `
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background: linear-gradient(135deg, #18181B 0%, #27272A 100%); border-radius: 12px; margin-bottom: 32px; border: 1px solid #3F3F46; box-shadow: 0 4px 10px rgba(0,0,0,0.15);">
                            <tr>
                                <td style="padding: 24px; color: #FFFFFF;">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <td>
                                                <span style="background-color: #F14D24; color: #FFFFFF; font-size: 9px; font-weight: 900; padding: 4px 8px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 1px;">EMPLOYEE OF THE MONTH</span>
                                                <h2 style="margin: 12px 0 4px 0; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px;">${employeeOfTheMonth.name}</h2>
                                                <p style="margin: 0; font-size: 11px; font-weight: bold; color: #D4D4D8; text-transform: uppercase; letter-spacing: 1px;">${employeeOfTheMonth.role} • ${employeeOfTheMonth.department}</p>
                                            </td>
                                            <td align="right" style="background-color: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); min-width: 130px;">
                                                <div style="font-size: 9px; font-weight: bold; color: #A1A1AA; text-transform: uppercase; letter-spacing: 1px;">Task Velocity</div>
                                                <div style="font-size: 24px; font-weight: 900; color: #FFFFFF; margin: 4px 0;">${employeeOfTheMonth.tasksCompleted} <span style="font-size: 10px; font-weight: normal; color: #A1A1AA;">Tasks Done</span></div>
                                                <div style="font-size: 10px; font-weight: bold; color: #34D399; text-transform: uppercase; letter-spacing: 1px;">${employeeOfTheMonth.yieldRate}% Yield Rate</div>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                        ` : ''}

                        <!-- Institutional Metrics Grid -->
                        <h4 style="margin: 0 0 12px 0; font-size: 11px; font-weight: 900; text-transform: uppercase; color: #9CA3AF; letter-spacing: 1.5px;">Institutional Performance</h4>
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
                            <tr>
                                <td width="23%" style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; text-align: center;">
                                    <div style="font-size: 8px; font-weight: 900; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px;">Active Staff</div>
                                    <div style="font-size: 20px; font-weight: 900; color: #111827; margin-top: 4px;">${totalActiveStaff}</div>
                                </td>
                                <td width="2%"></td>
                                <td width="23%" style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; text-align: center;">
                                    <div style="font-size: 8px; font-weight: 900; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px;">Assigned</div>
                                    <div style="font-size: 20px; font-weight: 900; color: #111827; margin-top: 4px;">${totalTasksAssigned}</div>
                                </td>
                                <td width="2%"></td>
                                <td width="23%" style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; text-align: center;">
                                    <div style="font-size: 8px; font-weight: 900; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px;">Completed</div>
                                    <div style="font-size: 20px; font-weight: 900; color: #059669; margin-top: 4px;">${totalTasksCompleted}</div>
                                </td>
                                <td width="2%"></td>
                                <td width="23%" style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; text-align: center;">
                                    <div style="font-size: 8px; font-weight: 900; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px;">Delays</div>
                                    <div style="font-size: 9px; font-weight: 900; color: #059669; background-color: #ECFDF5; border-radius: 9999px; padding: 2px 6px; margin-top: 6px; display: inline-block;">Stable</div>
                                </td>
                            </tr>
                        </table>

                        <!-- Full Yield Audit Table -->
                        <h4 style="margin: 0 0 12px 0; font-size: 11px; font-weight: 900; text-transform: uppercase; color: #9CA3AF; letter-spacing: 1.5px;">Personnel Yield Audit</h4>
                        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; background-color: #FFFFFF;">
                            <thead style="background-color: #F9FAFB; border-bottom: 1px solid #E5E7EB;">
                                <tr>
                                    <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: left; text-transform: uppercase; letter-spacing: 1px;">Rank</th>
                                    <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: left; text-transform: uppercase; letter-spacing: 1px;">Personnel Profile</th>
                                    <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: center; text-transform: uppercase; letter-spacing: 1px;">Assigned</th>
                                    <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: center; text-transform: uppercase; letter-spacing: 1px;">Completed</th>
                                    <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: center; text-transform: uppercase; letter-spacing: 1px;">Pending</th>
                                    <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: right; text-transform: uppercase; letter-spacing: 1px;">Yield</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${breakdownRows}
                            </tbody>
                        </table>

                    </td>
                </tr>

                <!-- Footer Bar -->
                <tr>
                    <td bgcolor="#1F2937" style="padding: 24px; text-align: center; color: #9CA3AF; font-size: 11px;">
                        <p style="margin: 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold;">Usthad Academy OS • Command Center</p>
                        <p style="margin: 4px 0 0 0; font-size: 9px; color: #6B7280;">This is a computer-generated performance record. Keep strictly confidential.</p>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `;

        // 7. Retrieve CEO & Manager emails
        const { data: managers, error: managersError } = await supabase
            .from("profiles")
            .select("email")
            .in("role", ["ceo", "manager"]);

        if (managersError) throw managersError;

        const recipientEmails = (managers || [])
            .map((m) => m.email)
            .filter((email): email is string => !!email);

        if (recipientEmails.length === 0) {
            recipientEmails.push("admin@usthadacademy.com"); // Fallback
        }

        // 8. Dispatch Email via Resend
        if (resendApiKey) {
            console.log(`Sending Monthly Report to recipients:`, recipientEmails);
            const resendResponse = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${resendApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: "Usthad Academy OS <onboarding@resend.dev>",
                    to: recipientEmails,
                    subject: `MONTHLY PERFORMANCE BRIEFING • ${reportMonth}`,
                    html: htmlContent,
                }),
            });

            if (!resendResponse.ok) {
                const errorText = await resendResponse.text();
                throw new Error(`Resend API error: ${errorText}`);
            }
            console.log("Monthly Report email dispatched successfully!");
        } else {
            console.warn("RESEND_API_KEY secret is not configured in Supabase. Email dispatch skipped.");
        }

        return new Response(
            JSON.stringify({
                success: true,
                totalActiveStaff,
                totalTasksAssigned,
                totalTasksCompleted,
                operationalVelocity,
                recipients: recipientEmails,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
        );

    } catch (error) {
        console.error("Monthly report edge function failure:", error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
