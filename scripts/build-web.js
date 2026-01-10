#!/usr/bin/env node

/**
 * Build script for web deployment
 * This script ensures the build completes successfully and provides clear error messages
 */

const { execSync } = require('child_process');
const { existsSync } = require('fs');
const { resolve } = require('path');

const DIST_DIR = resolve(__dirname, '..', 'dist');

console.log('🔨 Starting web build...');
console.log(`📦 Target directory: ${DIST_DIR}`);
console.log('');

try {
  // Check if required environment variables are set
  const requiredEnvVars = [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ ERROR: Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('');
    console.error('Please set these variables in Render dashboard before building.');
    process.exit(1);
  }

  console.log('✅ Environment variables check passed');
  console.log('');

  // Run the expo export command
  console.log('📤 Running: npx expo export --platform web --clear');
  console.log('');
  
  execSync('npx expo export --platform web --clear', {
    stdio: 'inherit',
    cwd: resolve(__dirname, '..'),
    env: process.env
  });

  // Verify the dist directory was created
  if (!existsSync(DIST_DIR)) {
    console.error('');
    console.error('❌ ERROR: Build completed but dist directory was not created!');
    console.error(`Expected location: ${DIST_DIR}`);
    process.exit(1);
  }

  // Check if index.html exists
  const indexPath = resolve(DIST_DIR, 'index.html');
  if (!existsSync(indexPath)) {
    console.error('');
    console.error('❌ ERROR: Build completed but index.html was not found in dist!');
    process.exit(1);
  }

  console.log('');
  console.log('✅ Build completed successfully!');
  console.log(`📁 Output directory: ${DIST_DIR}`);
  console.log(`📄 Entry file: ${indexPath}`);

} catch (error) {
  console.error('');
  console.error('❌ Build failed with error:');
  console.error(error.message);
  console.error('');
  console.error('Common issues:');
  console.error('  - Missing environment variables (check above)');
  console.error('  - TypeScript/compilation errors');
  console.error('  - Missing dependencies');
  console.error('  - Insufficient memory (try upgrading Render plan)');
  process.exit(1);
}
