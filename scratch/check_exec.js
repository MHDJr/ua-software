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
  console.log('Testing exec_sql RPC call...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: 'SELECT 1 as val;' });
  if (error) {
    console.error('❌ Error calling exec_sql:', error.message);
  } else {
    console.log('✅ exec_sql works! Result:', data);
  }
}

main();
