const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error("❌ Missing required environment variables in .env.local");
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false }
});

const supabaseStandard = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false }
});

async function runStrategyOfficeTests() {
    console.log("====================================================");
    console.log("🧪 STRATEGY OFFICE DATABASE INTEGRITY & SECURITY TESTS");
    console.log("====================================================\n");

    const tables = [
        "ideas",
        "monthly_plans",
        "strategic_projects",
        "business_journal",
        "decision_log",
        "vision_board",
        "resources"
    ];

    try {
        // TEST 1: SCHEMA CORNERSTONES
        console.log("👉 Test 1: Verifying new strategy tables exist in schema cache...");
        for (const table of tables) {
            const { error } = await supabaseAdmin.from(table).select("id").limit(1);
            if (error) {
                console.error(`❌ Table '${table}' check failed:`, error.message);
                console.log("Please run the migrations in your Supabase SQL Editor first.");
                process.exit(1);
            }
            console.log(`✅ Table '${table}' is active.`);
        }
        console.log("\n");

        // TEST 2: RLS DATA PRIVACY LOCKS
        console.log("👉 Test 2: Verifying RLS access protection on strategy tables...");
        for (const table of tables) {
            console.log(`Checking select query on '${table}' with standard client key...`);
            const { data, error } = await supabaseStandard.from(table).select("id").limit(1);
            
            if (error) {
                console.log(`✅ Success! Read was BLOCKED by RLS. (Error: "${error.message}")`);
            } else if (data && data.length > 0) {
                console.warn(`⚠️ Warning: Read was NOT blocked on table '${table}'. Verify if RLS is enabled.`);
            } else {
                console.log(`✅ Standard client read returned empty array due to RLS/User filters.`);
            }
        }
        console.log("\n");

        console.log("====================================================");
        console.log("✅ STRATEGY OFFICE CONFIGURATION VALIDATIONS COMPLETED");
        console.log("====================================================");

    } catch (e) {
        console.error("❌ Exception during verification:", e);
    }
}

runStrategyOfficeTests();
