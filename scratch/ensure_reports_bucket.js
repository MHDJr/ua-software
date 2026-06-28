const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
});

async function run() {
    try {
        console.log("Checking storage buckets...");
        const { data: buckets, error } = await supabase.storage.listBuckets();
        if (error) {
            console.error("Error listing buckets:", error);
            return;
        }
        console.log("Existing buckets:", buckets.map(b => b.name));
        
        const hasReports = buckets.some(b => b.id === 'reports');
        if (!hasReports) {
            console.log("Bucket 'reports' not found! Creating 'reports' bucket...");
            const { data, error: createError } = await supabase.storage.createBucket('reports', {
                public: false, // reports should be private and secure, accessed only via admin client or signed URLs
                allowedMimeTypes: ['application/pdf'],
                fileSizeLimit: 10485760 // 10MB
            });
            if (createError) {
                console.error("Error creating bucket:", createError);
            } else {
                console.log("Created bucket 'reports' successfully:", data);
            }
        } else {
            console.log("Bucket 'reports' already exists.");
        }
    } catch (e) {
        console.error("Exception checking/creating reports bucket:", e);
    }
}

run();
