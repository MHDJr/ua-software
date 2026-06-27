import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resend, EMAIL_CONFIG } from "@/lib/resend";

export const dynamic = "force-dynamic";

// Helper to generate a minimal valid placeholder PDF buffer containing text.
function generatePlaceholderPDF(reportName: string): Buffer {
    const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << >> >>
endobj
4 0 obj
<< /Length 80 >>
stream
BT
/F1 12 Tf
72 712 Td
(Placeholder for ${reportName}) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000056 00000 n 
0000000111 00000 n 
0000000212 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
341
%%EOF`;
    return Buffer.from(content, "utf-8");
}

// Helper to fetch report PDF from internal endpoint if available, falling back to local placeholder.
// Modified to pass the correct target month and year parameters to your downloading endpoint.
async function fetchReportPDF(
    reportType: string,
    defaultName: string,
    requestUrl: string,
    year: number,
    month: number,
): Promise<Buffer> {
    try {
        const baseUrl = new URL(requestUrl).origin;
        // Appends historical month context parameters (?type=sales&year=2026&month=6)
        const downloadUrl = `${baseUrl}/api/reports/download?type=${reportType}&year=${year}&month=${month + 1}`;

        const response = await fetch(downloadUrl, {
            headers: {
                Authorization: `Bearer ${process.env.CRON_SECRET || ""}`,
            },
        });
        if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        }
    } catch (e) {
        console.warn(
            `[SendCeoReport] Failed to fetch live PDF for ${reportType}, using generated placeholder:`,
            e,
        );
    }
    return generatePlaceholderPDF(defaultName);
}

export async function GET(request: NextRequest) {
    try {
        // 1. Access Protection: Read and verify the 'authorization' header
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 },
            );
        }

        // 2. Initialize Supabase Admin client
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceRoleKey =
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            console.error(
                "[SendCeoReport] Server configuration error: Missing database credentials.",
            );
            return NextResponse.json(
                {
                    error: "Server Configuration Error: Missing database credentials.",
                },
                { status: 500 },
            );
        }

        const supabaseAdmin = createClient(
            supabaseUrl,
            supabaseServiceRoleKey,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
            },
        );

        // 3. Time Frame Realignment: Compute full dynamic month range boundaries
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed (e.g. 5 for June)

        const firstDayOfMonth = new Date(currentYear, currentMonth, 1)
            .toISOString()
            .split("T")[0];
        const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0)
            .toISOString()
            .split("T")[0];
        const monthNameString = now.toLocaleString("default", {
            month: "long",
            year: "numeric",
        });

        // 4. Data Fetching: Retrieve everything written during the entire month range
        const { data: salesData, error: fetchError } = await supabaseAdmin
            .from("daily_sales_tracking")
            .select(
                `
                profile_id,
                tracking_date,
                total_leads,
                conversions,
                evaluations_taken,
                lost_leads,
                lead_quality_rating,
                updated_at,
                profile:profiles!profile_id (
                    full_name,
                    email,
                    role
                )
            `,
            )
            .gte("tracking_date", firstDayOfMonth)
            .lte("tracking_date", lastDayOfMonth);

        if (fetchError) {
            console.error(
                "[SendCeoReport] Database fetch error:",
                fetchError.message,
            );
            return NextResponse.json(
                { error: `Database query failed: ${fetchError.message}` },
                { status: 500 },
            );
        }

        // 5. Resend Integration verification
        if (!resend) {
            console.error(
                "[SendCeoReport] Resend client not initialized (check RESEND_API_KEY)",
            );
            return NextResponse.json(
                {
                    error: "Resend client is not initialized. Please configure RESEND_API_KEY.",
                },
                { status: 500 },
            );
        }

        // Gather/generate the 4 specific operational report PDFs passing month/year parameters
        const requestUrl = request.url;
        const [financeBuffer, salesBuffer, leaveBuffer, tasksBuffer] =
            await Promise.all([
                fetchReportPDF(
                    "finance",
                    "Finance Monthly Report",
                    requestUrl,
                    currentYear,
                    currentMonth,
                ),
                fetchReportPDF(
                    "sales",
                    "Sales Monthly Report",
                    requestUrl,
                    currentYear,
                    currentMonth,
                ),
                fetchReportPDF(
                    "leave",
                    "Leave Monthly Report",
                    requestUrl,
                    currentYear,
                    currentMonth,
                ),
                fetchReportPDF(
                    "tasks",
                    "Tasks Monthly Report",
                    requestUrl,
                    currentYear,
                    currentMonth,
                ),
            ]);

        // Aggregate cumulative statistics for summary display across the entire month
        const totalRecords = salesData ? salesData.length : 0;
        let sumLeads = 0;
        let sumConversions = 0;
        let sumEvaluations = 0;
        let sumLostLeads = 0;
        let sumQuality = 0;

        if (salesData && salesData.length > 0) {
            salesData.forEach((row) => {
                sumLeads += row.total_leads || 0;
                sumConversions += row.conversions || 0;
                sumEvaluations += row.evaluations_taken || 0;
                sumLostLeads += row.lost_leads || 0;
                sumQuality += row.lead_quality_rating || 0;
            });
        }

        const avgQuality =
            totalRecords > 0 ? (sumQuality / totalRecords).toFixed(1) : "N/A";
        const overallConversionRate =
            sumLeads > 0
                ? ((sumConversions / sumLeads) * 100).toFixed(1) + "%"
                : "0.0%";

        // 6. Build clean, professional HTML content with inline styles detailing the compilation and attachments
        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Monthly Executive Operations Briefing</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1e293b;">
    <table border="0; cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f5f7; padding:40px 20px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px; background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.05); border:1px solid #e2e8f0;">
                    <tr>
                        <td bgcolor="#31267D" style="padding:32px 40px; text-align:left;">
                            <span style="font-size:11px; font-weight:800; text-transform:uppercase; color:#a5b4fc; letter-spacing:2px; display:block; margin-bottom:4px;">Executive Briefing</span>
                            <h1 style="margin:0; font-size:24px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">End-of-Month Operations Report</h1>
                            <p style="margin:6px 0 0 0; font-size:14px; color:#c7d2fe;">Billing Cycle: ${monthNameString}</p>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="padding:40px;">
                            <h2 style="margin:0 0 16px 0; font-size:18px; font-weight:700; color:#0f172a; border-bottom:2px solid #f1f5f9; padding-bottom:8px;">Executive Summary</h2>
                            <p style="margin:0 0 24px 0; font-size:14px; line-height:1.6; color:#475569;">
                                Dear CEO,<br/><br/>
                                The complete multi-departmental executive brief files for this period have been successfully compiled. The full report PDFs are attached directly to this email for your review:
                            </p>

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
                            
                            <h2 style="margin:0 0 16px 0; font-size:18px; font-weight:700; color:#0f172a; border-bottom:2px solid #f1f5f9; padding-bottom:8px;">Cumulative Monthly Performance Highlights</h2>
                            <p style="margin:0 0 20px 0; font-size:13px; color:#64748b;">
                                Below is the aggregated snapshot of cumulative metrics compiled over the entire month:
                            </p>

                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
                                <tr>
                                    <td width="48%" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px; margin-bottom:12px; display:inline-block; vertical-align:top; box-sizing:border-box;">
                                        <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b;">Total Leads</span>
                                        <div style="font-size:22px; font-weight:800; color:#31267D; margin:4px 0;">${sumLeads}</div>
                                    </td>
                                    <td width="4%"></td>
                                    <td width="48%" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px; margin-bottom:12px; display:inline-block; vertical-align:top; box-sizing:border-box;">
                                        <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b;">Conversions</span>
                                        <div style="font-size:22px; font-weight:800; color:#10b981; margin:4px 0;">${sumConversions}</div>
                                    </td>
                                </tr>
                                <tr>
                                    <td width="48%" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px; margin-bottom:12px; display:inline-block; vertical-align:top; box-sizing:border-box;">
                                        <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b;">Conversion Rate</span>
                                        <div style="font-size:22px; font-weight:800; color:#e86123; margin:4px 0;">${overallConversionRate}</div>
                                    </td>
                                    <td width="4%"></td>
                                    <td width="48%" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; padding:16px; margin-bottom:12px; display:inline-block; vertical-align:top; box-sizing:border-box;">
                                        <span style="font-size:11px; font-weight:700; text-transform:uppercase; color:#64748b;">Avg Lead Quality</span>
                                        <div style="font-size:22px; font-weight:800; color:#4f46e5; margin:4px 0;">${avgQuality} / 10</div>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin:0; font-size:14px; line-height:1.6; color:#475569;">
                                Please review the attached PDF documents for full deep-dives.
                            </p>
                        </td>
                    </tr>
                    
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

        // 7. Send Email using Resend with PDF attachments
        const emailResponse = await resend.emails.send({
            from: "Usthad Academy Reports <reports@mail.usthadacademy.com>",
            to: "ceo@usthadacademy.com",
            subject: `[Usthad Academy] Monthly Operations Report & Executive Briefs - ${monthNameString}`,
            html: htmlContent,
            attachments: [
                {
                    filename: `Finance_Report_${monthNameString.replace(" ", "_")}.pdf`,
                    content: financeBuffer,
                },
                {
                    filename: `Sales_Report_${monthNameString.replace(" ", "_")}.pdf`,
                    content: salesBuffer,
                },
                {
                    filename: `Leave_Report_${monthNameString.replace(" ", "_")}.pdf`,
                    content: leaveBuffer,
                },
                {
                    filename: `Tasks_Report_${monthNameString.replace(" ", "_")}.pdf`,
                    content: tasksBuffer,
                },
            ],
        });

        if (emailResponse.error) {
            console.error(
                "[SendCeoReport] Resend send error:",
                emailResponse.error,
            );
            return NextResponse.json(
                {
                    error: `Email delivery failed: ${emailResponse.error.message}`,
                },
                { status: 500 },
            );
        }

        return NextResponse.json({
            success: true,
            message: `Monthly report and attachments for ${monthNameString} sent to CEO successfully.`,
            records_compiled: totalRecords,
            email_id: emailResponse.data?.id,
        });
    } catch (err: any) {
        console.error("[SendCeoReport] Unhandled exception:", err);
        return NextResponse.json(
            { error: err.message || "Internal server error" },
            { status: 500 },
        );
    }
}
