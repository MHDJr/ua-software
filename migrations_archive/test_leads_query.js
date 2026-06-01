
const { createClient } = require('@supabase/supabase-js');
// Need to mock environment variables if possible, or use real ones if available in the environment
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing SUPABASE environment variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQuery() {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    console.log("Three days ago:", threeDaysAgo);
    
    const { data, error } = await supabase
        .from("leads")
        .select("*")
        .or(`created_at.gte.${threeDaysAgo},status.eq.converted,updated_at.gte.${threeDaysAgo}`)
        .order("updated_at", { ascending: false });
        
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Leads count:", data.length);
        console.log("First 3 leads:", data.slice(0, 3));
    }
}

testQuery();
