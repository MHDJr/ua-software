import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resend } from "@/lib/resend";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        // 1. Access Protection: Read and verify the 'authorization' header
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // 2. Initialize Supabase Admin client
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            console.error("[SendCeoReport] Server configuration error: Missing database credentials.");
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

        // 3. Dynamic Previous Month Date Matching
        const now = new Date();
        const targetDate = new Date(now.getFullYear(), now.getMonth(), 0);
        const targetYear = targetDate.getFullYear();
        const targetMonth = targetDate.getMonth(); // 0-indexed representation of the concluded month

        const firstDayOfMonth = new Date(targetYear, targetMonth, 1).toISOString().split("T")[0];
        const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).toISOString().split("T")[0];
        const monthNameString = targetDate.toLocaleString("default", { month: "long", year: "numeric" });

        const queryMonth = targetMonth + 1;

        // 4. Query Data Directly from Supabase Tables
        
        // 4a. Fetch Finance Data
        let financeData: any[] = [];
        try {
            const { data, error } = await supabaseAdmin
                .from("financial_entries")
                .select("entry_date, uloomx_income, usthad_income, total_expenses, revenue, status, notes")
                .gte("entry_date", firstDayOfMonth)
                .lte("entry_date", lastDayOfMonth)
                .order("entry_date", { ascending: true });
            if (!error) financeData = data || [];
        } catch (err) {
            console.error("[SendCeoReport] Finance fetch error:", err);
        }

        // 4b. Fetch Sales Data
        let salesData: any[] = [];
        try {
            const { data, error } = await supabaseAdmin
                .from("daily_sales_tracking")
                .select("tracking_date, total_leads, conversions, lost_leads, lead_quality_rating, profile:profiles!profile_id(full_name)")
                .gte("tracking_date", firstDayOfMonth)
                .lte("tracking_date", lastDayOfMonth)
                .order("tracking_date", { ascending: true });
            if (!error) salesData = data || [];
        } catch (err) {
            console.error("[SendCeoReport] Sales fetch error:", err);
        }

        // 4c. Fetch Leave Data
        let leaveData: any[] = [];
        try {
            const { data, error } = await supabaseAdmin
                .from("requests")
                .select("created_at, title, dates, total_days, status, purpose, profile:profiles!submitted_by(full_name)")
                .eq("type", "leave")
                .gte("created_at", `${firstDayOfMonth}T00:00:00Z`)
                .lte("created_at", `${lastDayOfMonth}T23:59:59Z`)
                .order("created_at", { ascending: true });
            if (!error) leaveData = data || [];
        } catch (err) {
            console.error("[SendCeoReport] Leave fetch error:", err);
        }

        // 4d. Fetch Tasks Data
        let tasksData: any[] = [];
        try {
            const { data, error } = await supabaseAdmin
                .from("tasks")
                .select("created_at, title, priority, status, profile:profiles!assigned_to(full_name)")
                .gte("created_at", `${firstDayOfMonth}T00:00:00Z`)
                .lte("created_at", `${lastDayOfMonth}T23:59:59Z`)
                .order("created_at", { ascending: true });
            if (!error) tasksData = data || [];
        } catch (err) {
            console.error("[SendCeoReport] Tasks fetch error:", err);
        }

        // 5. Build HTML tables from fetched database rows
        
        // 5a. Render Finance HTML
        let financeRowsHTML = "";
        let totalUloomx = 0, totalUsthad = 0, totalExp = 0, totalNet = 0;
        if (financeData.length > 0) {
            financeData.forEach((row: any) => {
                const uloomx = parseFloat(row.uloomx_income) || 0;
                const usthad = parseFloat(row.usthad_income) || 0;
                const exp = parseFloat(row.total_expenses) || 0;
                const net = parseFloat(row.revenue) || (uloomx + usthad - exp);
                
                totalUloomx += uloomx;
                totalUsthad += usthad;
                totalExp += exp;
                totalNet += net;

                financeRowsHTML += `
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; font-family:Courier, monospace;">${row.entry_date}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; text-align:right; font-family:Courier, monospace;">$${uloomx.toFixed(2)}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; text-align:right; font-family:Courier, monospace;">$${usthad.toFixed(2)}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; text-align:right; font-family:Courier, monospace;">$${exp.toFixed(2)}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; text-align:right; font-weight:bold; color:${net >= 0 ? "#10B981" : "#EF4444"}; font-family:Courier, monospace;">$${net.toFixed(2)}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:12px; text-align:center; color:#F59E0B; font-weight:bold;">${(row.status || "pending").toUpperCase()}</td>
                    </tr>
                `;
            });
            financeRowsHTML += `
                <tr style="background-color:#F1F5F9; font-weight:bold;">
                    <td style="padding:10px; border-top:2px solid #cbd5e1; font-size:13px;">Total Summary</td>
                    <td style="padding:10px; border-top:2px solid #cbd5e1; font-size:13px; text-align:right; font-family:Courier, monospace;">$${totalUloomx.toFixed(2)}</td>
                    <td style="padding:10px; border-top:2px solid #cbd5e1; font-size:13px; text-align:right; font-family:Courier, monospace;">$${totalUsthad.toFixed(2)}</td>
                    <td style="padding:10px; border-top:2px solid #cbd5e1; font-size:13px; text-align:right; font-family:Courier, monospace;">$${totalExp.toFixed(2)}</td>
                    <td style="padding:10px; border-top:2px solid #cbd5e1; font-size:13px; text-align:right; color:${totalNet >= 0 ? "#10B981" : "#EF4444"}; font-family:Courier, monospace;">$${totalNet.toFixed(2)}</td>
                    <td style="padding:10px; border-top:2px solid #cbd5e1; font-size:13px;"></td>
                </tr>
            `;
        } else {
            financeRowsHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:#64748b; font-style:italic;">No financial transactions recorded for this period.</td></tr>`;
        }

        // 5b. Render Sales HTML
        let salesRowsHTML = "";
        let totalLeads = 0, totalConversions = 0, totalLost = 0, sumQuality = 0;
        if (salesData.length > 0) {
            salesData.forEach((row: any) => {
                const repName = row.profile?.full_name || "Sales Rep";
                const leads = parseInt(row.total_leads) || 0;
                const conv = parseInt(row.conversions) || 0;
                const lost = parseInt(row.lost_leads) || 0;
                const qual = parseInt(row.lead_quality_rating) || 0;

                totalLeads += leads;
                totalConversions += conv;
                totalLost += lost;
                sumQuality += qual;

                salesRowsHTML += `
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; font-family:Courier, monospace;">${row.tracking_date}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:bold; color:#0F172A;">${repName}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; text-align:center; font-family:Courier, monospace;">${leads}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; text-align:center; font-family:Courier, monospace;">${conv}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; text-align:center; font-family:Courier, monospace;">${lost}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; text-align:center; font-weight:bold; color:#4F46E5; font-family:Courier, monospace;">${qual}/10</td>
                    </tr>
                `;
            });
            const avgQuality = salesData.length > 0 ? (sumQuality / salesData.length).toFixed(1) : "0";
            salesRowsHTML += `
                <tr style="background-color:#F1F5F9; font-weight:bold;">
                    <td style="padding:10px; border-top:2px solid #cbd5e1; font-size:13px;">Total Summary</td>
                    <td style="padding:10px; border-top:2px solid #cbd5e1; font-size:13px;"></td>
                    <td style="padding:10px; border-top:2px solid #cbd5e1; font-size:13px; text-align:center; font-family:Courier, monospace;">${totalLeads}</td>
                    <td style="padding:10px; border-top:2px solid #cbd5e1; font-size:13px; text-align:center; font-family:Courier, monospace;">${totalConversions}</td>
                    <td style="padding:10px; border-top:2px solid #cbd5e1; font-size:13px; text-align:center; font-family:Courier, monospace;">${totalLost}</td>
                    <td style="padding:10px; border-top:2px solid #cbd5e1; font-size:13px; text-align:center; font-family:Courier, monospace;">${avgQuality}/10 Avg</td>
                </tr>
            `;
        } else {
            salesRowsHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:#64748b; font-style:italic;">No sales tracking records found for this period.</td></tr>`;
        }

        // 5c. Render Leave HTML
        let leaveRowsHTML = "";
        if (leaveData.length > 0) {
            leaveData.forEach((row: any) => {
                const dateStr = new Date(row.created_at).toISOString().split("T")[0];
                const name = row.profile?.full_name || "Staff";
                const leaveDates = row.dates || "N/A";
                const days = row.total_days || 0;
                const purpose = row.purpose || "N/A";
                const status = row.status || "pending";
                const statusColor = status === "approved" || status === "APPROVED" ? "#10B981" : status === "rejected" || status === "REJECTED" ? "#EF4444" : "#F59E0B";

                leaveRowsHTML += `
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; font-family:Courier, monospace;">${dateStr}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:bold; color:#0F172A;">${name}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px;">${leaveDates}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; text-align:center; font-family:Courier, monospace;">${days}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px;">${purpose}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:12px; text-align:center; font-weight:bold; color:${statusColor};">${status.toUpperCase()}</td>
                    </tr>
                `;
            });
        } else {
            leaveRowsHTML = `<tr><td colspan="6" style="padding:20px; text-align:center; color:#64748b; font-style:italic;">No leave requests logged during this period.</td></tr>`;
        }

        // 5d. Render Tasks HTML
        let tasksRowsHTML = "";
        if (tasksData.length > 0) {
            tasksData.forEach((row: any) => {
                const dateStr = new Date(row.created_at).toISOString().split("T")[0];
                const name = row.profile?.full_name || "Staff";
                const title = row.title || "Untitled Task";
                const priority = row.priority || "medium";
                const status = row.status || "pending";
                
                const priorityColor = priority === "high" || priority === "HIGH" ? "#EF4444" : priority === "low" || priority === "LOW" ? "#94A3B8" : "#F59E0B";
                const statusColor = status === "completed" || status === "COMPLETED" ? "#10B981" : "#F59E0B";

                tasksRowsHTML += `
                    <tr>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; font-family:Courier, monospace;">${dateStr}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px; font-weight:bold; color:#0F172A;">${name}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:13px;">${title}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:12px; text-align:center; font-weight:bold; color:${priorityColor};">${priority.toUpperCase()}</td>
                        <td style="padding:10px; border-bottom:1px solid #e2e8f0; font-size:12px; text-align:center; font-weight:bold; color:${statusColor};">${status.toUpperCase()}</td>
                    </tr>
                `;
            });
        } else {
            tasksRowsHTML = `<tr><td colspan="5" style="padding:20px; text-align:center; color:#64748b; font-style:italic;">No tasks created during this period.</td></tr>`;
        }

        // 6. Resend Integration verification
        if (!resend) {
            console.error("[SendCeoReport] Resend client not initialized (check RESEND_API_KEY)");
            return NextResponse.json(
                { error: "Resend client is not initialized. Please configure RESEND_API_KEY." },
                { status: 500 }
            );
        }

        const overallConversionRate = totalLeads > 0 ? ((totalConversions / totalLeads) * 100).toFixed(1) + "%" : "0.0%";
        const overallAvgQuality = salesData.length > 0 ? (sumQuality / salesData.length).toFixed(1) : "N/A";

        // 7. Build premium HTML email content with direct database data tables embedded
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Monthly Executive Operations Briefing</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f5f7; padding:40px 20px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:800px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.05); border:1px solid #e2e8f0;">
                    <!-- Header -->
                    <tr>
                        <td bgcolor="#31267D" style="padding:32px 40px; text-align:left;">
                            <span style="font-size:11px; font-weight:800; text-transform:uppercase; color:#a5b4fc; letter-spacing:2px; display:block; margin-bottom:4px;">Executive Briefing</span>
                            <h1 style="margin:0; font-size:26px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">Usthad Academy - Monthly Executive Operational Brief</h1>
                            <p style="margin:6px 0 0 0; font-size:14px; color:#c7d2fe;">Billing Period: ${monthNameString}</p>
                        </td>
                    </tr>
                    
                    <!-- Content Body -->
                    <tr>
                        <td style="padding:40px;">
                            <h2 style="margin:0 0 16px 0; font-size:18px; font-weight:700; color:#0f172a; border-bottom:2px solid #f1f5f9; padding-bottom:8px;">Executive Summary</h2>
                            <p style="margin:0 0 32px 0; font-size:14px; line-height:1.6; color:#475569;">
                                Dear Executive Board,<br/><br/>
                                Below is the fully compiled multi-departmental executive ledger for **${monthNameString}**. This report has been compiled directly from live database transactions and compiled in-body to guarantee delivery.
                            </p>
 
                             <!-- Sales KPI Summary Cards -->
                             <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:40px;">
                                 <tr>
                                     <td width="23%" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px; text-align:center;">
                                         <span style="font-size:10px; font-weight:700; text-transform:uppercase; color:#64748b; display:block; margin-bottom:4px;">Total Leads</span>
                                         <span style="font-size:20px; font-weight:800; color:#31267D;">${totalLeads}</span>
                                     </td>
                                     <td width="2%"></td>
                                     <td width="23%" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px; text-align:center;">
                                         <span style="font-size:10px; font-weight:700; text-transform:uppercase; color:#64748b; display:block; margin-bottom:4px;">Conversions</span>
                                         <span style="font-size:20px; font-weight:800; color:#10B981;">${totalConversions}</span>
                                     </td>
                                     <td width="2%"></td>
                                     <td width="23%" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px; text-align:center;">
                                         <span style="font-size:10px; font-weight:700; text-transform:uppercase; color:#64748b; display:block; margin-bottom:4px;">Conv. Rate</span>
                                         <span style="font-size:20px; font-weight:800; color:#E86123;">${overallConversionRate}</span>
                                     </td>
                                     <td width="2%"></td>
                                     <td width="23%" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px; text-align:center;">
                                         <span style="font-size:10px; font-weight:700; text-transform:uppercase; color:#64748b; display:block; margin-bottom:4px;">Avg Quality</span>
                                         <span style="font-size:20px; font-weight:800; color:#4F46E5;">${overallAvgQuality}/10</span>
                                     </td>
                                 </tr>
                             </table>
 
                             <!-- Section 1: Financial Intelligence Ledger -->
                             <h3 style="margin:0 0 12px 0; font-size:16px; font-weight:700; color:#31267D;">1. Financial Intelligence Briefing</h3>
                             <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:40px; border-collapse:collapse; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                                 <tr style="background-color:#31267D; color:#ffffff;">
                                     <th style="padding:10px; text-align:left; font-size:12px; font-weight:bold;">Date</th>
                                     <th style="padding:10px; text-align:right; font-size:12px; font-weight:bold;">UloomX Rev</th>
                                     <th style="padding:10px; text-align:right; font-size:12px; font-weight:bold;">Usthad Rev</th>
                                     <th style="padding:10px; text-align:right; font-size:12px; font-weight:bold;">Expenses</th>
                                     <th style="padding:10px; text-align:right; font-size:12px; font-weight:bold;">Net Rev</th>
                                     <th style="padding:10px; text-align:center; font-size:12px; font-weight:bold;">Status</th>
                                 </tr>
                                 ${financeRowsHTML}
                             </table>
 
                             <!-- Section 2: Sales Metrics Briefing -->
                             <h3 style="margin:0 0 12px 0; font-size:16px; font-weight:700; color:#31267D;">2. Daily Sales Tracking Summary</h3>
                             <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:40px; border-collapse:collapse; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                                 <tr style="background-color:#31267D; color:#ffffff;">
                                     <th style="padding:10px; text-align:left; font-size:12px; font-weight:bold;">Date</th>
                                     <th style="padding:10px; text-align:left; font-size:12px; font-weight:bold;">Sales Rep</th>
                                     <th style="padding:10px; text-align:center; font-size:12px; font-weight:bold;">Leads</th>
                                     <th style="padding:10px; text-align:center; font-size:12px; font-weight:bold;">Conversions</th>
                                     <th style="padding:10px; text-align:center; font-size:12px; font-weight:bold;">Lost</th>
                                     <th style="padding:10px; text-align:center; font-size:12px; font-weight:bold;">Quality</th>
                                 </tr>
                                 ${salesRowsHTML}
                             </table>
 
                             <!-- Section 3: HR Leaves Request Briefing -->
                             <h3 style="margin:0 0 12px 0; font-size:16px; font-weight:700; color:#31267D;">3. Leave & HR Authorizations</h3>
                             <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:40px; border-collapse:collapse; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                                 <tr style="background-color:#31267D; color:#ffffff;">
                                     <th style="padding:10px; text-align:left; font-size:12px; font-weight:bold;">Date</th>
                                     <th style="padding:10px; text-align:left; font-size:12px; font-weight:bold;">Staff</th>
                                     <th style="padding:10px; text-align:left; font-size:12px; font-weight:bold;">Leave Dates</th>
                                     <th style="padding:10px; text-align:center; font-size:12px; font-weight:bold;">Days</th>
                                     <th style="padding:10px; text-align:left; font-size:12px; font-weight:bold;">Purpose</th>
                                     <th style="padding:10px; text-align:center; font-size:12px; font-weight:bold;">Status</th>
                                 </tr>
                                 ${leaveRowsHTML}
                             </table>
 
                             <!-- Section 4: Tasks Executive Briefing -->
                             <h3 style="margin:0 0 12px 0; font-size:16px; font-weight:700; color:#31267D;">4. Tasks Execution Summary</h3>
                             <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse; border:1px solid #e2e8f0; border-radius:8px; overflow:hidden;">
                                 <tr style="background-color:#31267D; color:#ffffff;">
                                     <th style="padding:10px; text-align:left; font-size:12px; font-weight:bold;">Created</th>
                                     <th style="padding:10px; text-align:left; font-size:12px; font-weight:bold;">Assigned To</th>
                                     <th style="padding:10px; text-align:left; font-size:12px; font-weight:bold;">Title</th>
                                     <th style="padding:10px; text-align:center; font-size:12px; font-weight:bold;">Priority</th>
                                     <th style="padding:10px; text-align:center; font-size:12px; font-weight:bold;">Status</th>
                                 </tr>
                                 ${tasksRowsHTML}
                             </table>
 
                             <p style="margin:30px 0 0 0; font-size:14px; line-height:1.6; color:#475569;">
                                 Please check the live Usthad Academy Dashboard portal for detailed filters, analytics history, and graphs.
                             </p>
                         </td>
                     </tr>
                     
                     <!-- Footer -->
                     <tr>
                         <td bgcolor="#f8fafc" style="padding:24px 40px; border-top:1px solid #e2e8f0; text-align:center;">
                             <p style="margin:0 0 4px 0; font-size:12px; color:#64748b; font-weight:600;">Usthad Academy Ops Engine</p>
                             <p style="margin:0; font-size:11px; color:#94a3b8;">This is an automated system report. Please do not reply directly to this message.</p>
                         </td>
                     </tr>
                 </table>
             </td>
         </tr>
     </table>
 </body>
 </html>
         `;
 
         // 8. Send Email using Resend with direct HTML table body content
         const recipients = ["ceo@usthadacademy.com", "saleemsaquafi@gmail.com"];
         const emailResponse = await resend.emails.send({
             from: "Usthad Academy Reports <reports@mail.usthadacademy.com>",
             to: recipients,
             subject: `[Usthad Academy] Monthly Executive Operational Brief - ${monthNameString}`,
             html: htmlContent,
         });

        if (emailResponse.error) {
            console.error("[SendCeoReport] Resend send error:", emailResponse.error);
            return NextResponse.json(
                { error: `Email delivery failed: ${emailResponse.error.message}` },
                { status: 500 }
            );
        }

        // 9. Lifecycle Soft-Archive: Mark the concluded month's temporary daily sales tracking draft records as archived ONLY after email acceptance
        const { error: purgeError } = await supabaseAdmin
            .from("daily_sales_tracking")
            .update({ is_archived: true })
            .gte("tracking_date", firstDayOfMonth)
            .lte("tracking_date", lastDayOfMonth);

        if (purgeError) {
            console.error("[SendCeoReport] Failed to archive temporary sales tracking records:", purgeError.message);
        }

        return NextResponse.json({
            success: true,
            message: `Monthly report ledger for ${monthNameString} sent successfully to CEO & Operations. Concluded month draft metrics archived.`,
            records_compiled: salesData.length,
            email_id: emailResponse.data?.id,
            purged: !purgeError,
        });

    } catch (err: any) {
        console.error("[SendCeoReport] Unhandled exception:", err);
        return NextResponse.json(
            { error: err.message || "Internal server error" },
            { status: 500 }
        );
    }
}
