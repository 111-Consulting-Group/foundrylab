#!/usr/bin/env node
/**
 * Script to verify training block import
 */

const { Client } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL || 
                         process.env.POSTGRES_URL || 
                         'postgresql://postgres:suxha2-bohkEh-gaknek@db.sugewjaiokcxeeicccwn.supabase.co:5432/postgres';

const userId = process.argv[2] || '33b1256c-8787-450a-b954-2526fa437aa5';

const client = new Client({ connectionString });

async function verifyImport() {
  try {
    await client.connect();
    
    // Get training blocks
    const blocksResult = await client.query(`
      SELECT id, name, duration_weeks, is_active, created_at,
        (SELECT COUNT(*) FROM workouts WHERE block_id = training_blocks.id) as workout_count
      FROM training_blocks 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [userId]);
    
    console.log(`\nTraining Blocks for User: ${userId}`);
    console.log('='.repeat(60));
    
    for (const block of blocksResult.rows) {
      console.log(`\n📦 ${block.name}`);
      console.log(`   ID: ${block.id}`);
      console.log(`   Duration: ${block.duration_weeks} weeks`);
      console.log(`   Workouts: ${block.workout_count}`);
      console.log(`   Active: ${block.is_active ? '✅ Yes' : '❌ No'}`);
      console.log(`   Created: ${new Date(block.created_at).toLocaleDateString()}`);
      
      // Get workout details
      const workoutsResult = await client.query(`
        SELECT w.id, w.week_number, w.day_number, w.focus,
          COUNT(ws.id) as set_count,
          COUNT(DISTINCT ws.exercise_id) as exercise_count
        FROM workouts w
        LEFT JOIN workout_sets ws ON w.id = ws.workout_id
        WHERE w.block_id = $1
        GROUP BY w.id, w.week_number, w.day_number, w.focus
        ORDER BY w.week_number, w.day_number
      `, [block.id]);
      
      console.log(`\n   Workouts breakdown:`);
      const workoutsByWeek = {};
      workoutsResult.rows.forEach(w => {
        if (!workoutsByWeek[w.week_number]) {
          workoutsByWeek[w.week_number] = [];
        }
        workoutsByWeek[w.week_number].push(w);
      });
      
      for (const week in workoutsByWeek) {
        console.log(`     Week ${week}:`);
        workoutsByWeek[week].forEach(w => {
          console.log(`       Day ${w.day_number} (${w.focus.substring(0, 40)}...): ${w.set_count} sets, ${w.exercise_count} exercises`);
        });
      }
      
      // Total stats
      const totalSets = workoutsResult.rows.reduce((sum, w) => sum + parseInt(w.set_count), 0);
      const totalExercises = new Set(workoutsResult.rows.flatMap(w => w.exercise_count)).size;
      console.log(`\n   Total: ${workoutsResult.rows.length} workouts, ${totalSets} sets`);
    }
    
    // Delete old incomplete block if it exists
    const oldBlockId = '4958f7e7-a0ad-4d4a-a2e0-a7eb3ed6243e';
    const oldBlockCheck = await client.query('SELECT id FROM training_blocks WHERE id = $1', [oldBlockId]);
    if (oldBlockCheck.rows.length > 0) {
      console.log('\n\n🧹 Cleaning up old incomplete block...');
      await client.query('DELETE FROM training_blocks WHERE id = $1', [oldBlockId]);
      console.log('✅ Deleted old incomplete block');
    }
    
    await client.end();
    
  } catch (error) {
    console.error('Error:', error.message);
    await client.end();
    process.exit(1);
  }
}

verifyImport().then(() => process.exit(0));
