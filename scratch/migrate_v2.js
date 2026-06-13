require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing service role key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🚀 Checking/Migrating delivery_status and read_at columns...');
  
  // 1. Add delivery_status column
  const query1 = `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'sent' CHECK (delivery_status IN ('sent', 'delivered', 'read'));`;
  console.log(`Executing: ${query1}`);
  const res1 = await supabase.rpc('exec_sql', { sql_query: query1 });
  if (res1.error) {
    console.error('❌ Error adding delivery_status:', res1.error.message);
  } else {
    console.log('✅ delivery_status column checked/added!');
  }

  // 2. Add read_at column
  const query2 = `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;`;
  console.log(`Executing: ${query2}`);
  const res2 = await supabase.rpc('exec_sql', { sql_query: query2 });
  if (res2.error) {
    console.error('❌ Error adding read_at:', res2.error.message);
  } else {
    console.log('✅ read_at column checked/added!');
  }

  // 3. Print existing columns of tasks table
  const query3 = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tasks';`;
  console.log(`Executing: ${query3}`);
  const res3 = await supabase.rpc('exec_sql', { sql_query: query3 });
  if (res3.error) {
    console.error('❌ Error getting columns:', res3.error.message);
  } else {
    console.log('Columns in tasks table:', res3.data);
  }
}

main();
