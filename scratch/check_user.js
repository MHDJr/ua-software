const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking profiles table...");
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .ilike('username', 'Nourin')
        .maybeSingle();

    if (error) {
        console.error("Error fetching profile:", error);
    } else {
        console.log("Nourin profile:", profile);
    }
}

run();
