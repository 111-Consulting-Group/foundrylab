#!/usr/bin/env node
/**
 * Fetches exercise data from free-exercise-db (yuhonas/free-exercise-db)
 * Downloads the exercises.json file from GitHub and caches it locally
 */

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'free-exercise-db.json');
const SOURCE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';

async function fetchFreeExerciseDb(forceRefresh = false) {
  // Check if cache exists and is valid
  if (!forceRefresh && fs.existsSync(CACHE_FILE)) {
    console.log('📦 Using cached data from', CACHE_FILE);
    const cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log(`✅ Loaded ${cachedData.length} exercises from cache`);
    return cachedData;
  }

  console.log('🌐 Fetching data from free-exercise-db...');
  console.log(`   URL: ${SOURCE_URL}`);

  try {
    const response = await fetch(SOURCE_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Ensure cache directory exists
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }

    // Save to cache
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
    console.log(`✅ Fetched ${data.length} exercises and cached to ${CACHE_FILE}`);
    
    return data;
  } catch (error) {
    console.error('❌ Error fetching free-exercise-db:', error.message);
    
    // If fetch fails but cache exists, use cache
    if (fs.existsSync(CACHE_FILE)) {
      console.log('⚠️  Using cached data as fallback');
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    }
    
    throw error;
  }
}

// If run directly, fetch and display sample
if (require.main === module) {
  const forceRefresh = process.argv.includes('--refresh');
  fetchFreeExerciseDb(forceRefresh)
    .then((data) => {
      console.log(`\n📊 Sample exercise (first entry):`);
      console.log(JSON.stringify(data[0], null, 2));
      console.log(`\n✅ Total exercises: ${data.length}`);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { fetchFreeExerciseDb };
