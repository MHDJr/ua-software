import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = 
    url && serviceKey 
        ? createClient(url, serviceKey, {
            auth: { persistSession: false },
        })
        : null as any;

// Optional: Add a helper to ensure it's available at runtime
export const getSupabaseAdmin = () => {
    if (!supabaseAdmin) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is missing. Check your environment variables.");
    }
    return supabaseAdmin;
};
