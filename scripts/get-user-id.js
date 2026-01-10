#!/usr/bin/env node
/**
 * Helper script to get user ID from Supabase
 * Usage: node scripts/get-user-id.js [email]
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Load environment variables or use defaults
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 
                    process.env.SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL ||
                    'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                        process.env.SUPABASE_ANON_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const email = process.argv[2];

async function getUserId() {
  try {
    console.log(`Connecting to Supabase at: ${supabaseUrl}\n`);
    
    // Try to get user from user_profiles table first
    let query = supabase.from('user_profiles').select('id, email, display_name');
    
    if (email) {
      query = query.eq('email', email);
      console.log(`Looking for user with email: ${email}`);
    }
    
    const { data: profiles, error: profileError } = await query.limit(10);
    
    if (!profileError && profiles && profiles.length > 0) {
      console.log('\n✅ Found users:');
      profiles.forEach((profile, i) => {
        console.log(`\n${i + 1}. User ID: ${profile.id}`);
        console.log(`   Email: ${profile.email || 'N/A'}`);
        console.log(`   Display Name: ${profile.display_name || 'N/A'}`);
      });
      
      if (profiles.length === 1) {
        console.log(`\n✨ Using user ID: ${profiles[0].id}`);
        return profiles[0].id;
      } else {
        console.log('\nMultiple users found. Please specify which user ID to use.');
        return null;
      }
    }
    
    if (profileError) {
      console.warn('⚠️  Could not query user_profiles:', profileError.message);
    }
    
    // If no profiles found, try direct PostgreSQL connection to query auth.users
    console.log('\n💡 Trying direct PostgreSQL connection to query auth.users...');
    const { Client } = require('pg');
    
    try {
      const connectionString = process.env.DATABASE_URL || 
                               process.env.POSTGRES_URL || 
                               'postgresql://postgres:suxha2-bohkEh-gaknek@db.sugewjaiokcxeeicccwn.supabase.co:5432/postgres';
      
      const client = new Client({ connectionString });
      await client.connect();
      
      const result = await client.query(`
        SELECT id, email, created_at 
        FROM auth.users 
        ORDER BY created_at DESC 
        LIMIT 10
      `);
      
      await client.end();
      
      if (result.rows.length > 0) {
        console.log('\n✅ Found users in auth.users:');
        result.rows.forEach((user, i) => {
          console.log(`\n${i + 1}. User ID: ${user.id}`);
          console.log(`   Email: ${user.email || 'N/A'}`);
          console.log(`   Created: ${user.created_at}`);
        });
        
        if (result.rows.length === 1) {
          console.log(`\n✨ Single user found. User ID: ${result.rows[0].id}`);
          return result.rows[0].id;
        } else if (email) {
          const matchedUser = result.rows.find(u => u.email === email);
          if (matchedUser) {
            console.log(`\n✨ Matched user by email. User ID: ${matchedUser.id}`);
            return matchedUser.id;
          }
        }
      } else {
        console.log('\n⚠️  No users found in auth.users');
      }
    } catch (pgError) {
      console.warn('⚠️  Could not connect to PostgreSQL:', pgError.message);
    }
    
    // Fallback instructions
    console.log('\n💡 To get user ID from auth.users, you can:');
    console.log('   1. Check your browser console when logged into the app');
    console.log('   2. Query the database directly: SELECT id, email FROM auth.users;');
    console.log('   3. Check Supabase dashboard > Authentication > Users');
    
    if (email) {
      console.log(`\n⚠️  No user found with email: ${email}`);
    } else {
      console.log('\n⚠️  No users found in user_profiles table.');
      console.log('   Make sure you have created a user profile first.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getUserId().then(() => process.exit(0));
