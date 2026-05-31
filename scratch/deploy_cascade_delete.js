const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function deploy() {
    try {
        console.log('🚀 Loading cascade delete SQL script...');
        const sqlPath = path.join(__dirname, '../supabase/migrations/20260601000000_cascade_delete_profile.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');

        console.log('⚡ Deploying updated delete_profile_cascade function...');
        const { error } = await supabase.rpc('exec_sql', { sql_query: sqlContent });

        if (error) {
            console.error('❌ Failed to deploy via exec_sql:', error.message);
            process.exit(1);
        }

        console.log('✅ delete_profile_cascade deployed successfully!');
    } catch (e) {
        console.error('❌ Exception occurred:', e.message);
        process.exit(1);
    }
}

deploy();
