#!/usr/bin/env node
/**
 * Script to import training block using direct PostgreSQL (bypasses RLS)
 * Usage: node scripts/import-excel-block-pg.js <path-to-excel-file> <user-id>
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Check if xlsx package is installed
let XLSX;
try {
  XLSX = require('xlsx');
} catch (e) {
  console.error('Error: xlsx package not found. Please install it:');
  console.error('  npm install xlsx');
  process.exit(1);
}

// Load environment variables from .env file
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL || 
                         process.env.POSTGRES_URL || 
                         'postgresql://postgres:suxha2-bohkEh-gaknek@db.sugewjaiokcxeeicccwn.supabase.co:5432/postgres';

// Get command line arguments
const excelFilePath = process.argv[2];
const userIdArg = process.argv[3];
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

if (!excelFilePath || !userIdArg) {
  console.error('Usage: node scripts/import-excel-block-pg.js <path-to-excel-file> <user-id> [--dry-run]');
  console.error('Example: node scripts/import-excel-block-pg.js "./2026 Block 1.xlsx" <user-id>');
  process.exit(1);
}

// Check if file exists
const fullPath = path.isAbsolute(excelFilePath) ? excelFilePath : path.join(process.cwd(), excelFilePath);
if (!fs.existsSync(fullPath)) {
  console.error(`Error: File not found: ${fullPath}`);
  process.exit(1);
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
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: false, header: 1 });
    
    let currentDay = 0;
    let currentDayName = null;
    let currentFocus = null;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      
      const firstCell = String(row[0] || '').trim();
      
      // Check if this is a day header
      const dayMatch = firstCell.match(/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\s*[—–-]\s*(.+)$/i);
      if (dayMatch) {
        currentDay++;
        currentDayName = dayMatch[1].toUpperCase();
        currentFocus = dayMatch[2].trim();
        console.log(`  Found ${currentDayName}: ${currentFocus}`);
        continue;
      }
      
      // Check if this is the header row
      if (firstCell.toLowerCase() === 'exercise' || firstCell.toLowerCase() === 'exercise name') {
        continue;
      }
      
      // Check if this is an exercise row
      if (firstCell && row[1] && (String(row[1]).toUpperCase() === 'LIFT' || String(row[1]).toUpperCase() === 'RUN')) {
        const exerciseName = firstCell.trim();
        const type = String(row[1]).toUpperCase();
        const setsReps = String(row[2] || '').trim();
        const tempo = String(row[3] || '').trim();
        const rest = String(row[4] || '').trim();
        const rpe = String(row[5] || '').trim();
        const notes = String(row[12] || '').trim();
        
        if (currentDay === 0) continue;
        
        // Parse sets and reps
        let numSets = 1;
        let repsStr = null;
        
        if (setsReps) {
          const setsRepsMatch = setsReps.match(/^(\d+)\s*[×x*]\s*(.+)$/);
          if (setsRepsMatch) {
            numSets = parseInt(setsRepsMatch[1]);
            repsStr = setsRepsMatch[2];
          } else {
            repsStr = setsReps;
          }
        }
        
        // Parse RPE
        let rpeValue = null;
        if (rpe) {
          const rpeMatch = rpe.match(/^(\d+(?:\.\d+)?)/);
          if (rpeMatch) {
            rpeValue = parseFloat(rpeMatch[1]);
          } else if (!isNaN(parseFloat(rpe))) {
            rpeValue = parseFloat(rpe);
          }
        }
        
        // Parse reps
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
        
        // Find or create workout
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
        
        const exercise = {
          name: exerciseName,
          sets: [],
        };
        
        for (let s = 0; s < numSets; s++) {
          exercise.sets.push({
            reps: repsMax || repsMin || null,
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
  
  workouts.sort((a, b) => {
    if (a.week_number !== b.week_number) return a.week_number - b.week_number;
    return a.day_number - b.day_number;
  });
  
  console.log(`\n✅ Parsed ${workouts.length} workouts across all weeks`);
  
  return { workouts };
}

// Normalize exercise names for matching
function normalizeExerciseName(name) {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    .replace(/^(barbell|bb|db|dumbbell|machine|seated|standing|lying|incline|decline|hammer|reverse)\s+/i, '')
    .replace(/\s+(press|flye|fly|row|curl|extension|raise|shrug)$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/[—–-]/g, ' ')
    .replace(/[()\[\]]/g, '')
    .trim();
}

async function importTrainingBlock() {
  const client = new Client({ connectionString });
  
  try {
    console.log(`Reading Excel file: ${fullPath}`);
    
    const workbook = XLSX.readFile(fullPath);
    console.log(`Found sheets: ${workbook.SheetNames.join(', ')}`);
    
    const parsedData = parseWeekSheets(workbook);
    
    console.log('\nCreating training block...');
    const fileName = path.basename(fullPath, path.extname(fullPath));
    let blockName = fileName || '2026 Block 1 - Hybrid Focus';
    blockName = blockName.replace('Hyrbid', 'Hybrid');
    const blockDescription = `Imported from ${path.basename(fullPath)}`;
    
    const maxWeek = parsedData.workouts.length > 0 
      ? Math.max(...parsedData.workouts.map(w => w.week_number), 0)
      : 0;
    const durationWeeks = maxWeek || 6;
    
    console.log(`Block name: ${blockName}`);
    console.log(`Duration: ${durationWeeks} weeks`);
    console.log(`Total workouts: ${parsedData.workouts.length}`);
    
    if (isDryRun) {
      console.log('\n🔍 DRY RUN - No data will be inserted');
      return;
    }
    
    await client.connect();
    console.log('✅ Connected to database');
    
    // Deactivate existing active blocks
    await client.query(`
      UPDATE training_blocks 
      SET is_active = false 
      WHERE user_id = $1 AND is_active = true
    `, [userIdArg]);
    
    // Create training block
    const blockResult = await client.query(`
      INSERT INTO training_blocks (
        id, user_id, name, description, start_date, duration_weeks, is_active, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, CURRENT_DATE, $4, true, NOW(), NOW()
      ) RETURNING id, name
    `, [userIdArg, blockName, blockDescription, durationWeeks]);
    
    const block = blockResult.rows[0];
    console.log(`✅ Created training block: ${block.name} (ID: ${block.id})`);
    
    // Get all exercises for matching
    const exercisesResult = await client.query('SELECT id, name FROM exercises');
    const exercises = exercisesResult.rows;
    const exerciseMap = new Map();
    
    for (const exercise of exercises) {
      const normalized = normalizeExerciseName(exercise.name);
      exerciseMap.set(normalized, exercise.id);
      exerciseMap.set(exercise.name.toLowerCase().trim(), exercise.id);
      exerciseMap.set(exercise.name.trim(), exercise.id);
    }
    
    console.log(`✅ Loaded ${exercises.length} exercises from database`);
    
    // Create workouts and sets
    const startDate = new Date();
    let workoutCount = 0;
    let setCount = 0;
    const missingExercises = new Set();
    
    for (const workout of parsedData.workouts) {
      const daysOffset = (workout.week_number - 1) * 7 + (workout.day_number - 1);
      const scheduledDate = new Date(startDate);
      scheduledDate.setDate(startDate.getDate() + daysOffset);
      
      // Create workout
      const workoutResult = await client.query(`
        INSERT INTO workouts (
          id, block_id, user_id, week_number, day_number, focus, scheduled_date, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW()
        ) RETURNING id
      `, [
        block.id,
        userIdArg,
        workout.week_number,
        workout.day_number,
        workout.focus,
        scheduledDate.toISOString().split('T')[0],
      ]);
      
      const workoutId = workoutResult.rows[0].id;
      workoutCount++;
      
      // Create sets for this workout
      for (const exercise of workout.exercises) {
        const normalized = normalizeExerciseName(exercise.name);
        let exerciseId = exerciseMap.get(normalized) || 
                        exerciseMap.get(exercise.name.toLowerCase().trim()) ||
                        exerciseMap.get(exercise.name.trim());
        
        if (!exerciseId) {
          missingExercises.add(exercise.name);
          continue;
        }
        
        for (let i = 0; i < exercise.sets.length; i++) {
          const set = exercise.sets[i];
          await client.query(`
            INSERT INTO workout_sets (
              id, workout_id, exercise_id, set_order, target_reps, target_rpe, tempo, notes, created_at, updated_at
            ) VALUES (
              gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
            )
          `, [
            workoutId,
            exerciseId,
            i + 1,
            set.reps,
            set.rpe,
            set.tempo,
            set.notes,
          ]);
          setCount++;
        }
      }
    }
    
    if (missingExercises.size > 0) {
      console.log(`\n⚠️  Missing exercises (not found in database):`);
      Array.from(missingExercises).forEach(ex => console.log(`  - ${ex}`));
    }
    
    console.log('\n✅ Import completed successfully!');
    console.log(`   Training Block: ${block.name}`);
    console.log(`   Block ID: ${block.id}`);
    console.log(`   Workouts created: ${workoutCount}`);
    console.log(`   Sets created: ${setCount}`);
    
    await client.end();
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    if (error.code) console.error('Error code:', error.code);
    if (error.detail) console.error('Detail:', error.detail);
    await client.end();
    process.exit(1);
  }
}

importTrainingBlock().then(() => process.exit(0));
