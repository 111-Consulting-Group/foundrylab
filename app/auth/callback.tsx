import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

/**
 * Handles OAuth callbacks and password reset tokens from email links
 * Supabase password reset links include tokens in the URL hash
 */
export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function handleCallback() {
      try {
        // Extract tokens from URL hash (Supabase puts them here for security)
        if (typeof window === 'undefined') {
          router.replace('/login');
          return;
        }

        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type') || params.type;

        // Check if this is a password reset callback
        if (type === 'recovery' && accessToken) {
          // Set the session with the reset token
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) {
            console.error('Error setting session:', sessionError);
            setError('Invalid or expired reset link. Please request a new one.');
            setTimeout(() => router.replace('/forgot-password'), 3000);
            return;
          }

          // Clear the hash from URL
          window.history.replaceState(null, '', window.location.pathname);
          
          // Redirect to reset password screen
          router.replace('/reset-password');
          return;
        }

        // Handle regular OAuth/signup callbacks
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!sessionError) {
            window.history.replaceState(null, '', window.location.pathname);
            router.replace('/(tabs)');
            return;
          }
        }

        // No valid tokens found, redirect to login
        router.replace('/login');
      } catch (err: any) {
        console.error('Auth callback error:', err);
        setError(err.message || 'An error occurred during authentication');
        setTimeout(() => router.replace('/login'), 3000);
      }
    }

    handleCallback();
  }, [params, router]);

  if (error) {
    return (
      <View className="flex-1 bg-carbon-950 justify-center items-center px-6">
        <Text className="text-regression-500 text-center mb-4">{error}</Text>
        <Text className="text-graphite-400 text-sm text-center">Redirecting...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-carbon-950 justify-center items-center">
      <ActivityIndicator size="large" color="#2F80ED" />
      <Text className="text-graphite-400 mt-4">Authenticating...</Text>
    </View>
  );
}
