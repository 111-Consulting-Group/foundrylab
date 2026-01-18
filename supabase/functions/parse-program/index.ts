import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
};

// Types for parsed program data
interface ParsedProgramExercise {
  name: string;
  sets: number;
  reps: string;
  notes?: string;
}

interface ParsedProgramDay {
  dayNumber: number;
  name: string;
  focus: string;
  exercises: ParsedProgramExercise[];
}

interface ParsedProgram {
  name: string;
  description?: string;
  durationWeeks: number;
  daysPerWeek: number;
  splitType: string;
  days: ParsedProgramDay[];
  source?: string;
  rawText?: string;
}

const PROGRAM_PARSE_PROMPT = `You are an expert at parsing training programs from images and text.
Your job is to extract structured program data from workout plans, books, websites, or handwritten notes.

Common program formats you'll see:
- PPL (Push/Pull/Legs)
- Upper/Lower splits
- Full body programs
- Bro splits (Chest/Back/Shoulders/Arms/Legs)
- 5x5, 5/3/1, PHAT, PHUL, etc.

Common notations:
- "3x8-12" = 3 sets of 8-12 reps
- "4x10" = 4 sets of 10 reps
- "5x5" = 5 sets of 5 reps
- "AMRAP" = As Many Reps As Possible
- "RPE 8" = Rate of Perceived Exertion target

Your task:
1. Identify the program structure (split type, days per week)
2. Extract each training day with its exercises
3. Standardize exercise names
4. Determine a reasonable program duration (default to 4 weeks if not specified)

Output ONLY valid JSON matching this structure:
{
  "name": "Program name (e.g., 'PPL Hypertrophy', 'Arnold Split', '5x5 Strength')",
  "description": "Brief description of the program goals/style",
  "durationWeeks": 4,
  "daysPerWeek": 3,
  "splitType": "PPL" | "Upper/Lower" | "Full Body" | "Bro Split" | "Custom",
  "days": [
    {
      "dayNumber": 1,
      "name": "Day 1" or "Push Day" or "Monday",
      "focus": "Push" | "Pull" | "Legs" | "Upper" | "Lower" | "Chest" | etc.,
      "exercises": [
        {
          "name": "Standardized exercise name",
          "sets": 4,
          "reps": "8-12",
          "notes": "Optional notes like 'pause at bottom'"
        }
      ]
    }
  ],
  "rawText": "Plain text representation of what you parsed"
}

Important:
- Standardize exercise names (e.g., "Bench Press" not "Flat Bench", "Barbell Row" not "Rows")
- If program has weekly variation, just capture the base template
- Default to 4 weeks if duration not specified
- Count unique training days for daysPerWeek
- Include all exercises mentioned, even warmups if they're part of the program`;

serve(async (req) => {
  console.log('[parse-program] Request received:', req.method);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      console.error('[parse-program] OPENAI_API_KEY not found');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { image, text, userId } = body;

    console.log('[parse-program] Processing request for user:', userId);

    let messages: any[];

    if (image) {
      // Parse from image
      console.log('[parse-program] Parsing from image');
      messages = [
        {
          role: 'system',
          content: PROGRAM_PARSE_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Parse this training program image and extract the structured program data. Return only valid JSON.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${image}`,
              },
            },
          ],
        },
      ];
    } else if (text) {
      // Parse from text
      console.log('[parse-program] Parsing from text');
      messages = [
        {
          role: 'system',
          content: PROGRAM_PARSE_PROMPT,
        },
        {
          role: 'user',
          content: `Parse this training program text and extract the structured program data. Return only valid JSON.\n\n---\n${text}\n---`,
        },
      ];
    } else {
      return new Response(
        JSON.stringify({ error: 'No image or text provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: image ? 'gpt-4o' : 'gpt-4o-mini',
        messages,
        max_tokens: 4000,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('[parse-program] OpenAI error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to parse program' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[parse-program] No content in response');
      return new Response(
        JSON.stringify({ error: 'Failed to parse program' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[parse-program] Raw response:', content);

    // Parse the JSON response
    let program: ParsedProgram;
    try {
      program = JSON.parse(content);
    } catch (e) {
      console.error('[parse-program] JSON parse error:', e);
      return new Response(
        JSON.stringify({ error: 'Failed to parse response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and clean up the program
    if (!program.days || program.days.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Could not identify any workout days in the program' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set defaults
    program.durationWeeks = program.durationWeeks || 4;
    program.daysPerWeek = program.daysPerWeek || program.days.length;
    program.splitType = program.splitType || 'Custom';
    program.name = program.name || `${program.splitType} Program`;

    // Ensure day numbers are sequential
    program.days = program.days.map((day, index) => ({
      ...day,
      dayNumber: index + 1,
    }));

    console.log('[parse-program] Successfully parsed program:', program.name);

    return new Response(
      JSON.stringify({ program }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[parse-program] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
