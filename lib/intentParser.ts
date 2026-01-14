/**
 * Natural Language Intent Parser
 *
 * Parses user free-form text input and extracts actionable intents.
 * This is a deterministic, rule-based parser that mocks LLM behavior
 * for real-time performance without API calls.
 *
 * Supports:
 * - Workout logging ("Did 3x10 curls with 30lbs")
 * - Session modifications ("knee hurts", "running late")
 * - Cardio logging ("ran 5k in 25 mins")
 * - General chat fallback
 */

// ============================================================================
// TYPES
// ============================================================================

export type IntentType =
  | 'LOG_WORKOUT'
  | 'LOG_CARDIO'
  | 'MODIFY_SESSION'
  | 'ADD_EXERCISE'
  | 'SKIP_EXERCISE'
  | 'CHAT';

export interface LogWorkoutPayload {
  exercise: string;
  sets?: number;
  reps?: number;
  weight?: number;
  weightUnit?: 'lbs' | 'kg';
  rpe?: number;
}

export interface LogCardioPayload {
  activity: string;
  distance?: number;
  distanceUnit?: 'km' | 'mi' | 'm';
  duration?: number; // in minutes
  pace?: string;
  calories?: number;
}

export interface ModifySessionPayload {
  constraint?: string;
  intent?: 'pain' | 'too_hard' | 'too_easy' | 'fatigue' | 'time_crunch' | 'skip_exercise' | 'swap_exercise';
  bodyPart?: string;
  reason?: string;
}

export interface AddExercisePayload {
  exercise: string;
  sets?: number;
  reps?: number;
}

export interface ChatPayload {
  message: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface ActionIntent {
  type: IntentType;
  payload: LogWorkoutPayload | LogCardioPayload | ModifySessionPayload | AddExercisePayload | ChatPayload;
  confidence: number; // 0-1 confidence score
  rawInput: string;
}

// ============================================================================
// PARSING PATTERNS
// ============================================================================

// Workout patterns: "3x10", "3 sets of 10", "3 sets 10 reps"
const SETS_REPS_PATTERNS = [
  /(\d+)\s*[xX×]\s*(\d+)/,                           // 3x10, 3X10, 3×10
  /(\d+)\s*sets?\s*(?:of\s*)?(\d+)\s*reps?/i,        // 3 sets of 10 reps
  /(\d+)\s*sets?\s*(?:@|at)?\s*(\d+)/i,              // 3 sets at 10
  /did\s*(\d+)\s*sets?\s*(?:of\s*)?(\d+)/i,          // did 3 sets of 10
];

// Weight patterns: "30lbs", "30 lbs", "30 pounds", "30kg"
const WEIGHT_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*(?:lbs?|pounds?)/i,
  /(\d+(?:\.\d+)?)\s*(?:kgs?|kilos?|kilograms?)/i,
  /(?:with|at|@)\s*(\d+(?:\.\d+)?)\s*(?:lbs?|kgs?)?/i,
];

// RPE patterns: "RPE 8", "@8", "at RPE 8"
const RPE_PATTERNS = [
  /(?:rpe|@)\s*(\d+(?:\.\d+)?)/i,
  /(?:at\s*)?rpe\s*(\d+(?:\.\d+)?)/i,
];

// Cardio patterns: "ran 5k", "5 miles", "25 mins", "25 minutes"
const CARDIO_PATTERNS = {
  distance: [
    /(\d+(?:\.\d+)?)\s*(?:k|km|kilometers?)/i,
    /(\d+(?:\.\d+)?)\s*(?:mi|miles?)/i,
    /(\d+(?:\.\d+)?)\s*(?:m|meters?)/i,
  ],
  duration: [
    /(\d+(?:\.\d+)?)\s*(?:mins?|minutes?)/i,
    /(\d+)\s*:\s*(\d+)(?:\s*(?:mins?|minutes?))?/,   // 25:30 or 25:30 mins
    /in\s*(\d+(?:\.\d+)?)\s*(?:mins?|minutes?)?/i,
  ],
  activity: [
    /(?:ran|run|running|jog|jogging)/i,
    /(?:walk|walking|walked)/i,
    /(?:bike|biking|biked|cycling|cycled)/i,
    /(?:swim|swimming|swam)/i,
    /(?:row|rowing|rowed)/i,
  ],
};

