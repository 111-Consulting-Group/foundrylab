/**
 * Fix user signup issues:
 * 1. Check if trigger exists and is working
 * 2. Manually create user profile if trigger didn't fire
 * 3. Confirm user email if needed
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.local') });
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Error: Missing Supabase credentials!');
  console.error('Please set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function checkTrigger() {
  console.log('📋 Checking if database trigger exists...\n');
  
  try {
    // In managed Supabase, we can't directly query pg_trigger via REST API
    // We'll test if the trigger works by checking if profiles are created automatically
    // This is a limitation - you need to check in Supabase Dashboard > Database > Triggers
    console.log('ℹ️  To verify trigger exists:');
    console.log('   1. Go to Supabase Dashboard > Database > Database Functions');
    console.log('   2. Look for "handle_new_user" function');
    console.log('   3. Go to Database > Triggers');
    console.log('   4. Look for "on_auth_user_created" trigger on auth.users table\n');

    if (error) {
      console.log('⚠️  Cannot directly check trigger (this is normal in managed Supabase)');
      console.log('   We\'ll verify by checking if the function can be called\n');
    } else if (triggers && triggers.length > 0) {
      console.log('✅ Trigger appears to exist in database');
    } else {
      console.log('⚠️  Trigger may not exist - you may need to run migration 003_auth_triggers.sql\n');
    }
  } catch (err) {
    console.log('⚠️  Could not verify trigger (this is OK - managed Supabase restrictions)');
    console.log('   We\'ll test by attempting to create a profile\n');
  }
}

async function fixUser(userEmailOrId) {
  console.log(`\n🔧 Fixing user: ${userEmailOrId}\n`);

  // 1. Find the user
  let user = null;
  if (userEmailOrId.includes('@')) {
    // Search by email
    const { data: users, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error('❌ Error listing users:', error.message);
      return;
    }
    user = users.users.find(u => u.email === userEmailOrId);
  } else {
    // Assume it's a user ID
    const { data, error } = await supabase.auth.admin.getUserById(userEmailOrId);
    if (error) {
      console.error('❌ Error getting user:', error.message);
      return;
    }
    user = data.user;
  }

  if (!user) {
    console.error('❌ User not found!');
    return;
  }

  console.log(`✅ Found user: ${user.id}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   Created: ${user.created_at}`);
  console.log(`   Email Confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'}\n`);

  // 2. Confirm email if not confirmed
  if (!user.email_confirmed_at) {
    console.log('📧 Confirming user email...');
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { email_confirm: true }
    );

    if (updateError) {
      console.error('❌ Error confirming email:', updateError.message);
    } else {
      console.log('✅ Email confirmed successfully\n');
    }
  }

  // 3. Check if profile exists
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('❌ Error checking profile:', profileError.message);
    return;
  }

  if (profile) {
    console.log('✅ User profile already exists:');
    console.log(`   ID: ${profile.id}`);
    console.log(`   Email: ${profile.email}`);
    console.log(`   Display Name: ${profile.display_name || '(not set)'}\n`);
    console.log('✅ User is fully set up!\n');
    return;
  }

  // 4. Create profile manually
  console.log('👤 Creating user profile manually...');
  const { data: newProfile, error: createError } = await supabase
    .from('user_profiles')
    .insert({
      id: user.id,
      email: user.email,
      display_name: user.user_metadata?.display_name || null,
    })
    .select()
    .single();

  if (createError) {
    console.error('❌ Error creating profile:', createError.message);
    console.error('   Code:', createError.code);
    console.error('\n💡 This might be an RLS issue. The trigger should have created this automatically.');
    console.error('   Please check:');
    console.error('   1. Has migration 003_auth_triggers.sql been applied?');
    console.error('   2. Does the handle_new_user function exist?');
    console.error('   3. Is the trigger on_auth_user_created attached to auth.users?');
    return;
  }

  console.log('✅ User profile created successfully:');
  console.log(`   ID: ${newProfile.id}`);
  console.log(`   Email: ${newProfile.email}`);
  console.log(`   Display Name: ${newProfile.display_name || '(not set)'}\n`);
  console.log('✅ User is now fully set up and can log in!\n');
}

async function main() {
  const userEmailOrId = process.argv[2];

  if (!userEmailOrId) {
    console.log('Usage: node scripts/fix-user-signup.js <user_email_or_id>');
    console.log('\nExample:');
    console.log('  node scripts/fix-user-signup.js corecompetency52@gmail.com');
    console.log('  node scripts/fix-user-signup.js 59af8252-db40-4331-ba0f-ed42be52327b');
    process.exit(0);
  }

  await checkTrigger();
  await fixUser(userEmailOrId);
}

main();
