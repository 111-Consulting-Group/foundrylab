import { useCoachContext } from '@/hooks/useCoach';
import { CoachServiceError, fetchCoachResponse } from '@/lib/coachService';
import { useGuideStore } from '@/stores/useGuideStore';
import { useEffect, useState } from 'react';

export function useDailyBriefing() {
    const { currentBriefing, setBriefing } = useGuideStore();
    const { data: context } = useCoachContext();
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];

        // If we already have today's briefing, don't regenerate
        if (currentBriefing?.date === today) {
            return;
        }

        // Wait for context to be available
        if (!context || isLoading) return;

        const generateBriefing = async () => {
            setIsLoading(true);
            try {
                const readinessScore = context.todayReadiness?.readiness_score;
                const workoutToday = !!context.upcomingWorkout;
                const lastWorkout = context.recentWorkouts?.[0];

                const contextSummary = `
          Readiness: ${readinessScore ?? 'Unknown'}/100.
          Has workout today: ${workoutToday}.
          Last workout: ${lastWorkout?.focus ?? 'None'} on ${lastWorkout?.date_completed ?? 'unknown'}.
          Goal: ${context.profile?.primary_goal ?? 'Fitness'}.
        `;

                const data = await fetchCoachResponse({
                    messages: [
                        {
                            role: 'user',
                            content: `Generate a single, short (max 15 words) daily greeting for the user. Be encouraging but realistic based on readiness. Do not ask a question if readiness is unknown. Context: ${contextSummary}`
                        }
                    ],
                    systemPrompt: "You are a concise, helpful fitness coach. Output ONLY the greeting text. No quotes.",
                    temperature: 0.7,
                    maxTokens: 50,
                });

                const greeting = data.message?.trim().replace(/^"|"$/g, '') || "Good morning.";
                setBriefing(greeting);
            } catch (error) {
                // Use a contextual fallback greeting instead of a generic one
                if (error instanceof CoachServiceError && error.code === 'not_configured') {
                    console.warn('AI coach not configured, using fallback greeting');
                } else {
                    console.error('Failed to generate briefing:', error);
                }

                // Provide a decent fallback based on available context
                const hour = new Date().getHours();
                const timeGreeting = hour < 12 ? 'Good morning.' : hour < 17 ? 'Good afternoon.' : 'Good evening.';
                setBriefing(timeGreeting);
            } finally {
                setIsLoading(false);
            }
        };

        generateBriefing();
    }, [context, currentBriefing]); // eslint-disable-line react-hooks/exhaustive-deps

    return {
        greeting: currentBriefing?.greeting,
        isLoading,
    };
}
