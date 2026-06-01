import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { userId } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "User ID is required" }, { status: 400 });
        }

        console.log(`[Admin] Initiating permanent deletion for user: ${userId}`);

        // 1. Delete from Auth.users
        // This will automatically trigger any database CASCADE deletes if configured.
        // It also purges the email and metadata from the auth system.
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authError) {
            console.error("Error deleting user from auth:", authError);
            // If user doesn't exist in auth but exists in profiles, we might still want to continue
            if (!authError.message.includes("User not found")) {
                return NextResponse.json({ error: authError.message }, { status: 500 });
            }
        }

        // 2. Explicitly call the cascade deletion RPC as a secondary safety measure
        // to ensure all public schema records are wiped even if CASCADE is not set.
        const { error: rpcError } = await supabaseAdmin.rpc('delete_profile_cascade', {
            profile_uuid: userId
        });

        if (rpcError) {
            console.error("Error calling delete_profile_cascade RPC:", rpcError);
            // Don't fail the whole request if RPC fails, as auth deletion is primary
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Critical error in delete-staff API:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
