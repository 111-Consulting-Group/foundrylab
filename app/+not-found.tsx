import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';

export default function NotFoundScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <SafeAreaView className={`flex-1 ${isDark ? 'bg-steel-950' : 'bg-steel-50'}`}>
        <View className="flex-1 items-center justify-center p-5">
          <Text className={`text-xl font-bold mb-4 ${isDark ? 'text-steel-100' : 'text-steel-900'}`}>
            This screen doesn&apos;t exist.
          </Text>
          <Link href="/" className="mt-4 py-4">
            <Text className="text-forge-500 text-base">Go to home screen</Text>
          </Link>
        </View>
      </SafeAreaView>
    </>
  );
}
