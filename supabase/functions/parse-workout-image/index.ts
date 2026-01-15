import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
};

// Types for parsed workout data
interface ParsedSet {
  reps: number;
  weight?: number;
  rpe?: number;
  notes?: string;
}

interface ParsedExercise {
  name: string;
  originalName: string; // What was written on the board
  sets: ParsedSet[];
  notes?: string;
}

interface ParsedWorkout {
  title?: string;
  date?: string;
  exercises: ParsedExercise[];
  notes?: string;
  goals?: { exercise: string; target: number }[];
  warmup?: string[];
  mode: 'log' | 'plan'; // Whether this is completed work or a plan
  rawText?: string; // For debugging
}

const VISION_SYSTEM_PROMPT = `You are an expert at reading handwritten workout logs and whiteboard workout plans.
Your job is to parse images of workouts and extract structured data.

Common notations you'll see:
- "5x10" or "5 x 10" = 5 sets of 10 reps
- "3x8@185" or "3x8 @ 185" = 3 sets of 8 reps at 185 lbs
- "225x5" sometimes means 225 lbs for 5 reps (context matters)
- "RPE 8" or "@8" = Rate of Perceived Exertion of 8
- Weights with # symbol (e.g., "185#") = pounds
- Checkmarks (✓, ✔, ☑) indicate completed items
- Empty boxes (☐, □) indicate planned but not completed

Common abbreviations:
- DB = Dumbbell
- BB = Barbell (or just "B" or "Bar")
- KB = Kettlebell
- BW = Bodyweight
- OHP = Overhead Press
- RDL = Romanian Deadlift
- EMOM = Every Minute On the Minute

Determine if this is:
1. A COMPLETED workout log (has actual weights logged) - mode: "log"
2. A WORKOUT PLAN (just exercises/sets/reps, needs weight suggestions) - mode: "plan"

Output ONLY valid JSON matching this structure:
{
  "title": "Optional workout title",
  "exercises": [
    {
      "name": "Standardized exercise name (e.g., 'Back Squat' not 'Squat')",
      "originalName": "Exactly what was written",
      "sets": [
        { "reps": 10, "weight": 185, "rpe": null, "notes": null }
      ],
      "notes": "Any exercise-specific notes"
    }
  ],
  "notes": "General workout notes",
  "goals": [{ "exercise": "Deadlift", "target": 410 }],
  "warmup": ["List of warmup items if visible"],
  "mode": "log" or "plan",
  "rawText": "Plain text representation of what you saw"
}

Important:
- If multiple weights are listed for sets, create individual set entries
- Convert all weights to pounds (lbs)
- Standardize exercise names (e.g., "Back Squat" not "Squat", "Bench Press" not "Bench")
- If sets have "x" notation like "5x10@185", expand to 5 individual sets
- Handle ascending/pyramid sets with different weights`;

