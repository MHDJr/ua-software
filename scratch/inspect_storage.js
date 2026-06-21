const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function main() {
    try {
        console.log("Checking storage buckets...");
        const { data: buckets, error } = await supabase.storage.listBuckets();
        if (error) {
            console.error("Error listing buckets:", error);
            return;
        }
        console.log("Buckets:", buckets);
        
        const hasAvatars = buckets.some(b => b.id === 'avatars');
        if (!hasAvatars) {
            console.log("Bucket 'avatars' not found! Creating 'avatars' bucket...");
            const { data, error: createError } = await supabase.storage.createBucket('avatars', {
                public: true,
                allowedMimeTypes: ['image/*'],
                fileSizeLimit: 5242880 // 5MB
            });
            if (createError) {
                console.error("Error creating bucket:", createError);
            } else {
                console.log("Created bucket 'avatars' successfully:", data);
            }
        } else {
            console.log("Bucket 'avatars' already exists.");
        }
    } catch (err) {
        console.error("Exception in inspect_storage:", err);
    }
}

main();
