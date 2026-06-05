const { createClient } = require('/Users/muhammed/Documents/inventions/UA-Software/project/node_modules/@supabase/supabase-js');

const supabaseUrl = 'https://eylimdqvkelknscrjfij.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5bGltZHF2a2Vsa25zY3JqZmlqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTc0NDAwOCwiZXhwIjoyMDg1MzIwMDA4fQ.iWYDY5Zjwq31ywiho3AjX4xpstZ44YoiRoGbpB4WZsY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Checking columns of demo_requests...");
    const { data: cols, error: colsErr } = await supabase.rpc('inspect_table_cols', { table_name: 'demo_requests' });
    if (colsErr) {
        // If inspect_table_cols doesn't exist, let's query via normal SQL if we have a way, or try select * limit 1
        console.log("RPC inspect_table_cols failed, trying direct select limit 1");
        const { data, error } = await supabase.from('demo_requests').select('*').limit(1);
        if (error) {
            console.error("Select failed:", error);
        } else {
            console.log("Sample row keys:", Object.keys(data[0] || {}));
        }
    } else {
        console.log("Columns:", cols);
    }
}

run();
