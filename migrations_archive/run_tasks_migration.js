const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function run() {
    console.log("🚀 Running tasks schema migration...");
    const statements = [
        `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100);`,
        `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS "updatedAt" TEXT;`,
        `ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;`,
        `ALTER TABLE tasks DROP CONSTRAINT IF EXISTS status_check;`,
        `ALTER TABLE tasks ADD CONSTRAINT tasks_status_check CHECK (
            status IN (
                'pending', 'in_progress', 'completed', 'paused', 'in_review',
                'PENDING', 'IN_PROGRESS', 'UNDER_REVIEW', 'COMPLETED'
            )
        );`
    ];
    
    for (const stmt of statements) {
        console.log(`⚡ Executing statement: ${stmt}`);
        try {
            const { error } = await supabase.rpc('exec_sql', { sql_query: stmt });
            if (error) {
                console.error("⚠️ RPC Error:", error.message);
                console.log("This is expected if the RPC function 'exec_sql' is not available. Please run this in the Supabase SQL editor instead.");
            } else {
                console.log("✅ Statement executed successfully!");
            }
        } catch (e) {
            console.error("❌ Exception executing statement:", e.message);
        }
    }
    console.log("🎉 Migration process completed!");
}

run();
