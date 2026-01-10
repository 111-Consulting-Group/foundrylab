import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams, Link } from 'expo-router';
import { useUpdatePassword } from '@/hooks/useAuth';
import { getPasswordStrength, validatePassword } from '@/lib/validation';
import { Colors } from '@/constants/Colors';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [tokenValidated, setTokenValidated] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const router = useRouter();
  const updatePasswordMutation = useUpdatePassword();

  const passwordStrength = getPasswordStrength(password);
  const passwordValid = password.length === 0 || validatePassword(password).valid;
  const passwordsMatch = password === confirmPassword;
  const canSubmit =
    tokenValidated &&
    passwordValid &&
    passwordStrength.strength !== 'weak' &&
    passwordsMatch &&
    !updatePasswordMutation.isPending;

  useEffect(() => {
    // Validate that we have a valid session from the password reset link
    // The callback route should have set the session already
    async function validateToken() {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !sessionData.session) {
        setTokenError('Invalid or expired reset token. Please request a new password reset link.');
        return;
      }

      // Check if this is a recovery session (password reset)
      // Recovery sessions have a specific token type
      if (sessionData.session.user) {
        setTokenValidated(true);
      } else {
        setTokenError('Invalid reset token. Please request a new password reset link.');
      }
    }
    
    validateToken();
  }, []);

  function getPasswordStrengthColor() {
    switch (passwordStrength.strength) {
      case 'weak':
        return Colors.regression[500];
      case 'fair':
        return Colors.oxide[500];
      case 'good':
        return Colors.signal[400];
      case 'strong':
        return Colors.progress[500];
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

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    if (password !== confirmPassword) {
      return;
    }

    updatePasswordMutation.mutate({
      password,
    });
  }

  if (tokenError) {
    return (
      <View className="flex-1 bg-carbon-950 justify-center px-6">
        <View className="mb-8 items-center">
          <Text className="text-2xl font-bold text-graphite-50 mb-4 text-center">
            Invalid Reset Link
          </Text>
          <Text className="text-graphite-400 text-center mb-6">{tokenError}</Text>
          <Link href="/forgot-password" asChild>
            <TouchableOpacity className="bg-signal-500 px-6 py-3 rounded-lg mb-4">
              <Text className="text-white font-semibold">Request New Link</Text>
            </TouchableOpacity>
          </Link>
          <Link href="/login" asChild>
            <TouchableOpacity>
              <Text className="text-signal-500 font-semibold">Back to Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    );
  }

  if (!tokenValidated) {
    return (
      <View className="flex-1 bg-carbon-950 justify-center px-6">
        <ActivityIndicator size="large" color={Colors.signal[500]} />
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-carbon-950"
      contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 48 }}
      keyboardShouldPersistTaps="handled"
    >
      <View className="mb-8">
        <Text className="text-4xl font-bold text-graphite-50 mb-2">New Password</Text>
        <Text className="text-graphite-400 text-lg">Enter your new password below</Text>
      </View>

      <View className="mb-4">
        <Text className="text-graphite-300 mb-2">New Password</Text>
        <View className="relative">
          <TextInput
            className={`bg-graphite-900 text-graphite-50 px-4 py-3 rounded-lg border pr-12 ${
              password.length > 0 && !passwordValid ? 'border-regression-500' : 'border-graphite-700'
            }`}
            placeholder="Enter new password"
            placeholderTextColor="#6B7485"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password-new"
            autoFocus
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
        {password.length > 0 && (
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
        {password.length > 0 && !passwordValid && (
          <Text className="text-regression-500 text-sm mt-1">
            {validatePassword(password).error}
          </Text>
        )}
      </View>

      <View className="mb-6">
        <Text className="text-graphite-300 mb-2">Confirm New Password</Text>
        <View className="relative">
          <TextInput
            className={`bg-graphite-900 text-graphite-50 px-4 py-3 rounded-lg border pr-12 ${
              confirmPassword.length > 0 && !passwordsMatch ? 'border-regression-500' : 'border-graphite-700'
            }`}
            placeholder="Confirm new password"
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

      <TouchableOpacity
        className={`py-4 rounded-lg items-center mb-4 ${
          canSubmit ? 'bg-signal-500' : 'bg-graphite-700 opacity-50'
        }`}
        onPress={handleSubmit}
        disabled={!canSubmit || updatePasswordMutation.isPending}
      >
        {updatePasswordMutation.isPending ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-white font-semibold text-lg">Reset Password</Text>
        )}
      </TouchableOpacity>

      <View className="flex-row justify-center items-center">
        <Link href="/login" asChild>
          <TouchableOpacity>
            <Text className="text-signal-500 font-semibold">Back to Sign In</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </ScrollView>
  );
}
