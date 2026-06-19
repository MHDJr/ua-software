const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking columns of notifications...");
    const { data, error } = await supabase.from('notifications').select('*').limit(1);
    if (error) {
        console.error("Select failed:", error);
    } else {
        console.log("Sample row keys:", Object.keys(data[0] || {}));
    }
}

run();
