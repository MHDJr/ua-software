require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Fetching tasks as service_role...');
  const { data: tasks, error: fetchError } = await supabase.from('tasks').select('*').limit(5);
  if (fetchError) {
    console.error('Error fetching tasks:', fetchError);
    return;
  }
  
  if (tasks.length === 0) {
    console.log('No tasks found to test updating.');
    return;
  }
  
  const targetTask = tasks[0];
  console.log('Testing update on task ID:', targetTask.id);
  console.log('Current task keys:', Object.keys(targetTask));
  console.log('Current delivery_status:', targetTask.delivery_status);
  
  const { data, error } = await supabase
    .from('tasks')
    .update({
      delivery_status: 'read',
      read_at: new Date().toISOString()
    })
    .eq('id', targetTask.id)
    .select();
    
  if (error) {
    console.error('❌ Update failed:', error);
  } else {
    console.log('✅ Update succeeded! Result:', data);
  }
}

main();
