import { router } from 'expo-router';
import { View } from 'react-native';

import GuideStream from '@/components/guide/GuideStream';
import { Colors } from '@/constants/Colors';

export default function DashboardScreen() {
  const handleOpenProfile = () => {
    // Navigate to profile/settings
    // In a real app this might open a modal or navigate to a profile screen
    router.push('/settings');
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.void[900] }}>
      <GuideStream onOpenProfile={handleOpenProfile} />
    </View>
  );
}
