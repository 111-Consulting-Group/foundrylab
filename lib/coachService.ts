import { supabase } from './supabase';

interface CoachRequest {
    messages: { role: 'user' | 'assistant'; content: string }[];
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
}

export async function fetchCoachResponse({
    messages,
    systemPrompt,
    temperature = 0.7,
    maxTokens = 1000,
    signal,
}: CoachRequest) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        throw new Error('Please log in to use the coach');
    }

    const response = await fetch(
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

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get coach response');
    }

    return await response.json();
}
