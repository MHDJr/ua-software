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
  console.log('Inspecting policies on notifications table...');
  const sql = `
    SELECT tablename, policyname, cmd, qual, with_check 
    FROM pg_policies 
    WHERE tablename = 'notifications';
  `;
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('❌ Error calling exec_sql:', error.message);
  } else {
    console.log('✅ Active RLS policies for notifications:');
    console.log(JSON.stringify(data, null, 2));
  }
}

main();
