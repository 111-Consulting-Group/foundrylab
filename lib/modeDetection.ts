/**
 * Mode Detection
 * Determines which coach mode to use based on user intent and context
 */

import type {
  CoachMode,
  ExtendedCoachContext,
  IntakeSection,
  IntakeResponses,
} from '@/types/coach';

// Type for concurrent activities
type ConcurrentActivity = NonNullable<IntakeResponses['concurrent_activities']>[number];

// ============================================================================
// INTENT PATTERNS
// ============================================================================

interface IntentPattern {
  mode: CoachMode;
  patterns: string[];
  requiresContext?: (context: ExtendedCoachContext) => boolean;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // Weekly planning triggers
  {
    mode: 'weekly_planning',
    patterns: [
      'plan my week',
      'plan this week',
      'weekly plan',
      "what's my week look like",
      "it's sunday",
      'plan for the week',
      'what should i do this week',
      'schedule my week',
      'week ahead',
    ],
  },

  // Daily mode triggers
  {
    mode: 'daily',
    patterns: [
      'what should i do today',
      "today's workout",
      'what do i do today',
      'workout for today',
      'train today',
      'what am i doing today',
      'today',
    ],
    requiresContext: (ctx) => {
      // Only if it looks like they're asking about today specifically
      return true;
    },
  },

  // Post-workout evaluation triggers
  {
    mode: 'post_workout',
    patterns: [
      'just finished',
      'just did',
      'here\'s what i did',
      'completed my workout',
      'done with my workout',
      'logged my workout',
      'how did i do',
      'here is my workout',
      'i did',
      'workout complete',
    ],
  },

  // Explain/reasoning triggers
  {
    mode: 'explain',
    patterns: [
      'why did you',
      'why are you',
      'explain why',
      'why this',
      'why that',
      'what\'s the reasoning',
      'why not',
      'how come',
      'explain your',
      'reasoning behind',
    ],
  },

  // History/progress triggers
  {
    mode: 'history',
    patterns: [
      'how have i been doing',
      'my progress',
      'am i improving',
      'show my history',
      'analyze my training',
      'what\'s working',
      'what\'s not working',
      'training review',
      'how\'s my training',
      'progress check',
      'last few weeks',
    ],
  },

  // Phase detection triggers
  {
    mode: 'phase',
    patterns: [
      'what phase am i in',
      'where am i in my training',
      'should i deload',
      'am i overtraining',
      'training phase',
      'current phase',
      'need a break',
      'feeling beat up',
      'recovery week',
    ],
  },

  // Reflect/summary triggers
  {
    mode: 'reflect',
    patterns: [
      'summarize my training',
      'what do you know about me',
      'my profile',
      'do you understand',
      'what have you learned',
      'recap',
    ],
  },
];

// ============================================================================
// MODE DETECTION
// ============================================================================

/**
 * Detect the appropriate coach mode from a user message
 */
export function detectModeFromMessage(
  message: string,
  context: ExtendedCoachContext
): CoachMode {
  const lowerMessage = message.toLowerCase().trim();

  // Check if intake is needed first (highest priority)
  if (shouldTriggerIntake(context)) {
    return 'intake';
  }

  // Check explicit pattern matches
  for (const { mode, patterns, requiresContext } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (lowerMessage.includes(pattern)) {
        // Check context requirements if any
        if (requiresContext && !requiresContext(context)) {
          continue;
        }
        return mode;
      }
    }
  }

  // Check for workout data submission (post-workout)
  if (looksLikeWorkoutData(lowerMessage)) {
    return 'post_workout';
  }

  // Default to general conversation
  return 'general';
}

/**
 * Check if intake should be triggered
 */
function shouldTriggerIntake(context: ExtendedCoachContext): boolean {
  // No profile at all
  if (!context.profile) {
    return true;
  }

  // Intake never started
  if (!context.intakeState) {
    return true;
  }

  // Intake started but not complete
  if (!context.intakeComplete && !context.intakeState.isComplete) {
    return true;
  }

  return false;
}

/**
 * Check if message looks like workout data being submitted
 */
