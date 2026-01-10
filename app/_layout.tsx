import '../global.css';

// #region agent log
fetch('http://127.0.0.1:7244/ingest/d1d789ce-94bc-4990-97f7-67ef9c008f4f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'_layout.tsx:top',message:'App _layout.tsx loaded - code is executing',data:{platform: typeof window !== 'undefined' ? 'web' : 'native'},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
// #endregion

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { Redirect } from 'expo-router';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

// Custom dark theme matching Forged brand colors
const ForgedDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#ed7411',
    background: '#1e232f',
    card: '#303848',
    text: '#f6f7f9',
    border: '#3e4965',
    notification: '#f43f5e',
  },
};

const ForgedLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#ed7411',
    background: '#f6f7f9',
    card: '#ffffff',
    text: '#1e232f',
    border: '#d3d8e4',
    notification: '#f43f5e',
  },
};

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 30, // 30 minutes
        retry: 2,
        refetchOnWindowFocus: false,
      },
    },
  }));

  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  const setUserId = useAppStore((state) => state.setUserId);
  const setUserProfile = useAppStore((state) => state.setUserProfile);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Initialize auth session
  useEffect(() => {
    async function initAuth() {
      try {
        // Check for existing session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Error getting session:', sessionError);
          setAuthInitialized(true);
          return;
        }

        if (session?.user) {
          console.log('Found existing session for user:', session.user.id);
          setUserId(session.user.id);
          
          // Fetch user profile
          const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (!profileError && profile) {
            setUserProfile(profile);
          }
        } else {
          console.log('No existing session found');
        }

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('Auth state changed:', event);
          if (session?.user) {
            setUserId(session.user.id);
            
            // Fetch user profile
            const { data: profile } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (profile) {
              setUserProfile(profile);
            }
          } else {
            setUserId(null);
            setUserProfile(null);
          }
        });

        setAuthInitialized(true);
        
        return () => {
          subscription.unsubscribe();
        };
      } catch (err) {
        console.error('Auth initialization error:', err);
        setAuthInitialized(true);
      }
    }

    initAuth();
  }, [setUserId, setUserProfile]);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && authInitialized) {
      SplashScreen.hideAsync();
    }
  }, [loaded, authInitialized]);

  if (!loaded || !authInitialized) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <RootLayoutNav />
    </QueryClientProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const userId = useAppStore((state) => state.userId);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? ForgedDarkTheme : ForgedLightTheme}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack>
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="workout/[id]"
            options={{
              presentation: 'card',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="block-builder"
            options={{
              presentation: 'modal',
              headerTitle: 'Block Builder',
            }}
          />
          <Stack.Screen
            name="exercise/[id]"
            options={{
              presentation: 'card',
              headerTitle: 'Exercise History',
            }}
          />
        </Stack>
      </GestureHandlerRootView>
    </ThemeProvider>
  );
}
