import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BIReportService } from "@/lib/bi-report-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        // 1. Authenticate user using Authorization header token
        const authHeader = req.headers.get("authorization");
        const token = authHeader?.split(" ")[1];
        if (!token) {
            return NextResponse.json({ error: "Unauthorized: Missing authentication token" }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

        const clientSupabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        });

        const { data: { user }, error: authError } = await clientSupabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Unauthorized: Invalid authentication session" }, { status: 401 });
        }

        // 2. Fetch profile to check authorization role
        const { data: profile, error: profileError } = await clientSupabase
            .from("profiles")
            .select("role, is_manager")
            .eq("id", user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json({ error: "Unauthorized: User profile not found" }, { status: 404 });
        }

        const isAuthorized = profile.role === "ceo" || profile.role === "manager" || profile.is_manager === true;
        if (!isAuthorized) {
            return NextResponse.json({ error: "Forbidden: Access restricted to CEO/Managers" }, { status: 403 });
        }

        // 3. Parse and run requested action
        const body = await req.json().catch(() => ({}));
        const { action, year, month } = body;

        if (!action) {
            return NextResponse.json({ error: "Missing required 'action' parameter" }, { status: 400 });
        }

        // Calculate defaults if not specified
        const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
        const targetDate = new Date(nowIST);
        targetDate.setDate(0); // target completed month
        
        const targetYear = year ? parseInt(year) : targetDate.getFullYear();
        const targetMonth = month ? parseInt(month) : (targetDate.getMonth() + 1);

        console.log(`[Admin API] Manual Action: ${action} for ${targetMonth}/${targetYear} initiated by ${user.email}`);

        let result;
        switch (action) {
            case "generate":
                // Run Stage 1 (isTestMode = false)
                result = await BIReportService.runStage1(targetYear, targetMonth, `CEO_MANUAL (${user.email})`, false);
                break;
            case "generate_test":
                // Run Stage 1 (isTestMode = true) - uses mock fallback data if db is empty
                result = await BIReportService.runStage1(targetYear, targetMonth, `CEO_TEST (${user.email})`, true);
                break;
            case "email":
                // Run Stage 2 (isTestMode = false)
                result = await BIReportService.runStage2(targetYear, targetMonth, false);
                break;
            case "email_test":
                // Run Stage 2 (isTestMode = true)
                result = await BIReportService.runStage2(targetYear, targetMonth, true);
                break;
            case "verify":
                // Run Stage 3
                result = await BIReportService.runStage3(targetYear, targetMonth);
                break;
            case "cleanup":
                // Run Stage 4
                result = await BIReportService.runStage4(targetYear, targetMonth);
                break;
            default:
                return NextResponse.json({ error: `Invalid action '${action}' requested.` }, { status: 400 });
        }

        return NextResponse.json({
            success: result.success,
            message: result.message,
            details: result.details || null
        });

    } catch (err: any) {
        console.error("[Admin API Exception]", err);
        return NextResponse.json({ 
            success: false, 
            error: err.message || "Internal server error" 
        }, { status: 500 });
    }
}
