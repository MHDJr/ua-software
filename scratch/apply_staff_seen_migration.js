require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🚀 Attempting to run staff seen migration via exec_sql RPC...');
  const sqlPath = path.join(__dirname, '../supabase/migrations/20260621110000_add_staff_seen_columns.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Let's split statements and try to run them, or try to run the whole block
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('❌ Error executing SQL via RPC:', error.message);
    console.log('\n====================================================');
    console.log('🔥 PLEASE RUN THIS SQL IN THE SUPABASE SQL EDITOR:');
    console.log('====================================================\n');
    console.log(sql);
    console.log('\n====================================================\n');
  } else {
    console.log('✅ Migration applied successfully via RPC!');
  }
}

main();
