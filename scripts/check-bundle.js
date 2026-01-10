#!/usr/bin/env node
/**
 * Script to check the bundle for import.meta occurrences
 * Run with: node scripts/check-bundle.js
 */

const fs = require('fs');
const http = require('http');

const DEBUG_LOG_PATH = '/Users/andywolfe/Documents/Development/TrainingApp/.cursor/debug.log';

function debugLog(hypothesisId, location, message, data) {
  const entry = JSON.stringify({ hypothesisId, location, message, data, timestamp: Date.now(), sessionId: 'debug-session', runId: 'bundle-check' }) + '\n';
  try { fs.appendFileSync(DEBUG_LOG_PATH, entry); } catch (e) { console.error('Log error:', e); }
}

const bundleUrl = 'http://localhost:8081/node_modules/expo-router/entry.bundle?platform=web&dev=true&hot=false&lazy=true&transform.routerRoot=app';

console.log('Fetching bundle from:', bundleUrl);

http.get(bundleUrl, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Bundle size:', data.length, 'bytes');
    
    // Find all import.meta occurrences (excluding comments and strings)
    const regex = /import\.meta/g;
    let match;
    const occurrences = [];
    while ((match = regex.exec(data)) !== null) {
      const start = Math.max(0, match.index - 200);
      const end = Math.min(data.length, match.index + 200);
      const context = data.substring(start, end).replace(/\n/g, ' ');
      
      // Check if it's in a comment or string
      const beforeMatch = data.substring(Math.max(0, match.index - 50), match.index);
      const isInComment = beforeMatch.includes('//') || beforeMatch.includes('/*') || beforeMatch.includes('*');
      const isInString = beforeMatch.includes('"') || beforeMatch.includes("'") || beforeMatch.includes('`');
      
      occurrences.push({
        index: match.index,
        context: context,
        likelyInComment: isInComment,
        likelyInString: isInString,
      });
    }
    
    // Calculate approximate line number for each occurrence
    occurrences.forEach(occ => {
      const textBefore = data.substring(0, occ.index);
      occ.approxLine = (textBefore.match(/\n/g) || []).length + 1;
    });
    
    console.log('Found', occurrences.length, 'occurrences of import.meta');
    
    // Log to debug file
    debugLog('C', 'check-bundle.js', 'Bundle analysis', {
      bundleSize: data.length,
      importMetaCount: occurrences.length,
      allOccurrences: occurrences.map(o => ({ 
        line: o.approxLine, 
        index: o.index, 
        inComment: o.likelyInComment, 
        inString: o.likelyInString,
        context: o.context.substring(0, 300) 
      })),
    });
    
    // Also check for line 124984 specifically (the error location)
    const lines = data.split('\n');
    const errorLine = lines[124983]; // 0-indexed
    debugLog('F', 'check-bundle.js', 'Error line 124984 content', {
      lineNumber: 124984,
      lineContent: errorLine ? errorLine.substring(0, 500) : 'LINE NOT FOUND',
      totalLines: lines.length,
    });
    
    // Print first few occurrences
    occurrences.slice(0, 5).forEach((occ, i) => {
      console.log(`\nOccurrence ${i + 1} at index ${occ.index}:`);
      console.log(occ.context);
    });
    
    // Check for zustand specifically
    const zustandIndex = data.indexOf('zustand');
    const expoRouterIndex = data.indexOf('expo-router');
    
    debugLog('E', 'check-bundle.js', 'Package locations in bundle', {
      zustandFound: zustandIndex !== -1,
      zustandIndex: zustandIndex,
      expoRouterFound: expoRouterIndex !== -1,
      expoRouterIndex: expoRouterIndex,
    });
    
    console.log('\nZustand in bundle:', zustandIndex !== -1 ? `Yes (at index ${zustandIndex})` : 'No');
    console.log('expo-router in bundle:', expoRouterIndex !== -1 ? `Yes (at index ${expoRouterIndex})` : 'No');
  });
}).on('error', (err) => {
  console.error('Error fetching bundle:', err.message);
  debugLog('C', 'check-bundle.js', 'Bundle fetch error', { error: err.message });
});
