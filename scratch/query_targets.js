const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function queryTargets() {
    try {
        console.log("Querying academy_sales_targets...");
        const { data: salesTargets, error: salesError } = await supabase
            .from('academy_sales_targets')
            .select('*');
        
        if (salesError) {
            console.error("Sales Targets Error:", salesError);
        } else {
            console.log("Sales Targets Row Count:", salesTargets.length);
            console.log("Sales Targets Rows:\n", JSON.stringify(salesTargets, null, 2));
        }

        console.log("\nQuerying monthly_targets...");
        const { data: monthlyTargets, error: monthlyError } = await supabase
            .from('monthly_targets')
            .select('*');
        
        if (monthlyError) {
            console.error("Monthly Targets Error:", monthlyError);
        } else {
            console.log("Monthly Targets Row Count:", monthlyTargets.length);
            console.log("Monthly Targets Rows:\n", JSON.stringify(monthlyTargets, null, 2));
        }
    } catch (err) {
        console.error("Catch Error:", err);
    }
}

queryTargets();