// Pain/injury patterns
const PAIN_PATTERNS = [
  /(?:my\s+)?(\w+)\s+(?:hurts?|is\s+hurting|aches?|is\s+aching|pain)/i,
  /(?:pain|ache|sore|soreness)\s+(?:in\s+)?(?:my\s+)?(\w+)/i,
  /injured?\s+(?:my\s+)?(\w+)/i,
  /(\w+)\s+(?:injury|strain|sprain)/i,
  /(?:pulled|tweaked|strained)\s+(?:my\s+)?(\w+)/i,
];

// Body part to constraint mapping
const BODY_PART_CONSTRAINTS: Record<string, string> = {
  knee: 'no_knee_flexion',
  knees: 'no_knee_flexion',
  back: 'no_spinal_loading',
  lower_back: 'no_spinal_loading',
  shoulder: 'no_overhead',
  shoulders: 'no_overhead',
  wrist: 'no_grip_intensive',
  wrists: 'no_grip_intensive',
  elbow: 'no_elbow_extension',
  elbows: 'no_elbow_extension',
  hip: 'no_hip_hinge',
  hips: 'no_hip_hinge',
  ankle: 'no_ankle_mobility',
  ankles: 'no_ankle_mobility',
  neck: 'no_neck_strain',
};

// Time/schedule patterns
const TIME_PATTERNS = [
  /(?:running|run)\s+(?:late|short)/i,
  /(?:short|low)\s+(?:on\s+)?time/i,
  /(?:gotta|have\s+to|need\s+to)\s+(?:go|leave|run)\s+(?:soon|early)/i,
  /(?:only\s+have|got)\s+(\d+)\s*(?:mins?|minutes?)/i,
  /(?:in\s+a\s+)?(?:rush|hurry)/i,
  /(?:quick|fast)\s+(?:session|workout)/i,
];

