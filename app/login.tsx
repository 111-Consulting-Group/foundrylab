import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { getAuthErrorMessage } from '@/lib/validation';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setUserId = useAppStore((state) => state.setUserId);
  const setUserProfile = useAppStore((state) => state.setUserProfile);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        console.error('Login error details:', error);
        const message = getAuthErrorMessage(error);
        Alert.alert('Sign In Error', message);
        setLoading(false);
        return;
      }

      if (data.user) {
        setUserId(data.user.id);
        
        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        
        if (!profileError && profile) {
          setUserProfile(profile);
        }

        // Small delay to ensure state is set before navigation
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Redirect to tabs
        router.replace('/(tabs)');
      } else {
        Alert.alert('Error', 'Login failed - no user data returned');
        setLoading(false);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      const message = getAuthErrorMessage(err);
      Alert.alert('Error', message);
      setLoading(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-carbon-950"
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 48, justifyContent: 'center', minHeight: '100%' }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="mb-8">
        <Text className="text-4xl font-bold text-graphite-50 mb-2">Foundry Lab</Text>
        <Text className="text-graphite-400 text-lg">Sign in to continue</Text>
      </View>

      <View className="mb-4">
        <Text className="text-graphite-300 mb-2">Email</Text>
        <TextInput
          className="bg-graphite-900 text-graphite-50 px-4 py-3 rounded-lg border border-graphite-700"
          placeholder="Enter your email"
          placeholderTextColor="#6B7485"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
      </View>

      <View className="mb-4">
        <Text className="text-graphite-300 mb-2">Password</Text>
        <TextInput
          className="bg-graphite-900 text-graphite-50 px-4 py-3 rounded-lg border border-graphite-700"
          placeholder="Enter your password"
          placeholderTextColor="#6B7485"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
        />
      </View>

      <View className="mb-6">
        <Link href="/forgot-password" asChild>
          <TouchableOpacity>
            <Text className="text-signal-500 font-semibold text-right">Forgot Password?</Text>
          </TouchableOpacity>
        </Link>
      </View>

      <TouchableOpacity
        className="bg-signal-500 py-4 rounded-lg items-center mb-6"
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-white font-semibold text-lg">Sign In</Text>
        )}
      </TouchableOpacity>

      <View className="flex-row justify-center items-center">
        <Text className="text-graphite-400">Don't have an account? </Text>
        <Link href="/signup" asChild>
          <TouchableOpacity>
            <Text className="text-signal-500 font-semibold">Sign Up</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </ScrollView>
  );
}
