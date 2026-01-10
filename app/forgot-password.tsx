import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { usePasswordReset } from '@/hooks/useAuth';
import { validateEmail } from '@/lib/validation';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const router = useRouter();
  const passwordResetMutation = usePasswordReset();

  const emailValid = email.length === 0 || validateEmail(email);
  const canSubmit = emailValid && email.length > 0 && !passwordResetMutation.isPending;

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }

    passwordResetMutation.mutate(
      { email: email.trim() },
      {
        onSuccess: () => {
          setEmailSent(true);
        },
      }
    );
  }

  if (emailSent) {
    return (
      <View className="flex-1 bg-carbon-950 justify-center px-6">
        <View className="mb-8 items-center">
          <View className="w-16 h-16 bg-signal-500 rounded-full items-center justify-center mb-4">
            <Text className="text-white text-3xl">✓</Text>
          </View>
          <Text className="text-2xl font-bold text-graphite-50 mb-2 text-center">
            Check Your Email
          </Text>
          <Text className="text-graphite-400 text-center mb-4">
            We've sent password reset instructions to:
          </Text>
          <Text className="text-signal-500 font-semibold mb-6">{email}</Text>
          <Text className="text-graphite-500 text-sm text-center mb-8">
            Click the link in the email to reset your password. The link will expire in 1 hour.
          </Text>
          <Link href="/login" asChild>
            <TouchableOpacity className="bg-signal-500 px-6 py-3 rounded-lg">
              <Text className="text-white font-semibold">Back to Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
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
        <Text className="text-4xl font-bold text-graphite-50 mb-2">Reset Password</Text>
        <Text className="text-graphite-400 text-lg">
          Enter your email address and we'll send you a link to reset your password.
        </Text>
      </View>

      <View className="mb-6">
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
          autoFocus
        />
        {email.length > 0 && !emailValid && (
          <Text className="text-regression-500 text-sm mt-1">Please enter a valid email address</Text>
        )}
      </View>

      <TouchableOpacity
        className={`py-4 rounded-lg items-center mb-4 ${
          canSubmit ? 'bg-signal-500' : 'bg-graphite-700 opacity-50'
        }`}
        onPress={handleSubmit}
        disabled={!canSubmit || passwordResetMutation.isPending}
      >
        {passwordResetMutation.isPending ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-white font-semibold text-lg">Send Reset Link</Text>
        )}
      </TouchableOpacity>

      <View className="flex-row justify-center items-center">
        <Text className="text-graphite-400">Remember your password? </Text>
        <Link href="/login" asChild>
          <TouchableOpacity>
            <Text className="text-signal-500 font-semibold">Sign In</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </ScrollView>
  );
}
