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

        // 3. Read path parameter
        const { searchParams } = new URL(req.url);
        const filePath = searchParams.get("path");

        if (!filePath) {
            return NextResponse.json({ error: "Missing required 'path' parameter" }, { status: 400 });
        }

        // Restrict downloads to the reports folder for security
        if (!filePath.startsWith("reports/")) {
            return NextResponse.json({ error: "Forbidden: Invalid file path requested." }, { status: 403 });
        }

        console.log(`[Download API] CEO downloaded archived report: ${filePath} (User: ${user.email})`);

        const supabaseAdmin = getSupabaseAdmin();

        // 4. Download file from Supabase Storage
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from("reports")
            .download(filePath);

        if (downloadError || !fileData) {
            console.error(`[Download API Error] File download failed for path: ${filePath}`, downloadError);
            return NextResponse.json({ error: "File not found or storage download failed." }, { status: 404 });
        }

        // 5. Stream PDF binary response
        const buffer = Buffer.from(await fileData.arrayBuffer());
        const filename = filePath.split("/").pop() || "report.pdf";

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Content-Length": buffer.length.toString(),
            },
        });

    } catch (err: any) {
        console.error("[Download API Exception]", err);
        return NextResponse.json({ 
            success: false, 
            error: err.message || "Internal server error" 
        }, { status: 500 });
    }
}