function looksLikeWorkoutData(message: string): boolean {
  // Look for patterns like "3x8 @ 185" or "squat: 225x5"
  const workoutPatterns = [
    /\d+\s*x\s*\d+/i,        // "3x8", "4 x 10"
    /\d+\s*@\s*\d+/i,        // "5 @ 185"
    /\d+\s*lbs?/i,           // "185 lbs"
    /\d+\s*kg/i,             // "80 kg"
    /sets?:\s*\d+/i,         // "sets: 4"
    /reps?:\s*\d+/i,         // "reps: 8"
    /rpe\s*\d+/i,            // "RPE 8"
  ];

  return workoutPatterns.some((pattern) => pattern.test(message));
}

// ============================================================================
// INTAKE SECTION DETECTION
// ============================================================================

/**
 * Parse user response to determine which intake section it answers
 */
export function detectIntakeSectionFromResponse(
  message: string,
  currentSection: IntakeSection
): {
  answersCurrentSection: boolean;
  extractedData: Partial<Record<string, unknown>>;
} {
  const lowerMessage = message.toLowerCase();

  switch (currentSection) {
    case 'goals': {
      const goalKeywords = {
        strength: ['stronger', 'strength', 'lift heavier', 'powerlifting'],
        hypertrophy: ['muscle', 'hypertrophy', 'bigger', 'size', 'bodybuilding', 'build muscle'],
        fat_loss: ['fat', 'lose weight', 'lean', 'cut', 'shred'],
        athletic: ['sport', 'athletic', 'performance', 'speed', 'agility'],
        health: ['health', 'healthy', 'longevity', 'general fitness', 'consistent'],
        maintain: ['maintain', 'keep', 'sustain', 'hold'],
      };

      for (const [goal, keywords] of Object.entries(goalKeywords)) {
        if (keywords.some((k) => lowerMessage.includes(k))) {
          return {
            answersCurrentSection: true,
            extractedData: { primary_goal: goal },
          };
        }
      }
      break;
    }

    case 'schedule': {
      // Look for numbers that could be days per week
      const daysMatch = lowerMessage.match(/(\d)\s*(?:days?|times?|x)/i);
      const minutesMatch = lowerMessage.match(/(\d+)\s*(?:min|minutes?|hour)/i);

      if (daysMatch || minutesMatch) {
        return {
          answersCurrentSection: true,
          extractedData: {
            ...(daysMatch && { days_per_week: parseInt(daysMatch[1]) }),
            ...(minutesMatch && {
              session_length_minutes: lowerMessage.includes('hour')
                ? parseInt(minutesMatch[1]) * 60
                : parseInt(minutesMatch[1]),
            }),
          },
        };
      }
      break;
    }

    case 'concurrent_training': {
      const activities: ConcurrentActivity[] = [];
      if (lowerMessage.includes('run') || lowerMessage.includes('running')) activities.push('running');
      if (lowerMessage.includes('cycl') || lowerMessage.includes('bike')) activities.push('cycling');
      if (lowerMessage.includes('swim')) activities.push('swimming');
      if (lowerMessage.includes('sport')) activities.push('sports');
      if (lowerMessage.includes('hik')) activities.push('hiking');

      const hoursMatch = lowerMessage.match(/(\d+)\s*(?:hours?|hrs?)/i);

      if (activities.length > 0 || lowerMessage.includes('no') || lowerMessage.includes('none')) {
        return {
          answersCurrentSection: true,
          extractedData: {
            concurrent_activities: activities.length > 0 ? activities : [],
            ...(hoursMatch && { concurrent_hours_per_week: parseInt(hoursMatch[1]) }),
          },
        };
      }
      break;
    }

    case 'constraints': {
      // Look for injury/preference mentions
      const hasInjuryMention = /injur|pain|avoid|can't|cannot|bad|hurt|issue/i.test(lowerMessage);
      const hasPreferenceMention = /love|like|prefer|hate|enjoy|favorite/i.test(lowerMessage);
      const hasNone = /no|none|nothing|nope/i.test(lowerMessage);

      if (hasInjuryMention || hasPreferenceMention || hasNone) {
        return {
          answersCurrentSection: true,
          extractedData: {
            // Store the raw response for the coach to parse
            injuries: hasInjuryMention ? message : undefined,
            exercise_preferences: hasPreferenceMention && lowerMessage.includes('love') ? message : undefined,
            exercise_aversions: hasPreferenceMention && lowerMessage.includes('hate') ? message : undefined,
          },
        };
      }
      break;
    }

    case 'context': {
      // Look for disruption mentions or sleep/stress ratings
      const sleepMatch = lowerMessage.match(/sleep[:\s]*(\d+)/i);
      const stressMatch = lowerMessage.match(/stress[:\s]*(\d+)/i);
      const hasDisruptionMention = /travel|sick|ill|busy|stress|tired|exhausted/i.test(lowerMessage);
      const hasNone = /no|none|nothing|normal|fine|good/i.test(lowerMessage);

      if (sleepMatch || stressMatch || hasDisruptionMention || hasNone) {
        return {
          answersCurrentSection: true,
          extractedData: {
            ...(sleepMatch && { sleep_quality: parseInt(sleepMatch[1]) }),
            ...(stressMatch && { stress_level: parseInt(stressMatch[1]) }),
            upcoming_disruptions: hasDisruptionMention ? message : undefined,
          },
        };
      }
      break;
    }

    case 'coaching_style': {
      // Look for a number 1-10 or keywords
      const numberMatch = lowerMessage.match(/\b(\d|10)\b/);
      const prefersStructure = /tell me|precise|exact|specific|detail/i.test(lowerMessage);
      const prefersFlexibility = /flexible|framework|freedom|figure|myself/i.test(lowerMessage);

      if (numberMatch) {
        return {
          answersCurrentSection: true,
          extractedData: { autonomy_preference: parseInt(numberMatch[1]) },
        };
      }
      if (prefersStructure) {
        return {
          answersCurrentSection: true,
          extractedData: { autonomy_preference: 8 },
        };
      }
      if (prefersFlexibility) {
        return {
          answersCurrentSection: true,
          extractedData: { autonomy_preference: 3 },
        };
      }
      break;
    }
  }

  // Couldn't definitively parse - let the coach handle it conversationally
  return {
    answersCurrentSection: false,
    extractedData: {},
  };
}

