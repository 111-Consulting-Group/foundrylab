/**
 * Check if auth triggers and functions are set up correctly
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  console.log('Required: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or EXPO_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuthSetup() {
  console.log('Checking auth setup...\n');

  try {
    // Check if trigger function exists
    const { data: functions, error: funcError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT proname 
        FROM pg_proc 
        WHERE proname = 'handle_new_user';
      `
    }).catch(() => ({ data: null, error: { message: 'Cannot check functions (requires service role key)' } }));

    if (funcError && funcError.message.includes('service role')) {
      console.log('⚠️  Cannot check database functions without SERVICE_ROLE_KEY');
      console.log('   Using anon key - some checks will be limited\n');
    }

    // Try to check user_profiles table structure
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, email, display_name')
      .limit(1);

    if (profileError) {
      console.error('❌ Error accessing user_profiles table:', profileError.message);
      return;
    }

    console.log('✅ user_profiles table is accessible');

    // Check Supabase auth settings
    console.log('\n📋 Supabase Configuration:');
    console.log(`   URL: ${supabaseUrl}`);
    console.log(`   Key type: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Service Role' : 'Anon'}`);

    // Test signup (dry run - won't actually create)
    console.log('\n🧪 Testing signup flow...');
    console.log('   (This will attempt to create a test user - check Supabase logs for errors)');

    const testEmail = `test-${Date.now()}@example.com`;
    const { data: testSignup, error: testError } = await supabase.auth.signUp({
      email: testEmail,
      password: 'TestPassword123!',
      options: {
        data: { display_name: 'Test User' }
      }
    });

    if (testError) {
      console.error('❌ Test signup failed:', testError.message);
      if (testError.message.includes('already registered')) {
        console.log('   (This is expected if test user already exists)');
      }
    } else if (testSignup.user) {
      console.log('✅ Test signup succeeded');
      console.log(`   User ID: ${testSignup.user.id}`);
      console.log(`   Email: ${testSignup.user.email}`);
      console.log(`   Has session: ${!!testSignup.session}`);

      // Check if profile was created
      const { data: testProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', testSignup.user.id)
        .single();

      if (testProfile) {
        console.log('✅ User profile was created automatically');
      } else {
        console.warn('⚠️  User profile was NOT created automatically');
        console.warn('   The database trigger may not be set up. Run migration 003_auth_triggers.sql');
      }

      // Clean up test user (if using service role)
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        await supabase.auth.admin.deleteUser(testSignup.user.id);
        console.log('   (Test user cleaned up)');
      }
    }

    console.log('\n📝 Next steps:');
    console.log('   1. Ensure migration 003_auth_triggers.sql has been applied');
    console.log('   2. Check Supabase Dashboard > Authentication > Settings');
    console.log('   3. Verify "Enable email confirmations" is OFF (for beta)');
    console.log('   4. Check browser console for any client-side errors');

  } catch (error) {
    console.error('❌ Error checking setup:', error);
  }
}

checkAuthSetup();
