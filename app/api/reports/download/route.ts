import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchReportData, buildPDF } from "@/lib/pdf-generator";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    try {
        // 1. Access Security Verification
        const authHeader = request.headers.get("authorization");
        const cronSecret = process.env.CRON_SECRET;

        if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        // 2. Read URL Parameters
        const url = new URL(request.url);
        const type = url.searchParams.get("type") || "sales";
        const yearStr = url.searchParams.get("year");
        const monthStr = url.searchParams.get("month");

        const currentDate = new Date();
        const year = yearStr ? parseInt(yearStr) : currentDate.getFullYear();
        const month = monthStr ? parseInt(monthStr) : currentDate.getMonth() + 1;

        if (!["finance", "sales", "leave", "tasks"].includes(type)) {
            return NextResponse.json(
                { error: "Invalid report type requested." },
                { status: 400 }
            );
        }

        // 3. Connect Supabase Admin
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceRoleKey) {
            console.error("[ReportsDownload] Server configuration error: Missing database credentials.");
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

        // 4. Query data based on type
        const dbData = await fetchReportData(supabaseAdmin, type, year, month);

        // 5. Generate PDF Binary
        const pdfBuffer = await buildPDF(type, year, month, dbData);

        // 6. Return response with Content-Type header
        return new NextResponse(pdfBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${type}_monthly_report_${year}_${month}.pdf"`,
                "Content-Length": pdfBuffer.length.toString(),
            },
        });

    } catch (err: any) {
        console.error("[ReportsDownload] Unhandled exception:", err);
        return NextResponse.json(
            { error: err.message || "Internal server error" },
            { status: 500 }
        );
    }
}
