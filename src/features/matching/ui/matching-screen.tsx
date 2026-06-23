import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLoadingScreen } from '@/components/organism/app-loading-screen';
import { GlobalHomeHud } from '@/components/organism/global-home-hud';
import { homeAssets } from '@/constants/home-assets';
import { onlineMatchAssets } from '@/constants/online-match-assets';
import { useMatchingScreen } from '@/features/matching/ui/use-matching-screen';
import { useAssetPreload } from '@/hooks/common/use-asset-preload';
import { useScreenBgm } from '@/hooks/common/use-screen-bgm';
import { playSe } from '@/lib/audio/audio-manager';

export function MatchingScreen() {
  const router = useRouter();
  const { isReady: areAssetsReady } = useAssetPreload([onlineMatchAssets.matchingBackground]);
  const { snapshot, cancel, startedMatchId } = useMatchingScreen(areAssetsReady);
  const needsBattleSetup = snapshot.status.includes('対戦準備が未保存');
  useScreenBgm('matching');

  useEffect(() => {
    if (!startedMatchId) return;
    router.replace({ pathname: '/online-battle', params: { matchId: startedMatchId } });
  }, [router, startedMatchId]);

  if (!areAssetsReady) {
    return <AppLoadingScreen imageSource={homeAssets.loadingImage} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['left', 'right', 'bottom']}>
      <GlobalHomeHud />
      <View className="flex-1">
        <View className="absolute inset-0">
          <Image
            source={onlineMatchAssets.matchingBackground}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
          <View className="absolute inset-0 bg-black/40" />
        </View>

        <View className="flex-1 items-center justify-center px-4">
          <View className="w-full max-w-[240px] rounded-xl bg-white/90 p-4 shadow-lg">
            <Text className="text-center text-base font-black text-[#1f2937]">マッチング中</Text>
            <Text className="mt-2 text-center text-sm text-[#4b5563]">{snapshot.status}</Text>

            {snapshot.self ? (
              <View className="mt-3 rounded-lg bg-[#f3f4f6] px-3 py-2">
                <Text className="text-xs font-bold text-[#6b7280]">あなた</Text>
                <Text className="text-sm font-black text-[#1f2937]">
                  {snapshot.self.displayName}
                </Text>
                <Text className="text-xs font-bold text-[#4b5563]">
                  レート {snapshot.self.rating}
                </Text>
              </View>
            ) : null}

            {snapshot.opponent ? (
              <View className="mt-2 rounded-lg bg-[#eff6ff] px-3 py-2">
                <Text className="text-xs font-bold text-[#2563eb]">対戦相手</Text>
                <Text className="text-sm font-black text-[#1f2937]">
                  {snapshot.opponent.displayName}
                </Text>
                <Text className="text-xs font-bold text-[#4b5563]">
                  レート {snapshot.opponent.rating}
                </Text>
              </View>
            ) : null}

            <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-200">
              <View
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${snapshot.progress}%` }}
              />
            </View>

            {needsBattleSetup || snapshot.status.includes('対戦準備が無効') ? (
              <Pressable
                onPress={() => {
                  void playSe('tap');
                  router.replace('/online-match-setup');
                }}
                className="mt-4 self-center rounded-lg bg-blue-600 px-4 py-2 active:scale-95"
              >
                <Text className="text-sm font-black text-white">対戦準備へ</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={async () => {
                void playSe('cancel');
                await cancel();
                router.replace('/home');
              }}
              className="mt-4 self-center rounded-lg bg-red-500 px-4 py-2 active:scale-95"
            >
              <Text className="text-sm font-black text-white">キャンセル</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
