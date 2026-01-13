import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Alert, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { getAuthErrorMessage, validateEmail, validatePassword } from '@/lib/validation';

export interface SignupData {
  email: string;
  password: string;
  displayName?: string;
}

export interface PasswordResetData {
  email: string;
}

export interface UpdatePasswordData {
  password: string;
}

/**
 * Hook for user signup
 */
export function useSignup() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUserId = useAppStore((state) => state.setUserId);
  const setUserProfile = useAppStore((state) => state.setUserProfile);

  return useMutation({
    mutationFn: async (data: SignupData) => {
      // Validate input
      if (!validateEmail(data.email)) {
        throw new Error('Please enter a valid email address');
      }

      const passwordValidation = validatePassword(data.password);
      if (!passwordValidation.valid) {
        throw new Error(passwordValidation.error);
      }

      // Sign up with Supabase
      console.log('Attempting to sign up user:', data.email);
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            display_name: data.displayName || '',
          },
          emailRedirectTo: `${process.env.EXPO_PUBLIC_SUPABASE_URL}/auth/callback`,
        },
      });

      if (signupError) {
        console.error('Signup error:', signupError);
        throw signupError;
      }

      if (!authData.user) {
        console.error('No user returned from signup');
        throw new Error('Failed to create account');
      }

      console.log('User created successfully:', authData.user.id);
      
      // If no session is returned (shouldn't happen with confirmations disabled), wait a moment and check again
      if (!authData.session && authData.user) {
        console.log('No immediate session, checking after brief delay...');
        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          authData.session = session;
          console.log('Session retrieved after delay');
        }
      }

      // Wait for the database trigger to create the profile
      // The trigger uses SECURITY DEFINER and should auto-create it
      // We'll retry a few times with increasing delays
      let profile = null;
      let profileFetchError = null;
      
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        
        const { data: fetchedProfile, error: fetchError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle(); // Use maybeSingle() instead of single() to avoid errors when no rows

        if (fetchedProfile) {
          profile = fetchedProfile;
          console.log('Profile found after', attempt + 1, 'attempt(s)');
          break;
        }
        
        if (fetchError && !fetchError.message.includes('PGRST116')) {
          profileFetchError = fetchError;
          console.warn(`Profile fetch attempt ${attempt + 1} failed:`, fetchError.message);
        }
      }

      if (!profile) {
        console.warn('User profile not found after signup. The database trigger may not have fired, or there may be an RLS policy issue.');
        console.warn('The user can still use the app, but profile data will not be available until the trigger runs.');
      }

      // Send welcome email via Edge Function (non-blocking, fire and forget)
      // Note: This can also be handled via database webhooks
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (supabaseUrl && authData.user.email && authData.session) {
        // Fire and forget - don't wait for response
        fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.session.access_token}`,
            'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
          },
          body: JSON.stringify({
            user_email: authData.user.email,
            display_name: data.displayName || authData.user.user_metadata?.display_name,
          }),
        }).catch((err) => {
          // Silently fail - email sending is not critical for signup
          console.warn('Welcome email send failed (non-critical):', err.message);
        });
      }

      return { user: authData.user, session: authData.session, profile: profile || null };
    },
    onSuccess: (data) => {
      console.log('Signup success callback:', { 
        hasUser: !!data.user, 
        hasSession: !!data.session,
        userId: data.user?.id 
      });
      
      if (data.user) {
        setUserId(data.user.id);
        if (data.profile) {
          setUserProfile(data.profile);
        }
        queryClient.invalidateQueries({ queryKey: ['user'] });
        
        // With email confirmations disabled, we should always have a session
        // If not, something went wrong
        if (data.session) {
          console.log('Redirecting to dashboard with session');
          router.replace('/(tabs)');
        } else {
          // No session returned - this shouldn't happen with confirmations disabled
          // But user is created, so prompt them to sign in
          console.warn('Signup succeeded but no session returned. User may need to sign in.');
          Alert.alert(
            'Account Created', 
            'Your account has been created successfully. Please sign in with your email and password.',
            [{ text: 'OK', onPress: () => router.replace('/login') }]
          );
        }
      } else {
        console.error('Signup succeeded but no user object returned');
        Alert.alert('Error', 'Account creation completed but user data is missing. Please try signing in.');
      }
    },
    onError: (error: any) => {
      const message = getAuthErrorMessage(error);
      Alert.alert('Signup Error', message);
    },
  });
}

/**
 * Hook for requesting password reset
 */
export function usePasswordReset() {
  return useMutation({
    mutationFn: async (data: PasswordResetData) => {
      if (!validateEmail(data.email)) {
        throw new Error('Please enter a valid email address');
      }

      // Use the app URL for redirect - Supabase will append tokens in hash
      // The callback route will handle extracting tokens and redirecting to reset-password
      const appUrl = process.env.EXPO_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081');
      const redirectTo = `${appUrl}/auth/callback?type=recovery`;

      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo,
      });

      if (error) {
        throw error;
      }

      // Note: Password reset email is sent by Supabase automatically
      // To customize with Resend, configure webhook in Supabase Dashboard:
      // Database > Webhooks > Create webhook for auth.users password reset events
      // OR call send-password-reset Edge Function here if needed

      return { success: true };
    },
    onSuccess: () => {
      Alert.alert(
        'Password Reset Email Sent',
        'Check your email for a password reset link. Click the link to reset your password.',
        [{ text: 'OK' }]
      );
    },
    onError: (error: any) => {
      const message = getAuthErrorMessage(error);
      Alert.alert('Error', message);
    },
  });
}

/**
 * Hook for updating password via reset token
 */
export function useUpdatePassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: UpdatePasswordData) => {
      const passwordValidation = validatePassword(data.password);
      if (!passwordValidation.valid) {
        throw new Error(passwordValidation.error);
      }

      // Check if we have a valid session (set from the password reset link via callback)
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        throw new Error('Invalid or expired reset token. Please request a new password reset link.');
      }

      // Update password using the current session
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (updateError) {
        throw updateError;
      }

      // Send password changed confirmation email via Edge Function
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const userEmail = sessionData.session.user.email;
      if (supabaseUrl && userEmail) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/send-password-changed`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${sessionData.session.access_token}`,
              'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
            },
            body: JSON.stringify({
              user_email: userEmail,
            }),
          }).catch((err) => {
            // Don't fail password update if email fails
            console.error('Failed to send password changed email:', err);
          });
        } catch (err) {
          console.error('Error calling password changed email function:', err);
        }
      }

      // Sign out after password reset to force re-login
      await supabase.auth.signOut();

      return { success: true };
    },
    onSuccess: () => {
      Alert.alert('Success', 'Your password has been updated successfully. Please sign in with your new password.');
      router.replace('/login');
    },
    onError: (error: any) => {
      console.error('Password update error:', error);
      const message = getAuthErrorMessage(error);
      Alert.alert('Error', message);
    },
  });
}

/**
 * Hook for user logout
 */
export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setUserId = useAppStore((state) => state.setUserId);
  const setUserProfile = useAppStore((state) => state.setUserProfile);

  return useMutation({
    mutationFn: async () => {
      console.log('🔄 Logging out user...');
      
      // Clear app state first (this will trigger UI updates)
      console.log('🧹 Clearing app state...');
      setUserId(null);
      setUserProfile(null);
      queryClient.clear();
      
      // Sign out from Supabase (this will trigger onAuthStateChange which also sets userId to null)
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        console.error('❌ Supabase signOut error:', signOutError);
        // Continue anyway - we've already cleared local state
      } else {
        console.log('✅ Supabase signOut successful');
      }
      
      // Wait a moment for auth state change to propagate
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify session is cleared
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        console.warn('⚠️ Session still exists after signOut');
      } else {
        console.log('✅ Session confirmed cleared');
      }
      
      console.log('✅ User logged out successfully');
      return true;
    },
    onSuccess: async () => {
      console.log('🚀 Logout mutation succeeded, navigating to login');
      // Small delay to ensure state is fully cleared
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Navigate to root index, which will check userId and redirect to /login if null
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        console.log('Using window.location.href for web navigation');
        window.location.href = '/';
      } else {
        console.log('Using router.replace for native navigation');
        // Navigate to root - index.tsx will check userId and redirect to /login
        router.replace('/');
      }
    },
    onError: (error: any) => {
      console.error('❌ Logout mutation error:', error);
      // Even on error, ensure we're logged out
      setUserId(null);
      setUserProfile(null);
      queryClient.clear();
      
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.location.href = '/login';
      } else {
        router.replace('/login');
      }
      Alert.alert('Logout', 'You have been signed out.');
    },
  });
}
