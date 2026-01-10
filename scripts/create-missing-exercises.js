#!/usr/bin/env node
/**
 * Script to create missing exercises from Excel file
 * Usage: node scripts/create-missing-exercises.js <path-to-excel-file>
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const XLSX = require('xlsx');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL || 
                         process.env.POSTGRES_URL || 
                         'postgresql://postgres:suxha2-bohkEh-gaknek@db.sugewjaiokcxeeicccwn.supabase.co:5432/postgres';

const excelFilePath = process.argv[2] || '/Users/andywolfe/Documents/Fitness/2026 Block 1.xlsx';
const fullPath = path.isAbsolute(excelFilePath) ? excelFilePath : path.join(process.cwd(), excelFilePath);

function parseWeekSheets(workbook) {
  const exerciseNames = new Set();
  
  for (const sheetName of workbook.SheetNames) {
    if (!sheetName.match(/^Week\s+\d+/i) && !sheetName.match(/^W\d+/i)) continue;
    
    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: false, header: 1 });
    
    for (const row of rows) {
      if (!row || row.length === 0) continue;
      const firstCell = String(row[0] || '').trim();
      const type = String(row[1] || '').toUpperCase();
      
      if (firstCell && (type === 'LIFT' || type === 'RUN')) {
        // Skip day headers and option exercises
        if (!firstCell.match(/^(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)/i) &&
            !firstCell.toLowerCase().includes('exercise') &&
            firstCell.length > 3) {
          exerciseNames.add(firstCell.trim());
        }
      }
    }
  }
  
  return Array.from(exerciseNames);
}

function determineModalityAndMuscle(exerciseName) {
  const name = exerciseName.toLowerCase();
  
  // Determine modality
  let modality = 'Strength';
  if (name.includes('run') || name.includes('interval') || name.includes('zone') || name.includes('pace') || name.includes('1000m') || name.includes('800m') || name.includes('400m') || name.includes('200m')) {
    modality = 'Cardio';
  } else if (name.includes('farmer') || name.includes('carry')) {
    modality = 'Hybrid';
  }
  
  // Determine muscle group (simplified)
  let muscleGroup = 'Full Body';
  if (name.includes('bench') || name.includes('chest') || name.includes('flye') || name.includes('press') && !name.includes('shoulder')) {
    muscleGroup = 'Chest';
  } else if (name.includes('row') || name.includes('pulldown') || name.includes('pull-up') || name.includes('pullup')) {
    muscleGroup = 'Back';
  } else if (name.includes('shoulder') || name.includes('lateral') || name.includes('delt')) {
    muscleGroup = 'Shoulders';
  } else if (name.includes('curl') || name.includes('bicep')) {
    muscleGroup = 'Arms';
  } else if (name.includes('tricep') || name.includes('pressdown') || name.includes('extension') && !name.includes('leg')) {
    muscleGroup = 'Arms';
  } else if (name.includes('squat') || name.includes('leg') || name.includes('rdl') || name.includes('deadlift') || name.includes('lunge')) {
    muscleGroup = 'Legs';
  } else if (name.includes('run') || name.includes('interval') || name.includes('zone')) {
    muscleGroup = 'Cardiovascular';
  }
  
  // Determine primary metric
  let primaryMetric = 'Weight';
  if (modality === 'Cardio') {
    primaryMetric = 'Pace';
    if (name.includes('zone') || name.includes('run')) {
      primaryMetric = 'Pace';
    }
  }
  
  return { modality, muscleGroup, primaryMetric };
}

async function createMissingExercises() {
  const client = new Client({ connectionString });
  
  try {
    console.log(`Reading Excel file: ${fullPath}`);
    const workbook = XLSX.readFile(fullPath);
    const exerciseNames = parseWeekSheets(workbook);
    
    console.log(`\nFound ${exerciseNames.length} unique exercises in Excel\n`);
    
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Get existing exercises
    const existingResult = await client.query('SELECT id, name FROM exercises');
    const existingNames = new Set(existingResult.rows.map(e => e.name.toLowerCase().trim()));
    console.log(`Found ${existingResult.rows.length} existing exercises in database\n`);
    
    // Find missing exercises
    const missingExercises = exerciseNames.filter(name => {
      const normalized = name.toLowerCase().trim();
      return !existingNames.has(normalized) && 
             !existingNames.has(normalized.replace(/^(barbell |bb |db |dumbbell )/, '')) &&
             !existingNames.has(normalized.replace(/db /g, 'dumbbell '));
    });
    
    if (missingExercises.length === 0) {
      console.log('✅ All exercises already exist in database!');
      await client.end();
      return;
    }
    
    console.log(`Found ${missingExercises.length} missing exercises:\n`);
    
    // Create missing exercises
    let created = 0;
    for (const exerciseName of missingExercises) {
      const { modality, muscleGroup, primaryMetric } = determineModalityAndMuscle(exerciseName);
      
      // Clean up exercise name (remove descriptions in parentheses for the base name)
      let baseName = exerciseName.split('(')[0].trim();
      if (baseName.includes(':')) {
        baseName = baseName.split(':')[0].trim();
      }
      
      // Determine equipment
      let equipment = 'None';
      if (baseName.toLowerCase().includes('barbell') || baseName.toLowerCase().includes('bb ')) {
        equipment = 'Barbell';
      } else if (baseName.toLowerCase().includes('dumbbell') || baseName.toLowerCase().includes('db ')) {
        equipment = 'Dumbbells';
      } else if (baseName.toLowerCase().includes('machine') || baseName.toLowerCase().includes('cable') || baseName.toLowerCase().includes('band')) {
        equipment = 'Machine/Cable';
      } else if (baseName.toLowerCase().includes('kettlebell') || baseName.toLowerCase().includes('kb ')) {
        equipment = 'Kettlebell';
      } else if (baseName.toLowerCase().includes('run') || baseName.toLowerCase().includes('interval')) {
        equipment = 'None';
      }
      
      try {
        await client.query(`
          INSERT INTO exercises (
            id, name, modality, primary_metric, muscle_group, equipment, is_custom, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW()
          )
        `, [exerciseName, modality, primaryMetric, muscleGroup, equipment]);
        
        console.log(`  ✅ Created: ${exerciseName} (${modality}, ${muscleGroup})`);
        created++;
      } catch (error) {
        if (error.code === '23505') { // Duplicate key
          console.log(`  ⚠️  Already exists: ${exerciseName}`);
        } else {
          console.error(`  ❌ Error creating ${exerciseName}:`, error.message);
        }
      }
    }
    
    console.log(`\n✅ Created ${created} new exercises`);
    console.log(`\n💡 You can now re-run the import to match these exercises:`);
    console.log(`   node scripts/import-excel-block-pg.js "${fullPath}" "33b1256c-8787-450a-b954-2526fa437aa5"`);
    
    await client.end();
    
  } catch (error) {
    console.error('Fatal error:', error.message);
    await client.end();
    process.exit(1);
  }
}

createMissingExercises().then(() => process.exit(0));
