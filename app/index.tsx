import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { supabase } from '@/lib/supabase';

export default function Index() {
  const userId = useAppStore((state) => state.userId);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Check actual Supabase session to ensure auth state is accurate
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasSession(!!session?.user);
    });
  }, []);

  // If we're still checking session, don't redirect yet
  if (hasSession === null) {
    return null;
  }

  // If no userId in store OR no session in Supabase, redirect to login
  if (!userId || !hasSession) {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)" />;
}