// Fatigue patterns
const FATIGUE_PATTERNS = [
  /(?:feeling|feel|i'm|im)\s+(?:tired|exhausted|fatigued|beat|drained)/i,
  /(?:didn't|didnt|did\s+not)\s+(?:sleep|rest)\s+(?:well|good|enough)/i,
  /(?:low|no)\s+(?:energy|motivation)/i,
  /(?:rough|bad|hard)\s+(?:day|night|week)/i,
  /(?:sore|stiff)\s+(?:all\s+over|everywhere)/i,
];

// "Too easy" patterns
const TOO_EASY_PATTERNS = [
  /(?:too|way\s+too)\s+(?:easy|light)/i,
  /(?:not|isn't|isnt)\s+(?:challenging|hard)\s+enough/i,
  /(?:can|could)\s+(?:do|go)\s+(?:more|heavier|harder)/i,
  /(?:bump|add)\s+(?:up|more)\s+(?:weight|load)/i,
  /(?:feels?|feeling)\s+(?:light|easy)/i,
];

// "Too hard" patterns
const TOO_HARD_PATTERNS = [
  /(?:too|way\s+too)\s+(?:hard|heavy)/i,
  /(?:can't|cant|cannot)\s+(?:do|lift|handle)\s+(?:this|that|it)/i,
  /(?:struggling|struggle)/i,
  /(?:drop|lower|reduce)\s+(?:the\s+)?(?:weight|load)/i,
  /(?:this|that)\s+(?:is|was)\s+(?:brutal|killer|tough)/i,
];

// Skip exercise patterns
const SKIP_PATTERNS = [
  /(?:skip|pass\s+on|skip\s+over)\s+(?:this|that|the)?\s*(?:one|exercise)?/i,
  /(?:don't|dont|do\s+not)\s+(?:want\s+to|wanna)\s+(?:do|try)\s+(?:this|that)/i,
  /(?:next|move\s+on)/i,
  /(?:let's|lets)\s+(?:skip|move\s+on)/i,
];

// Exercise name extraction patterns
const EXERCISE_PATTERNS = [
  // Common exercises
  /(?:bicep\s*)?curls?/i,
  /(?:tricep\s*)?(?:push\s*downs?|extensions?)/i,
  /bench\s*press/i,
  /squats?/i,
  /deadlifts?/i,
  /(?:overhead|military|shoulder)\s*press/i,
  /rows?/i,
  /(?:pull|chin)\s*ups?/i,
  /lunges?/i,
  /(?:lat\s*)?pull\s*downs?/i,
  /(?:leg\s*)?press/i,
  /(?:leg\s*)?(?:curls?|extensions?)/i,
  /(?:calf|calves)\s*raises?/i,
  /(?:lateral|front|rear)\s*raises?/i,
  /(?:face\s*)?pulls?/i,
  /dips?/i,
  /shrugs?/i,
  /planks?/i,
  /crunches?/i,
];

// ============================================================================
// PARSER FUNCTIONS
// ============================================================================

/**
 * Attempts to parse workout logging intent from user input.
 * Examples: "Did 3x10 curls with 30lbs", "bench press 225 for 5"
 */
function parseWorkoutLog(input: string): LogWorkoutPayload | null {
  let sets: number | undefined;
  let reps: number | undefined;
  let weight: number | undefined;
  let weightUnit: 'lbs' | 'kg' = 'lbs';
  let exercise: string | undefined;
  let rpe: number | undefined;

  // Try to extract sets x reps
  for (const pattern of SETS_REPS_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      sets = parseInt(match[1], 10);
      reps = parseInt(match[2], 10);
      break;
    }
  }

  // Try to extract weight
  for (const pattern of WEIGHT_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      weight = parseFloat(match[1]);
      if (/kg|kilo/i.test(input)) {
        weightUnit = 'kg';
      }
      break;
    }
  }

  // Try to extract RPE
  for (const pattern of RPE_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      rpe = parseFloat(match[1]);
      break;
    }
  }

  // Try to extract exercise name
  for (const pattern of EXERCISE_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      exercise = normalizeExerciseName(match[0]);
      break;
    }
  }

  // We need at least sets/reps OR weight to consider this a workout log
  if ((sets && reps) || weight) {
    return {
      exercise: exercise || 'Unknown Exercise',
      sets,
      reps,
      weight,
      weightUnit,
      rpe,
    };
  }

  return null;
}

/**
 * Attempts to parse cardio logging intent from user input.
 * Examples: "ran 5k in 25 mins", "walked 2 miles"
 */
function parseCardioLog(input: string): LogCardioPayload | null {
  let activity: string | undefined;
  let distance: number | undefined;
  let distanceUnit: 'km' | 'mi' | 'm' | undefined;
  let duration: number | undefined;

  // Check for cardio activity
  for (const pattern of CARDIO_PATTERNS.activity) {
    if (pattern.test(input)) {
      const match = input.match(pattern);
      if (match) {
        activity = normalizeCardioActivity(match[0]);
        break;
      }
    }
  }

  // Extract distance
  for (const pattern of CARDIO_PATTERNS.distance) {
    const match = input.match(pattern);
    if (match) {
      distance = parseFloat(match[1]);
      if (/km|k|kilometers?/i.test(input)) {
        distanceUnit = 'km';
      } else if (/mi|miles?/i.test(input)) {
        distanceUnit = 'mi';
      } else {
        distanceUnit = 'm';
      }
      break;
    }
  }

  // Extract duration
  for (const pattern of CARDIO_PATTERNS.duration) {
    const match = input.match(pattern);
    if (match) {
      if (match[2]) {
        // Time format like 25:30
        duration = parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
      } else {
        duration = parseFloat(match[1]);
      }
      break;
    }
  }

  // We need activity AND (distance OR duration) to consider this cardio
  if (activity && (distance || duration)) {
    return {
      activity,
      distance,
      distanceUnit,
      duration,
    };
  }

  return null;
}

/**
 * Attempts to parse session modification intent from user input.
 * Examples: "knee hurts", "running late", "too tired"
 */
function parseModificationIntent(input: string): ModifySessionPayload | null {
  // Check for pain/injury
  for (const pattern of PAIN_PATTERNS) {
    const match = input.match(pattern);
    if (match) {
      const bodyPart = match[1]?.toLowerCase();
      const constraint = BODY_PART_CONSTRAINTS[bodyPart] || `no_${bodyPart}_strain`;
      return {
        intent: 'pain',
        bodyPart,
        constraint,
        reason: `User reported ${bodyPart} pain`,
      };
    }
  }

  // Check for time constraints
  for (const pattern of TIME_PATTERNS) {
    if (pattern.test(input)) {
      return {
        intent: 'time_crunch',
        reason: 'User is short on time',
      };
    }
  }

  // Check for fatigue
  for (const pattern of FATIGUE_PATTERNS) {
    if (pattern.test(input)) {
      return {
        intent: 'fatigue',
        reason: 'User is fatigued',
      };
    }
  }

  // Check for "too easy"
  for (const pattern of TOO_EASY_PATTERNS) {
    if (pattern.test(input)) {
      return {
        intent: 'too_easy',
        reason: 'User finds exercise too easy',
      };
    }
  }

  // Check for "too hard"
  for (const pattern of TOO_HARD_PATTERNS) {
    if (pattern.test(input)) {
      return {
        intent: 'too_hard',
        reason: 'User finds exercise too hard',
      };
    }
  }

  // Check for skip request
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(input)) {
      return {
        intent: 'skip_exercise',
        reason: 'User wants to skip exercise',
      };
    }
  }

  return null;
}

