#!/usr/bin/env node
/**
 * Import training block with user authentication
 * This bypasses RLS by authenticating as the user first
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Check if xlsx package is installed
let XLSX;
try {
  XLSX = require('xlsx');
} catch (e) {
  console.error('Error: xlsx package not found. Please install it:');
  console.error('  npm install xlsx');
  process.exit(1);
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Prompt for user credentials
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  const excelFilePath = process.argv[2];
  const emailArg = process.argv[3];
  const passwordArg = process.argv[4];
  
  if (!excelFilePath) {
    console.error('Usage: node scripts/import-with-auth.js <path-to-excel-file> [email] [password]');
    console.error('Example: node scripts/import-with-auth.js "/Users/andywolfe/Documents/Fitness/2026 Block 1.xlsx" email@example.com password');
    console.error('         (if email/password omitted, you will be prompted)');
    process.exit(1);
  }

  const fullPath = path.isAbsolute(excelFilePath) ? excelFilePath : path.join(process.cwd(), excelFilePath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Error: File not found: ${fullPath}`);
    process.exit(1);
  }

  let email, password;

  if (emailArg && passwordArg) {
    email = emailArg;
    password = passwordArg;
    console.log('🔐 Using provided credentials\n');
  } else {
    console.log('🔐 Please sign in to import your training block:\n');
    email = await question('Email: ');
    password = await question('Password: ');
    rl.close();
  }

  console.log('\n🔑 Signing in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError) {
    console.error('❌ Sign in failed:', authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`✅ Signed in as: ${authData.user.email}\n`);

  // Now run the import logic
  await importTrainingBlock(fullPath, userId);
}

async function importTrainingBlock(fullPath, userId) {
  try {
    console.log(`Reading Excel file: ${fullPath}`);

    const workbook = XLSX.readFile(fullPath);
    console.log('Found sheets:', workbook.SheetNames.join(', '), '\n');

    const parsedData = {
      blockName: path.basename(fullPath, path.extname(fullPath)).replace(/ Block \d+/, ''),
      workouts: [],
    };

    let currentWeek = 0;
    let currentDay = 0;
    let currentFocus = '';

    // Parse workbook (same logic as original script)
    for (const sheetName of workbook.SheetNames) {
      if (!sheetName.startsWith('Week ')) continue;

      currentWeek = parseInt(sheetName.replace('Week ', ''), 10);
      if (isNaN(currentWeek)) continue;

      console.log(`Parsing ${sheetName} (Week ${currentWeek})...`);

      const worksheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null, raw: false });

      for (let i = 0; i < sheetData.length; i++) {
        const row = sheetData[i];
        const firstCell = row[0];

        if (typeof firstCell === 'string' && firstCell.match(/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)/i)) {
          currentDay++;
          currentFocus = firstCell.split('—')[1]?.trim() || firstCell;
          console.log(`  Found ${firstCell}`);

          let headerRowIndex = i + 1;
          while (headerRowIndex < sheetData.length && (!sheetData[headerRowIndex][0] || sheetData[headerRowIndex][0].toLowerCase() !== 'exercise')) {
            headerRowIndex++;
          }

          if (headerRowIndex < sheetData.length) {
            const headers = sheetData[headerRowIndex].map(h => h ? h.toLowerCase().replace(/[^a-z0-9]/g, '') : null);
            const exerciseCol = headers.indexOf('exercise');
            const setsRepsCol = headers.indexOf('setsreps');
            const tempoCol = headers.indexOf('tempo');
            const restCol = headers.indexOf('rest');
            const rpeCol = headers.indexOf('rpe');
            const loadCol = headers.indexOf('load');
            const notesCol = headers.indexOf('notes');

            const workoutExercises = [];
            let exerciseRowIndex = headerRowIndex + 1;

            while (exerciseRowIndex < sheetData.length && sheetData[exerciseRowIndex][exerciseCol]) {
              const exerciseRow = sheetData[exerciseRowIndex];
              const exerciseName = exerciseRow[exerciseCol]?.trim();
              const setsReps = exerciseRow[setsRepsCol]?.trim();
              const tempo = exerciseRow[tempoCol]?.trim();
              const rest = exerciseRow[restCol]?.trim();
              const rpe = exerciseRow[rpeCol]?.trim();
              const load = exerciseRow[loadCol]?.trim();
              const notes = exerciseRow[notesCol]?.trim();

              if (exerciseName && setsReps) {
                const sets = [];
                const [numSetsStr, repsRange] = setsReps.split('×');
                const numSets = parseInt(numSetsStr, 10);

                if (!isNaN(numSets) && numSets > 0) {
                  for (let s = 1; s <= numSets; s++) {
                    sets.push({
                      set_order: s,
                      target_reps: repsRange ? parseInt(repsRange.split('-')[0], 10) : null,
                      target_rpe: rpe ? parseFloat(rpe.split('-')[0]) : null,
                      target_load: load ? parseFloat(load) : null,
                      tempo: tempo || null,
                      notes: notes || null,
                    });
                  }
                } else if (setsReps.toLowerCase().includes('min')) {
                  sets.push({
                    set_order: 1,
                    duration_seconds: parseDurationToSeconds(setsReps),
                    notes: notes || null,
                  });
                } else {
                  sets.push({
                    set_order: 1,
                    notes: `${setsReps} ${notes || ''}`.trim(),
                  });
                }

                workoutExercises.push({
                  exercise_name: exerciseName,
                  sets: sets,
                });
                console.log(`    Added: ${exerciseName} (${setsReps})`);
              }
              exerciseRowIndex++;
            }

            parsedData.workouts.push({
              week_number: currentWeek,
              day_number: currentDay,
              focus: currentFocus,
              exercises: workoutExercises,
            });
          }
          i = exerciseRowIndex - 1;
        }
      }
    }

    console.log(`\n✅ Parsed ${parsedData.workouts.length} workouts across all weeks`);

    const maxWeek = Math.max(...parsedData.workouts.map(w => w.week_number), 0);
    const durationWeeks = maxWeek || 6;

    console.log('\nCreating training block...');
    const blockName = "2026 Block 1 - Hybrid Focus";
    const blockDescription = `Imported from ${path.basename(fullPath)}`;

    console.log(`Block name: ${blockName}`);
    console.log(`Duration: ${durationWeeks} weeks`);
    console.log(`Total workouts: ${parsedData.workouts.length}`);

    // Deactivate any existing active blocks
    await supabase
      .from('training_blocks')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    // Create the training block
    const { data: block, error: blockError } = await supabase
      .from('training_blocks')
      .insert({
        user_id: userId,
        name: blockName,
        description: blockDescription,
        start_date: new Date().toISOString().split('T')[0],
        duration_weeks: durationWeeks,
        is_active: true,
      })
      .select()
      .single();

    if (blockError) {
      console.error('Error creating training block:', blockError);
      throw blockError;
    }

    console.log(`Created training block: ${block.name} (ID: ${block.id})`);

    // Get all exercises from database for name matching
    const { data: exercises, error: exercisesError } = await supabase
      .from('exercises')
      .select('id, name');

    if (exercisesError) {
      console.error('Error fetching exercises:', exercisesError);
      throw exercisesError;
    }

    const exerciseMap = new Map(exercises.map(e => [e.name.toLowerCase().trim(), e.id]));
    console.log(`Loaded ${exercises.length} exercises from database`);

    // Create workouts and sets
    const startDate = new Date();
    let workoutCount = 0;
    let setCount = 0;

    for (const workout of parsedData.workouts) {
      const daysOffset = (workout.week_number - 1) * 7 + (workout.day_number - 1);
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(startDate.getDate() + daysOffset);

      const { data: createdWorkout, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          block_id: block.id,
          user_id: userId,
          week_number: workout.week_number,
          day_number: workout.day_number,
          focus: workout.focus,
          scheduled_date: scheduledDate.toISOString().split('T')[0],
        })
        .select()
        .single();

      if (workoutError) {
        console.error('Error creating workout:', workoutError);
        throw workoutError;
      }

      workoutCount++;

      const setsToInsert = [];

      for (const exercise of workout.exercises) {
        const exerciseId = exerciseMap.get(exercise.exercise_name.toLowerCase().trim());
        if (!exerciseId) {
          console.warn(`  ⚠️ Exercise not found in database, skipping: "${exercise.exercise_name}"`);
          continue;
        }

        exercise.sets.forEach((set) => {
          setsToInsert.push({
            workout_id: createdWorkout.id,
            exercise_id: exerciseId,
            set_order: set.set_order,
            target_reps: set.target_reps,
            target_rpe: set.target_rpe,
            target_load: set.target_load,
            tempo: set.tempo,
            duration_seconds: set.duration_seconds,
            notes: set.notes,
            is_warmup: false,
            is_pr: false,
          });
        });
      }

      if (setsToInsert.length > 0) {
        const { error: setsError } = await supabase
          .from('workout_sets')
          .insert(setsToInsert);

        if (setsError) {
          console.error('Error creating workout sets:', setsError);
          throw setsError;
        }
        setCount += setsToInsert.length;
      }
    }

    console.log(`\n🎉 Successfully imported training block "${block.name}"`);
    console.log(`  Workouts created: ${workoutCount}`);
    console.log(`  Sets created: ${setCount}`);

  } catch (error) {
    console.error('\n❌ Error during import:', error.message);
    process.exit(1);
  }
}

function parseDurationToSeconds(durationStr) {
  const match = durationStr.match(/(\d+)-?(\d+)?\s*min/i);
  if (match) {
    const min1 = parseInt(match[1], 10);
    const min2 = match[2] ? parseInt(match[2], 10) : min1;
    return Math.round(((min1 + min2) / 2) * 60);
  }
  return null;
}

main().catch(console.error);
