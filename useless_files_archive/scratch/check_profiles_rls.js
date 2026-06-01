const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function checkRLS() {
    console.log('Querying RLS policies on profiles...');
    const { data, error } = await supabase.rpc('exec_sql', {
        sql_query: `
            SELECT 
              policyname,
              cmd,
              qual,
              with_check
            FROM pg_policies 
            WHERE tablename = 'profiles';
        `
    });

    if (error) {
        console.error('Error fetching policies:', error);
    } else {
        console.log('RLS Policies on profiles table:');
        console.table(data);
    }
}

checkRLS();