/**
 * Normalizes exercise names to a standard format.
 */
function normalizeExerciseName(raw: string): string {
  const normalized = raw.toLowerCase().trim();

  const mappings: Record<string, string> = {
    curl: 'Bicep Curl',
    curls: 'Bicep Curl',
    'bicep curl': 'Bicep Curl',
    'bicep curls': 'Bicep Curl',
    squat: 'Squat',
    squats: 'Squat',
    deadlift: 'Deadlift',
    deadlifts: 'Deadlift',
    'bench press': 'Bench Press',
    bench: 'Bench Press',
    row: 'Row',
    rows: 'Row',
    'pull up': 'Pull-Up',
    'pull ups': 'Pull-Up',
    pullup: 'Pull-Up',
    pullups: 'Pull-Up',
    'chin up': 'Chin-Up',
    'chin ups': 'Chin-Up',
    chinup: 'Chin-Up',
    chinups: 'Chin-Up',
    lunge: 'Lunge',
    lunges: 'Lunge',
    dip: 'Dip',
    dips: 'Dip',
    plank: 'Plank',
    planks: 'Plank',
    crunch: 'Crunch',
    crunches: 'Crunch',
    shrug: 'Shrug',
    shrugs: 'Shrug',
    'lat pulldown': 'Lat Pulldown',
    'lat pull down': 'Lat Pulldown',
    'leg press': 'Leg Press',
    'leg curl': 'Leg Curl',
    'leg curls': 'Leg Curl',
    'leg extension': 'Leg Extension',
    'leg extensions': 'Leg Extension',
    'calf raise': 'Calf Raise',
    'calf raises': 'Calf Raise',
    'lateral raise': 'Lateral Raise',
    'lateral raises': 'Lateral Raise',
    'front raise': 'Front Raise',
    'front raises': 'Front Raise',
    'overhead press': 'Overhead Press',
    'military press': 'Military Press',
    'shoulder press': 'Shoulder Press',
    'face pull': 'Face Pull',
    'face pulls': 'Face Pull',
    'tricep pushdown': 'Tricep Pushdown',
    'tricep extension': 'Tricep Extension',
  };

  return mappings[normalized] || titleCase(normalized);
}

/**
 * Normalizes cardio activity names.
 */
function normalizeCardioActivity(raw: string): string {
  const normalized = raw.toLowerCase().trim();

  if (/ran|run|running|jog|jogging/.test(normalized)) {
    return 'Running';
  }
  if (/walk|walking|walked/.test(normalized)) {
    return 'Walking';
  }
  if (/bike|biking|biked|cycling|cycled/.test(normalized)) {
    return 'Cycling';
  }
  if (/swim|swimming|swam/.test(normalized)) {
    return 'Swimming';
  }
  if (/row|rowing|rowed/.test(normalized)) {
    return 'Rowing';
  }

  return titleCase(normalized);
}

