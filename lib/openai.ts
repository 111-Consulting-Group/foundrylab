import type { AIGeneratedBlock, Exercise } from '@/types/database';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// System prompt for training block generation
const SYSTEM_PROMPT = `You are an expert strength and conditioning coach specializing in hybrid athlete training.
Your job is to generate training programs based on user goals.

When generating a training block:
1. Consider the user's stated goals (strength, conditioning, sport-specific)
2. Include appropriate exercises from the provided exercise list
3. Use RPE-based loading (6-10 scale)
4. Include warm-up guidance where appropriate
5. Balance volume and intensity appropriately for the training phase
6. Consider recovery and progressive overload principles
7. If the user's current PRs are provided, use them to set appropriate starting loads
8. For exercises with known PRs, calculate working weights as percentages (e.g., 70-85% of e1RM for working sets)

Output Format:
Return ONLY valid JSON matching this structure:
{
  "name": "Block name",
  "description": "Brief description of the block's focus",
  "duration_weeks": number (typically 4-8),
  "workouts": [
    {
      "week_number": number,
      "day_number": number,
      "focus": "Primary focus (e.g., Upper Push, Lower, Conditioning)",
      "exercises": [
        {
          "exercise_name": "Exact name from exercise list",
          "sets": [
            {
              "set_order": number,
              "target_reps": number,
              "target_rpe": number (6-10),
              "notes": "Optional notes"
            }
          ]
        }
      ]
    }
  ]
}

Important rules:
- Use ONLY exercises from the provided exercise list
- Keep workouts reasonable (4-8 exercises per session)
- Include rest day recommendations in the description
- RPE typically ranges from 6 (easy) to 10 (max effort)
- For strength: 3-5 reps at higher RPE
- For hypertrophy: 8-12 reps at moderate RPE
- For conditioning: specify duration or rounds`;

export interface UserPR {
  exerciseName: string;
  e1rm: number | null;
}

export interface TrainingHistorySummary {
  detectedSplit?: string; // e.g., "Push/Pull/Legs"
  avgWorkoutsPerWeek?: number;
  avgExercisesPerWorkout?: number;
  frequentExercises?: string[]; // Top exercises they use
  recentFocuses?: string[]; // Last few workout focuses
}

export interface GenerateBlockParams {
  prompt: string;
  exercises: Exercise[];
  durationWeeks?: number;
  userPRs?: UserPR[];
  activeGoals?: { exerciseName: string; targetValue: number; currentValue: number | null }[];
  trainingHistory?: TrainingHistorySummary;
}

export async function generateTrainingBlock({
  prompt,
  exercises,
  durationWeeks = 4,
  userPRs = [],
  activeGoals = [],
  trainingHistory,
}: GenerateBlockParams): Promise<AIGeneratedBlock> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  // Create exercise list for context
  const exerciseList = exercises
    .map((e) => `- ${e.name} (${e.modality}, ${e.muscle_group})`)
    .join('\n');

  // Format user's current PRs for context
  let prSection = '';
  if (userPRs.length > 0) {
    const prList = userPRs
      .filter((pr) => pr.e1rm !== null)
      .map((pr) => `- ${pr.exerciseName}: ${pr.e1rm} lbs (estimated 1RM)`)
      .join('\n');
    if (prList) {
      prSection = `\n\nUser's Current PRs (use these to set appropriate working weights):\n${prList}`;
    }
  }

  // Format active goals for context
  let goalsSection = '';
  if (activeGoals.length > 0) {
    const goalList = activeGoals
      .map((g) => {
        const current = g.currentValue !== null ? `${g.currentValue} lbs` : 'no current data';
        return `- ${g.exerciseName}: Target ${g.targetValue} lbs (currently ${current})`;
      })
      .join('\n');
    goalsSection = `\n\nUser's Active Training Goals (prioritize exercises related to these goals):\n${goalList}`;
  }

  // Format training history for context
  let historySection = '';
  if (trainingHistory) {
    const parts: string[] = [];

    if (trainingHistory.detectedSplit) {
      parts.push(`- Current training split: ${trainingHistory.detectedSplit}`);
    }
    if (trainingHistory.avgWorkoutsPerWeek) {
      parts.push(`- Average workouts per week: ${trainingHistory.avgWorkoutsPerWeek.toFixed(1)}`);
    }
    if (trainingHistory.avgExercisesPerWorkout) {
      parts.push(`- Average exercises per session: ${trainingHistory.avgExercisesPerWorkout.toFixed(1)}`);
    }
    if (trainingHistory.frequentExercises && trainingHistory.frequentExercises.length > 0) {
      parts.push(`- Frequently used exercises: ${trainingHistory.frequentExercises.slice(0, 5).join(', ')}`);
    }
    if (trainingHistory.recentFocuses && trainingHistory.recentFocuses.length > 0) {
      parts.push(`- Recent workout focuses: ${trainingHistory.recentFocuses.slice(0, 5).join(' → ')}`);
    }

    if (parts.length > 0) {
      historySection = `\n\nUser's Training History (build on their existing patterns when relevant):\n${parts.join('\n')}`;
    }
  }

  const userMessage = `Generate a ${durationWeeks}-week training block for the following goal:

"${prompt}"

Available exercises:
${exerciseList}${prSection}${goalsSection}${historySection}

Remember to use ONLY exercises from this list. If PRs are provided, calculate working weights as percentages of e1RM (typically 70-85% for working sets). Consider the user's training history when designing the program structure.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to generate training block');
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content in response');
  }

  try {
    const block = JSON.parse(content) as AIGeneratedBlock;

    // Validate and map exercise names to IDs
    block.workouts.forEach((workout) => {
      workout.exercises.forEach((ex) => {
        const matchedExercise = exercises.find(
          (e) => e.name.toLowerCase() === ex.exercise_name.toLowerCase()
        );
        if (matchedExercise) {
          ex.exercise_id = matchedExercise.id;
        }
      });
    });

    return block;
  } catch (parseError) {
    console.error('Failed to parse AI response:', content);
    throw new Error('Failed to parse training block from AI response');
  }
}

// Pre-built prompt suggestions
export const PROMPT_SUGGESTIONS = [
  {
    title: 'Strength Focus',
    description: '4-week block emphasizing main lifts',
    prompt:
      'Build a strength-focused program with emphasis on squat, bench, and deadlift. Progressive overload with RPE-based loading. 4 training days per week.',
  },
  {
    title: 'Hybrid Athlete',
    description: 'Balance strength and conditioning',
    prompt:
      'Create a hybrid training program balancing strength work with conditioning. Include 3 strength days and 2 conditioning days. Focus on functional fitness and work capacity.',
  },
  {
    title: 'CrossFit Prep',
    description: 'Build work capacity and skills',
    prompt:
      'Design a program to improve CrossFit performance. Include Olympic lifting practice, gymnastics skill work, and varied conditioning. 5-6 days per week.',
  },
  {
    title: 'Upper/Lower Split',
    description: 'Classic 4-day split',
    prompt:
      'Create a 4-day upper/lower split focused on building muscle. Include compound movements and targeted accessories. Moderate volume with progressive intensity.',
  },
];
