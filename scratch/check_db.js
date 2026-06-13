require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing env variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('Querying task table columns...');
  const { data, error } = await supabase.from('tasks').select('*').limit(1);
  if (error) {
    console.error('Error fetching task:', error);
  } else {
    console.log('Fetched task keys:', data.length > 0 ? Object.keys(data[0]) : 'No tasks found');
    console.log('Sample task data:', data[0]);
  }
}

main();
