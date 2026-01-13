import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { FoundryLabLogo } from '@/components/FoundryLabLogo';
import { Colors } from '@/constants/Colors';

export default function NotFoundScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <SafeAreaView style={{ flex: 1, backgroundColor: Colors.void[900] }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <FoundryLabLogo size={100} style={{ marginBottom: 32 }} />
          <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 16, color: Colors.graphite[50], textAlign: 'center' }}>
            This screen doesn&apos;t exist.
          </Text>
          <Link href="/" asChild>
            <View style={{ marginTop: 16, paddingVertical: 16 }}>
              <Text style={{ color: Colors.signal[400], fontSize: 16, fontWeight: '600' }}>Go to home screen</Text>
            </View>
          </Link>
        </View>
      </SafeAreaView>
    </>
  );
}
