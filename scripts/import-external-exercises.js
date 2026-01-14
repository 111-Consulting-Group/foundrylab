#!/usr/bin/env node
/**
 * Main script to import external exercise data
 * Orchestrates fetching, mapping, deduplication, and insertion
 * 
 * Usage:
 *   node scripts/import-external-exercises.js [--dry-run] [--source free-exercise-db|exercisedb|all] [--refresh]
 */

const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// Import fetch scripts
const { fetchFreeExerciseDb } = require('./fetch-exercise-data/fetch-free-exercise-db');
const { fetchExerciseDb } = require('./fetch-exercise-data/fetch-exercisedb');

// Import mappers
const { mapFreeExerciseDbArray } = require('./import-exercises/mappers/free-exercise-db-mapper');
const { mapExerciseDbArray } = require('./import-exercises/mappers/exercisedb-mapper');

// Import deduplication and merge logic
const { deduplicateExercises } = require('./import-exercises/deduplicate');
const { prepareMerges } = require('./import-exercises/merge');

// Database connection
const connectionString = process.env.DATABASE_URL || 
                         process.env.POSTGRES_URL || 
                         'postgresql://postgres:suxha2-bohkEh-gaknek@db.sugewjaiokcxeeicccwn.supabase.co:5432/postgres';

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const forceRefresh = args.includes('--refresh');
const sourceArg = args.find(arg => arg.startsWith('--source='));
const source = sourceArg ? sourceArg.split('=')[1] : 'all';

async function loadExistingExercises(client) {
  console.log('📊 Loading existing exercises from database...');
  const result = await client.query(`
    SELECT id, name, modality, primary_metric, muscle_group, equipment, instructions, is_custom
    FROM exercises
    ORDER BY name
  `);
  
  console.log(`✅ Loaded ${result.rows.length} existing exercises\n`);
  return result.rows;
}

async function insertNewExercises(client, exercises, dryRun = false) {
  if (exercises.length === 0) {
    return { inserted: 0, errors: [] };
  }
  
  console.log(`\n📝 Inserting ${exercises.length} new exercises...`);
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - Would insert:');
    exercises.slice(0, 5).forEach(ex => {
      console.log(`   - ${ex.name} (${ex.modality}, ${ex.muscle_group})`);
    });
    if (exercises.length > 5) {
      console.log(`   ... and ${exercises.length - 5} more`);
    }
    return { inserted: exercises.length, errors: [] };
  }
  
  let inserted = 0;
  const errors = [];
  const batchSize = 50;
  
  for (let i = 0; i < exercises.length; i += batchSize) {
    const batch = exercises.slice(i, i + batchSize);
    
    for (const exercise of batch) {
      try {
        // Remove metadata fields before inserting
        const { _source, _sourceId, _originalData, _mergeHistory, ...cleanExercise } = exercise;
        
        await client.query(`
          INSERT INTO exercises (
            id, name, modality, primary_metric, muscle_group, equipment, instructions, is_custom, created_at, updated_at
          ) VALUES (
            gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW(), NOW()
          )
        `, [
          cleanExercise.name,
          cleanExercise.modality,
          cleanExercise.primary_metric,
          cleanExercise.muscle_group,
          cleanExercise.equipment,
          cleanExercise.instructions,
          cleanExercise.is_custom || false,
        ]);
        
        inserted++;
        if (inserted % 10 === 0) {
          process.stdout.write(`   Inserted ${inserted}/${exercises.length}...\r`);
        }
      } catch (error) {
        if (error.code === '23505') { // Duplicate key
          // This shouldn't happen if deduplication worked, but handle gracefully
          errors.push({ exercise: exercise.name, error: 'Duplicate key (already exists)' });
        } else {
          errors.push({ exercise: exercise.name, error: error.message });
        }
      }
    }
  }
  
  console.log(`\n✅ Inserted ${inserted} new exercises`);
  if (errors.length > 0) {
    console.log(`⚠️  ${errors.length} errors occurred`);
  }
  
  return { inserted, errors };
}

async function updateExistingExercises(client, updates, dryRun = false) {
  if (updates.length === 0) {
    return { updated: 0, errors: [] };
  }
  
  console.log(`\n🔄 Updating ${updates.length} existing exercises...`);
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - Would update:');
    updates.slice(0, 5).forEach(({ existing, merged, confidence }) => {
      const changes = [];
      if (existing.instructions !== merged.instructions) changes.push('instructions');
      if (existing.equipment !== merged.equipment) changes.push('equipment');
      console.log(`   - ${existing.name} (${confidence} confidence) - changes: ${changes.join(', ')}`);
    });
    if (updates.length > 5) {
      console.log(`   ... and ${updates.length - 5} more`);
    }
    return { updated: updates.length, errors: [] };
  }
  
  let updated = 0;
  const errors = [];
  
  for (const { existing, merged } of updates) {
    try {
      // Remove metadata fields before updating
      const { _source, _sourceId, _originalData, _mergeHistory, ...cleanMerged } = merged;
      
      await client.query(`
        UPDATE exercises
        SET 
          equipment = COALESCE($1, equipment),
          instructions = COALESCE($2, instructions),
          updated_at = NOW()
        WHERE id = $3
      `, [
        cleanMerged.equipment,
        cleanMerged.instructions,
        existing.id,
      ]);
      
      updated++;
      if (updated % 10 === 0) {
        process.stdout.write(`   Updated ${updated}/${updates.length}...\r`);
      }
    } catch (error) {
      errors.push({ exercise: existing.name, error: error.message });
    }
  }
  
  console.log(`\n✅ Updated ${updated} existing exercises`);
  if (errors.length > 0) {
    console.log(`⚠️  ${errors.length} errors occurred`);
  }
  
  return { updated, errors };
}

