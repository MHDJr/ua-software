const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function run() {
    console.log("=== Querying financial_entries sample ===");
    const { data: fin } = await supabase.from('financial_entries').select('*').limit(5);
    console.log(JSON.stringify(fin, null, 2));

    console.log("=== Querying daily_sales_tracking sample ===");
    const { data: sales } = await supabase.from('daily_sales_tracking').select('*').limit(5);
    console.log(JSON.stringify(sales, null, 2));

    console.log("=== Querying staff_presence sample ===");
    const { data: presence } = await supabase.from('staff_presence').select('*').limit(5);
    console.log(JSON.stringify(presence, null, 2));

    console.log("=== Querying tasks sample ===");
    const { data: tasks } = await supabase.from('tasks').select('*').limit(3);
    console.log(JSON.stringify(tasks, null, 2));
}

run();