serve(async (req) => {
  console.log('[parse-workout-image] Request received:', req.method);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    console.log('[parse-workout-image] Handling CORS preflight');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[parse-workout-image] Checking for OPENAI_API_KEY...');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('[parse-workout-image] OPENAI_API_KEY not found in environment');
      throw new Error('OPENAI_API_KEY not configured');
    }
    console.log('[parse-workout-image] OPENAI_API_KEY found (length:', OPENAI_API_KEY.length, ')');

    console.log('[parse-workout-image] Parsing request body...');
    const body = await req.json();
    const { image_base64, image_url, user_id } = body;
    console.log('[parse-workout-image] Request parsed - has image_base64:', !!image_base64, ', has image_url:', !!image_url, ', user_id:', user_id);
    console.log('[parse-workout-image] Image base64 length:', image_base64?.length || 0);

    if (!image_base64 && !image_url) {
      return new Response(
        JSON.stringify({ error: 'Either image_base64 or image_url is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the image content for GPT-4 Vision
    const imageContent = image_base64
      ? {
          type: 'image_url',
          image_url: {
            url: `data:image/jpeg;base64,${image_base64}`,
            detail: 'high',
          },
        }
      : {
          type: 'image_url',
          image_url: {
            url: image_url,
            detail: 'high',
          },
        };

    // Call OpenAI Vision API
    console.log('[parse-workout-image] Calling OpenAI Vision API...');
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: VISION_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Parse this workout image and extract all exercises, sets, reps, and weights. Determine if this is a completed log or a plan needing suggestions.',
              },
              imageContent,
            ],
          },
        ],
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    console.log('[parse-workout-image] OpenAI response status:', response.status);
    
    if (!response.ok) {
      const error = await response.json();
      console.error('[parse-workout-image] OpenAI API error:', JSON.stringify(error));
      throw new Error(error.error?.message || 'Failed to parse image');
    }

    console.log('[parse-workout-image] Parsing OpenAI response...');
    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    console.log('[parse-workout-image] Got content, length:', content?.length || 0);

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    let parsedWorkout: ParsedWorkout;
    try {
      parsedWorkout = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Failed to parse workout data from image');
    }

    // Helper function to calculate string similarity (simple Levenshtein-like)
    function calculateSimilarity(str1: string, str2: string): number {
      const s1 = str1.toLowerCase();
      const s2 = str2.toLowerCase();
      
      // Exact match
      if (s1 === s2) return 1.0;
      
      // One contains the other
      if (s1.includes(s2) || s2.includes(s1)) return 0.8;
      
      // Calculate common words
      const words1 = s1.split(/\s+/);
      const words2 = s2.split(/\s+/);
      const commonWords = words1.filter(w => words2.includes(w));
      if (commonWords.length > 0) {
        return Math.min(0.6, 0.3 + (commonWords.length / Math.max(words1.length, words2.length)) * 0.3);
      }
      
      return 0.0;
    }

    // If user_id provided, try to match exercises to database
    let matchedExercises: { parsed: string; matched: { id: string; name: string } | null; suggestions?: { id: string; name: string; similarity: number }[] }[] = [];
    
    if (user_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get all available exercises (including approved and user's pending/custom)
      const { data: exercises } = await supabase
        .from('exercises')
        .select('id, name, aliases, status, created_by')
        .or(`status.eq.approved,created_by.eq.${user_id}`);

      if (exercises) {
        // Filter to only approved exercises or user's own exercises
        const availableExercises = exercises.filter(
          (e) => e.status === 'approved' || e.created_by === user_id
        );

        // Try to match parsed exercise names to database
        matchedExercises = parsedWorkout.exercises.map((ex) => {
          const normalizedName = ex.name.toLowerCase().trim();
          
          // Exact match first (name or aliases)
          let match = availableExercises.find(
            (e) => {
              const nameMatch = e.name.toLowerCase() === normalizedName;
              const aliasMatch = e.aliases && Array.isArray(e.aliases) && 
                e.aliases.some((alias: string) => alias.toLowerCase() === normalizedName);
              return nameMatch || aliasMatch;
            }
          );
          
          // Fuzzy match - check if database exercise contains parsed name (including aliases)
          if (!match) {
            match = availableExercises.find(
              (e) => {
                const nameContains = e.name.toLowerCase().includes(normalizedName) ||
                                     normalizedName.includes(e.name.toLowerCase());
                const aliasContains = e.aliases && Array.isArray(e.aliases) &&
                  e.aliases.some((alias: string) => 
                    alias.toLowerCase().includes(normalizedName) ||
                    normalizedName.includes(alias.toLowerCase())
                  );
                return nameContains || aliasContains;
              }
            );
          }

          // Try common variations
          if (!match) {
            const variations: Record<string, string[]> = {
              'back squat': ['squat', 'barbell squat', 'bb squat'],
              'bench press': ['bench', 'flat bench', 'barbell bench', 'bb bench'],
              'deadlift': ['conventional deadlift', 'barbell deadlift'],
              'overhead press': ['ohp', 'shoulder press', 'military press'],
              'barbell row': ['bent over row', 'bb row', 'row'],
              'pull-up': ['pullup', 'pull up', 'chin up', 'chinup'],
              'romanian deadlift': ['rdl', 'stiff leg deadlift'],
              'dumbbell bench press': ['db bench', 'dumbbell bench'],
              'dumbbell shoulder press': ['db shoulder press', 'db ohp', 'seated db press'],
            };

            for (const [standard, alts] of Object.entries(variations)) {
              if (alts.includes(normalizedName) || normalizedName.includes(standard)) {
                match = availableExercises.find(
                  (e) => {
                    const nameMatch = e.name.toLowerCase() === standard ||
                                     e.name.toLowerCase().includes(standard);
                    const aliasMatch = e.aliases && Array.isArray(e.aliases) &&
                      e.aliases.some((alias: string) => 
                        alias.toLowerCase() === standard ||
                        alias.toLowerCase().includes(standard)
                      );
                    return nameMatch || aliasMatch;
                  }
                );
                if (match) break;
              }
            }
          }

          // If no match, calculate similarity scores for top suggestions
          let suggestions: { id: string; name: string; similarity: number }[] = [];
          if (!match) {
            const scored = availableExercises.map((e) => {
              // Check similarity against name
              let maxSimilarity = calculateSimilarity(normalizedName, e.name);
              
              // Check similarity against aliases
              if (e.aliases && Array.isArray(e.aliases)) {
                for (const alias of e.aliases) {
                  const aliasSimilarity = calculateSimilarity(normalizedName, alias);
                  maxSimilarity = Math.max(maxSimilarity, aliasSimilarity);
                }
              }
              
              return {
                id: e.id,
                name: e.name,
                similarity: maxSimilarity,
              };
            })
            .filter((s) => s.similarity > 0.2) // Only include reasonable matches
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, 3); // Top 3 suggestions
            
            suggestions = scored;
          }

          return {
            parsed: ex.name,
            matched: match ? { id: match.id, name: match.name } : null,
            suggestions: suggestions.length > 0 ? suggestions : undefined,
          };
        });

        // Attach matched IDs and suggestions to parsed exercises
        parsedWorkout.exercises = parsedWorkout.exercises.map((ex, i) => ({
          ...ex,
          exercise_id: matchedExercises[i]?.matched?.id || null,
          matchedName: matchedExercises[i]?.matched?.name || null,
          suggestions: matchedExercises[i]?.suggestions || undefined,
        }));
      }

      // If mode is 'plan', get suggestions from movement memory
      if (parsedWorkout.mode === 'plan') {
        const exerciseIds = parsedWorkout.exercises
          .filter((ex: any) => ex.exercise_id)
          .map((ex: any) => ex.exercise_id);

        if (exerciseIds.length > 0) {
          // Get movement memory for suggestions
          const { data: memories } = await supabase
            .from('movement_memory')
            .select('*')
            .eq('user_id', user_id)
            .in('exercise_id', exerciseIds);

          if (memories) {
            parsedWorkout.exercises = parsedWorkout.exercises.map((ex: any) => {
              if (!ex.exercise_id) return ex;
              
              const memory = memories.find((m) => m.exercise_id === ex.exercise_id);
              if (!memory) return ex;

              // Apply progressive overload logic
              let suggestedWeight = memory.last_weight;
              let reasoning = '';

              if (memory.last_rpe !== null && memory.last_rpe < 7) {
                suggestedWeight = memory.last_weight;
                reasoning = `Last set felt easy (RPE ${memory.last_rpe}). Try same weight, aim for +1 rep.`;
              } else if (memory.last_rpe !== null && memory.last_rpe <= 8.5) {
                suggestedWeight = Math.round((memory.last_weight + 5) / 5) * 5; // Round to 5
                reasoning = `Good effort last time (RPE ${memory.last_rpe}). Try +5 lbs.`;
              } else {
                reasoning = `Last set was challenging. Match ${memory.last_weight} lbs before progressing.`;
              }

              return {
                ...ex,
                suggestion: {
                  weight: suggestedWeight,
                  lastWeight: memory.last_weight,
                  lastReps: memory.last_reps,
                  lastRpe: memory.last_rpe,
                  lastDate: memory.last_date,
                  confidence: memory.confidence_level,
                  reasoning,
                  prWeight: memory.pr_weight,
                  exposureCount: memory.exposure_count,
                },
              };
            });
          }
        }
      }
    }

    console.log('[parse-workout-image] Success! Returning parsed workout with', parsedWorkout.exercises?.length || 0, 'exercises');
    return new Response(
      JSON.stringify({
        success: true,
        workout: parsedWorkout,
        matchedExercises,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[parse-workout-image] Error:', error);
    console.error('[parse-workout-image] Error message:', error.message);
    console.error('[parse-workout-image] Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
