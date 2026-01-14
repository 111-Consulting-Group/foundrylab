/**
 * Duplicate detection logic for exercises
 * Uses name normalization and fuzzy matching to identify duplicates
 */

/**
 * Normalize exercise name for comparison
 * - Lowercase
 * - Trim whitespace
 * - Remove special characters (keep spaces and hyphens)
 * - Remove common variations (e.g., "barbell" vs "bb")
 */
function normalizeName(name) {
  if (!name) return '';
  
  return name
    .toLowerCase()
    .trim()
    // Remove common prefixes/suffixes
    .replace(/^(barbell|bb|dumbbell|db|kettlebell|kb)\s+/gi, '')
    .replace(/\s+(barbell|bb|dumbbell|db|kettlebell|kb)$/gi, '')
    // Normalize common abbreviations
    .replace(/\bbb\b/g, 'barbell')
    .replace(/\bdb\b/g, 'dumbbell')
    .replace(/\bkb\b/g, 'kettlebell')
    // Remove special characters except spaces and hyphens
    .replace(/[^\w\s-]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  
  if (len1 === 0) return len2;
  if (len2 === 0) return len1;
  
  const matrix = [];
  
  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + 1  // substitution
        );
      }
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Calculate similarity ratio between two strings (0-1)
 */
function similarityRatio(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1.0;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLen);
}

/**
 * Check if two exercise names are likely duplicates
 * Returns: { isDuplicate: boolean, confidence: 'high' | 'medium' | 'low', reason: string }
 */
function areDuplicates(name1, name2, options = {}) {
  const {
    exactMatchThreshold = 0.95,
    fuzzyMatchThreshold = 0.85,
    equipmentMatch = true,
  } = options;
  
  const normalized1 = normalizeName(name1);
  const normalized2 = normalizeName(name2);
  
  // Exact match after normalization
  if (normalized1 === normalized2) {
    return {
      isDuplicate: true,
      confidence: 'high',
      reason: 'exact_match',
    };
  }
  
  // Check if one contains the other (high confidence)
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    const shorter = normalized1.length < normalized2.length ? normalized1 : normalized2;
    const longer = normalized1.length >= normalized2.length ? normalized1 : normalized2;
    
    // If shorter is at least 80% of longer, consider it a match
    if (shorter.length / longer.length >= 0.8) {
      return {
        isDuplicate: true,
        confidence: 'high',
        reason: 'contains_match',
      };
    }
  }
  
  // Fuzzy matching
  const similarity = similarityRatio(normalized1, normalized2);
  
  if (similarity >= exactMatchThreshold) {
    return {
      isDuplicate: true,
      confidence: 'high',
      reason: 'fuzzy_exact',
      similarity,
    };
  }
  
  if (similarity >= fuzzyMatchThreshold) {
    return {
      isDuplicate: true,
      confidence: 'medium',
      reason: 'fuzzy_match',
      similarity,
    };
  }
  
  // Low confidence matches (similarity >= 0.7)
  if (similarity >= 0.7) {
    return {
      isDuplicate: true,
      confidence: 'low',
      reason: 'fuzzy_low',
      similarity,
    };
  }
  
  return {
    isDuplicate: false,
    confidence: null,
    reason: 'no_match',
    similarity,
  };
}

/**
 * Find duplicates for a new exercise against existing exercises
 * Returns: { match: existingExercise | null, confidence: string | null, reason: string }
 */
function findDuplicate(newExercise, existingExercises, options = {}) {
  const {
    fuzzyMatchThreshold = 0.85,
    equipmentMatch = true,
  } = options;
  
  let bestMatch = null;
  let bestConfidence = null;
  let bestReason = null;
  let bestSimilarity = 0;
  
  for (const existing of existingExercises) {
    const result = areDuplicates(newExercise.name, existing.name, options);
    
    if (result.isDuplicate) {
      // Prefer higher confidence matches
      const confidenceRank = { high: 3, medium: 2, low: 1 };
      const currentRank = confidenceRank[result.confidence] || 0;
      const bestRank = confidenceRank[bestConfidence] || 0;
      
      // If equipment matching is enabled, consider equipment differences
      if (equipmentMatch && newExercise.equipment && existing.equipment) {
        const eq1 = (newExercise.equipment || '').toLowerCase();
        const eq2 = (existing.equipment || '').toLowerCase();
        
        // If equipment is different, lower confidence
        if (eq1 !== eq2 && eq1 !== 'none' && eq2 !== 'none') {
          // Still allow match but with lower confidence
          if (result.confidence === 'high') {
            result.confidence = 'medium';
          } else if (result.confidence === 'medium') {
            result.confidence = 'low';
          }
        }
      }
      
      // Update best match if this is better
      if (currentRank > bestRank || 
          (currentRank === bestRank && (result.similarity || 0) > bestSimilarity)) {
        bestMatch = existing;
        bestConfidence = result.confidence;
        bestReason = result.reason;
        bestSimilarity = result.similarity || 1.0;
      }
    }
  }
  
  return {
    match: bestMatch,
    confidence: bestConfidence,
    reason: bestReason,
    similarity: bestSimilarity,
  };
}

/**
 * Deduplicate array of new exercises against existing exercises
 * Returns: {
 *   duplicates: Array<{ new: exercise, existing: exercise, confidence: string }>,
 *   unique: Array<exercise>
 * }
 */
function deduplicateExercises(newExercises, existingExercises, options = {}) {
  const duplicates = [];
  const unique = [];
  
  for (const newExercise of newExercises) {
    const duplicate = findDuplicate(newExercise, existingExercises, options);
    
    if (duplicate.match) {
      duplicates.push({
        new: newExercise,
        existing: duplicate.match,
        confidence: duplicate.confidence,
        reason: duplicate.reason,
        similarity: duplicate.similarity,
      });
    } else {
      unique.push(newExercise);
    }
  }
  
  return { duplicates, unique };
}

module.exports = {
  normalizeName,
  levenshteinDistance,
  similarityRatio,
  areDuplicates,
  findDuplicate,
  deduplicateExercises,
};
