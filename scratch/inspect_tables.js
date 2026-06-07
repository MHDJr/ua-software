const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function inspectSchema() {
    try {
        console.log("Inspecting academy_financial_targets and academy_sales_targets schemas...");
        
        const sql = `
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name IN ('academy_financial_targets', 'academy_sales_targets')
            ORDER BY table_name, ordinal_position;
        `;
        
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) {
            console.error("RPC Error:", error);
        } else {
            console.log("Schema Columns:\n", JSON.stringify(data, null, 2));
        }
    } catch (err) {
        console.error("Catch Error:", err);
    }
}

inspectSchema();
