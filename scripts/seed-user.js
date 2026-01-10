#!/usr/bin/env node
/**
 * Script to seed/create a user in Supabase
 * Usage: node scripts/seed-user.js <email> <password> [display-name]
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 
                    process.env.SUPABASE_URL || 
                    'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                        process.env.SUPABASE_ANON_KEY || 
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Get command line arguments
const email = process.argv[2];
const password = process.argv[3];
const displayName = process.argv[4] || 'ADub';

if (!email || !password) {
  console.error('Usage: node scripts/seed-user.js <email> <password> [display-name]');
  console.error('Example: node scripts/seed-user.js adub@example.com password123 ADub');
  process.exit(1);
}

async function seedUser() {
  try {
    console.log(`Creating user: ${displayName} (${email})`);
    console.log(`Connecting to: ${supabaseUrl}\n`);
    
    // Create user in auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        display_name: displayName,
      },
    });
    
    if (authError) {
      // If admin API not available, try regular signup
      if (authError.message.includes('admin') || authError.message.includes('service_role')) {
        console.log('Admin API not available, trying regular signup...');
        const { data: signupData, error: signupError } = await supabase.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              display_name: displayName,
            },
          },
        });
        
        if (signupError) {
          console.error('Error creating user:', signupError.message);
          process.exit(1);
        }
        
        if (!signupData.user) {
          console.error('User creation failed - no user returned');
          process.exit(1);
        }
        
        console.log('✅ User created in auth:', signupData.user.id);
        console.log('⚠️  Note: Email confirmation may be required');
        
        // Create user profile
        const { data: profileData, error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: signupData.user.id,
            email: email,
            display_name: displayName,
            units_preference: 'imperial',
          })
          .select()
          .single();
        
        if (profileError) {
          console.error('Error creating user profile:', profileError.message);
          console.log('\nUser ID for manual profile creation:', signupData.user.id);
          process.exit(1);
        }
        
        console.log('✅ User profile created');
        console.log('\n✨ User successfully created!');
        console.log(`   User ID: ${signupData.user.id}`);
        console.log(`   Email: ${email}`);
        console.log(`   Display Name: ${displayName}`);
        return signupData.user.id;
      } else {
        console.error('Error creating user:', authError.message);
        process.exit(1);
      }
    }
    
    if (!authData.user) {
      console.error('User creation failed - no user returned');
      process.exit(1);
    }
    
    console.log('✅ User created in auth:', authData.user.id);
    
    // Create user profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email: email,
        display_name: displayName,
        units_preference: 'imperial',
      })
      .select()
      .single();
    
    if (profileError) {
      console.error('Error creating user profile:', profileError.message);
      console.log('\nUser ID for manual profile creation:', authData.user.id);
      process.exit(1);
    }
    
    console.log('✅ User profile created');
    console.log('\n✨ User successfully created!');
    console.log(`   User ID: ${authData.user.id}`);
    console.log(`   Email: ${email}`);
    console.log(`   Display Name: ${displayName}`);
    
    return authData.user.id;
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

seedUser().then((userId) => {
  if (userId) {
    console.log(`\n💡 You can now use this user ID: ${userId}`);
    console.log(`   To import your training block, run:`);
    console.log(`   node scripts/import-excel-block.js "/Users/andywolfe/Documents/Fitness/2026 Block 1.xlsx" "${userId}"`);
  }
  process.exit(0);
});
