#!/usr/bin/env node
/**
 * Script to create user through Supabase Auth API (proper way)
 * Usage: node scripts/create-user-auth.js <email> <password> [display-name]
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

const email = process.argv[2] || 'andywolfe15@yahoo.com';
const password = process.argv[3] || 'password1';
const displayName = process.argv[4] || 'ADub';

async function createUserAuth() {
  try {
    console.log(`Creating user through Supabase Auth: ${displayName} (${email})`);
    console.log(`URL: ${supabaseUrl}\n`);
    
    // First, try to delete existing user if it exists (using direct DB if needed)
    // Actually, we can't delete through auth API without admin key, so we'll try signup
    // If user exists, signup will fail, but we can check
    
    // Try to sign up (will fail if user exists, but that's OK)
    console.log('Attempting to sign up new user...');
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
        emailRedirectTo: `${supabaseUrl}/auth/callback`,
      },
    });
    
    if (signupError) {
      if (signupError.message.includes('already registered') || signupError.message.includes('User already registered')) {
        console.log('⚠️  User already exists. Trying to sign in...');
        
        // Try to sign in - if password is wrong, we need to reset it
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (signInError) {
          console.error('❌ Cannot sign in with existing user:', signInError.message);
          console.log('\n💡 The existing user may have been created incorrectly.');
          console.log('   Options:');
          console.log('   1. Reset password through Supabase dashboard');
          console.log('   2. Delete user from auth.users and recreate');
          console.log('   3. Use service role key to update user password');
          return;
        }
        
        console.log('✅ Successfully signed in with existing user!');
        console.log(`   User ID: ${signInData.user.id}`);
        return signInData.user.id;
      } else {
        console.error('❌ Error signing up:', signupError.message);
        return;
      }
    }
    
    if (!signupData.user) {
      console.error('❌ No user returned from signup');
      return;
    }
    
    console.log('✅ User created successfully!');
    console.log(`   User ID: ${signupData.user.id}`);
    console.log(`   Email: ${signupData.user.email}`);
    
    // Note: Email confirmation may be required depending on Supabase settings
    if (signupData.user && !signupData.session) {
      console.log('⚠️  Email confirmation may be required');
      console.log('   Check your email or disable email confirmation in Supabase settings');
    }
    
    // Create user profile
    console.log('\nCreating user profile...');
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
      if (profileError.code === '23505') { // Duplicate key
        console.log('⚠️  User profile already exists');
      } else {
        console.error('❌ Error creating user profile:', profileError.message);
        console.log('   User ID for manual profile creation:', signupData.user.id);
        return signupData.user.id;
      }
    } else {
      console.log('✅ User profile created');
    }
    
    console.log('\n✨ User setup complete!');
    console.log(`   User ID: ${signupData.user.id}`);
    console.log(`   Email: ${email}`);
    console.log(`   Display Name: ${displayName}`);
    
    return signupData.user.id;
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

createUserAuth().then((userId) => {
  if (userId) {
    console.log(`\n💡 You can now log in with:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
  }
  process.exit(0);
});
