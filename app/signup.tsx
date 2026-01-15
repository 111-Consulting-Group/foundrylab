import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useSignup } from '@/hooks/useAuth';
import { validateEmail, getPasswordStrength, validatePassword } from '@/lib/validation';
import { Colors } from '@/constants/Colors';
import { isSupabaseConfigured } from '@/lib/supabase';
import { FoundryLabLogo } from '@/components/FoundryLabLogo';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const router = useRouter();
  const signupMutation = useSignup();

  const passwordStrength = getPasswordStrength(password);
  const emailValid = email.length === 0 || validateEmail(email);
  const passwordsMatch = password === confirmPassword;
  // Only validate password if it has content
  let passwordValid = true;
  let passwordError: string | undefined = undefined;
  if (password.length > 0) {
    try {
      const validationResult = validatePassword(password);
      passwordValid = validationResult.valid;
      passwordError = validationResult.error;
    } catch {
      passwordValid = false;
      passwordError = 'Password validation failed';
    }
  }
  // Allow submission if password is valid according to requirements, even if strength is 'weak'
  const canSubmit = emailValid && email.length > 0 && password.length > 0 && passwordValid && passwordsMatch && acceptedTerms && !signupMutation.isPending;

  function getPasswordStrengthColor() {
    switch (passwordStrength.strength) {
      case 'weak':
        return Colors.regression[500];
      case 'fair':
        return Colors.oxide[500];
      case 'good':
        return Colors.signal[400];
      case 'strong':
        return Colors.emerald[500];
      default:
        return Colors.graphite[500];
    }
  }

  function getPasswordStrengthLabel() {
    switch (passwordStrength.strength) {
      case 'weak':
        return 'Weak';
      case 'fair':
        return 'Fair';
      case 'good':
        return 'Good';
      case 'strong':
        return 'Strong';
      default:
        return '';
    }
  }

  async function handleSignup() {
    if (!canSubmit) {
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    signupMutation.mutate({
      email: email.trim(),
      password,
      displayName: displayName.trim() || undefined,
    });
  }

  return (
    <ScrollView
      className="flex-1 bg-carbon-950"
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ marginBottom: 48, alignItems: 'center' }}>
        <FoundryLabLogo size={100} style={{ marginBottom: 24 }} />
        <Text className="text-4xl font-bold text-graphite-50 mb-2">Join Foundry Lab</Text>
        <Text className="text-graphite-400 text-lg">Create your account to get started</Text>
      </View>

      <View className="mb-4">
        <Text className="text-graphite-300 mb-2">Display Name (Optional)</Text>
        <TextInput
          className="bg-graphite-900 text-graphite-50 px-4 py-3 rounded-lg border border-graphite-700"
          placeholder="Your name"
          placeholderTextColor="#6B7485"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
          autoComplete="name"
        />
      </View>

      <View className="mb-4">
        <Text className="text-graphite-300 mb-2">Email</Text>
        <TextInput
          className={`bg-graphite-900 text-graphite-50 px-4 py-3 rounded-lg border ${
            email.length > 0 && !emailValid ? 'border-regression-500' : 'border-graphite-700'
          }`}
          placeholder="Enter your email"
          placeholderTextColor="#6B7485"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
        />
        {email.length > 0 && !emailValid && (
          <Text className="text-regression-500 text-sm mt-1">Please enter a valid email address</Text>
        )}
      </View>

      <View className="mb-4">
        <Text className="text-graphite-300 mb-2">Password</Text>
        <View className="relative">
          <TextInput
            className="bg-graphite-900 text-graphite-50 px-4 py-3 rounded-lg border border-graphite-700 pr-12"
            placeholder="Create a password"
            placeholderTextColor="#6B7485"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password-new"
          />
          {Platform.OS === 'web' && (
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-3"
            >
              <Text className="text-signal-500 text-sm">{showPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          )}
        </View>
        {password.length > 0 && passwordError && (
          <Text className="text-regression-500 text-sm mt-2">{passwordError}</Text>
        )}
        {password.length > 0 && !passwordError && (
          <View className="mt-2">
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-graphite-400 text-sm">Strength: {getPasswordStrengthLabel()}</Text>
              <View
                className="h-1 flex-1 ml-2 rounded"
                style={{
                  backgroundColor: getPasswordStrengthColor(),
                  width: `${passwordStrength.score}%`,
                }}
              />
            </View>
            {passwordStrength.feedback.length > 0 && passwordStrength.strength !== 'strong' && (
              <Text className="text-graphite-500 text-xs mt-1">
                Add: {passwordStrength.feedback.slice(0, 2).join(', ')}
              </Text>
            )}
          </View>
        )}
      </View>

      <View className="mb-6">
        <Text className="text-graphite-300 mb-2">Confirm Password</Text>
        <View className="relative">
          <TextInput
            className={`bg-graphite-900 text-graphite-50 px-4 py-3 rounded-lg border pr-12 ${
              confirmPassword.length > 0 && !passwordsMatch ? 'border-regression-500' : 'border-graphite-700'
            }`}
            placeholder="Confirm your password"
            placeholderTextColor="#6B7485"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoComplete="password-new"
          />
          {Platform.OS === 'web' && (
            <TouchableOpacity
              onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-3"
            >
              <Text className="text-signal-500 text-sm">{showConfirmPassword ? 'Hide' : 'Show'}</Text>
            </TouchableOpacity>
          )}
        </View>
        {confirmPassword.length > 0 && !passwordsMatch && (
          <Text className="text-regression-500 text-sm mt-1">Passwords do not match</Text>
        )}
      </View>

      <View className="mb-6 flex-row items-start">
        <TouchableOpacity
          onPress={() => setAcceptedTerms(!acceptedTerms)}
          className={`w-5 h-5 rounded border-2 mr-3 mt-1 items-center justify-center ${
            acceptedTerms ? 'bg-signal-500 border-signal-500' : 'border-graphite-600'
          }`}
        >
          {acceptedTerms && <Text className="text-white text-xs">✓</Text>}
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-graphite-400 text-sm">
            I agree to the Terms of Service and Privacy Policy
          </Text>
        </View>
      </View>

      {signupMutation.isError && (
        <View className="mb-4 p-3 bg-regression-500/20 border border-regression-500 rounded-lg">
          <Text className="text-regression-500 text-sm">
            {signupMutation.error?.message || 'An error occurred. Please try again.'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        className={`py-4 rounded-lg items-center mb-4 ${
          canSubmit ? 'bg-signal-500' : 'bg-graphite-700 opacity-50'
        }`}
        onPress={handleSignup}
        disabled={!canSubmit || signupMutation.isPending}
      >
        {signupMutation.isPending ? (
          <View className="flex-row items-center">
            <ActivityIndicator color="#ffffff" size="small" style={{ marginRight: 8 }} />
            <Text className="text-white font-semibold text-lg">Creating Account...</Text>
          </View>
        ) : (
          <Text className="text-white font-semibold text-lg">Create Account</Text>
        )}
      </TouchableOpacity>

      <View className="flex-row justify-center items-center">
        <Text className="text-graphite-400">Already have an account? </Text>
        <Link href="/login" asChild>
          <TouchableOpacity>
            <Text className="text-signal-500 font-semibold">Sign In</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </ScrollView>
  );
}
