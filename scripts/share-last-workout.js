#!/usr/bin/env node

/**
 * Script to share the last completed workout to the feed
 * 
 * Usage:
 *   node scripts/share-last-workout.js [user-id]
 * 
 * If user-id is not provided, it will try to find the most recent user
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const userIdArg = process.argv[2];

async function shareLastWorkout() {
  try {
    let userId = userIdArg;

    // If no user ID provided, try to find the most recent user
    if (!userId) {
      console.log('No user ID provided. Finding most recent user...\n');
      
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, email, display_name')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (profileError || !profiles) {
        console.error('❌ Could not find a user. Please provide user ID as argument:');
        console.error('   node scripts/share-last-workout.js YOUR_USER_ID');
        process.exit(1);
      }

      userId = profiles.id;
      console.log(`✅ Using user: ${profiles.email || profiles.display_name || userId}\n`);
    }

    // Find the last completed workout that hasn't been shared
    console.log('Finding last completed workout...\n');
    
    const { data: lastWorkout, error: workoutError } = await supabase
      .from('workouts')
      .select('id, focus, date_completed')
      .eq('user_id', userId)
      .not('date_completed', 'is', null)
      .order('date_completed', { ascending: false })
      .limit(1)
      .single();

    if (workoutError || !lastWorkout) {
      console.error('❌ Could not find a completed workout');
      process.exit(1);
    }

    console.log(`Found workout: ${lastWorkout.focus}`);
    console.log(`Completed: ${lastWorkout.date_completed}\n`);

    // Check if it's already shared
    const { data: existingPost, error: postCheckError } = await supabase
      .from('workout_posts')
      .select('id')
      .eq('workout_id', lastWorkout.id)
      .single();

    if (!postCheckError && existingPost) {
      console.log('✅ This workout is already shared to the feed!');
      process.exit(0);
    }

    // Share the workout
    console.log('Sharing workout to feed...\n');
    
    const { error: shareError } = await supabase
      .from('workout_posts')
      .insert({
        workout_id: lastWorkout.id,
        user_id: userId,
        caption: null,
        is_public: true,
      });

    if (shareError) {
      console.error('❌ Failed to share workout:', shareError.message);
      process.exit(1);
    }

    console.log('✅ Successfully shared workout to feed!');
    console.log(`   Workout: ${lastWorkout.focus}`);
    console.log(`   Post will appear in your feed now.`);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

shareLastWorkout();
