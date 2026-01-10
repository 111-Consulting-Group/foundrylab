import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';

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
        email,
        password,
      });

      if (error) {
        console.error('Login error details:', error);
        Alert.alert('Login Error', error.message || 'Failed to sign in. Please check your credentials.');
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

        // Redirect to tabs
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="flex-1 bg-[#1e232f] justify-center px-6">
      <View className="mb-8">
        <Text className="text-4xl font-bold text-white mb-2">Forged</Text>
        <Text className="text-gray-400 text-lg">Sign in to continue</Text>
      </View>

      <View className="mb-4">
        <Text className="text-gray-300 mb-2">Email</Text>
        <TextInput
          className="bg-[#303848] text-white px-4 py-3 rounded-lg border border-[#3e4965]"
          placeholder="Enter your email"
          placeholderTextColor="#6b7280"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
      </View>

      <View className="mb-6">
        <Text className="text-gray-300 mb-2">Password</Text>
        <TextInput
          className="bg-[#303848] text-white px-4 py-3 rounded-lg border border-[#3e4965]"
          placeholder="Enter your password"
          placeholderTextColor="#6b7280"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
        />
      </View>

      <TouchableOpacity
        className="bg-[#ed7411] py-4 rounded-lg items-center mb-4"
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-white font-semibold text-lg">Sign In</Text>
        )}
      </TouchableOpacity>

      <Text className="text-gray-500 text-center text-sm">
        For development: Use andywolfe15@yahoo.com / password1
      </Text>
    </View>
  );
}
