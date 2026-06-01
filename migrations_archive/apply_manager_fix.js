const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function run() {
    const sqlPath = path.join(__dirname, 'fix_manager_add_staff_permissions.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolons, but be careful with DO blocks
    // For simplicity, we'll try to execute the whole thing if we can, 
    // but the JS client doesn't support multiple statements in one RPC call usually.
    // However, we can try to wrap it in a function or just send it as is if exec_sql supports it.
    
    console.log('Attempting to apply SQL via exec_sql RPC...');
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sqlContent });
    
    if (error) {
        console.error('Error applying SQL:', error);
        
        // Try splitting if it's a "multiple statements" error
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
