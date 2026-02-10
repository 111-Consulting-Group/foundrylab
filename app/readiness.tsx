import { router } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReadinessCheckIn } from '@/components/ReadinessCheckIn';
import { Colors } from '@/constants/Colors';
import type { ReadinessAdjustment } from '@/types/database';

export default function ReadinessScreen() {
  const handleComplete = (adjustment: ReadinessAdjustment) => {
    // Go back to the main screen after completing check-in
    router.back();
  };

  const handleSkip = () => {
    router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
        <ReadinessCheckIn onComplete={handleComplete} onSkip={handleSkip} />
      </View>
    </SafeAreaView>
  );
}
