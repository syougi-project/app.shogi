import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppLoadingScreen } from '@/components/organism/app-loading-screen';
import { homeAssets } from '@/constants/home-assets';
import {
  HOME_BACKGROUND_OFFSET,
  HOME_GACHA_BALL_HELP_BUTTON_HEIGHT,
  HOME_GACHA_BALL_HELP_BUTTON_RIGHT,
  HOME_GACHA_BALL_HELP_BUTTON_WIDTH,
  HOME_TOP_LAYOUT_OFFSET,
} from '@/features/home/ui/home-layout';
import { HomeActionGridSection } from '@/features/home/ui/sections/home-action-grid-section';
import { HomeBackgroundSection } from '@/features/home/ui/sections/home-background-section';
import { gachaBallColorIndexForCurrentPeriod } from '@/features/home/lib/gacha-ball-schedule';
import { HomeHeaderSection } from '@/features/home/ui/sections/home-header-section';
import {
  DeleteAccountConfirmModal,
  TitleSettingsModal,
} from '@/features/home/ui/title-settings-modal';
import { useHomeScreen } from '@/features/home/ui/use-home-screen';
import { useAuthSession } from '@/hooks/common/auth-session-context';
import {
  loadHomeSnapshot,
  resetHomeSnapshotForAccountChange,
} from '@/hooks/common/home-snapshot-store';
import { useAssetPreload } from '@/hooks/common/use-asset-preload';
import { useScreenBgm } from '@/hooks/common/use-screen-bgm';
import { playSe } from '@/lib/audio/audio-manager';
import { resolvePieceImageSource } from '@/lib/piece-image';
import { deleteAccount } from '@/usecases/auth/delete-account-usecase';
import { createLoadActiveDeckSummaryUseCase } from '@/usecases/deck-builder/create-deck-builder-usecases';

const FADE_IN_MS = 520;
const FADE_HOLD_MS = 920;
const FADE_OUT_MS = 520;
const NEXT_PIECE_DELAY_MS = 140;

const GACHA_BALL_COLOR_ROWS: { label: string; source: number }[] = [
  { label: '白', source: homeAssets.gachaBallColors.white },
  { label: '青', source: homeAssets.gachaBallColors.blue },
  { label: '赤', source: homeAssets.gachaBallColors.red },
  { label: '金', source: homeAssets.gachaBallColors.gold },
  { label: '黒', source: homeAssets.gachaBallColors.black },
];

type GachaModalPanel = 'viewer' | 'help';

type DeckCarouselPiece = {
  key: string;
  char: string;
  name: string;
};

