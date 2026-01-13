#!/usr/bin/env node

/**
 * Create a developer sandbox account for testing
 * 
 * Usage:
 *   node scripts/create-sandbox-account.js
 *   node scripts/create-sandbox-account.js dev@test.com password123 "Dev Tester"
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 
                    process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                        process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Sandbox account credentials
const SANDBOX_EMAIL = process.argv[2] || 'sandbox@foundrylab.dev';
const SANDBOX_PASSWORD = process.argv[3] || 'Sandbox123!';
const SANDBOX_NAME = process.argv[4] || 'Dev Sandbox';

async function createSandboxAccount() {
  try {
    console.log('🧪 Creating Developer Sandbox Account\n');
    console.log(`Email: ${SANDBOX_EMAIL}`);
    console.log(`Password: ${SANDBOX_PASSWORD}`);
    console.log(`Name: ${SANDBOX_NAME}\n`);

    // Step 1: Try to create new user (or sign in if exists)
    console.log('👤 Creating/updating sandbox account...');
    let userId;
    
    // Try to sign up first
    const { data: signupData, error: signupError } = await supabase.auth.signUp({
      email: SANDBOX_EMAIL,
      password: SANDBOX_PASSWORD,
      options: {
        data: {
          display_name: SANDBOX_NAME,
          is_sandbox: true, // Flag for easy identification
        },
        emailRedirectTo: `${supabaseUrl}/auth/callback`,
      },
    });

    if (signupError) {
      if (signupError.message.includes('already registered') || signupError.message.includes('User already registered')) {
        console.log('⚠️  User already exists. Trying to sign in...');
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: SANDBOX_EMAIL,
          password: SANDBOX_PASSWORD,
        });
        
        if (signInError) {
          console.error('❌ Cannot sign in. Password may be incorrect.');
          console.error('   Error:', signInError.message);
          console.log('\n💡 Options:');
          console.log('   1. Reset password in Supabase Dashboard');
          console.log('   2. Delete user and recreate');
          console.log('   3. Use a different email for sandbox');
          process.exit(1);
        }
        
        userId = signInData.user.id;
        console.log('✅ Signed in with existing account');
        console.log(`   User ID: ${userId}`);
      } else {
        console.error('❌ Error creating user:', signupError.message);
        process.exit(1);
      }
    } else {
      if (!signupData.user) {
        console.error('❌ No user returned from signup');
        process.exit(1);
      }
      
      userId = signupData.user.id;
      console.log('✅ User created successfully');
      console.log(`   User ID: ${userId}`);
    }

    // Step 3: Wait for profile trigger (or create manually)
    console.log('\n📝 Checking user profile...');
    
    // Wait a moment for trigger
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.log('⚠️  Profile not found. Creating manually...');
      const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert({
          id: userId,
          email: SANDBOX_EMAIL,
          display_name: SANDBOX_NAME,
          units_preference: 'imperial',
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ Error creating profile:', createError.message);
        console.log('\n💡 You may need to create the profile manually in Supabase Dashboard');
        console.log(`   User ID: ${userId}`);
      } else {
        console.log('✅ Profile created');
      }
    } else {
      // Update profile to ensure it's correct
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          display_name: SANDBOX_NAME,
          email: SANDBOX_EMAIL,
        })
        .eq('id', userId);

      if (updateError) {
        console.log('⚠️  Could not update profile:', updateError.message);
      } else {
        console.log('✅ Profile verified/updated');
      }
    }

    // Step 4: Clear any existing data (clean slate)
    console.log('\n🧹 Clearing existing data for clean slate...');
    
    const { error: deletePRsError } = await supabase
      .from('personal_records')
      .delete()
      .eq('user_id', userId);
    
    const { error: deleteMemoryError } = await supabase
      .from('movement_memory')
      .delete()
      .eq('user_id', userId);
    
    const { error: deleteWorkoutsError } = await supabase
      .from('workouts')
      .delete()
      .eq('user_id', userId);
    
    const { error: deleteBlocksError } = await supabase
      .from('training_blocks')
      .delete()
      .eq('user_id', userId);

    if (deletePRsError || deleteMemoryError || deleteWorkoutsError || deleteBlocksError) {
      console.log('⚠️  Some cleanup errors (may be expected if no data exists)');
    } else {
      console.log('✅ Account cleared - ready for testing');
    }

    // Step 5: Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ SANDBOX ACCOUNT READY');
    console.log('='.repeat(60));
    console.log(`\n📧 Email:    ${SANDBOX_EMAIL}`);
    console.log(`🔑 Password: ${SANDBOX_PASSWORD}`);
    console.log(`👤 Name:     ${SANDBOX_NAME}`);
    console.log(`🆔 User ID:  ${userId}`);
    console.log('\n💡 Use these credentials to log in and test features');
    console.log('   This account is isolated from your main account\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  }
}

createSandboxAccount();