function generateReport(stats) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 IMPORT REPORT');
  console.log('='.repeat(60));
  console.log(`\n📥 Sources processed:`);
  console.log(`   - free-exercise-db: ${stats.sources.freeExerciseDb || 0} exercises`);
  console.log(`   - exercisedb: ${stats.sources.exercisedb || 0} exercises`);
  
  console.log(`\n🔍 Duplicate detection:`);
  console.log(`   - High confidence: ${stats.duplicates.high || 0}`);
  console.log(`   - Medium confidence: ${stats.duplicates.medium || 0}`);
  console.log(`   - Low confidence: ${stats.duplicates.low || 0}`);
  
  console.log(`\n✨ Actions taken:`);
  console.log(`   - New exercises inserted: ${stats.inserted || 0}`);
  console.log(`   - Existing exercises updated: ${stats.updated || 0}`);
  console.log(`   - Exercises skipped: ${stats.skipped || 0}`);
  
  if (stats.errors && stats.errors.length > 0) {
    console.log(`\n⚠️  Errors: ${stats.errors.length}`);
    stats.errors.slice(0, 10).forEach(err => {
      console.log(`   - ${err.exercise}: ${err.error}`);
    });
    if (stats.errors.length > 10) {
      console.log(`   ... and ${stats.errors.length - 10} more`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

async function importExercises() {
  const client = new Client({ connectionString });
  
  try {
    console.log('🚀 Starting exercise import...\n');
    
    if (isDryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be committed to database\n');
    }
    
    await client.connect();
    console.log('✅ Connected to database\n');
    
    // Load existing exercises
    const existingExercises = await loadExistingExercises(client);
    
    const stats = {
      sources: {},
      duplicates: { high: 0, medium: 0, low: 0 },
      inserted: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };
    
    let allMappedExercises = [];
    
    // Fetch and map from free-exercise-db
    if (source === 'all' || source === 'free-exercise-db') {
      console.log('📥 Fetching from free-exercise-db...');
      const freeExerciseDbData = await fetchFreeExerciseDb(forceRefresh);
      const mapped = mapFreeExerciseDbArray(freeExerciseDbData);
      stats.sources.freeExerciseDb = mapped.length;
      allMappedExercises = allMappedExercises.concat(mapped);
      console.log(`✅ Mapped ${mapped.length} exercises from free-exercise-db\n`);
    }
    
    // Fetch and map from ExerciseDB
    if (source === 'all' || source === 'exercisedb') {
      console.log('📥 Fetching from ExerciseDB...');
      try {
        const exercisedbData = await fetchExerciseDb(forceRefresh);
        const mapped = mapExerciseDbArray(exercisedbData);
        stats.sources.exercisedb = mapped.length;
        allMappedExercises = allMappedExercises.concat(mapped);
        console.log(`✅ Mapped ${mapped.length} exercises from ExerciseDB\n`);
      } catch (error) {
        console.warn(`⚠️  Could not fetch from ExerciseDB: ${error.message}`);
        console.log('   (This is OK if you don\'t have an API key or dump file)\n');
      }
    }
    
    if (allMappedExercises.length === 0) {
      console.log('⚠️  No exercises to import');
      await client.end();
      return;
    }
    
    console.log(`\n🔍 Detecting duplicates against ${existingExercises.length} existing exercises...`);
    
    // Deduplicate
    const { duplicates, unique } = deduplicateExercises(allMappedExercises, existingExercises);
    
    // Count duplicates by confidence
    duplicates.forEach(dup => {
      if (dup.confidence === 'high') stats.duplicates.high++;
      else if (dup.confidence === 'medium') stats.duplicates.medium++;
      else if (dup.confidence === 'low') stats.duplicates.low++;
    });
    
    console.log(`✅ Found ${duplicates.length} potential duplicates, ${unique.length} unique exercises\n`);
    
    // Prepare merges
    const { toUpdate, toSkip } = prepareMerges(duplicates);
    stats.skipped = toSkip.length;
    
    console.log(`📋 Merge plan: ${toUpdate.length} to update, ${toSkip.length} to skip\n`);
    
    // Update existing exercises
    const updateResult = await updateExistingExercises(client, toUpdate, isDryRun);
    stats.updated = updateResult.updated;
    stats.errors = stats.errors.concat(updateResult.errors);
    
    // Insert new exercises
    const insertResult = await insertNewExercises(client, unique, isDryRun);
    stats.inserted = insertResult.inserted;
    stats.errors = stats.errors.concat(insertResult.errors);
    
    // Generate report
    generateReport(stats);
    
    if (isDryRun) {
      console.log('\n💡 This was a dry run. Run without --dry-run to commit changes.');
    } else {
      console.log('\n✅ Import completed successfully!');
    }
    
    await client.end();
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    await client.end();
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  importExercises()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
}

module.exports = { importExercises };
