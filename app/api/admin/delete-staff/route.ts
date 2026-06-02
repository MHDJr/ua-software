import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { userId, email, username } = await req.json();

        if (!userId && !email && !username) {
            return NextResponse.json({ error: "User identifier (ID, email, or username) is required" }, { status: 400 });
        }

        let targetUserId = userId;
        let targetEmail = email;

        // 1. If we don't have a userId but have email/username, try to find the user
        if (!targetUserId) {
            console.log(`[Admin] Searching for user by ${email ? 'email: ' + email : 'username: ' + username}`);
            
            let query = supabaseAdmin.from("profiles").select("id, email, username");
            if (email) query = query.eq("email", email);
            if (username) query = query.eq("username", username);
            
            const { data: profile } = await query.maybeSingle();
            
            if (profile) {
                targetUserId = profile.id;
                targetEmail = profile.email;
            } else if (email) {
                // If not in profiles, try to find in auth.users by email
                const { data: authUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
                if (!listError) {
                    const authUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
                    if (authUser) {
                        targetUserId = authUser.id;
                        targetEmail = authUser.email;
                    }
                }
            }
        }

        console.log(`[Admin] Initiating permanent deletion for user: ${targetUserId || 'Unknown'} (${targetEmail || 'No Email'})`);

        // 2. Delete from Auth.users
        if (targetUserId) {
            const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);
            if (authError) {
                console.warn("Auth deletion warning:", authError.message);
            }
        } else if (targetEmail) {
            // Last ditch effort: search and delete in auth
            const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            if (!listError) {
                const user = users.find(u => u.email === targetEmail);
                if (user) {
                    await supabaseAdmin.auth.admin.deleteUser(user.id);
                }
            }
        }

        // 3. Call the cascade deletion RPC
        // We do this even if targetUserId is null, maybe the RPC can handle email/username?
        // Actually our RPC only takes UUID. Let's make it better or call it if we have ID.
        if (targetUserId) {
            const { error: rpcError } = await supabaseAdmin.rpc('delete_profile_cascade', {
                profile_uuid: targetUserId
            });
            if (rpcError) console.error("RPC Error:", rpcError);
        }

        // 4. Manual cleanup for signup_requests and other non-cascading items
        const cleanupFilters: string[] = [];
        if (targetEmail) cleanupFilters.push(`email.eq.${targetEmail}`);
        if (username) cleanupFilters.push(`username.eq.${username}`);

        if (cleanupFilters.length > 0) {
            console.log(`[Admin] Cleaning up signup_requests with filter: ${cleanupFilters.join(',')}`);
            const { error: srError } = await supabaseAdmin
                .from("signup_requests")
                .delete()
                .or(cleanupFilters.join(','));
            if (srError) console.warn("Signup requests cleanup warning:", srError.message);
        }
        
        if (targetEmail) {
            console.log(`[Admin] Cleaning up add_staff requests for email: ${targetEmail}`);
            // Find requests where the metadata contains the email
            const { data: pendingAddRequests } = await supabaseAdmin
                .from("requests")
                .select("id, metadata")
                .eq("type", "add_staff");
            
            if (pendingAddRequests) {
                const requestsToDelete = pendingAddRequests.filter(r => 
                    r.metadata?.email?.toLowerCase() === targetEmail.toLowerCase()
                ).map(r => r.id);
                
                if (requestsToDelete.length > 0) {
                    await supabaseAdmin
                        .from("requests")
                        .delete()
                        .in("id", requestsToDelete);
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Critical error in delete-staff API:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
