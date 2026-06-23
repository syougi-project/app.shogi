import { useFonts } from 'expo-font';
import { ShipporiMincho_700Bold } from '@expo-google-fonts/shippori-mincho';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { LogBox, View, Text } from 'react-native';
import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AppLoadingScreen } from '@/components/organism/app-loading-screen';
import { AuthSessionProvider, useAuthSession } from '@/hooks/common/auth-session-context';
import { initializeAdMob } from '@/lib/ads/admob';
import { releaseAudioPlayers } from '@/lib/audio/audio-manager';

import '../../global.css';

LogBox.ignoreLogs(['SafeAreaView has been deprecated and will be removed in a future release.']);

function RootLayoutInner() {
  const router = useRouter();
  const [fontsLoaded] = useFonts({
    ShipporiMincho_700Bold,
  });
  const { isReady, needsUsernameSetup, error, statusMessage } = useAuthSession();

  useEffect(() => {
    void initializeAdMob();
    return () => {
      releaseAudioPlayers();
    };
  }, []);

  useEffect(() => {
    if (isReady && !error && needsUsernameSetup) {
      router.replace('/username-setup');
    }
  }, [isReady, error, needsUsernameSetup, router]);

  if (!fontsLoaded || !isReady) {
    return <AppLoadingScreen label={statusMessage ?? undefined} />;
  }

  if (error) {
    console.error('[Auth Error]', error);
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#000',
          padding: 24,
        }}
      >
        <Text style={{ color: '#fff', marginBottom: 12 }}>
          {'userMessage' in error
            ? String(error.userMessage)
            : '接続できませんでした。時間をおいてもう一度お試しください。'}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="light" translucent backgroundColor="transparent" />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthSessionProvider>
      <RootLayoutInner />
    </AuthSessionProvider>
  );
}
