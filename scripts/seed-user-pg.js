#!/usr/bin/env node
/**
 * Script to seed/create a user using direct PostgreSQL connection
 * Usage: node scripts/seed-user-pg.js <email> <password> [display-name]
 */

const { Client } = require('pg');
const crypto = require('crypto');
const path = require('path');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Get command line arguments
const email = process.argv[2];
const password = process.argv[3];
const displayName = process.argv[4] || 'ADub';

if (!email || !password) {
  console.error('Usage: node scripts/seed-user-pg.js <email> <password> [display-name]');
  console.error('Example: node scripts/seed-user-pg.js adub@example.com password123 ADub');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL || 
                         process.env.POSTGRES_URL || 
                         'postgresql://postgres:suxha2-bohkEh-gaknek@db.sugewjaiokcxeeicccwn.supabase.co:5432/postgres';

async function seedUser() {
  const client = new Client({ connectionString });
  
  try {
    console.log(`Creating user: ${displayName} (${email})`);
    console.log(`Connecting to database...\n`);
    
    await client.connect();
    
    // Generate a UUID for the user
    const userIdResult = await client.query('SELECT gen_random_uuid() as id');
    const userId = userIdResult.rows[0].id;
    
    // Hash the password (Supabase uses bcrypt)
    // For Supabase, we need to use their password hashing
    // But we can create the user and let them reset password, or use a simpler approach
    const passwordHash = await client.query(`
      SELECT crypt($1, gen_salt('bf')) as hash
    `, [password]);
    
    // Actually, Supabase uses a specific format. Let's use their auth schema functions
    // Or we can insert directly and they'll need to reset password
    console.log('Creating user in auth.users...');
    
    // Insert into auth.users
    await client.query(`
      INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        created_at,
        updated_at,
        raw_app_meta_data,
        raw_user_meta_data,
        is_super_admin,
        role
      ) VALUES (
        $1,
        '00000000-0000-0000-0000-000000000000',
        $2,
        crypt($3, gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        '{"provider":"email","providers":["email"]}',
        $4,
        false,
        'authenticated'
      )
    `, [userId, email, password, JSON.stringify({ display_name: displayName })]);
    
    console.log('✅ User created in auth.users');
    
    // Create user profile
    console.log('Creating user profile...');
    await client.query(`
      INSERT INTO public.user_profiles (
        id,
        email,
        display_name,
        units_preference,
        created_at,
        updated_at
      ) VALUES (
        $1,
        $2,
        $3,
        'imperial',
        NOW(),
        NOW()
      )
    `, [userId, email, displayName]);
    
    console.log('✅ User profile created');
    
    console.log('\n✨ User successfully created!');
    console.log(`   User ID: ${userId}`);
    console.log(`   Email: ${email}`);
    console.log(`   Display Name: ${displayName}`);
    console.log(`   Password: ${password}`);
    
    await client.end();
    
    return userId;
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    await client.end();
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
