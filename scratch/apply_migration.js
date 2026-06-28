const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  const migrationPath = path.join(__dirname, '../supabase/migrations/20260628000000_create_monthly_reports_schema.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('====================================================');
  console.log('🚀 REDESIGNED BI REPORTING SYSTEM SCHEMA MIGRATION');
  console.log('====================================================\n');

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env.local\n');
    printSqlEditorManualInstructions(sql);
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('Attempting to apply migration via exec_sql RPC...');
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (error) {
        console.warn('⚠️ exec_sql RPC failed or is not defined:');
        console.warn(error.message);
        console.log('\n----------------------------------------------------');
        printSqlEditorManualInstructions(sql);
    } else {
        console.log('✅ Migration applied successfully via RPC!');
    }
  } catch (err) {
    console.error('❌ Exception applying migration:', err.message);
    printSqlEditorManualInstructions(sql);
  }
}

function printSqlEditorManualInstructions(sql) {
  console.log('🔥 PLEASE RUN THIS SQL IN THE SUPABASE SQL EDITOR:');
  console.log('1. Go to your Supabase Project Dashboard (https://supabase.com/dashboard)');
  console.log('2. Click on the "SQL Editor" in the left sidebar.');
  console.log('3. Click "New Query" and paste the SQL content below:');
  console.log('----------------------------------------------------');
  console.log(sql);
  console.log('----------------------------------------------------');
  console.log('4. Click "Run" to apply the schema updates.');
  console.log('====================================================\n');
}

main();
