import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLoadingScreen } from '@/components/organism/app-loading-screen';
import { GlobalHomeHud } from '@/components/organism/global-home-hud';
import { mergeIntroBanners } from '@/constants/gacha-intro-banners';
import {
  bannerImageSource,
  gachaRoomAssets,
  resolveGachaBannerKey,
} from '@/constants/gacha-room-assets';
import { homeAssets } from '@/constants/home-assets';
import { GACHA_ROOM_BACK_BUTTON_INTRO_MARGIN_LEFT } from '@/features/gacha-room/ui/gacha-room-layout';
import { GachaLineupSection } from '@/features/gacha-room/ui/parts/gacha-lineup-section';
import { GachaRoomBackButton } from '@/features/gacha-room/ui/parts/gacha-room-back-button';
import { GachaRoomVM, useGachaRoomScreen } from '@/features/gacha-room/ui/use-gacha-room-screen';
import { useAssetPreload } from '@/hooks/common/use-asset-preload';
import { useScreenBgm } from '@/hooks/common/use-screen-bgm';
import { listLocalPieceImageModules, resolvePieceImageSource } from '@/lib/piece-image';
import { playSe } from '@/lib/audio/audio-manager';
import { useSafeRouterBack } from '@/lib/navigation/safe-router-back';
import type { GachaBanner } from '@/usecases/gacha-room/load-gacha-lobby-usecase';

function rarityColor(rarity: string): string {
  switch (rarity) {
    case 'SSR':
      return '#f0c040';
    case 'UR':
      return '#c084fc';
    case 'SR':
      return '#60a5fa';
    case 'R':
      return '#34d399';
    default:
      return '#94a3b8';
  }
}

function ResultBlock({ vm, selected }: { vm: GachaRoomVM; selected: GachaBanner | undefined }) {
  if (vm.phase === 'idle') {
    return <Text className="text-sm text-slate-100">まだガチャを引いていません。</Text>;
  }

  if (vm.phase === 'done' && vm.lastResult) {
    const result = vm.lastResult;
    if (result.type === 'hit') {
      const pieceSource = resolvePieceImageSource(result.piece);
      return (
        <View className="gap-2">
          <Text
            style={{ color: rarityColor(result.piece.rarity) }}
            className="text-base font-black"
          >
            {result.alreadyOwned
              ? `${result.piece.name}（${result.piece.rarity}）は既に所持！`
              : `${result.piece.name}（${result.piece.rarity}）を獲得！`}
          </Text>
          {result.alreadyOwned && (result.duplicateGoldGranted ?? 0) > 0 ? (
            <Text className="text-sm font-bold text-yellow-300">
              {`代わりに金通貨 x${result.duplicateGoldGranted} を獲得しました`}
            </Text>
          ) : null}
          {pieceSource ? (
            <View className="items-center py-2">
              <Image
                source={pieceSource}
                contentFit="contain"
                style={{ width: 120, height: 120 }}
              />
            </View>
          ) : (
            <Text className="py-2 text-center text-5xl text-white">{result.piece.char}</Text>
          )}
          <Text className="text-sm text-slate-200">{result.piece.description}</Text>
          <Text className="text-xs text-slate-400">
            {selected
              ? `続けて引く場合は「ガチャを引く」またはガチャ選択から${selected.name}を選んでください。`
              : '続けて引く場合は「ガチャを引く」を押してください。'}
          </Text>
        </View>
      );
    }
    const label = result.currency === 'gold' ? `金 x${result.amount}` : `歩 x${result.amount}`;
    const currencyChar = result.currency === 'gold' ? '金' : '歩';
    const currencyImageSource = resolvePieceImageSource({ char: currencyChar });
    return (
      <View className="gap-2">
        <Text className="text-base font-black text-slate-100">{`${currencyChar}を獲得！`}</Text>
        {currencyImageSource ? (
          <View className="items-center py-2">
            <Image
              source={currencyImageSource}
              contentFit="contain"
              style={{ width: 120, height: 120 }}
            />
          </View>
        ) : (
          <Text className="py-2 text-center text-5xl text-white">{currencyChar}</Text>
        )}
        <Text className="text-sm text-slate-300">{`${label} の通貨が増えました。ショップで使いましょう。`}</Text>
      </View>
    );
  }

  return <Text className="text-sm text-slate-300">抽選中…</Text>;
}

