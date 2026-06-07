const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function inspectViewsDirectly() {
    for (const viewName of ['staff_directives', 'staff_performance_summary', 'ceo_staff_presence']) {
        console.log(`\n--- Inspecting view: ${viewName} ---`);
        try {
            const { data, error } = await supabase.from(viewName).select('*').limit(1);
            if (error) {
                console.error(`Error querying ${viewName}:`, error.message, error);
            } else {
                console.log(`Success querying ${viewName}. Sample row:`, data);
            }
        } catch (e) {
            console.error(`Exception querying ${viewName}:`, e);
        }
    }
}

inspectViewsDirectly();
