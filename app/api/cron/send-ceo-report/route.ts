import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resend } from "@/lib/resend";
import { fetchReportData, buildPDF } from "@/lib/pdf-generator";

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

        // 4. Resend Integration verification
        if (!resend) {
            console.error("[SendCeoReport] Resend client not initialized (check RESEND_API_KEY)");
            return NextResponse.json(
                { error: "Resend client is not initialized. Please configure RESEND_API_KEY." },
                { status: 500 }
            );
        }

        // 5. Gather/generate the 4 specific operational report PDFs locally from the database
        const queryMonth = targetMonth + 1;

        const [financeData, salesReportData, leaveData, tasksData] = await Promise.all([
            fetchReportData(supabaseAdmin, "finance", targetYear, queryMonth),
            fetchReportData(supabaseAdmin, "sales", targetYear, queryMonth),
            fetchReportData(supabaseAdmin, "leave", targetYear, queryMonth),
            fetchReportData(supabaseAdmin, "tasks", targetYear, queryMonth),
        ]);

        const [financeBuffer, salesBuffer, leaveBuffer, tasksBuffer] = await Promise.all([
            buildPDF("finance", targetYear, queryMonth, financeData),
            buildPDF("sales", targetYear, queryMonth, salesReportData),
            buildPDF("leave", targetYear, queryMonth, leaveData),
            buildPDF("tasks", targetYear, queryMonth, tasksData),
        ]);

        // Aggregate statistics for summary display in the email
        const totalRecords = salesReportData ? salesReportData.length : 0;
        let sumLeads = 0;
        let sumConversions = 0;
        let sumEvaluations = 0;
        let sumLostLeads = 0;
        let sumQuality = 0;

        if (salesReportData && salesReportData.length > 0) {
            salesReportData.forEach(row => {
                sumLeads += row.total_leads || 0;
                sumConversions += row.conversions || 0;
                sumEvaluations += row.evaluations_taken || 0;
                sumLostLeads += row.lost_leads || 0;
                sumQuality += row.lead_quality_rating || 0;
            });
        }

        const avgQuality = totalRecords > 0 ? (sumQuality / totalRecords).toFixed(1) : "N/A";
        const overallConversionRate = sumLeads > 0 ? ((sumConversions / sumLeads) * 100).toFixed(1) + "%" : "0.0%";

        // 6. Build clean, professional HTML content
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
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.05); border:1px solid #e2e8f0;">
                    <!-- Header -->
                    <tr>
                        <td bgcolor="#31267D" style="padding:32px 40px; text-align:left;">
                            <span style="font-size:11px; font-weight:800; text-transform:uppercase; color:#a5b4fc; letter-spacing:2px; display:block; margin-bottom:4px;">Executive Briefing</span>
                            <h1 style="margin:0; font-size:24px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">Operations Monthly Report</h1>
                            <p style="margin:6px 0 0 0; font-size:14px; color:#c7d2fe;">Billing Period: ${monthNameString}</p>
                        </td>
                    </tr>
                    
                    <!-- Content Body -->
                    <tr>
                        <td style="padding:40px;">
                            <!-- Briefing Message -->
                            <h2 style="margin:0 0 16px 0; font-size:18px; font-weight:700; color:#0f172a; border-bottom:2px solid #f1f5f9; padding-bottom:8px;">Executive Summary</h2>
                            <p style="margin:0 0 24px 0; font-size:14px; line-height:1.6; color:#475569;">
                                Dear Executive Board,<br/><br/>
                                The complete multi-departmental executive brief files for **${monthNameString}** have been successfully compiled. The full report PDFs are attached directly to this email for your review:
                            </p>

                            <!-- PDF Attachments Card List -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px; background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px 20px;">
                                <tr>
                                    <td style="padding:10px 0; border-bottom:1px solid #e2e8f0;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td width="36" style="vertical-align:middle;"><span style="font-size:24px;">📊</span></td>
                                                <td style="vertical-align:middle; padding-left:10px;">
                                                    <strong style="font-size:14px; color:#0f172a; display:block;">Finance_Report.pdf</strong>
                                                    <span style="font-size:12px; color:#64748b;">Comprehensive monthly revenue, expenses, and yield rate ledger.</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 0; border-bottom:1px solid #e2e8f0;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td width="36" style="vertical-align:middle;"><span style="font-size:24px;">📈</span></td>
                                                <td style="vertical-align:middle; padding-left:10px;">
                                                    <strong style="font-size:14px; color:#0f172a; display:block;">Sales_Report.pdf</strong>
                                                    <span style="font-size:12px; color:#64748b;">Leads tracking, conversions, and personnel yield analytics.</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 0; border-bottom:1px solid #e2e8f0;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td width="36" style="vertical-align:middle;"><span style="font-size:24px;">📅</span></td>
                                                <td style="vertical-align:middle; padding-left:10px;">
                                                    <strong style="font-size:14px; color:#0f172a; display:block;">Leave_Report.pdf</strong>
                                                    <span style="font-size:12px; color:#64748b;">HR leave authorizations, requests, and personnel shifts overview.</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 0;">
                                        <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                            <tr>
                                                <td width="36" style="vertical-align:middle;"><span style="font-size:24px;">✅</span></td>
                                                <td style="vertical-align:middle; padding-left:10px;">
                                                    <strong style="font-size:14px; color:#0f172a; display:block;">Tasks_Report.pdf</strong>
                                                    <span style="font-size:12px; color:#64748b;">Task execution status, completion velocity, and pending directives.</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- KPI Overview -->
                            <h2 style="margin:0 0 16px 0; font-size:18px; font-weight:700; color:#0f172a; border-bottom:2px solid #f1f5f9; padding-bottom:8px;">Sales Summary Metrics</h2>
                            <p style="margin:0 0 20px 0; font-size:13px; color:#64748b;">
                                Aggregated sales tracking details for ${monthNameString}:
                            </p>

                            <!-- KPI Cards -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
                                <tr>
                                    <td width="48%" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px; margin-bottom:12px; display:inline-block; vertical-align:top; box-sizing:border-box;">
                                        <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; tracking:1px;">Total Leads</span>
                                        <div style="font-size:22px; font-weight:800; color:#31267D; margin:4px 0;">${sumLeads}</div>
                                    </td>
                                    <td width="4%"></td>
                                    <td width="48%" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px; margin-bottom:12px; display:inline-block; vertical-align:top; box-sizing:border-box;">
                                        <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; tracking:1px;">Conversions</span>
                                        <div style="font-size:22px; font-weight:800; color:#10b981; margin:4px 0;">${sumConversions}</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td width="48%" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px; margin-bottom:12px; display:inline-block; vertical-align:top; box-sizing:border-box;">
                                        <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; tracking:1px;">Conversion Rate</span>
                                        <div style="font-size:22px; font-weight:800; color:#e86123; margin:4px 0;">${overallConversionRate}</div>
                                    </td>
                                    <td width="4%"></td>
                                    <td width="48%" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px; margin-bottom:12px; display:inline-block; vertical-align:top; box-sizing:border-box;">
                                        <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b; tracking:1px;">Avg Lead Quality</span>
                                        <div style="font-size:22px; font-weight:800; color:#4f46e5; margin:4px 0;">${avgQuality} / 10</div>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0; font-size:14px; line-height:1.6; color:#475569;">
                                Please check the attached files for the comprehensive reporting data.
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

        // 7. Send Email using Resend with PDF attachments to multiple recipients simultaneously
        const recipients = ["ceo@usthadacademy.com", "saleemsaquafi@gmail.com"];
        const emailResponse = await resend.emails.send({
            from: "Usthad Academy Reports <reports@mail.usthadacademy.com>",
            to: recipients,
            subject: `[Usthad Academy] Operations Monthly Report & Executive Briefs - ${monthNameString}`,
            html: htmlContent,
            attachments: [
                { filename: "Finance_Report.pdf", content: financeBuffer },
                { filename: "Sales_Report.pdf", content: salesBuffer },
                { filename: "Leave_Report.pdf", content: leaveBuffer },
                { filename: "Tasks_Report.pdf", content: tasksBuffer },
            ],
        });

        if (emailResponse.error) {
            console.error("[SendCeoReport] Resend send error:", emailResponse.error);
            return NextResponse.json(
                { error: `Email delivery failed: ${emailResponse.error.message}` },
                { status: 500 }
            );
        }

        // 8. Lifecycle Soft-Archive: Mark the concluded month's temporary daily sales tracking draft records as archived ONLY after email acceptance
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
            message: `Monthly report and attachments for ${monthNameString} sent to CEO & Operations successfully. Concluded month draft metrics archived.`,
            records_compiled: totalRecords,
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
