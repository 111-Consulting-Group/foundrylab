import { Redirect } from 'expo-router';
import { useAppStore } from '@/stores/useAppStore';

export default function Index() {
  const userId = useAppStore((state) => state.userId);

  if (!userId) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)" />;
}
