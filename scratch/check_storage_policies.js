const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function main() {
    try {
        const sql = `
            SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
            FROM pg_policies 
            WHERE schemaname = 'storage' OR tablename = 'objects';
        `;
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) {
            console.error("Error fetching storage policies:", error);
        } else {
            console.log("Storage Policies:", JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error("Exception:", err);
    }
}

main();
