const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function queryProfiles() {
    try {
        console.log("Querying profiles...");
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, role, is_manager, department');
        
        if (error) {
            console.error("Profiles Error:", error);
        } else {
            console.log("Profiles Row Count:", data.length);
            console.log("Profiles Rows:\n", JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error("Catch Error:", err);
    }
}

queryProfiles();
