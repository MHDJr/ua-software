const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function run() {
    try {
        console.log("Fetching routine list from schema...");
        // We can query the routines using Supabase postgrest query on information_schema views if they are exposed
        // Since information_schema might not be exposed, let's check what functions we can call or query profiles
        // Wait, information_schema is usually NOT exposed via PostgREST by default, but we can try:
        const { data, error } = await supabase.from('_rpc').select('*').limit(10);
        if (error) {
            console.log("Direct _rpc select failed (expected):", error.message);
        } else {
            console.log("RPC list:", data);
        }

        // Let's try select from pg_proc via REST if possible (usually blocked)
        const { data: proc, error: procErr } = await supabase.from('pg_proc').select('*').limit(5);
        console.log("pg_proc result:", procErr ? procErr.message : proc);
    } catch (e) {
        console.error("Exception:", e);
    }
}

run();
