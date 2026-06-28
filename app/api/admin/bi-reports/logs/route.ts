import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
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

        const supabaseAdmin = getSupabaseAdmin();

        // 3. Fetch monthly_reports list
        const { data: reports, error: reportsError } = await supabaseAdmin
            .from("monthly_reports")
            .select("*")
            .order("year", { ascending: false })
            .order("month", { ascending: false })
            .limit(12);

        if (reportsError) throw reportsError;

        // 4. Fetch the last 100 log entries from report_logs
        const { data: logs, error: logsError } = await supabaseAdmin
            .from("report_logs")
            .select("*, monthly_reports(year, month)")
            .order("created_at", { ascending: false })
            .limit(100);

        if (logsError) throw logsError;

        // 5. Check Supabase Storage status (verify if bucket 'reports' exists and get bucket info)
        const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();
        const reportsBucket = buckets?.find(b => b.name === "reports");
        const storageStatus = reportsBucket ? {
            exists: true,
            public: reportsBucket.public,
            fileSizeLimit: reportsBucket.file_size_limit,
            allowedMimeTypes: reportsBucket.allowed_mime_types
        } : {
            exists: false
        };

        return NextResponse.json({
            success: true,
            reports: reports || [],
            logs: logs || [],
            storage: storageStatus
        });

    } catch (err: any) {
        console.error("[Admin Logs API Exception]", err);
        return NextResponse.json({ 
            success: false, 
            error: err.message || "Internal server error" 
        }, { status: 500 });
    }
}
