require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing service role key in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('Running database migrations to add read_at and cron jobs...');
  
  const sql = `
    -- 1. Add read_at column if not exists
    ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
    
    -- 2. Create helper purge function
    CREATE OR REPLACE FUNCTION public.purge_read_notifications()
    RETURNS void AS $$
    BEGIN
      DELETE FROM public.notifications
      WHERE read = true AND read_at IS NOT NULL AND read_at < now() - interval '1 hour';
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  
  const { data: migrationData, error: migrationError } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (migrationError) {
    console.error('❌ Error applying migration SQL:', migrationError.message);
  } else {
    console.log('✅ Base migration applied successfully (read_at column & purge function).');
  }

  // 3. Try to enable pg_cron and schedule the cron job
  const cronSql = `
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    SELECT cron.schedule('purge-read-notifications-job', '*/5 * * * *', 'SELECT public.purge_read_notifications();');
  `;
  const { data: cronData, error: cronError } = await supabase.rpc('exec_sql', { sql_query: cronSql });
  if (cronError) {
    console.log('⚠️ Could not schedule pg_cron (normal if extension disabled or permission restricted):', cronError.message);
    console.log('💡 Fallback: We will also run the purge cleanup inline in our API endpoints and fetch routes.');
  } else {
    console.log('✅ pg_cron scheduled job configured successfully to run every 5 minutes.');
  }
}

main();
