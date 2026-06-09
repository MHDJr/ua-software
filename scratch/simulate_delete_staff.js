const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function simulateDelete() {
    console.log("Simulating staff deletion workflow...");
    
    // 1. Create a temporary user
    const testEmail = `test_staff_temp_${Date.now()}@example.com`;
    const testUsername = `temp_staff_${Date.now()}`;
    
    console.log(`Creating test user: ${testEmail}`);
    const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
        email: testEmail,
        password: 'TemporaryPassword123!',
        email_confirm: true
    });
    
    if (authCreateError) {
        console.error("Failed to create auth user:", authCreateError);
        return;
    }
    
    const userId = authData.user.id;
    console.log(`Created auth user with ID: ${userId}`);
    
    // Check if profile was automatically created
    const { data: profileCheck } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
    if (profileCheck) {
        console.log("Profile was automatically created:", profileCheck);
    } else {
        console.log("Profile was NOT automatically created. Inserting manually...");
        const { error: profileInsertError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: userId,
                email: testEmail,
                username: testUsername,
                full_name: 'Temporary Test Staff',
                role: 'staff',
                department: 'Sales',
                status: 'active'
            });
            
        if (profileInsertError) {
            console.error("Failed to insert profile:", profileInsertError);
            // Clean up auth user before exit
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return;
        }
    }
    
    // Add reference data in some tables (e.g. daily_reports, activity_feed, notifications) to see if cascade fails
    console.log("Adding mock references in other tables...");
    
    // Insert into activity_feed
    const { error: feedErr } = await supabaseAdmin.from('activity_feed').insert({
        user_id: userId,
        action: 'test_action',
        details: 'Simulating delete cascade'
    });
    if (feedErr) console.warn("Could not insert activity feed:", feedErr.message);
    
    // Let's call the delete logic
    console.log("--- STARTING DELETION WORKFLOW ---");
    
    // Step 2. Delete from Auth.users
    console.log("Deleting from auth.users...");
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
        console.error("Auth deletion failed:", authDeleteError.message);
    } else {
        console.log("Auth user deleted successfully.");
    }
    
    // Step 3. Call the cascade deletion RPC
    console.log("Calling delete_profile_cascade RPC...");
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('delete_profile_cascade', {
        profile_uuid: userId
    });
    
    if (rpcError) {
        console.error("RPC delete_profile_cascade Error:", rpcError);
    } else {
        console.log("RPC delete_profile_cascade returned:", rpcData);
    }
    
    // Check if profile still exists in profiles
    const { data: finalProfile } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
    if (finalProfile) {
        console.error("CRITICAL: Profile STILL EXISTS in database!", finalProfile);
    } else {
        console.log("SUCCESS: Profile was successfully deleted from database.");
    }
}

simulateDelete().catch(console.error);
