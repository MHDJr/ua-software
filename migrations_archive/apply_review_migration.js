const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
    console.log('🚀 Applying migration: Add reviewed_by_info to tasks...');
    
    const sql = `
        ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reviewed_by_info TEXT;
        COMMENT ON COLUMN tasks.reviewed_by_info IS 'Stores formatted string of who reviewed the task (e.g. "CEO, Sales Manager")';
    `;

    try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        
        if (error) {
            console.error('❌ Error applying migration via RPC:', error.message);
            console.log('Attempting alternative method...');
            // In some environments, RPC exec_sql might not be available.
            // But since I don't have a direct SQL runner tool, I'll provide the SQL for the user.
            console.log('\n--- PLEASE RUN THIS SQL IN SUPABASE SQL EDITOR ---\n');
            console.log(sql);
            console.log('\n--------------------------------------------------\n');
        } else {
            console.log('✅ Migration applied successfully!');
        }
    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
        console.log('\n--- PLEASE RUN THIS SQL IN SUPABASE SQL EDITOR ---\n');
        console.log(sql);
        console.log('\n--------------------------------------------------\n');
    }
}

applyMigration();