function GachaVideoOverlay({ isHit, onEnd }: { isHit: boolean; onEnd: () => void }) {
  const endedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const source = isHit ? gachaRoomAssets.videos.hit : gachaRoomAssets.videos.miss;
  const player = useVideoPlayer(source, (p) => {
    endedRef.current = false;
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    endedRef.current = false;
  }, [source]);

  useEffect(() => {
    const finishOnce = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      onEndRef.current();
    };

    const subPlayToEnd = player.addListener('playToEnd', finishOnce);
    return () => {
      subPlayToEnd.remove();
    };
  }, [player]);

  const handleSkip = () => {
    try {
      player.pause();
    } catch {
      // ignore
    }
    if (!endedRef.current) {
      endedRef.current = true;
      onEndRef.current();
    }
  };

  return (
    <Pressable
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.92)',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onPress={handleSkip}
    >
      <VideoView
        player={player}
        style={{ width: '100%', height: '100%' }}
        contentFit="cover"
        nativeControls={false}
      />
      <Text
        style={{ position: 'absolute', bottom: 24, color: 'rgba(255,255,255,0.5)', fontSize: 12 }}
      >
        タップでスキップ
      </Text>
    </Pressable>
  );
}

function PieceOverlay({
  piece,
  onDismiss,
}: {
  piece: { char: string; pieceCode?: string | null; pieceId?: number };
  onDismiss: () => void;
}) {
  const source = resolvePieceImageSource(piece);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.95)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onPress={onDismiss}
      >
        {source ? (
          <Image source={source} contentFit="contain" style={{ width: '80%', height: '70%' }} />
        ) : (
          <Text style={{ fontSize: 120, color: 'white' }}>{piece.char}</Text>
        )}
        <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginTop: 24 }}>
          タップで閉じる
        </Text>
      </Pressable>
    </Modal>
  );
}

