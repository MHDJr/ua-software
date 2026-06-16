const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('--- TESTING NOTIFICATIONS INSERTION ---');
  
  // Let's fetch one profile to get a valid user_id
  const { data: profiles, error: pError } = await serviceClient
    .from('profiles')
    .select('id, full_name, role')
    .limit(5);
    
  if (pError) {
    console.error('Failed to fetch profiles:', pError);
    return;
  }
  
  console.log('Available profiles:', profiles);
  if (profiles.length === 0) {
    console.error('No profiles found in the database');
    return;
  }
  
  const testUserId = profiles[0].id;
  const testUserName = profiles[0].full_name;
  
  console.log(`\nTesting insert as Service Role for user ${testUserName} (${testUserId})...`);
  const { data: sInsert, error: sInsertErr } = await serviceClient
    .from('notifications')
    .insert({
      user_id: testUserId,
      title: 'TEST SERVICE ROLE',
      message: 'This is a test notification from service role client',
      type: 'message'
    })
    .select();
    
  if (sInsertErr) {
    console.error('❌ Service role insert failed:', sInsertErr);
  } else {
    console.log('✅ Service role insert succeeded:', sInsert);
    // Delete the test notification
    const { error: sDelErr } = await serviceClient
      .from('notifications')
      .delete()
      .eq('id', sInsert[0].id);
    console.log('Deleted test notification:', sDelErr ? 'failed' : 'succeeded');
  }
  
  console.log(`\nTesting insert as Anon Client for user ${testUserId}...`);
  const { data: aInsert, error: aInsertErr } = await anonClient
    .from('notifications')
    .insert({
      user_id: testUserId,
      title: 'TEST ANON CLIENT',
      message: 'This is a test notification from anon client',
      type: 'message'
    })
    .select();
    
  if (aInsertErr) {
    console.error('❌ Anon client insert failed:', aInsertErr);
  } else {
    console.log('✅ Anon client insert succeeded:', aInsert);
  }
}

test();
