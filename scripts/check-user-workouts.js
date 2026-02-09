/**
 * Script to check if a user has any workout data
 * Usage: node scripts/check-user-workouts.js <email>
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUserWorkouts(email) {
  try {
    console.log(`\n🔍 Checking workouts for: ${email}\n`);

    // Find user by email
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserByEmail(email);
    
    if (authError || !authUser) {
      console.error('❌ User not found:', authError?.message || 'No user with that email');
      return;
    }

    const userId = authUser.user.id;
    console.log(`✅ Found user: ${authUser.user.email}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Display Name: ${authUser.user.user_metadata?.display_name || 'N/A'}\n`);

    // Check workouts
    const { data: workouts, error: workoutsError } = await supabase
      .from('workouts')
      .select('id, focus, date_completed, created_at, scheduled_date')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (workoutsError) {
      console.error('❌ Error fetching workouts:', workoutsError);
      return;
    }

    console.log(`📊 Workout Summary:`);
    console.log(`   Total workouts: ${workouts?.length || 0}`);
    
    const completed = workouts?.filter(w => w.date_completed) || [];
    const incomplete = workouts?.filter(w => !w.date_completed) || [];
    
    console.log(`   ✅ Completed: ${completed.length}`);
    console.log(`   ⏳ Incomplete: ${incomplete.length}\n`);

    if (incomplete.length > 0) {
      console.log('⏳ Incomplete Workouts:');
      incomplete.slice(0, 5).forEach((w, i) => {
        console.log(`   ${i + 1}. ${w.focus || 'Untitled'} (Created: ${new Date(w.created_at).toLocaleDateString()})`);
      });
      if (incomplete.length > 5) {
        console.log(`   ... and ${incomplete.length - 5} more`);
      }
      console.log('');
    }

    if (completed.length > 0) {
      console.log('✅ Recent Completed Workouts:');
      completed.slice(0, 5).forEach((w, i) => {
        console.log(`   ${i + 1}. ${w.focus || 'Untitled'} (Completed: ${new Date(w.date_completed).toLocaleDateString()})`);
      });
      console.log('');
    }

    // Check workout sets
    if (workouts && workouts.length > 0) {
      const workoutIds = workouts.map(w => w.id);
      const { data: sets, error: setsError } = await supabase
        .from('workout_sets')
        .select('id, workout_id, exercise_id, duration_seconds, actual_weight, actual_reps, avg_watts, avg_hr')
        .in('workout_id', workoutIds);

      if (!setsError && sets) {
        const cardioSets = sets.filter(s => s.duration_seconds || s.avg_watts || s.avg_hr);
        const strengthSets = sets.filter(s => s.actual_weight || s.actual_reps);
        
        console.log(`💪 Workout Sets:`);
        console.log(`   Total sets: ${sets.length}`);
        console.log(`   🏃 Cardio sets: ${cardioSets.length}`);
        console.log(`   🏋️ Strength sets: ${strengthSets.length}\n`);

        if (cardioSets.length > 0) {
          console.log('🏃 Recent Cardio Sets:');
          cardioSets.slice(0, 3).forEach((s, i) => {
            const details = [];
            if (s.duration_seconds) details.push(`${Math.round(s.duration_seconds / 60)} min`);
            if (s.avg_watts) details.push(`${s.avg_watts}W`);
            if (s.avg_hr) details.push(`${s.avg_hr} bpm`);
            console.log(`   ${i + 1}. ${details.join(', ')}`);
          });
          console.log('');
        }
      }
    }

    // Check if user has any data at all
    if (!workouts || workouts.length === 0) {
      console.log('⚠️  No workout data found. User may have:');
      console.log('   - Started logging but never completed a workout');
      console.log('   - Created a workout but never added sets');
      console.log('   - Not used the app yet\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Get email from command line
const email = process.argv[2];

if (!email) {
  console.error('Usage: node scripts/check-user-workouts.js <email>');
  console.error('Example: node scripts/check-user-workouts.js abby@example.com');
  process.exit(1);
}

checkUserWorkouts(email);
