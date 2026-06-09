const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function testDeleteWithRelations() {
    console.log("Testing staff deletion with active foreign key references...");
    
    // 1. Create a temporary user
    const suffix = Date.now().toString().slice(-6);
    const testEmail = `test_staff_rel_${suffix}@example.com`;
    const testUsername = `rel_staff_${suffix}`;
    
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
    console.log(`Created auth user ID: ${userId}`);
    
    // Insert profile manually
    const { error: profileInsertError } = await supabaseAdmin
        .from('profiles')
        .insert({
            id: userId,
            email: testEmail,
            username: testUsername,
            full_name: 'Relational Test Staff',
            role: 'staff',
            department: 'Sales',
            status: 'active'
        });
        
    if (profileInsertError) {
        console.error("Failed to insert profile:", profileInsertError);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return;
    }
    
    const relations = [
        { table: 'notifications', data: { user_id: userId, title: 'Test', message: 'Test message', type: 'system' } },
        { table: 'monthly_targets', data: { profile_id: userId, target_month: '2026-06-01', target_value: 10, department: 'sales' } },
        { table: 'daily_sales_tracking', data: { profile_id: userId, tracking_date: '2026-06-09', total_leads: 1, conversions: 0, evaluations_taken: 0 } },
        { table: 'conversions', data: { staff_id: userId, staff_name: 'Relational Test Staff', student_name: 'Test Student', conversion_date: '2026-06-09', status: 'converted' } },
        { table: 'daily_reports', data: { profile_id: userId, user_id: userId, reporter_name: 'Relational Test Staff', report_date: '2026-06-09', total_leads: 1, conversions: 0 } },
        { table: 'ideas', data: { created_by: userId, title: 'Test Idea', content: 'Test content', status: 'active' } }
    ];

    console.log("Inserting reference records...");
    for (const rel of relations) {
        const { error } = await supabaseAdmin.from(rel.table).insert(rel.data);
        if (error) {
            console.warn(`[WARN] Failed to insert into table ${rel.table}:`, error.message);
        } else {
            console.log(`[OK] Inserted reference in table ${rel.table}`);
        }
    }

    // Now try calling deletion
    console.log("--- ATTEMPTING DELETION (auth.admin.deleteUser) ---");
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
        console.error("Auth deletion failed:", authDeleteError.message);
    } else {
        console.log("Auth deletion succeeded in auth schema.");
    }

    // Check if the profile is still in profiles table
    const { data: profileCheck, error: profileCheckError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (profileCheckError) {
        console.error("Error checking profile:", profileCheckError.message);
    } else if (profileCheck) {
        console.log("Profile still exists in profiles table:", profileCheck);
        
        // Now try delete_profile_cascade
        console.log("--- ATTEMPTING delete_profile_cascade ---");
        const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('delete_profile_cascade', {
            profile_uuid: userId
        });
        
        if (rpcError) {
            console.error("RPC delete_profile_cascade failed:", rpcError.message);
        } else {
            console.log("RPC delete_profile_cascade succeeded:", rpcResult);
        }
        
        // Re-check profile
        const { data: profileCheck2 } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
            
        if (profileCheck2) {
            console.error("CRITICAL: Profile STILL EXISTS after RPC cascade deletion!");
        } else {
            console.log("Profile was deleted after calling RPC!");
        }
    } else {
        console.log("Profile was deleted automatically (cascade from auth.users or trigger).");
    }

    // Check what records remain for this userId in the relations
    console.log("Checking for leftover reference records...");
    for (const rel of relations) {
        let query = supabaseAdmin.from(rel.table).select('id').eq(rel.table === 'notifications' || rel.table === 'ideas' ? 'created_by' : (rel.table === 'monthly_targets' || rel.table === 'daily_sales_tracking' || rel.table === 'daily_reports' ? 'profile_id' : 'staff_id'), userId);
        
        if (rel.table === 'notifications') {
            query = supabaseAdmin.from(rel.table).select('id').eq('user_id', userId);
        } else if (rel.table === 'daily_sales_tracking') {
            query = supabaseAdmin.from(rel.table).select('profile_id').eq('profile_id', userId);
        }
        
        const { data, error } = await query;
        if (error) {
            console.error(`Error querying leftovers for ${rel.table}:`, error.message);
        } else if (data && data.length > 0) {
            console.warn(`[LEFTOVER] Table ${rel.table} has ${data.length} records remaining!`);
        } else {
            console.log(`[CLEAN] Table ${rel.table} is clean.`);
        }
    }

    // Clean up test references manually
    console.log("Cleaning up test references manually...");
    for (const rel of relations) {
        try {
            let col = rel.table === 'notifications' || rel.table === 'ideas' ? 'created_by' : (rel.table === 'monthly_targets' || rel.table === 'daily_sales_tracking' || rel.table === 'daily_reports' ? 'profile_id' : 'staff_id');
            if (rel.table === 'notifications') col = 'user_id';
            await supabaseAdmin.from(rel.table).delete().eq(col, userId);
        } catch(e) {}
    }
    await supabaseAdmin.from('profiles').delete().eq('id', userId);
    await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => {});
}

testDeleteWithRelations().catch(console.error);