function GachaDrawButton({
  banner,
  useAdDraw,
  disabled = false,
  onPress,
}: {
  banner: GachaBanner;
  useAdDraw: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const key = resolveGachaBannerKey(banner.key);
  const isKanken1 = key === 'kanken1';

  const drawImage = useAdDraw
    ? gachaRoomAssets.drawAdv
    : isKanken1
      ? gachaRoomAssets.drawGold
      : gachaRoomAssets.drawWalk;
  const size = useAdDraw
    ? { width: 360, height: 144 }
    : isKanken1
      ? { width: 390, height: 150 }
      : { width: 360, height: 144 };

  return (
    <Pressable
      disabled={disabled}
      onPress={() => {
        void playSe('tap');
        void playSe('confirm');
        onPress();
      }}
      className={`items-center active:opacity-90 ${disabled ? 'opacity-50' : ''}`}
      style={isKanken1 && !useAdDraw ? { marginTop: 25 } : undefined}
    >
      <Image source={drawImage} contentFit="contain" style={size} />
    </Pressable>
  );
}

export function GachaRoomScreen() {
  const goBack = useSafeRouterBack('/home');
  const vm = useGachaRoomScreen();
  const [introVisible, setIntroVisible] = useState(true);

  const introBanners = useMemo(() => mergeIntroBanners(vm.banners), [vm.banners]);

  const selectedBanner = useMemo(() => {
    const sk = resolveGachaBannerKey(vm.selectedKey);
    const fromApi = vm.banners.find((b) => resolveGachaBannerKey(b.key) === sk);
    if (fromApi) return fromApi;
    return introBanners.find((b) => b.key === sk) ?? introBanners[0];
  }, [vm.banners, vm.selectedKey, introBanners]);

  const { isReady: areAssetsReady } = useAssetPreload(
    [
      gachaRoomAssets.background,
      gachaRoomAssets.backButton,
      gachaRoomAssets.drawWalk,
      gachaRoomAssets.drawGold,
      gachaRoomAssets.drawAdv,
      ...(Object.values(gachaRoomAssets.bannerByKey) as number[]),
      ...listLocalPieceImageModules(),
    ],
    {
      enabled: !vm.isLoading,
    },
  );
  useScreenBgm('gacha');

  if (vm.isLoading || !areAssetsReady) {
    return <AppLoadingScreen imageSource={homeAssets.loadingImage} />;
  }

  if (vm.loadError) {
    return (
      <SafeAreaView className="flex-1 justify-center px-6" style={{ backgroundColor: '#020617' }}>
        <Text className="mb-6 text-center text-base text-slate-200">{vm.loadError}</Text>
        <Pressable
          onPress={() => {
            void playSe('tap');
            vm.reloadLobby();
          }}
          className="items-center rounded-xl bg-indigo-600 px-6 py-3 active:opacity-90"
        >
          <Text className="font-bold text-white">再読み込み</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const isHit =
    vm.phase === 'video' || vm.phase === 'pieceOverlay' ? vm.lastResult?.type === 'hit' : false;
  const canRoll = vm.phase === 'idle' || vm.phase === 'done';
  const bgSource = selectedBanner
    ? bannerImageSource(selectedBanner.key, selectedBanner.imageSignedUrl)
    : gachaRoomAssets.draw1;

  return (
    <ImageBackground source={gachaRoomAssets.background} resizeMode="cover" className="flex-1">
      <SafeAreaView className="flex-1" edges={['left', 'right', 'bottom']}>
        {vm.phase === 'video' && <GachaVideoOverlay isHit={isHit} onEnd={vm.onVideoEnd} />}

        {vm.phase === 'pieceOverlay' && vm.lastResult?.type === 'hit' && (
          <PieceOverlay piece={vm.lastResult.piece} onDismiss={vm.onPieceOverlayDismiss} />
        )}

        <GlobalHomeHud pawnCurrency={vm.pawnCurrency} goldCurrency={vm.goldCurrency} />

        {introVisible ? (
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-4 pb-10 pt-2"
            showsVerticalScrollIndicator
          >
            <View
              className="mb-4 flex-row items-center"
              style={{ marginLeft: GACHA_ROOM_BACK_BUTTON_INTRO_MARGIN_LEFT }}
            >
              <GachaRoomBackButton
                onPress={() => {
                  void playSe('tap');
                  goBack();
                }}
              />
            </View>
            <Text className="mb-4 text-center text-xl font-black text-white drop-shadow-md">
              ガチャ一覧
            </Text>
            {vm.featuredAdGachaLabel ? (
              <View className="mb-4 rounded-xl border border-amber-300/50 bg-amber-500/15 px-3 py-2">
                <Text className="text-center text-xs font-bold text-amber-100">
                  {vm.dailyAdGacha?.used
                    ? `本日の広告無償ガチャは使用済みです（次回更新: 0:00）`
                    : `本日の広告無償ガチャ: ${vm.featuredAdGachaLabel}（1日1回・0:00更新）`}
                </Text>
              </View>
            ) : null}
            {introBanners.map((banner) => {
              const src = bannerImageSource(banner.key, banner.imageSignedUrl);
              const isFeaturedAd = vm.isFeaturedAdGacha(banner.key);
              const canAdRoll = vm.canRollWithAd(banner.key);
              return (
                <View key={banner.key} className="mb-5">
                  <View
                    className={`relative overflow-hidden rounded-xl border bg-white/20 ${
                      isFeaturedAd ? 'border-amber-300/80' : 'border-[#8b0000]/25'
                    }`}
                  >
                    {isFeaturedAd ? (
                      <View className="absolute left-2 top-2 z-10 rounded-full bg-amber-400/90 px-2 py-0.5">
                        <Text className="text-[10px] font-black text-[#4a3200]">
                          {canAdRoll ? '本日広告無料' : '本日の対象ガチャ'}
                        </Text>
                      </View>
                    ) : null}
                    <Image source={src} contentFit="cover" style={{ width: '100%', height: 200 }} />
                    <View className="absolute bottom-1 left-0 right-0 items-center gap-1">
                      <GachaDrawButton
                        banner={banner}
                        useAdDraw={canAdRoll}
                        disabled={!canRoll}
                        onPress={() => {
                          vm.setSelectedKey(banner.key);
                          setIntroVisible(false);
                          if (canAdRoll) {
                            void vm.rollWithAd(banner.key);
                            return;
                          }
                        }}
                      />
                    </View>
                  </View>
                  {banner.pieceRateText ? (
                    <Text className="mt-2 text-center text-xs font-semibold text-white drop-shadow-sm">
                      {banner.pieceRateText}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="flex-grow pb-10"
            keyboardShouldPersistTaps="handled"
          >
            <ImageBackground
              source={bgSource}
              resizeMode="cover"
              style={{ minHeight: 520 }}
              imageStyle={{ opacity: 0.45 }}
            >
              <View className="min-h-[520px] flex-1 bg-black/50 px-4 pb-8 pt-2">
                {vm.noticeMessage ? (
                  <View className="mb-3 rounded-xl border border-amber-300/40 bg-amber-500/10 px-3 py-2">
                    <Text className="text-sm font-bold text-amber-200">{vm.noticeMessage}</Text>
                  </View>
                ) : null}

                <View className="mb-4">
                  <View className="max-w-[70%]">
                    <Text className="text-2xl font-black text-white drop-shadow-md">
                      {selectedBanner?.name ?? 'ガチャルーム'}
                    </Text>
                    {selectedBanner?.description ? (
                      <Text className="mt-1 text-sm text-slate-200">
                        {selectedBanner.description}
                      </Text>
                    ) : selectedBanner?.pieceRateText ? (
                      <Text className="mt-1 text-sm text-slate-200">
                        {selectedBanner.pieceRateText}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {selectedBanner?.pieceRateText ? (
                  <View className="mb-4 self-end rounded-full bg-amber-500/30 px-3 py-1">
                    <Text className="text-xs font-semibold text-amber-200">
                      {selectedBanner.pieceRateText}
                    </Text>
                  </View>
                ) : null}

                <GachaLineupSection banner={selectedBanner} />

                <GachaDrawButton
                  banner={selectedBanner ?? introBanners[0]!}
                  useAdDraw={selectedBanner != null && vm.canRollWithAd(selectedBanner.key)}
                  disabled={!canRoll || selectedBanner == null}
                  onPress={() => {
                    if (!canRoll || !selectedBanner) return;
                    if (vm.canRollWithAd(selectedBanner.key)) {
                      void vm.rollWithAd(selectedBanner.key);
                      return;
                    }
                    void vm.roll(selectedBanner.key);
                  }}
                />
                <View className="mb-6" />
                <Text className="mb-2 text-center text-xs text-slate-400">
                  消費: 歩 x{selectedBanner?.pawnCost ?? 0} / 金 x{selectedBanner?.goldCost ?? 0}
                </Text>

                <View className="rounded-xl border border-white/15 bg-white/10 p-4">
                  <View className="mb-2 flex-row items-center gap-2">
                    <MaterialIcons name="thumb-up" size={20} color="#bef264" />
                    <Text className="text-lg font-semibold text-white">今回の結果</Text>
                  </View>
                  <ResultBlock vm={vm} selected={selectedBanner} />
                </View>

                <Text className="mx-1 mt-6 text-center text-xs leading-5 text-slate-400">
                  ※ 当たり駒は駒コレクションに記録されます。{'\n'}※
                  はずれの場合でも歩や金の通貨が返却され、ショップで利用できます。
                </Text>

                <Pressable
                  onPress={() => {
                    void playSe('tap');
                    setIntroVisible(true);
                  }}
                  className="mx-auto mt-6 flex-row items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-4 py-2 active:bg-white/20"
                >
                  <MaterialIcons name="arrow-back" color="#fff" size={18} />
                  <Text className="text-sm font-semibold text-white">ガチャ選択画面に戻る</Text>
                </Pressable>
              </View>
            </ImageBackground>
          </ScrollView>
        )}
      </SafeAreaView>
    </ImageBackground>
  );
}
