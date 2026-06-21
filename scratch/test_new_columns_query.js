const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Testing query with new columns...');
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, description, assigned_to, priority, status, progress, due_date, created_by, created_at, updated_at, repeat_daily, is_daily_task, is_staff_seen, staff_seen_at, assigned_to_user:profiles!assigned_to(full_name, department), creator:profiles!created_by(role, is_manager)")
    .limit(1);

  if (error) {
    console.error('❌ Query failed:', error.message, error);
  } else {
    console.log('✅ Query succeeded! Data:', data);
  }
}

main();
