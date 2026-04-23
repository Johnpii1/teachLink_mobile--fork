import { MobileProfile } from '@/src/components/mobile/MobileProfile';
import { useAppStore } from '@/src/store';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';

export default function ProfileScreen() {
  const { userId } = useLocalSearchParams();
  const theme = useAppStore((s) => s.theme);

  return <MobileProfile userId={userId as string} isDark={theme === 'dark'} />;
}
