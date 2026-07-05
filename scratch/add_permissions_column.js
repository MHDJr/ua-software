const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function main() {
    const sql = `
        ALTER TABLE profiles 
        ADD COLUMN IF NOT EXISTS manager_permissions JSONB DEFAULT '{}'::jsonb;
    `;
    
    console.log('Applying migration to add manager_permissions column to profiles table...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    }
    
    console.log('Migration applied successfully!');
    
    // Verify by querying a profile
    const { data: profiles, error: queryError } = await supabase
        .from('profiles')
        .select('id, email, manager_permissions')
        .limit(1);
        
    if (queryError) {
        console.error('Verification failed:', queryError.message);
    } else {
        console.log('Verification success. Row sample:', profiles[0]);
    }
}

main();
