console.log('🟡 useAppStore.ts loading...');

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { UserProfile, WorkoutSet } from '@/types/database';
import { zustandStorage } from './storage';

console.log('🟡 useAppStore.ts imports loaded, storage:', typeof zustandStorage);

// Active workout state for in-progress logging
interface ActiveWorkoutState {
  workoutId: string | null;
  startTime: Date | null;
  currentExerciseIndex: number;
  completedSets: Map<string, WorkoutSet[]>;
}

// App-wide state
interface AppState {
  // User state
  userId: string | null;
  userProfile: UserProfile | null;
  isOnboarded: boolean;

  // Active workout state
  activeWorkout: ActiveWorkoutState | null;

  // UI state
  unitsPreference: 'imperial' | 'metric';

  // Actions
  setUserId: (userId: string | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setOnboarded: (value: boolean) => void;
  setUnitsPreference: (units: 'imperial' | 'metric') => void;

  // Workout actions
  startWorkout: (workoutId: string) => void;
  endWorkout: () => void;
  setCurrentExerciseIndex: (index: number) => void;
  addCompletedSet: (exerciseId: string, set: WorkoutSet) => void;
  updateCompletedSet: (exerciseId: string, setIndex: number, set: WorkoutSet) => void;
  clearActiveWorkout: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      userId: null,
      userProfile: null,
      isOnboarded: false,
      activeWorkout: null,
      unitsPreference: 'imperial',

      // User actions
      setUserId: (userId) => set({ userId }),
      setUserProfile: (userProfile) => set({ userProfile }),
      setOnboarded: (isOnboarded) => set({ isOnboarded }),
      setUnitsPreference: (unitsPreference) => set({ unitsPreference }),

      // Workout actions
      startWorkout: (workoutId) =>
        set({
          activeWorkout: {
            workoutId,
            startTime: new Date(),
            currentExerciseIndex: 0,
            completedSets: new Map(),
          },
        }),

      endWorkout: () => set({ activeWorkout: null }),

      setCurrentExerciseIndex: (index) =>
        set((state) => ({
          activeWorkout: state.activeWorkout
            ? { ...state.activeWorkout, currentExerciseIndex: index }
            : null,
        })),

      addCompletedSet: (exerciseId, newSet) =>
        set((state) => {
          if (!state.activeWorkout) return state;
          const newCompletedSets = new Map(state.activeWorkout.completedSets);
          const existingSets = newCompletedSets.get(exerciseId) || [];
          newCompletedSets.set(exerciseId, [...existingSets, newSet]);
          return {
            activeWorkout: {
              ...state.activeWorkout,
              completedSets: newCompletedSets,
            },
          };
        }),

      updateCompletedSet: (exerciseId, setIndex, updatedSet) =>
        set((state) => {
          if (!state.activeWorkout) return state;
          const newCompletedSets = new Map(state.activeWorkout.completedSets);
          const existingSets = newCompletedSets.get(exerciseId) || [];
          if (setIndex >= 0 && setIndex < existingSets.length) {
            existingSets[setIndex] = updatedSet;
            newCompletedSets.set(exerciseId, existingSets);
          }
          return {
            activeWorkout: {
              ...state.activeWorkout,
              completedSets: newCompletedSets,
            },
          };
        }),

      clearActiveWorkout: () => set({ activeWorkout: null }),
    }),
    {
      name: 'foundry-lab-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        userId: state.userId,
        isOnboarded: state.isOnboarded,
        unitsPreference: state.unitsPreference,
        // Don't persist activeWorkout - it should be ephemeral
      }),
    }
  )
);

// Selector hooks for optimized re-renders
export const useUserId = () => useAppStore((state) => state.userId);
export const useUserProfile = () => useAppStore((state) => state.userProfile);
export const useIsOnboarded = () => useAppStore((state) => state.isOnboarded);
export const useUnitsPreference = () => useAppStore((state) => state.unitsPreference);
export const useActiveWorkout = () => useAppStore((state) => state.activeWorkout);
