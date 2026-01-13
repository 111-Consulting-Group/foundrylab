import { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/stores/useAppStore';
import { getAuthErrorMessage } from '@/lib/validation';
import { Colors } from '@/constants/Colors';
import { FoundryLabLogo } from '@/components/FoundryLabLogo';

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

        const { data: profile, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (!profileError && profile) {
          setUserProfile(profile);
        }

        await new Promise(resolve => setTimeout(resolve, 100));
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
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      {/* Ambient Background Glows */}
      <View
        style={{
          position: 'absolute',
          top: -150,
          left: -100,
          width: 400,
          height: 400,
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderRadius: 200,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: -100,
          right: -150,
          width: 450,
          height: 450,
          backgroundColor: 'rgba(37, 99, 235, 0.06)',
          borderRadius: 225,
        }}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingVertical: 48,
          justifyContent: 'center',
          minHeight: '100%'
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / Header */}
        <View style={{ marginBottom: 48, alignItems: 'center' }}>
          <FoundryLabLogo size={120} style={{ marginBottom: 24 }} />
          <Text style={{ fontSize: 32, fontWeight: '700', color: Colors.graphite[50], marginBottom: 8 }}>
            Foundry Lab
          </Text>
          <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 3, color: Colors.signal[400], textTransform: 'uppercase' }}>
            Progress, Engineered
          </Text>
        </View>

        {/* Glass Card Container */}
        <View
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 24,
            padding: 24,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          {/* Top edge reflection */}
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 24,
              right: 24,
              height: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              borderRadius: 1,
            }}
          />

          <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.graphite[50], marginBottom: 24, textAlign: 'center' }}>
            Sign In
          </Text>

          {/* Email Input */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: Colors.graphite[400], marginBottom: 8 }}>
              Email
            </Text>
            <View
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
              }}
            >
              <Ionicons name="mail-outline" size={20} color={Colors.graphite[500]} />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  paddingHorizontal: 12,
                  fontSize: 16,
                  color: Colors.graphite[50],
                }}
                placeholder="Enter your email"
                placeholderTextColor={Colors.graphite[600]}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, color: Colors.graphite[400], marginBottom: 8 }}>
              Password
            </Text>
            <View
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: 12,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 16,
              }}
            >
              <Ionicons name="lock-closed-outline" size={20} color={Colors.graphite[500]} />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 16,
                  paddingHorizontal: 12,
                  fontSize: 16,
                  color: Colors.graphite[50],
                }}
                placeholder="Enter your password"
                placeholderTextColor={Colors.graphite[600]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
              />
            </View>
          </View>

          {/* Forgot Password */}
          <Link href="/forgot-password" asChild>
            <Pressable style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: Colors.signal[400], textAlign: 'right' }}>
                Forgot Password?
              </Text>
            </Pressable>
          </Link>

          {/* Sign In Button */}
          <Pressable
            style={{
              backgroundColor: Colors.signal[600],
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: 'center',
              flexDirection: 'row',
              justifyContent: 'center',
              shadowColor: Colors.signal[500],
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
            }}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Sign In
                </Text>
              </>
            )}
          </Pressable>
        </View>

        {/* Sign Up Link */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 32 }}>
          <Text style={{ fontSize: 14, color: Colors.graphite[400] }}>Don't have an account? </Text>
          <Link href="/signup" asChild>
            <Pressable>
              <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.signal[400] }}>Sign Up</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </View>
  );
}
