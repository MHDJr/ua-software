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

        // Fetch leave requests for month end leaves auditing
        const { data: leaves, error: leavesError } = await supabase
            .from("requests")
            .select("*, submitted_by:profiles!submitted_by(id, full_name, username, role, department)")
            .eq("type", "leave")
            .order("created_at", { ascending: false });

        if (leavesError) throw leavesError;

        // Fetch financial entries for the current month
        const currentMonthYYYYMM = new Date().toISOString().slice(0, 7); // YYYY-MM
        const { data: finEntries, error: finError } = await supabase
            .from("financial_entries")
            .select("*")
            .gte("entry_date", `${currentMonthYYYYMM}-01`)
            .order("entry_date", { ascending: false });

        if (finError) {
            console.error("Error fetching financial entries for monthly report:", finError);
        }

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

        // Explicitly include the CEO's webmail as requested
        if (!recipientEmails.includes("ceo@usthadacademy.com")) {
            recipientEmails.push("ceo@usthadacademy.com");
        }

        if (recipientEmails.length === 0) {
            recipientEmails.push("admin@usthadacademy.com"); // Fallback
        }

        // 8. Dispatch Emails via Resend & Perform Database Storage Cleanup
        if (resendApiKey) {
            console.log(`Sending Monthly Performance Report to recipients:`, recipientEmails);
            const resendResponse = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${resendApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: "Usthad Academy Executive <reports@usthadacademy.com>",
                    to: recipientEmails,
                    subject: `EXECUTIVE OPERATIONAL BRIEFING • ${reportMonth}`,
                    html: htmlContent,
                }),
            });

            if (!resendResponse.ok) {
                const errorText = await resendResponse.text();
                throw new Error(`Resend API error sending monthly report: ${errorText}`);
            }
            console.log("Monthly Performance Report email dispatched successfully!");

            // 8b. Construct and dispatch Monthly Leaves Report
            let leavesBreakdownRows = "";
            const leavesList = leaves || [];
            leavesList.forEach((req: any) => {
                const reqDate = new Date(req.created_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                });
                const staffName = req.submitted_by?.full_name || req.submitted_by?.username || "Unknown Staff";
                const dept = req.submitted_by?.department || "General";
                const role = req.submitted_by?.role || "Staff";
                const leaveTitle = req.title || "Leave Request";
                
                let desc = req.description || "";
                let cleanedReason = desc.replace(/^\[[^\]]+\]\s*/, "").trim();
                if (cleanedReason.includes("Reason:")) {
                    cleanedReason = cleanedReason.split("Reason:")[1]?.trim() || cleanedReason;
                }
                
                const statusStr = (req.status || "PENDING").toUpperCase();
                let statusBadgeColor = "color: #D97706; background-color: #FEF3C7;"; // yellow
                if (statusStr === "APPROVED") {
                    statusBadgeColor = "color: #059669; background-color: #D1FAE5;"; // green
                } else if (statusStr === "REJECTED" || statusStr === "DECLINED") {
                    statusBadgeColor = "color: #DC2626; background-color: #FEE2E2;"; // red
                }

                leavesBreakdownRows += `
                    <tr style="border-bottom: 1px solid #E5E7EB;">
                        <td style="padding: 12px 16px; font-size: 11px; color: #4B5563;">${reqDate}</td>
                        <td style="padding: 12px 16px; font-size: 11px; font-weight: bold; color: #111827;">
                            <div>${staffName}</div>
                            <div style="font-size: 9px; color: #6B7280; margin-top: 2px;">${role} • ${dept}</div>
                        </td>
                        <td style="padding: 12px 16px; font-size: 11px; color: #111827; font-weight: 500;">${leaveTitle}</td>
                        <td style="padding: 12px 16px; font-size: 11px; color: #4B5563; max-width: 200px; word-break: break-word;">${cleanedReason}</td>
                        <td style="padding: 12px 16px; font-size: 11px; text-align: right;">
                            <span style="font-size: 9px; font-weight: bold; padding: 4px 8px; border-radius: 9999px; ${statusBadgeColor}">${statusStr}</span>
                        </td>
                    </tr>
                `;
            });

            const leavesHtmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Monthly Leave Requests & Audit Report</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F3F4F6;">
                <table align="center" border="0" cellpadding="0" cellspacing="0" width="650" style="border-collapse: collapse; margin-top: 40px; margin-bottom: 40px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #E5E7EB;">
                    <tr>
                        <td bgcolor="#F14D24" style="padding: 24px 32px;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td>
                                        <h1 style="margin: 0; color: #FFFFFF; font-size: 17px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">MONTHLY LEAVE AUDIT BRIEFING</h1>
                                        <p style="margin: 4px 0 0 0; color: #FFFFFF; opacity: 0.8; font-size: 9px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">Usthad Academy OS • Command Center</p>
                                    </td>
                                    <td align="right" style="color: #FFFFFF; opacity: 0.8; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                                        ${reportMonth}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px;">
                            <h4 style="margin: 0 0 12px 0; font-size: 11px; font-weight: 900; text-transform: uppercase; color: #9CA3AF; letter-spacing: 1.5px;">Leaves Summary</h4>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
                                <tr>
                                    <td width="31%" style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; text-align: center;">
                                        <div style="font-size: 8px; font-weight: 900; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px;">Total Requests</div>
                                        <div style="font-size: 20px; font-weight: 900; color: #111827; margin-top: 4px;">${leavesList.length}</div>
                                    </td>
                                    <td width="3%"></td>
                                    <td width="31%" style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; text-align: center;">
                                        <div style="font-size: 8px; font-weight: 900; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px;">Approved</div>
                                        <div style="font-size: 20px; font-weight: 900; color: #059669; margin-top: 4px;">${leavesList.filter((l: any) => l.status === 'approved').length}</div>
                                    </td>
                                    <td width="3%"></td>
                                    <td width="31%" style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; text-align: center;">
                                        <div style="font-size: 8px; font-weight: 900; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px;">Rejected</div>
                                        <div style="font-size: 20px; font-weight: 900; color: #DC2626; margin-top: 4px;">${leavesList.filter((l: any) => l.status === 'rejected').length}</div>
                                    </td>
                                </tr>
                            </table>

                            <h4 style="margin: 0 0 12px 0; font-size: 11px; font-weight: 900; text-transform: uppercase; color: #9CA3AF; letter-spacing: 1.5px;">Detailed Leave Directives</h4>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; background-color: #FFFFFF;">
                                <thead style="background-color: #F9FAFB; border-bottom: 1px solid #E5E7EB;">
                                    <tr>
                                        <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: left; text-transform: uppercase; letter-spacing: 1px;">Date</th>
                                        <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: left; text-transform: uppercase; letter-spacing: 1px;">Staff Profile</th>
                                        <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: left; text-transform: uppercase; letter-spacing: 1px;">Leave Type</th>
                                        <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: left; text-transform: uppercase; letter-spacing: 1px;">Reason / Note</th>
                                        <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: right; text-transform: uppercase; letter-spacing: 1px;">Decision</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${leavesBreakdownRows || `<tr><td colspan="5" style="padding: 24px; text-align: center; color: #6B7280; font-size: 12px;">No leave requests recorded for this period.</td></tr>`}
                                </tbody>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td bgcolor="#1F2937" style="padding: 24px; text-align: center; color: #9CA3AF; font-size: 11px;">
                            <p style="margin: 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold;">Usthad Academy OS • Command Center</p>
                            <p style="margin: 4px 0 0 0; font-size: 9px; color: #6B7280;">This is an official leaves audit. Confidentiality required.</p>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            `;

            console.log(`Sending Monthly Leaves Report to recipients:`, recipientEmails);
            const leavesResendResponse = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${resendApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: "Usthad Academy OS <onboarding@resend.dev>",
                    to: recipientEmails,
                    subject: `MONTHLY LEAVE AUDIT BRIEFING • ${reportMonth}`,
                    html: leavesHtmlContent,
                }),
            });

            if (!leavesResendResponse.ok) {
                const errorText = await leavesResendResponse.text();
                throw new Error(`Resend API error sending monthly leaves report: ${errorText}`);
            }
            console.log("Monthly Leaves Report email dispatched successfully!");

            // 8c. Construct and dispatch Monthly Financial Report
            console.log("Constructing and dispatching Monthly Financial Report...");
            const entriesList = finEntries || [];
            const uloomxTotal = entriesList.reduce((sum: number, e: any) => sum + (parseFloat(e.uloomx_income) || 0), 0);
            const usthadTotal = entriesList.reduce((sum: number, e: any) => sum + (parseFloat(e.usthad_income) || 0), 0);
            const totalExpense = entriesList.reduce((sum: number, e: any) => sum + (parseFloat(e.total_expenses) || 0), 0);
            const balance = uloomxTotal + usthadTotal - totalExpense;

            // Formatter helper inside edge function
            const formatCurrencyEdge = (amount: number) => {
                return new Intl.NumberFormat("en-IN", {
                    style: "currency",
                    currency: "INR",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                }).format(amount);
            };

            let finBreakdownRows = "";
            entriesList.forEach((e: any) => {
                const dateStr = new Date(e.entry_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                });

                const usthadIncVal = parseFloat(e.usthad_income) || 0;
                const uloomxIncVal = parseFloat(e.uloomx_income) || 0;
                const expVal = parseFloat(e.total_expenses) || 0;
                const netVal = usthadIncVal + uloomxIncVal - expVal;

                finBreakdownRows += `
                    <tr style="border-bottom: 1px solid #E5E7EB;">
                        <td style="padding: 12px 16px; font-size: 11px; color: #4B5563;">${dateStr}</td>
                        <td style="padding: 12px 16px; font-size: 11px; color: #111827; font-weight: bold;">${formatCurrencyEdge(usthadIncVal)}</td>
                        <td style="padding: 12px 16px; font-size: 11px; color: #F14D24; font-weight: bold;">${formatCurrencyEdge(uloomxIncVal)}</td>
                        <td style="padding: 12px 16px; font-size: 11px; color: #DC2626;">${formatCurrencyEdge(expVal)}</td>
                        <td style="padding: 12px 16px; font-size: 11px; text-align: right; font-weight: bold; color: ${netVal >= 0 ? "#059669" : "#DC2626"};">
                            ${formatCurrencyEdge(netVal)}
                        </td>
                    </tr>
                `;
            });

            const finHtmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Monthly Financial Audit & Performance Report</title>
            </head>
            <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #F3F4F6;">
                <table align="center" border="0" cellpadding="0" cellspacing="0" width="650" style="border-collapse: collapse; margin-top: 40px; margin-bottom: 40px; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #E5E7EB;">
                    <tr>
                        <td bgcolor="#31267D" style="padding: 24px 32px;">
                            <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                <tr>
                                    <td>
                                        <h1 style="margin: 0; color: #FFFFFF; font-size: 17px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase;">MONTHLY FINANCIAL AUDIT BRIEFING</h1>
                                        <p style="margin: 4px 0 0 0; color: #FFFFFF; opacity: 0.8; font-size: 9px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">Usthad Academy OS • Financial Intelligence</p>
                                    </td>
                                    <td align="right" style="color: #FFFFFF; opacity: 0.8; font-size: 10px; font-weight: bold; text-transform: uppercase;">
                                        ${reportMonth}
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 32px;">
                            <h4 style="margin: 0 0 12px 0; font-size: 11px; font-weight: 900; text-transform: uppercase; color: #9CA3AF; letter-spacing: 1.5px;">Financial Cumulative Overview</h4>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 32px;">
                                <tr>
                                    <td width="23%" style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; text-align: center;">
                                        <div style="font-size: 8px; font-weight: 900; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px;">Usthad Revenue</div>
                                        <div style="font-size: 16px; font-weight: 900; color: #111827; margin-top: 4px;">${formatCurrencyEdge(usthadTotal)}</div>
                                    </td>
                                    <td width="2%"></td>
                                    <td width="23%" style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; text-align: center;">
                                        <div style="font-size: 8px; font-weight: 900; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px;">UloomX Revenue</div>
                                        <div style="font-size: 16px; font-weight: 900; color: #F14D24; margin-top: 4px;">${formatCurrencyEdge(uloomxTotal)}</div>
                                    </td>
                                    <td width="2%"></td>
                                    <td width="23%" style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; text-align: center;">
                                        <div style="font-size: 8px; font-weight: 900; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px;">Total Expenses</div>
                                        <div style="font-size: 16px; font-weight: 900; color: #DC2626; margin-top: 4px;">${formatCurrencyEdge(totalExpense)}</div>
                                    </td>
                                    <td width="2%"></td>
                                    <td width="23%" style="background-color: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 8px; padding: 16px; text-align: center;">
                                        <div style="font-size: 8px; font-weight: 900; color: #059669; text-transform: uppercase; letter-spacing: 1px;">Net Balance</div>
                                        <div style="font-size: 16px; font-weight: 900; color: #059669; margin-top: 4px;">${formatCurrencyEdge(balance)}</div>
                                    </td>
                                </tr>
                            </table>

                            <h4 style="margin: 0 0 12px 0; font-size: 11px; font-weight: 900; text-transform: uppercase; color: #9CA3AF; letter-spacing: 1.5px;">Detailed Financial Transactions</h4>
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden; background-color: #FFFFFF;">
                                <thead style="background-color: #F9FAFB; border-bottom: 1px solid #E5E7EB;">
                                    <tr>
                                        <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: left; text-transform: uppercase; letter-spacing: 1px;">Date</th>
                                        <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: left; text-transform: uppercase; letter-spacing: 1px;">Usthad Rev</th>
                                        <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: left; text-transform: uppercase; letter-spacing: 1px;">UloomX Rev</th>
                                        <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: left; text-transform: uppercase; letter-spacing: 1px;">Expenses</th>
                                        <th style="padding: 12px 16px; font-size: 9px; font-weight: 900; color: #9CA3AF; text-align: right; text-transform: uppercase; letter-spacing: 1px;">Net Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${finBreakdownRows || `<tr><td colspan="5" style="padding: 24px; text-align: center; color: #6B7280; font-size: 12px;">No transactions recorded for this period.</td></tr>`}
                                </tbody>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td bgcolor="#1F2937" style="padding: 24px; text-align: center; color: #9CA3AF; font-size: 11px;">
                            <p style="margin: 0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold;">Usthad Academy OS • Command Center</p>
                            <p style="margin: 4px 0 0 0; font-size: 9px; color: #6B7280;">This is an official financial audit briefing. Confidentiality required.</p>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
            `;

            const finResendResponse = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${resendApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: "Usthad Academy Finance <reports@usthadacademy.com>",
                    to: recipientEmails,
                    subject: `MONTHLY FINANCIAL AUDIT BRIEFING • ${reportMonth}`,
                    html: finHtmlContent,
                }),
            });

            if (!finResendResponse.ok) {
                const errorText = await finResendResponse.text();
                console.error(`Resend API error sending monthly financial report: ${errorText}`);
            } else {
                console.log("Monthly Financial Report email dispatched successfully!");
            }

            // 9. PERFORM MONTH-END DATA PURGING (CEO COMMANDS TO CLEAR STORAGE)
            console.log("All monthly reports sent successfully. Initiating database cleanup...");

            // 9a. Delete all completed tasks
            const { data: clearedTasks, error: taskCleanupError } = await supabase
                .from("tasks")
                .delete()
                .in("status", ["completed", "COMPLETED"])
                .select("id");

            if (taskCleanupError) {
                console.error("Month-end completed tasks deletion failure:", taskCleanupError);
            } else {
                console.log(`Successfully purged ${clearedTasks?.length || 0} completed tasks from database.`);
            }

            // 9b. Delete all old leave requests to save space (created before the current month)
            const firstDayOfCurrentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
            const { data: clearedLeaves, error: leavesCleanupError } = await supabase
                .from("requests")
                .delete()
                .eq("type", "leave")
                .lt("created_at", firstDayOfCurrentMonth)
                .select("id");

            if (leavesCleanupError) {
                console.error("Month-end leave requests deletion failure:", leavesCleanupError);
            } else {
                console.log(`Successfully purged ${clearedLeaves?.length || 0} leave request archives from database.`);
            }

        } else {
            console.warn("RESEND_API_KEY secret is not configured in Supabase. Email dispatch and cleanup skipped.");
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
