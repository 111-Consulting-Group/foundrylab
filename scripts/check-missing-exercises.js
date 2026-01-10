#!/usr/bin/env node
/**
 * Check for missing exercises in workout_sets
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

(async () => {
  try {
    // Sign in as the user
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: 'andywolfedev@gmail.com',
      password: process.argv[2] || '' // Pass password as argument
    });

    if (authError) {
      console.error('❌ Sign in failed. Please provide password as argument:');
      console.error('   node scripts/check-missing-exercises.js YOUR_PASSWORD');
      process.exit(1);
    }

    console.log('✅ Authenticated\n');

    // Get a sample workout
    const { data: workout } = await supabase
      .from('workouts')
      .select('id, focus')
      .eq('user_id', '5c817af2-a8d5-41a1-94e0-8cec84d66d8c')
      .limit(1)
      .single();

    if (!workout) {
      console.log('❌ No workouts found');
      process.exit(0);
    }

    console.log(`📋 Checking workout: ${workout.focus}\n`);

    // Get workout sets with exercise IDs
    const { data: sets } = await supabase
      .from('workout_sets')
      .select('id, exercise_id')
      .eq('workout_id', workout.id);

    console.log(`Found ${sets.length} workout sets\n`);

    // Check which exercise_ids don't exist
    const uniqueExerciseIds = [...new Set(sets.map(s => s.exercise_id))];
    console.log(`Checking ${uniqueExerciseIds.length} unique exercise IDs...\n`);

    const missing = [];
    const found = [];

    for (const exerciseId of uniqueExerciseIds) {
      const { data: exercise } = await supabase
        .from('exercises')
        .select('id, name')
        .eq('id', exerciseId)
        .maybeSingle();

      if (!exercise) {
        missing.push(exerciseId);
        console.log(`❌ Missing: ${exerciseId}`);
      } else {
        found.push(exercise);
        console.log(`✅ Found: ${exercise.name}`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Found exercises: ${found.length}`);
    console.log(`   Missing exercises: ${missing.length}`);

    if (missing.length > 0) {
      console.log(`\n⚠️  Problem: ${missing.length} exercise IDs in workout_sets don't exist in exercises table!`);
      console.log(`   This is why you see "has no exercise associated" errors.`);
      
      // Count affected sets
      const affectedSets = sets.filter(s => missing.includes(s.exercise_id));
      console.log(`   Affected workout sets: ${affectedSets.length}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
