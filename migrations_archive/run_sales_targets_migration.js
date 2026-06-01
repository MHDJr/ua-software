const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables:');
    console.error('- NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
    console.error('- SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
    process.exit(1);
}

// Create admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function runMigration() {
    try {
        console.log('🚀 Starting sales targets table migration...');
        
        // Read the SQL file
        const sqlPath = path.join(__dirname, 'supabase', 'migrations', '20260531010000_academy_sales_targets.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📝 SQL file loaded, executing...');
        
        // Split SQL into individual statements
        const statements = sqlContent
            .split(';')
            .map(s => s.trim())
            .filter(s => s && !s.startsWith('--') && !s.startsWith('SELECT '));
        
        console.log(`📊 Found ${statements.length} SQL statements to execute`);
        
        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.trim()) {
                try {
                    console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
                    const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
                    if (error) {
                        console.warn(`⚠️  Statement ${i + 1} RPC error:`, error.message);
                    } else {
                        console.log(`✅ Statement ${i + 1} executed successfully.`);
                    }
                } catch (err) {
                    console.warn(`⚠️  Statement ${i + 1} exception:`, err.message);
                }
            }
        }
        
        console.log('✅ Migration completed!');
        
        // Verify table accessibility
        const { data, error } = await supabase
            .from('academy_sales_targets')
            .select('*')
            .limit(0);
        
        if (error) {
            console.error('❌ Error verifying table:', error.message);
        } else {
            console.log('✅ academy_sales_targets table is successfully verified and accessible!');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
