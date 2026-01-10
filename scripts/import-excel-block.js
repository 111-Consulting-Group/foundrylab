#!/usr/bin/env node
/**
 * Script to import a training block from Excel into the database
 * Usage: node scripts/import-excel-block.js <path-to-excel-file> [user-id]
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

// Load environment variables or use defaults
// Check for remote Supabase first (from .env), then local defaults
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 
                    process.env.SUPABASE_URL || 
                    process.env.NEXT_PUBLIC_SUPABASE_URL ||
                    'http://127.0.0.1:54321'; // Default to local Supabase

// For imports, we need the service role key to bypass RLS
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
                            process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 
                        process.env.SUPABASE_ANON_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'; // Default local anon key

// Use service role key if available (bypasses RLS), otherwise fallback to anon key
const supabaseKey = supabaseServiceKey || supabaseAnonKey;

if (supabaseServiceKey) {
  console.log('🔑 Using service role key (bypasses RLS)');
} else {
  console.log('⚠️  Using anon key (subject to RLS policies)');
}

// Get command line arguments
const excelFilePath = process.argv[2];
const userIdArg = process.argv[3];
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

if (!excelFilePath) {
  console.error('Usage: node scripts/import-excel-block.js <path-to-excel-file> <user-id> [--dry-run]');
  console.error('Example: node scripts/import-excel-block.js "./2026 Block 1.xlsx" <user-id>');
  console.error('         node scripts/import-excel-block.js "./2026 Block 1.xlsx" <user-id> --dry-run');
  process.exit(1);
}

if (isDryRun) {
  console.log('🔍 DRY RUN MODE - No data will be inserted\n');
}

// Check if file exists
const fullPath = path.isAbsolute(excelFilePath) ? excelFilePath : path.join(process.cwd(), excelFilePath);
if (!fs.existsSync(fullPath)) {
  console.error(`Error: File not found: ${fullPath}`);
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function importTrainingBlock() {
  try {
    console.log(`Reading Excel file: ${fullPath}`);
    
    // Read the Excel file
    const workbook = XLSX.readFile(fullPath);
    console.log(`Found sheets: ${workbook.SheetNames.join(', ')}`);
    
    // Try to get user ID - check if provided, or try to find one in the database
    let userId = userIdArg;
    if (!userId) {
      console.log('\nNo user ID provided. Attempting to find a user in the database...');
      
      // Try to get first user from auth.users (if we have service role key)
      // Otherwise, check if there's a user_profile we can use
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1)
        .single();
      
      if (!profileError && profiles) {
        userId = profiles.id;
        console.log(`✅ Found user ID: ${userId}`);
      } else {
        // Try to get from auth.users if possible (requires admin access)
        console.error('Error: Could not find a user ID automatically.');
        console.error('Please provide user-id as second argument.');
        console.error('Usage: node scripts/import-excel-block.js <excel-file> <user-id>');
        console.error('\nTo find your user ID:');
        console.error('  1. Open your app and check the browser console');
        console.error('  2. Or query: SELECT id FROM auth.users LIMIT 1;');
        console.error('  3. Or use: node scripts/get-user-id.js');
        process.exit(1);
      }
    }
    
    // Parse all week sheets
    const parsedData = parseWeekSheets(workbook);
    
    // Create training block
    console.log('\nCreating training block...');
    const fileName = path.basename(fullPath, path.extname(fullPath));
    // Use the filename but fix common issues (like "2026 Block 1.xlsx" -> "2026 Block 1")
    let blockName = fileName || '2026 Block 1 - Hybrid Focus';
    // Fix typo in filename if present
    blockName = blockName.replace('Hyrbid', 'Hybrid');
    const blockDescription = `Imported from ${path.basename(fullPath)}`;
    
    // Calculate duration in weeks
    const maxWeek = parsedData.workouts.length > 0 
      ? Math.max(...parsedData.workouts.map(w => w.week_number), 0)
      : 0;
    const durationWeeks = maxWeek || 6;
    
    console.log(`Block name: ${blockName}`);
    console.log(`Duration: ${durationWeeks} weeks`);
    console.log(`Total workouts: ${parsedData.workouts.length}`);
    
    // Check Supabase configuration
    console.log(`\nSupabase URL: ${supabaseUrl}`);
    console.log(`Using ${supabaseUrl.includes('localhost') || supabaseUrl.includes('127.0.0.1') ? 'LOCAL' : 'REMOTE'} Supabase`);
    
    // Test Supabase connection
    const { data: testData, error: testError } = await supabase
      .from('exercises')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.error('\n❌ Error connecting to Supabase:');
      console.error('  ', testError.message);
      console.error('\nPlease check:');
      console.error('  1. Supabase is running (if local: `supabase start`)');
      console.error('  2. Environment variables are set correctly');
      console.error('  3. Database schema is migrated');
      process.exit(1);
    }
    
    console.log('✅ Connected to Supabase successfully');
    
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
    
    // Create exercise map with fuzzy matching
    const exerciseMap = new Map();
    const exerciseNameVariations = new Map();
    
    for (const exercise of exercises) {
      const normalized = normalizeExerciseName(exercise.name);
      exerciseMap.set(normalized, exercise.id);
      exerciseNameVariations.set(normalized, exercise.name);
      
      // Also add common variations
      exerciseMap.set(exercise.name.toLowerCase().trim(), exercise.id);
      exerciseMap.set(exercise.name.trim(), exercise.id);
    }
    
    console.log(`Loaded ${exercises.length} exercises from database`);
    
    if (isDryRun) {
      console.log('\n📋 Exercises that will be matched:');
      const uniqueExercises = new Set(parsedData.workouts.flatMap(w => w.exercises.map(e => e.name)));
      for (const exerciseName of uniqueExercises) {
        const normalized = normalizeExerciseName(exerciseName);
        const matchedId = exerciseMap.get(normalized);
        if (matchedId) {
          console.log(`  ✅ "${exerciseName}" -> ${exerciseNameVariations.get(normalized)}`);
        } else {
          console.log(`  ❌ "${exerciseName}" -> NOT FOUND in database`);
        }
      }
      console.log('\n📊 Summary:');
      console.log(`  Total workouts: ${parsedData.workouts.length}`);
      console.log(`  Total exercises: ${uniqueExercises.size}`);
      console.log(`  Total sets: ${parsedData.workouts.reduce((sum, w) => sum + w.exercises.reduce((s, e) => s + e.sets.length, 0), 0)}`);
      console.log('\n⚠️  Dry run complete. Run without --dry-run to import.');
      return;
    }
    
    // Create workouts and sets
    const startDate = new Date();
    let workoutCount = 0;
    let setCount = 0;
    
    for (const workout of parsedData.workouts) {
      // Calculate scheduled date
      const daysOffset = (workout.week_number - 1) * 7 + (workout.day_number - 1);
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(startDate.getDate() + daysOffset);
      
      // Create workout
      const { data: createdWorkout, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          block_id: block.id,
          user_id: userId,
          week_number: workout.week_number,
          day_number: workout.day_number,
          focus: workout.focus || `Week ${workout.week_number} - Day ${workout.day_number}`,
          scheduled_date: scheduledDate.toISOString().split('T')[0],
        })
        .select()
        .single();
      
      if (workoutError) {
        console.error(`Error creating workout Week ${workout.week_number} Day ${workout.day_number}:`, workoutError);
        continue;
      }
      
      workoutCount++;
      
      // Create sets for this workout
      const setsToInsert = [];
      
      for (const exercise of workout.exercises) {
        // Find exercise ID by name with fuzzy matching
        const normalized = normalizeExerciseName(exercise.name);
        let exerciseId = exerciseMap.get(normalized) || 
                        exerciseMap.get(exercise.name.toLowerCase().trim()) ||
                        exerciseMap.get(exercise.name.trim());
        
        if (!exerciseId) {
          console.warn(`  ⚠️  Exercise not found in database: "${exercise.name}" - skipping`);
          continue;
        }
        
        for (let i = 0; i < exercise.sets.length; i++) {
          const set = exercise.sets[i];
          setsToInsert.push({
            workout_id: createdWorkout.id,
            exercise_id: exerciseId,
            set_order: i + 1,
            target_reps: set.reps ? parseInt(set.reps) : null,
            target_load: set.weight ? parseFloat(set.weight) : null,
            target_rpe: set.rpe ? parseFloat(set.rpe) : null,
            tempo: set.tempo || null,
            notes: set.notes || null,
          });
          setCount++;
        }
      }
      
      if (setsToInsert.length > 0) {
        const { error: setsError } = await supabase
          .from('workout_sets')
          .insert(setsToInsert);
        
        if (setsError) {
          console.error(`Error creating sets for workout Week ${workout.week_number} Day ${workout.day_number}:`, setsError);
        }
      }
    }
    
    console.log('\n✅ Import completed successfully!');
    console.log(`   Training Block: ${block.name}`);
    console.log(`   Workouts created: ${workoutCount}`);
    console.log(`   Sets created: ${setCount}`);
    console.log(`   Block ID: ${block.id}`);
    
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

function parseWeekSheets(workbook) {
  const workouts = [];
  
  // Parse each week sheet
  for (const sheetName of workbook.SheetNames) {
    // Skip non-week sheets
    if (!sheetName.match(/^Week\s+\d+/i) && !sheetName.match(/^W\d+/i)) {
      continue;
    }
    
    // Extract week number
    const weekMatch = sheetName.match(/(\d+)/);
    if (!weekMatch) continue;
    const weekNumber = parseInt(weekMatch[1]);
    
    console.log(`\nParsing ${sheetName} (Week ${weekNumber})...`);
    
    const worksheet = workbook.Sheets[sheetName];
    // Read as array of arrays to preserve structure
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: false, header: 1 });
    
    let currentDay = 0;
    let currentDayName = null;
    let currentFocus = null;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const firstCell = String(row[0] || '').trim();
      
      // Check if this is a day header (MONDAY, TUESDAY, etc.)
      const dayMatch = firstCell.match(/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\s*[—–-]\s*(.+)$/i);
      if (dayMatch) {
        currentDay++;
        currentDayName = dayMatch[1].toUpperCase();
        currentFocus = dayMatch[2].trim();
        console.log(`  Found ${currentDayName}: ${currentFocus}`);
        continue;
      }
      
      // Check if this is the header row for exercises
      if (firstCell.toLowerCase() === 'exercise' || firstCell.toLowerCase() === 'exercise name') {
        continue; // Skip header row
      }
      
      // Check if this is an exercise row (first cell has exercise name, second has type)
      if (firstCell && row[1] && (String(row[1]).toUpperCase() === 'LIFT' || String(row[1]).toUpperCase() === 'RUN')) {
        const exerciseName = firstCell.trim();
        const type = String(row[1]).toUpperCase();
        const setsReps = String(row[2] || '').trim(); // Sets×Reps column
        const tempo = String(row[3] || '').trim();
        const rest = String(row[4] || '').trim();
        const rpe = String(row[5] || '').trim();
        const notes = String(row[12] || '').trim(); // Notes column
        
        // Skip if no day has been found yet
        if (currentDay === 0) continue;
        
        // Parse sets and reps from "4×6-8" or "6×400m" format
        let numSets = 1;
        let repsStr = null;
        
        if (setsReps) {
          const setsRepsMatch = setsReps.match(/^(\d+)\s*[×x*]\s*(.+)$/);
          if (setsRepsMatch) {
            numSets = parseInt(setsRepsMatch[1]);
            repsStr = setsRepsMatch[2];
          } else {
            // Try to parse as single set
            repsStr = setsReps;
          }
        }
        
        // Parse RPE (handle date-like formats like "8-Jul" -> "8")
        let rpeValue = null;
        if (rpe) {
          const rpeMatch = rpe.match(/^(\d+(?:\.\d+)?)/);
          if (rpeMatch) {
            rpeValue = parseFloat(rpeMatch[1]);
          } else if (!isNaN(parseFloat(rpe))) {
            rpeValue = parseFloat(rpe);
          }
        }
        
        // Parse reps range (e.g., "6-8" or "400m" or "12-15")
        let repsMin = null;
        let repsMax = null;
        if (repsStr) {
          const repsRangeMatch = repsStr.match(/^(\d+)\s*-\s*(\d+)/);
          if (repsRangeMatch) {
            repsMin = parseInt(repsRangeMatch[1]);
            repsMax = parseInt(repsRangeMatch[2]);
          } else {
            const singleRepsMatch = repsStr.match(/^(\d+)/);
            if (singleRepsMatch) {
              repsMin = parseInt(singleRepsMatch[1]);
              repsMax = repsMin;
            }
          }
        }
        
        // Find or create workout for this week/day
        let workout = workouts.find(w => w.week_number === weekNumber && w.day_number === currentDay);
        if (!workout) {
          workout = {
            week_number: weekNumber,
            day_number: currentDay,
            focus: currentFocus || `${currentDayName || `Day ${currentDay}`} - Week ${weekNumber}`,
            exercises: [],
          };
          workouts.push(workout);
        }
        
        // Add exercise to workout
        const exercise = {
          name: exerciseName,
          sets: [],
        };
        
        // Create sets based on numSets
        for (let s = 0; s < numSets; s++) {
          exercise.sets.push({
            reps: repsMax || repsMin || null, // Use max if range, otherwise use single value
            weight: null, // Will be set when loading
            rpe: rpeValue,
            tempo: tempo || null,
            notes: notes || null,
          });
        }
        
        workout.exercises.push(exercise);
        console.log(`    Added: ${exerciseName} (${numSets} sets × ${repsStr || 'N/A'})`);
      }
    }
  }
  
  // Sort workouts by week then day
  workouts.sort((a, b) => {
    if (a.week_number !== b.week_number) return a.week_number - b.week_number;
    return a.day_number - b.day_number;
  });
  
  console.log(`\n✅ Parsed ${workouts.length} workouts across all weeks`);
  
  return { workouts };
}

// Normalize exercise names for better matching
function normalizeExerciseName(name) {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    // Remove common prefixes/suffixes
    .replace(/^(barbell|bb|db|dumbbell|machine|seated|standing|lying|incline|decline|hammer|reverse)\s+/i, '')
    .replace(/\s+(press|flye|fly|row|curl|extension|raise|shrug)$/i, '')
    // Normalize spacing
    .replace(/\s+/g, ' ')
    // Remove special characters
    .replace(/[—–-]/g, ' ')
    .replace(/[()\[\]]/g, '')
    // Trim again
    .trim();
}

// Run the import
importTrainingBlock();