// ============================================================================
// MODE TRANSITION LOGIC
// ============================================================================

/**
 * Determine if mode should transition after a response
 */
export function shouldTransitionMode(
  currentMode: CoachMode,
  context: ExtendedCoachContext,
  lastAssistantMessage?: string
): CoachMode | null {
  switch (currentMode) {
    case 'intake':
      // If intake is complete, transition to reflect
      if (context.intakeComplete || context.intakeState?.isComplete) {
        return 'reflect';
      }
      break;

    case 'reflect':
      // After reflect, user drives the next interaction
      // No automatic transition
      break;

    case 'weekly_planning':
    case 'daily':
    case 'history':
    case 'phase':
    case 'post_workout':
    case 'explain':
      // These are one-shot modes, return to general after
      // But only if the conversation continues
      break;
  }

  return null;
}

// ============================================================================
// QUICK SUGGESTIONS BY MODE
// ============================================================================

/**
 * Get contextual quick suggestions based on current mode and context
 */
export function getQuickSuggestions(
  currentMode: CoachMode,
  context: ExtendedCoachContext
): string[] {
  const suggestions: string[] = [];

  // Universal suggestions
  if (context.todayReadiness === null) {
    suggestions.push('How am I doing today?');
  }

  // Mode-specific suggestions
  switch (currentMode) {
    case 'intake':
      // During intake, no suggestions - let the flow continue
      break;

    case 'reflect':
      suggestions.push('Plan my week');
      suggestions.push('What should I do today?');
      break;

    case 'general':
      // Day of week awareness
      const dayOfWeek = new Date().getDay();
      if (dayOfWeek === 0) {
        // Sunday
        suggestions.push('Plan my week');
      } else {
        suggestions.push('What should I do today?');
      }

      suggestions.push('How have I been doing?');

      // Context-aware suggestions
      if (context.recentWorkouts.length > 0) {
        suggestions.push('What phase am I in?');
      }

      if (context.historyAnalysis?.gaps && context.historyAnalysis.gaps.length > 0) {
        suggestions.push('Help me rebuild consistency');
      }
      break;

    case 'weekly_planning':
      suggestions.push('Adjust the plan');
      suggestions.push('Explain this plan');
      break;

    case 'daily':
      suggestions.push('What if I feel off?');
      suggestions.push('Show alternatives');
      break;

    case 'post_workout':
      suggestions.push('What should I do next time?');
      suggestions.push('Plan the rest of my week');
      break;

    case 'history':
      suggestions.push('What should I focus on?');
      suggestions.push('Plan my week based on this');
      break;

    case 'phase':
      suggestions.push('Adjust my training');
      suggestions.push('Plan a deload');
      break;
  }

  return suggestions.slice(0, 4); // Max 4 suggestions
}
