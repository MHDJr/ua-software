const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
    console.log('Calling reload_schema RPC...');
    const { data, error } = await supabase.rpc('reload_schema');
    if (error) {
        console.error('reload_schema failed:', error.message);
    } else {
        console.log('reload_schema succeeded!');
    }
}

main();
