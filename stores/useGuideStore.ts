import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { zustandStorage } from './storage';

interface DailyBriefingData {
    date: string; // YYYY-MM-DD
    greeting: string;
    weatherSummary?: string; // Future proofing
}

interface GuideState {
    currentBriefing: DailyBriefingData | null;
    setBriefing: (greeting: string) => void;
    clearBriefing: () => void;
}

export const useGuideStore = create<GuideState>()(
    persist(
        (set) => ({
            currentBriefing: null,
            setBriefing: (greeting) =>
                set({
                    currentBriefing: {
                        date: new Date().toISOString().split('T')[0],
                        greeting
                    }
                }),
            clearBriefing: () => set({ currentBriefing: null }),
        }),
        {
            name: 'guide-storage',
            storage: createJSONStorage(() => zustandStorage),
        }
    )
);
