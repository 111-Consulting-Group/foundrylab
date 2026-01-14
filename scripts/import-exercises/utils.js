/**
 * Utility functions for exercise import and mapping
 */

// Muscle group standardization mapping
const MUSCLE_GROUP_MAP = {
  // free-exercise-db mappings
  'abdominals': 'Core',
  'abductors': 'Legs',
  'adductors': 'Legs',
  'biceps': 'Arms',
  'calves': 'Legs',
  'chest': 'Chest',
  'forearms': 'Arms',
  'glutes': 'Legs',
  'hamstrings': 'Legs',
  'lats': 'Back',
  'lower back': 'Back',
  'middle back': 'Back',
  'neck': 'Shoulders',
  'quadriceps': 'Legs',
  'shoulders': 'Shoulders',
  'traps': 'Back',
  'triceps': 'Arms',
  
  // ExerciseDB mappings (common variations)
  'abs': 'Core',
  'abdominal': 'Core',
  'obliques': 'Core',
  'bicep': 'Arms',
  'tricep': 'Arms',
  'deltoids': 'Shoulders',
  'delts': 'Shoulders',
  'pectorals': 'Chest',
  'pecs': 'Chest',
  'latissimus dorsi': 'Back',
  'lats': 'Back',
  'trapezius': 'Back',
  'trapezoids': 'Back',
  'gluteus maximus': 'Legs',
  'glutes': 'Legs',
  'quadriceps': 'Legs',
  'quads': 'Legs',
  'hamstrings': 'Legs',
  'hams': 'Legs',
  'gastrocnemius': 'Legs',
  'soleus': 'Legs',
  'calves': 'Legs',
  'cardiovascular': 'Cardiovascular',
  'cardio': 'Cardiovascular',
  'full body': 'Full Body',
  'fullbody': 'Full Body',
};

// Equipment standardization
const EQUIPMENT_MAP = {
  'body only': 'None',
  'bodyweight': 'None',
  'none': 'None',
  'dumbbell': 'Dumbbells',
  'dumbbells': 'Dumbbells',
  'barbell': 'Barbell',
  'barbells': 'Barbell',
  'cable': 'Machine/Cable',
  'cables': 'Machine/Cable',
  'machine': 'Machine/Cable',
  'kettlebell': 'Kettlebell',
  'kettlebells': 'Kettlebell',
  'band': 'Band',
  'bands': 'Band',
  'resistance band': 'Band',
  'resistance bands': 'Band',
  'ez curl bar': 'Barbell',
  'e-z curl bar': 'Barbell',
};

/**
 * Normalize muscle group name to standard format
 */
function normalizeMuscleGroup(muscleGroup) {
  if (!muscleGroup) return 'Full Body';
  
  const normalized = muscleGroup.toLowerCase().trim();
  
  // Direct mapping
  if (MUSCLE_GROUP_MAP[normalized]) {
    return MUSCLE_GROUP_MAP[normalized];
  }
  
  // Partial matching
  for (const [key, value] of Object.entries(MUSCLE_GROUP_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  // Capitalize first letter of each word as fallback
  return muscleGroup.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Normalize equipment name to standard format
 */
function normalizeEquipment(equipment) {
  if (!equipment) return 'None';
  
  const normalized = equipment.toLowerCase().trim();
  
  if (EQUIPMENT_MAP[normalized]) {
    return EQUIPMENT_MAP[normalized];
  }
  
  // Partial matching
  for (const [key, value] of Object.entries(EQUIPMENT_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return value;
    }
  }
  
  // Capitalize first letter of each word as fallback
  return equipment.split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Determine modality from category/exercise type
 */
function determineModality(category, exerciseName = '') {
  const name = exerciseName.toLowerCase();
  const cat = (category || '').toLowerCase();
  
  // Check category first (most reliable)
  if (cat === 'strength' || cat === 'powerlifting' || cat === 'olympic weightlifting') {
    return 'Strength';
  }
  
  if (cat === 'cardio' || cat === 'cardiovascular') {
    return 'Cardio';
  }
  
  if (cat === 'stretching' || cat === 'flexibility') {
    return 'Strength'; // Stretching exercises still use Strength modality
  }
  
  // If category is not clear, check name patterns (use word boundaries to avoid false matches)
  // Use regex word boundaries to match whole words only
  const cardioPatterns = [
    /\brun\b/,           // running, run, etc.
    /\bjog\b/,           // jogging, jog, etc.
    /\bsprint\b/,        // sprinting, sprint, etc.
    /\binterval\b/,      // interval training
    /\bpace\b/,          // pace work
    /\bzone\s*\d+/,      // zone 2, zone 3, etc.
    /\bcardio\b/,        // cardio
    /\bcycling\b/,       // cycling
    /\bbike\b/,          // bike, biking
    /\brower\b/,         // rower, rowing machine
    /\btreadmill\b/,     // treadmill
    /\belliptical\b/,    // elliptical
  ];
  
  for (const pattern of cardioPatterns) {
    if (pattern.test(name)) {
      return 'Cardio';
    }
  }
  
  // Hybrid exercises (e.g., farmer's walk, carries)
  if (/\bfarmer/.test(name) || /\bcarry/.test(name) || 
      /\bloaded\s+carry/.test(name) || /\bsled/.test(name)) {
    return 'Hybrid';
  }
  
  // Default to Strength
  return 'Strength';
}

/**
 * Determine primary metric from modality and exercise characteristics
 */
function determinePrimaryMetric(modality, exerciseName = '') {
  const name = exerciseName.toLowerCase();
  
  if (modality === 'Cardio') {
    if (name.includes('pace') || name.includes('run') || name.includes('jog')) {
      return 'Pace';
    }
    if (name.includes('watts') || name.includes('power') || name.includes('bike') || name.includes('cycling')) {
      return 'Watts';
    }
    if (name.includes('distance') || name.includes('mile') || name.includes('km')) {
      return 'Distance';
    }
    return 'Pace'; // Default for cardio
  }
  
  if (modality === 'Hybrid') {
    // Hybrid exercises typically use weight
    return 'Weight';
  }
  
  // Strength exercises use weight
  return 'Weight';
}

/**
 * Convert instructions array to string
 */
function formatInstructions(instructions) {
  if (!instructions) return null;
  
  if (Array.isArray(instructions)) {
    return instructions.join('\n\n');
  }
  
  if (typeof instructions === 'string') {
    return instructions;
  }
  
  return null;
}

/**
 * Get primary muscle group from array (takes first if multiple)
 */
function getPrimaryMuscleGroup(muscles) {
  if (!muscles || muscles.length === 0) return 'Full Body';
  
  if (Array.isArray(muscles)) {
    return normalizeMuscleGroup(muscles[0]);
  }
  
  return normalizeMuscleGroup(muscles);
}

module.exports = {
  normalizeMuscleGroup,
  normalizeEquipment,
  determineModality,
  determinePrimaryMetric,
  formatInstructions,
  getPrimaryMuscleGroup,
  MUSCLE_GROUP_MAP,
  EQUIPMENT_MAP,
};
