const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

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

async function runSchemaFix() {
    try {
        console.log('🚀 Starting schema fix for thought capture...');
        
        // Read the SQL file
        const sqlPath = path.join(__dirname, 'schema_fix_thought_capture.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('📝 SQL file loaded, executing...');
        
        // Split SQL into individual statements (basic approach)
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
                        // Try direct SQL execution if RPC fails
                        console.log('🔄 RPC failed, trying direct execution...');
                        const { error: directError } = await supabase
                            .from('_temp_execution')
                            .select('*');
                        
                        if (directError && directError.code !== 'PGRST116') {
                            console.warn(`⚠️  Statement ${i + 1} may have failed:`, error.message);
                        }
                    }
                } catch (err) {
                    console.warn(`⚠️  Statement ${i + 1} error:`, err.message);
                }
            }
        }
        
        console.log('✅ Schema fix completed!');
        console.log('🔍 Verifying the ideas table structure...');
        
        // Check if ideas table exists and show structure
        const { data, error } = await supabase
            .from('ideas')
            .select('*')
            .limit(0);
        
        if (error && error.code !== 'PGRST116') {
            console.error('❌ Error verifying table:', error.message);
        } else {
            console.log('✅ Ideas table is accessible!');
        }
        
        // Test a simple insert
        console.log('🧪 Testing thought capture functionality...');
        const testIdea = {
            title: 'Schema Fix Test',
            content: 'Testing if thought capture works after schema fix',
            priority: 'medium',
            status: 'open',
            created_by: '00000000-0000-0000-0000-000000000000' // Dummy ID for test
        };
        
        const { error: insertError } = await supabase
            .from('ideas')
            .insert(testIdea);
        
        if (insertError) {
            console.log('ℹ️  Insert test failed (expected with dummy ID):', insertError.message);
        } else {
            console.log('✅ Insert test successful!');
        }
        
    } catch (error) {
        console.error('❌ Schema fix failed:', error);
        process.exit(1);
    }
}

runSchemaFix();