export function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { accessToken, reinitializeSession } = useAuthSession();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<'first' | 'second' | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [gachaModalOpen, setGachaModalOpen] = useState(false);
  const [gachaModalPanel, setGachaModalPanel] = useState<GachaModalPanel>('viewer');
  const [viewerBallSource, setViewerBallSource] = useState<number | null>(null);
  const [deckPieces, setDeckPieces] = useState<DeckCarouselPiece[]>([]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cycleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { snapshot, isLoading } = useHomeScreen();
  const { isReady: areAssetsReady } = useAssetPreload(homeAssets.preloadTargets);
  useScreenBgm('home');

  const openSettings = useCallback(() => {
    void playSe('tap');
    setIsSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    void playSe('cancel');
    setIsSettingsOpen(false);
  }, []);

  const startChangeUsername = useCallback(() => {
    void playSe('tap');
    setIsSettingsOpen(false);
  }, []);

  const startDeleteAccount = useCallback(() => {
    void playSe('tap');
    setIsSettingsOpen(false);
    setDeleteAccountError(null);
    setDeleteConfirmStep('first');
  }, []);

  const cancelDeleteAccount = useCallback(() => {
    if (isDeletingAccount) {
      return;
    }
    void playSe('cancel');
    setDeleteConfirmStep(null);
    setDeleteAccountError(null);
  }, [isDeletingAccount]);

  const confirmDeleteAccountFirst = useCallback(() => {
    void playSe('tap');
    setDeleteAccountError(null);
    setDeleteConfirmStep('second');
  }, []);

  const backToDeleteAccountFirst = useCallback(() => {
    void playSe('tap');
    setDeleteAccountError(null);
    setDeleteConfirmStep('first');
  }, []);

  const confirmDeleteAccountSecond = useCallback(async () => {
    if (!accessToken || isDeletingAccount) {
      return;
    }
    void playSe('tap');
    setIsDeletingAccount(true);
    setDeleteAccountError(null);

    try {
      await deleteAccount(accessToken);
      resetHomeSnapshotForAccountChange();
      setDeleteConfirmStep(null);
      await reinitializeSession();
      await loadHomeSnapshot(true).catch(() => undefined);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'アカウントの削除に失敗しました。';
      setDeleteAccountError(message);
    } finally {
      setIsDeletingAccount(false);
    }
  }, [accessToken, isDeletingAccount, reinitializeSession]);

  const closeGachaModalCompletely = useCallback(() => {
    void playSe('tap');
    setGachaModalOpen(false);
    setGachaModalPanel('viewer');
    setViewerBallSource(null);
  }, []);

  const openGachaBallViewer = useCallback(() => {
    void playSe('tap');
    const idx = gachaBallColorIndexForCurrentPeriod();
    setViewerBallSource(GACHA_BALL_COLOR_ROWS[idx]!.source);
    setGachaModalPanel('viewer');
    setGachaModalOpen(true);
  }, []);

  const openGachaHelp = useCallback(() => {
    void playSe('tap');
    setGachaModalPanel('help');
  }, []);

  const closeGachaHelpBackToViewer = useCallback(() => {
    void playSe('tap');
    setGachaModalPanel('viewer');
  }, []);

  const handleGachaModalRequestClose = useCallback(() => {
    if (gachaModalPanel === 'help') {
      setGachaModalPanel('viewer');
    } else {
      closeGachaModalCompletely();
    }
  }, [gachaModalPanel, closeGachaModalCompletely]);

  useEffect(() => {
    let active = true;

    const loadDeckPieces = async (nextToken: string | null) => {
      try {
        if (!nextToken) {
          if (active) {
            setDeckPieces([]);
            setCarouselIndex(0);
          }
          return;
        }
        const deckSummary = await createLoadActiveDeckSummaryUseCase(nextToken).execute();
        const nextPieces = deckSummary.placements.map((placement, idx) => ({
          key: `${placement.pieceId}-${placement.rowNo}-${placement.colNo}-${idx}`,
          char: placement.char,
          name: placement.name,
        }));
        if (active) {
          setDeckPieces(nextPieces);
          setCarouselIndex(0);
        }
      } catch {
        if (active) {
          setDeckPieces([]);
          setCarouselIndex(0);
        }
      }
    };

    void loadDeckPieces(accessToken);

    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (deckPieces.length === 0) return;
    let active = true;

    const playCycle = () => {
      fadeAnim.setValue(0);
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: FADE_IN_MS,
          useNativeDriver: true,
        }),
        Animated.delay(FADE_HOLD_MS),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: FADE_OUT_MS,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished || !active) return;
        setCarouselIndex((prev) => {
          if (deckPieces.length <= 1) return 0;
          const prevPiece = deckPieces[prev % deckPieces.length];
          if (!prevPiece) return (prev + 1) % deckPieces.length;
          for (let step = 1; step < deckPieces.length; step += 1) {
            const candidateIndex = (prev + step) % deckPieces.length;
            const candidate = deckPieces[candidateIndex];
            if (!candidate) continue;
            if (candidate.char !== prevPiece.char) return candidateIndex;
          }
          return (prev + 1) % deckPieces.length;
        });
        cycleTimerRef.current = setTimeout(playCycle, NEXT_PIECE_DELAY_MS);
      });
    };

    playCycle();

    return () => {
      active = false;
      if (cycleTimerRef.current) {
        clearTimeout(cycleTimerRef.current);
        cycleTimerRef.current = null;
      }
      fadeAnim.stopAnimation();
    };
  }, [deckPieces, fadeAnim]);

  const currentDeckPiece = useMemo(() => {
    if (deckPieces.length === 0) return null;
    return deckPieces[carouselIndex % deckPieces.length] ?? null;
  }, [deckPieces, carouselIndex]);
  const currentDeckPieceImageSource = useMemo(() => {
    if (!currentDeckPiece) return null;
    return resolvePieceImageSource({
      char: currentDeckPiece.char,
    });
  }, [currentDeckPiece]);

  if (isLoading || !areAssetsReady) {
    return <AppLoadingScreen imageSource={homeAssets.loadingImage} />;
  }

  return (
    <ImageBackground
      source={homeAssets.background}
      resizeMode="stretch"
      className="flex-1"
      imageStyle={{
        transform: [{ translateY: HOME_BACKGROUND_OFFSET }],
      }}
    >
      <View style={{ marginTop: HOME_TOP_LAYOUT_OFFSET }}>
        <HomeHeaderSection
          onPressBackToTitle={() => {
            void playSe('tap');
            router.replace('/');
          }}
          onPressSettings={openSettings}
          onPressMatching={() => {
            void playSe('tap');
            router.push('/online-match-mode' as never);
          }}
          onPressGachaBallIcon={openGachaBallViewer}
          playerName={snapshot.playerName}
          playerRating={snapshot.rating}
          pawnCurrency={snapshot.pawnCurrency}
          goldCurrency={snapshot.goldCurrency}
          stamina={snapshot.stamina}
          maxStamina={snapshot.maxStamina}
          nextRecoveryAt={snapshot.nextRecoveryAt}
        />
      </View>
      <TitleSettingsModal
        visible={isSettingsOpen}
        accessToken={accessToken}
        onClose={closeSettings}
        onRequestChangeUsername={startChangeUsername}
        onRequestDelete={startDeleteAccount}
      />
      <DeleteAccountConfirmModal
        step={deleteConfirmStep}
        isDeleting={isDeletingAccount}
        errorMessage={deleteAccountError}
        onCancel={cancelDeleteAccount}
        onConfirmFirst={confirmDeleteAccountFirst}
        onConfirmSecond={() => void confirmDeleteAccountSecond()}
        onBackToFirst={backToDeleteAccountFirst}
      />
      <SafeAreaView edges={['left', 'right', 'bottom']} className="flex-1 bg-black/10">
        <View className="flex-1">
          <HomeBackgroundSection />
          {currentDeckPiece ? (
            <View pointerEvents="none" style={styles.deckCarouselLayer}>
              <Animated.View style={[styles.deckCarouselCard, { opacity: fadeAnim }]}>
                {currentDeckPieceImageSource ? (
                  <Image
                    source={currentDeckPieceImageSource}
                    contentFit="contain"
                    style={styles.deckCarouselImage}
                  />
                ) : (
                  <View style={styles.deckFallbackBadge}>
                    <Text style={styles.deckFallbackChar}>{currentDeckPiece.char}</Text>
                  </View>
                )}
              </Animated.View>
            </View>
          ) : null}
          <HomeActionGridSection />
        </View>
      </SafeAreaView>

      <Modal
        visible={gachaModalOpen}
        animationType="fade"
        presentationStyle={Platform.OS === 'ios' ? 'fullScreen' : undefined}
        onRequestClose={handleGachaModalRequestClose}
      >
        <View className="flex-1 bg-[#1f1410]">
          <SafeAreaView className="flex-1" edges={['top', 'left', 'right', 'bottom']}>
            {viewerBallSource !== null ? (
              <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
                <Image
                  source={viewerBallSource}
                  contentFit="contain"
                  style={StyleSheet.absoluteFillObject}
                />
              </View>
            ) : null}

            {gachaModalPanel === 'viewer' ? (
              <>
                <View className="absolute left-4 z-20" style={{ top: Math.max(insets.top, 8) + 4 }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="ホームへ戻る"
                    onPress={closeGachaModalCompletely}
                    className="rounded-full bg-[rgba(139,0,0,0.88)] p-2.5 active:opacity-80"
                  >
                    <MaterialIcons name="arrow-back" size={28} color="#fff" />
                  </Pressable>
                </View>

                <View
                  className="absolute z-20"
                  style={{
                    right: HOME_GACHA_BALL_HELP_BUTTON_RIGHT,
                    bottom: Math.max(insets.bottom, 12) + 8,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="ガチャ玉の色のヘルプ"
                    onPress={openGachaHelp}
                    className="active:scale-95"
                    style={{
                      width: HOME_GACHA_BALL_HELP_BUTTON_WIDTH,
                      height: HOME_GACHA_BALL_HELP_BUTTON_HEIGHT,
                    }}
                  >
                    <Image
                      source={homeAssets.gachaBallHelpButton}
                      contentFit="contain"
                      style={{ width: '100%', height: '100%' }}
                    />
                  </Pressable>
                </View>
              </>
            ) : null}

            {gachaModalPanel === 'help' ? (
              <View
                className="z-30 justify-center bg-black/55 px-5"
                style={StyleSheet.absoluteFillObject}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="ヘルプを閉じてガチャ玉に戻る"
                  className="flex-1 justify-center"
                  onPress={closeGachaHelpBackToViewer}
                >
                  <Pressable
                    className="max-h-[78%] rounded-2xl border-2 border-[#8e6428] bg-[#fff7e6] p-5"
                    onPress={(e) => e.stopPropagation()}
                  >
                    <Text className="mb-3 text-lg font-black text-[#4b2e1f]">ガチャ玉の色</Text>
                    <Text className="mb-4 text-sm font-semibold leading-6 text-[#4b2e1f]">
                      ガチャにおける当たり駒の出やすさは、ガチャ玉の色で確認できます。白は通常、青1.05倍、赤1.1倍、金1.2倍、黒1.5倍（当たり駒のみ。歩・金の通貨枠は変わりません）。4時間ごとに色が切り替わります。
                    </Text>
                    <ScrollView className="mb-2" showsVerticalScrollIndicator={false}>
                      <View className="flex-row flex-wrap justify-center gap-x-3 gap-y-4">
                        {GACHA_BALL_COLOR_ROWS.map(({ label, source }) => (
                          <View key={label} className="w-[28%] items-center">
                            <Image
                              source={source}
                              contentFit="contain"
                              style={{ width: 72, height: 72 }}
                            />
                            <Text className="mt-1 text-center text-xs font-black text-[#4b2e1f]">
                              {label}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </ScrollView>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="閉じる"
                      onPress={closeGachaHelpBackToViewer}
                      className="mt-5 rounded-lg border border-[#8e6428] bg-[#d2a860] py-3 active:opacity-80"
                    >
                      <Text className="text-center text-sm font-black text-[#4b2e1f]">閉じる</Text>
                    </Pressable>
                  </Pressable>
                </Pressable>
              </View>
            ) : null}
          </SafeAreaView>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  deckCarouselLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 8,
    paddingTop: 0,
  },
  deckCarouselCard: {
    width: 340,
    height: 360,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  deckCarouselImage: {
    width: 300,
    height: 320,
  },
  deckFallbackBadge: {
    width: 300,
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckFallbackChar: {
    fontSize: 108,
    fontWeight: '900',
    color: '#f7e9c5',
  },
});
