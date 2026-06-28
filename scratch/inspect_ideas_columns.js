const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error("❌ Missing required env variables.");
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey);

async function inspect() {
    console.log("Checking columns of table 'ideas' in public schema...");
    try {
        const { data, error } = await supabaseAdmin.from("ideas").select("*").limit(1);
        if (error) {
            console.error("Error executing select query on ideas:", error.message);
        } else {
            console.log("Columns successfully retrieved or empty row returned:", data);
        }
    } catch (e) {
        console.error("Exception:", e);
    }
}

inspect();
