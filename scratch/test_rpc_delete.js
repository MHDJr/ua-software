const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing service role key in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function runTest() {
  console.log('🚀 Starting Complete Staff Deletion Verification...');
  
  const suffix = Date.now().toString().slice(-6);
  const testEmail = `temp_staff_${suffix}@example.com`;
  const testUsername = `temp_staff_${suffix}`;
  
  console.log(`1. Creating test auth user with email: ${testEmail}`);
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: 'TemporaryPassword123!',
    email_confirm: true
  });
  
  if (authError) {
    console.error('❌ Failed to create auth user:', authError.message);
    return;
  }
  
  const userId = authData.user.id;
  console.log(`✅ Auth user created with ID: ${userId}`);
  
  console.log('2. Inserting profile record...');
  const { error: profileError } = await supabaseAdmin.from('profiles').insert({
    id: userId,
    email: testEmail,
    username: testUsername,
    full_name: 'Temporary Test Staff',
    role: 'staff',
    status: 'active'
  });
  
  if (profileError) {
    console.error('❌ Failed to insert profile:', profileError.message);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return;
  }
  console.log('✅ Profile record inserted successfully.');
  
  console.log('3. Inserting mock dependent records (notifications, monthly_targets)...');
  const { error: notifError } = await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    title: 'Test Notification',
    message: 'This is a test notification for deletion verification.',
    type: 'system'
  });
  
  if (notifError) {
    console.warn('⚠️ Warning: Failed to insert test notification:', notifError.message);
  } else {
    console.log('✅ Test notification inserted.');
  }

  const { error: targetError } = await supabaseAdmin.from('monthly_targets').insert({
    profile_id: userId,
    target_month: '2026-07-01',
    target_value: 100,
    department: 'sales'
  });
  
  if (targetError) {
    console.warn('⚠️ Warning: Failed to insert test target:', targetError.message);
  } else {
    console.log('✅ Test monthly target inserted.');
  }

  console.log('4. Calling RPC delete_profile_cascade...');
  const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('delete_profile_cascade', {
    profile_uuid: userId
  });
  
  if (rpcError) {
    console.error('❌ RPC delete_profile_cascade failed:', rpcError.message);
    console.log('💡 Note: If it says "function does not exist", you need to run the SQL migration in your Supabase Dashboard first.');
    // Clean up manually
    await supabaseAdmin.from('profiles').delete().eq('id', userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return;
  }
  
  console.log(`✅ RPC delete_profile_cascade returned: ${rpcResult}`);
  
  console.log('5. Verifying that the profile has been deleted...');
  const { data: profileCheck } = await supabaseAdmin.from('profiles').select('id').eq('id', userId).maybeSingle();
  if (profileCheck) {
    console.error('❌ FAIL: Profile still exists in the database!');
  } else {
    console.log('✅ Profile is completely gone from the profiles table.');
  }
  
  console.log('6. Verifying that the auth user has been deleted...');
  const { data: authCheckList, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    console.error('❌ Failed to list users:', listError.message);
  } else {
    const userExists = authCheckList.users.some(u => u.id === userId);
    if (userExists) {
      console.error('❌ FAIL: User still exists in auth.users! Deletion did not cascade to Auth.');
    } else {
      console.log('✅ User is completely gone from auth.users.');
    }
  }

  console.log('7. Verifying email reusability (creating a new user with the same email)...');
  const { data: reuseData, error: reuseError } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: 'TemporaryPassword123!',
    email_confirm: true
  });

  if (reuseError) {
    console.error('❌ FAIL: Could not create a new user with the same email. Error:', reuseError.message);
  } else {
    console.log('✅ SUCCESS: Created a new user with the exact same email address! Email is fully reusable.');
    // Clean up reused user
    await supabaseAdmin.auth.admin.deleteUser(reuseData.user.id);
    console.log('✅ Cleanup of reused user complete.');
  }
  
  console.log('🎉 Verification complete!');
}

runTest().catch(console.error);
