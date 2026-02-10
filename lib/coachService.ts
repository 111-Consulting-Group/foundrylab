import { isSupabaseConfigured, supabase } from './supabase';

interface CoachRequest {
    messages: { role: 'user' | 'assistant'; content: string }[];
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
}

export class CoachServiceError extends Error {
    public code: 'not_configured' | 'not_authenticated' | 'rate_limited' | 'service_unavailable' | 'network' | 'unknown';

    constructor(message: string, code: CoachServiceError['code']) {
        super(message);
        this.name = 'CoachServiceError';
        this.code = code;
    }
}

export async function fetchCoachResponse({
    messages,
    systemPrompt,
    temperature = 0.7,
    maxTokens = 1000,
    signal,
}: CoachRequest) {
    if (!isSupabaseConfigured()) {
        throw new CoachServiceError(
            'AI coach is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.',
            'not_configured'
        );
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new CoachServiceError('Please log in to use the coach.', 'not_authenticated');
    }

    let response: Response;
    try {
        response = await fetch(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/ai-coach`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    messages,
                    systemPrompt,
                    temperature,
                    maxTokens,
                }),
                signal,
            }
        );
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw err;
        }
        throw new CoachServiceError(
            'Could not reach the AI service. Check your network connection.',
            'network'
        );
    }

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 429) {
            throw new CoachServiceError('Too many requests. Please wait a moment and try again.', 'rate_limited');
        }
        if (response.status === 401) {
            throw new CoachServiceError('Session expired. Please log in again.', 'not_authenticated');
        }
        if (response.status === 503) {
            throw new CoachServiceError(
                errorData.error || 'AI service is not configured on the server. The OPENAI_API_KEY may not be set.',
                'service_unavailable'
            );
        }

        throw new CoachServiceError(
            errorData.error || `AI service error (${response.status})`,
            'service_unavailable'
        );
    }

    return await response.json();
}
