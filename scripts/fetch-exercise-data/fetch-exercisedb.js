#!/usr/bin/env node
/**
 * Fetches exercise data from ExerciseDB API
 * Supports both API key authentication and local database dump
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_FILE = path.join(CACHE_DIR, 'exercisedb.json');
const API_BASE_URL = 'https://exercisedb.p.rapidapi.com';
const DUMP_FILE_PATH = process.env.EXERCISEDB_DUMP_PATH || 
                       path.join(__dirname, 'cache', 'exercisedb-dump.json');

async function fetchFromAPI(apiKey) {
  console.log('🌐 Fetching data from ExerciseDB API...');
  console.log(`   Base URL: ${API_BASE_URL}`);

  try {
    const response = await fetch(`${API_BASE_URL}/exercises`, {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Invalid or missing API key. Set EXERCISEDB_API_KEY in .env file');
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('❌ Error fetching from ExerciseDB API:', error.message);
    throw error;
  }
}

async function fetchFromDump() {
  console.log('📂 Loading data from local dump file...');
  console.log(`   Path: ${DUMP_FILE_PATH}`);

  if (!fs.existsSync(DUMP_FILE_PATH)) {
    throw new Error(`Dump file not found at ${DUMP_FILE_PATH}\n` +
      'Please either:\n' +
      '1. Set EXERCISEDB_API_KEY in .env file, or\n' +
      '2. Download a database dump and place it at the path specified by EXERCISEDB_DUMP_PATH');
  }

  const data = JSON.parse(fs.readFileSync(DUMP_FILE_PATH, 'utf8'));
  return Array.isArray(data) ? data : [];
}

async function fetchExerciseDb(forceRefresh = false) {
  // Check if cache exists and is valid
  if (!forceRefresh && fs.existsSync(CACHE_FILE)) {
    console.log('📦 Using cached data from', CACHE_FILE);
    const cachedData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log(`✅ Loaded ${cachedData.length} exercises from cache`);
    return cachedData;
  }

  const apiKey = process.env.EXERCISEDB_API_KEY || process.env.RAPIDAPI_KEY;
  let data;

  if (apiKey) {
    try {
      data = await fetchFromAPI(apiKey);
    } catch (error) {
      console.log('⚠️  API fetch failed, trying local dump...');
      data = await fetchFromDump();
    }
  } else {
    console.log('ℹ️  No API key found, trying local dump...');
    data = await fetchFromDump();
  }

  // Ensure cache directory exists
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }

  // Save to cache
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  console.log(`✅ Fetched ${data.length} exercises and cached to ${CACHE_FILE}`);

  return data;
}

// If run directly, fetch and display sample
if (require.main === module) {
  const forceRefresh = process.argv.includes('--refresh');
  fetchExerciseDb(forceRefresh)
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

module.exports = { fetchExerciseDb };