/**
 * Converts a string to title case.
 */
function titleCase(str: string): string {
  return str
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Analyzes sentiment of the input for chat fallback.
 */
function analyzeSentiment(input: string): 'positive' | 'negative' | 'neutral' {
  const positivePatterns = [
    /(?:great|awesome|amazing|good|nice|love|loving|excited|pumped|ready)/i,
    /(?:let's go|lets go|yeah|yes|yay)/i,
  ];

  const negativePatterns = [
    /(?:bad|terrible|awful|hate|sucks|frustrated|annoyed|angry)/i,
    /(?:ugh|damn|crap|shit)/i,
  ];

  for (const pattern of positivePatterns) {
    if (pattern.test(input)) return 'positive';
  }

  for (const pattern of negativePatterns) {
    if (pattern.test(input)) return 'negative';
  }

  return 'neutral';
}

// ============================================================================
// MAIN PARSER
// ============================================================================

/**
 * Main intent parser function.
 * Analyzes user input and returns the most likely intent.
 *
 * @param input - Raw user input string
 * @returns ActionIntent object with type, payload, and confidence
 */
export function parseIntent(input: string): ActionIntent {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return {
      type: 'CHAT',
      payload: { message: '', sentiment: 'neutral' } as ChatPayload,
      confidence: 0,
      rawInput: input,
    };
  }

  // Try to parse as workout log
  const workoutPayload = parseWorkoutLog(trimmedInput);
  if (workoutPayload) {
    // Higher confidence if we got all components
    const hasExercise = workoutPayload.exercise !== 'Unknown Exercise';
    const hasSetsReps = workoutPayload.sets && workoutPayload.reps;
    const hasWeight = workoutPayload.weight !== undefined;

    let confidence = 0.5;
    if (hasExercise) confidence += 0.2;
    if (hasSetsReps) confidence += 0.15;
    if (hasWeight) confidence += 0.15;

    return {
      type: 'LOG_WORKOUT',
      payload: workoutPayload,
      confidence: Math.min(confidence, 1),
      rawInput: input,
    };
  }

  // Try to parse as cardio log
  const cardioPayload = parseCardioLog(trimmedInput);
  if (cardioPayload) {
    let confidence = 0.6;
    if (cardioPayload.distance) confidence += 0.2;
    if (cardioPayload.duration) confidence += 0.2;

    return {
      type: 'LOG_CARDIO',
      payload: cardioPayload,
      confidence: Math.min(confidence, 1),
      rawInput: input,
    };
  }

  // Try to parse as modification intent
  const modificationPayload = parseModificationIntent(trimmedInput);
  if (modificationPayload) {
    // Pain reports get high confidence
    const confidence = modificationPayload.intent === 'pain' ? 0.9 : 0.75;

    return {
      type: 'MODIFY_SESSION',
      payload: modificationPayload,
      confidence,
      rawInput: input,
    };
  }

  // Fallback to chat
  return {
    type: 'CHAT',
    payload: {
      message: trimmedInput,
      sentiment: analyzeSentiment(trimmedInput),
    } as ChatPayload,
    confidence: 0.3,
    rawInput: input,
  };
}

/**
 * Maps a ModifySessionPayload intent to a ModificationIntent for the store.
 */
export function mapToStoreModificationIntent(
  payload: ModifySessionPayload
): 'pain' | 'too_hard' | 'too_easy' | 'fatigue' | 'skip_exercise' | 'time_crunch' | null {
  if (!payload.intent) return null;

  const validIntents = ['pain', 'too_hard', 'too_easy', 'fatigue', 'skip_exercise', 'time_crunch'];
  if (validIntents.includes(payload.intent)) {
    return payload.intent as 'pain' | 'too_hard' | 'too_easy' | 'fatigue' | 'skip_exercise' | 'time_crunch';
  }

  return null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default parseIntent;
