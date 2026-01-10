/**
 * Script to check if a user exists in the database
 * Usage: node scripts/check-user-in-db.js [email or user_id]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase credentials!');
  console.error('Please set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkUser(identifier) {
  console.log(`\n🔍 Checking for user: ${identifier}\n`);

  try {
    // Check in auth.users (using service role to bypass RLS)
    console.log('1. Checking auth.users table...');
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error accessing auth.users:', authError.message);
      // Try alternative method
      console.log('\nTrying alternative method to check auth.users...');
      const { data: users, error: altError } = await supabase.rpc('get_users', {});
      if (altError) {
        console.error('❌ Alternative method also failed:', altError.message);
        console.log('\n⚠️  Cannot access auth.users directly. You may need to check in Supabase Dashboard:');
        console.log('   Authentication > Users');
      }
    } else {
      const matchingUser = authUsers.users.find(
        (u) => u.id === identifier || u.email?.toLowerCase() === identifier.toLowerCase()
      );
      
      if (matchingUser) {
        console.log('✅ Found in auth.users:');
        console.log(`   ID: ${matchingUser.id}`);
        console.log(`   Email: ${matchingUser.email}`);
        console.log(`   Created: ${matchingUser.created_at}`);
        console.log(`   Email Confirmed: ${matchingUser.email_confirmed_at ? 'Yes' : 'No'}`);
        
        // Now check user_profiles
        console.log('\n2. Checking user_profiles table...');
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', matchingUser.id)
          .single();

        if (profileError) {
          if (profileError.code === 'PGRST116') {
            console.log('❌ Profile NOT found in user_profiles table');
            console.log('\n💡 This means the database trigger may not have fired.');
            console.log('   Options:');
            console.log('   1. Check if trigger exists: SELECT * FROM pg_trigger WHERE tgname = \'on_auth_user_created\';');
            console.log('   2. Manually create profile or wait for trigger to fire');
            console.log('   3. Check trigger function: SELECT * FROM pg_proc WHERE proname = \'handle_new_user\';');
          } else {
            console.error('❌ Error checking user_profiles:', profileError.message);
          }
        } else {
          console.log('✅ Found in user_profiles:');
          console.log(`   ID: ${profile.id}`);
          console.log(`   Email: ${profile.email}`);
          console.log(`   Display Name: ${profile.display_name || 'N/A'}`);
          console.log(`   Created: ${profile.created_at}`);
        }
      } else {
        console.log('❌ User NOT found in auth.users');
        console.log('\n💡 Make sure you are:');
        console.log('   1. Using the correct email or user ID');
        console.log('   2. Connected to the correct Supabase project');
        console.log(`   3. Checking in: ${supabaseUrl}`);
      }
    }

    // Also try direct query to user_profiles
    console.log('\n3. Direct query to user_profiles table...');
    const { data: profiles, error: directError } = await supabase
      .from('user_profiles')
      .select('*')
      .or(`id.eq.${identifier},email.ilike.%${identifier}%`);

    if (directError) {
      console.error('❌ Error querying user_profiles:', directError.message);
    } else if (profiles && profiles.length > 0) {
      console.log(`✅ Found ${profiles.length} profile(s):`);
      profiles.forEach((p, i) => {
        console.log(`\n   Profile ${i + 1}:`);
        console.log(`   ID: ${p.id}`);
        console.log(`   Email: ${p.email}`);
        console.log(`   Display Name: ${p.display_name || 'N/A'}`);
      });
    } else {
      console.log('❌ No profiles found matching the identifier');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    console.error(error);
  }
}

// Get identifier from command line args
const identifier = process.argv[2];

if (!identifier) {
  console.error('Usage: node scripts/check-user-in-db.js <email_or_user_id>');
  console.error('Example: node scripts/check-user-in-db.js user@example.com');
  console.error('Example: node scripts/check-user-in-db.js 59af8252-db40-4331-ba0f-ed42be52327b');
  process.exit(1);
}

checkUser(identifier).then(() => {
  console.log('\n✅ Check complete\n');
  process.exit(0);
}).catch((error) => {
  console.error('\n❌ Script failed:', error);
  process.exit(1);
});
