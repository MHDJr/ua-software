const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

const tables = [
    'attendance',
    'staff_presence',
    'ceo_staff_presence',
    'financial_entries',
    'daily_sales_tracking',
    'leads',
    'requests',
    'tasks',
    'profiles',
    'conversions'
];

async function run() {
    for (const t of tables) {
        try {
            const { data, error } = await supabase.from(t).select('*').limit(1);
            if (error) {
                console.log(`Table '${t}' error: ${error.message}`);
            } else {
                console.log(`Table '${t}' exists! Sample row keys:`, data && data.length > 0 ? Object.keys(data[0]) : '(empty table)');
            }
        } catch (e) {
            console.log(`Table '${t}' exception: ${e.message}`);
        }
    }
}

run();
