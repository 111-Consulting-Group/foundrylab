import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { Database } from '@/types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

// Custom storage adapter for React Native using SecureStore
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      // Check if we're in a browser environment (not SSR)
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      // Check if we're in a browser environment (not SSR)
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      // Check if we're in a browser environment (not SSR)
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

// Create typed Supabase client
// Note: Full type safety requires running `npx supabase gen types typescript`
// after setting up the database. Until then, we use the Database type manually.
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      // Custom fetch wrapper for error handling
      fetch: async (url, options = {}) => {
        const urlStr = typeof url === 'string' ? url : url.toString();
        
        try {
          const response = await fetch(url, options);
          
          // Handle auth errors (400/401) - likely refresh token issues
          // Only for token refresh endpoints to avoid recursive issues
          if ((response.status === 400 || response.status === 401) && urlStr.includes('/auth/v1/token')) {
            const clonedResponse = response.clone();
            try {
              const errorData = await clonedResponse.json();
              const errorMessage = errorData?.message || errorData?.error_description || '';
              
              if (
                errorMessage.includes('Refresh Token') ||
                errorMessage.includes('refresh_token') ||
                errorMessage.includes('Invalid Refresh Token')
              ) {
                console.error('[Supabase] Refresh token error detected:', errorMessage);
                // Don't call signOut here - it causes recursive issues
                // Instead, emit a custom event or let the caller handle it
                // The onAuthStateChange listener will handle session cleanup
              }
            } catch (parseError) {
              console.error('[Supabase] Auth error but couldn\'t parse response');
            }
          }
          
          return response;
        } catch (fetchError) {
          console.error('[Supabase] Fetch error:', fetchError);
          throw fetchError;
        }
      },
    },
    db: {
      schema: 'public',
    },
  }
);

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return (
    supabaseUrl !== 'https://placeholder.supabase.co' &&
    supabaseAnonKey !== 'placeholder-key'
  );
};

// Type-safe table helpers with explicit typing
// These bypass strict Supabase typing issues before database generation
export const tables = {
  exercises: () => supabase.from('exercises'),
  training_blocks: () => supabase.from('training_blocks'),
  workouts: () => supabase.from('workouts'),
  workout_sets: () => supabase.from('workout_sets'),
  user_profiles: () => supabase.from('user_profiles'),
  personal_records: () => supabase.from('personal_records'),
} as const;
