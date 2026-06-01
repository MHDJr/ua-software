const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function run() {
    const sqlPath = path.join(__dirname, 'update_financial_entries_rls.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Attempting to apply financial_entries RLS SQL via exec_sql RPC...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sqlContent });
    
    if (error) {
        console.error('Error applying SQL in batch:', error);
        
        console.log('Trying to execute statements one by one...');
        const statements = sqlContent.split(';').map(s => s.trim()).filter(s => s.length > 0);
        for (const statement of statements) {
            const { error: stmtError } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
            if (stmtError) {
                console.warn('Statement failed:', statement.substring(0, 50) + '...', stmtError.message);
            } else {
                console.log('Statement executed successfully');
            }
        }
    } else {
        console.log('SQL applied successfully');
    }
}

run();
