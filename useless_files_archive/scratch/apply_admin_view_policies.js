const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/Users/muhammed/Documents/inventions/UA-Software/project/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

const sqlStatements = [
    // 1. Policy on financial_entries FOR SELECT to allow both ceo and manager to view all
    `DROP POLICY IF EXISTS "CEO can view all financial entries" ON financial_entries;`,
    `DROP POLICY IF EXISTS "CEO and Managers can view all financial entries" ON financial_entries;`,
    `CREATE POLICY "CEO and Managers can view all financial entries" ON financial_entries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true)));`,

    // 2. Policy on daily_reports FOR SELECT to allow managers to view all daily reports
    `DROP POLICY IF EXISTS "Users can view own daily reports" ON daily_reports;`,
    `CREATE POLICY "Users can view own daily reports" ON daily_reports FOR SELECT TO authenticated USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true)));`,

    // 3. Policy on conversions FOR SELECT to allow managers to view all conversions
    `DROP POLICY IF EXISTS "CEO can view all conversions" ON conversions;`,
    `DROP POLICY IF EXISTS "CEO and Managers can view all conversions" ON conversions;`,
    `CREATE POLICY "CEO and Managers can view all conversions" ON conversions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (role = 'ceo' OR role = 'manager' OR is_manager = true)));`
];

async function apply() {
    console.log('⚡ Deploying Administrator read-only RLS policies for financial_entries, daily_reports, and conversions...');
    for (const sql of sqlStatements) {
        console.log('Running:', sql);
        const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (error) {
            console.error('Error:', error.message);
        } else {
            console.log('✅ Success!');
        }
    }
    console.log('🎉 Done!');
}

apply();
