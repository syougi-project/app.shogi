import { Image } from 'expo-image';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLoadingScreen } from '@/components/organism/app-loading-screen';
import { TapToStartScreen } from '@/components/organism/tap-to-start-screen';
import { homeAssets } from '@/constants/home-assets';
import type { Announcement } from '@/domain/models/announcement';
import { TITLE_TO_HOME_LOADING_MS } from '@/constants/loading';
import {
  TITLE_INFORMATION_BUTTON_HEIGHT,
  TITLE_INFORMATION_BUTTON_LEFT,
  TITLE_INFORMATION_BUTTON_TOP,
  TITLE_INFORMATION_BUTTON_WIDTH,
  TITLE_SETTINGS_BUTTON_HEIGHT,
  TITLE_SETTINGS_BUTTON_LEFT,
  TITLE_SETTINGS_BUTTON_TOP,
  TITLE_SETTINGS_BUTTON_WIDTH,
  TITLE_TUTORIAL_BUTTON_BOTTOM,
  TITLE_TUTORIAL_BUTTON_HEIGHT,
  TITLE_TUTORIAL_BUTTON_RIGHT,
  TITLE_TUTORIAL_BUTTON_WIDTH,
} from '@/features/home/ui/title-layout';
import { useAssetPreload } from '@/hooks/common/use-asset-preload';
import { useScreenBgm } from '@/hooks/common/use-screen-bgm';
import { playSe } from '@/lib/audio/audio-manager';
import {
  DeleteAccountConfirmModal,
  TitleSettingsModal,
} from '@/features/home/ui/title-settings-modal';
import { useAuthSession } from '@/hooks/common/auth-session-context';
import { createLoadAnnouncementsUseCase } from '@/usecases/announcement/create-announcement-usecases';
import { deleteAccount } from '@/usecases/auth/delete-account-usecase';

function formatAnnouncementDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function TitleScreen() {
  const router = useRouter();
  const { accessToken, reinitializeSession } = useAuthSession();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<'first' | 'second' | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [isAnnouncementLoading, setIsAnnouncementLoading] = useState(false);
  const [announcementError, setAnnouncementError] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadAnnouncementsUseCase = useMemo(() => createLoadAnnouncementsUseCase(), []);

  const preloadTargets = useMemo(() => {
    const optionalTargets = Array.isArray(homeAssets.preloadTargets)
      ? homeAssets.preloadTargets
      : [];
    return [
      homeAssets.titleBackground,
      homeAssets.informationButton,
      homeAssets.settingsButton,
      homeAssets.tutorialButton,
      ...optionalTargets,
    ].filter(Boolean);
  }, []);

  const { isReady } = useAssetPreload(preloadTargets);
  useScreenBgm('title');

  useEffect(() => {
    return () => {
      if (transitionTimer.current) {
        clearTimeout(transitionTimer.current);
      }
    };
  }, []);

  function startHomeTransition() {
    if (isTransitioning) {
      return;
    }
    void playSe('tap');
    setIsTransitioning(true);
    transitionTimer.current = setTimeout(() => {
      router.replace('/home');
    }, TITLE_TO_HOME_LOADING_MS);
  }

  function openTutorial() {
    if (isTransitioning) {
      return;
    }
    void playSe('tap');
    router.push('/tutorial' as Href);
  }

  async function openAnnouncements() {
    if (isTransitioning) {
      return;
    }
    void playSe('tap');
    setIsAnnouncementOpen(true);
    setIsAnnouncementLoading(true);
    setAnnouncementError(null);

    try {
      const result = await loadAnnouncementsUseCase.execute();
      setAnnouncements(result);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'お知らせを取得できませんでした。';
      setAnnouncementError(message);
    } finally {
      setIsAnnouncementLoading(false);
    }
  }

  function closeAnnouncements() {
    void playSe('cancel');
    setIsAnnouncementOpen(false);
  }

  function openSettings() {
    if (isTransitioning) {
      return;
    }
    void playSe('tap');
    setIsSettingsOpen(true);
  }

  function closeSettings() {
    void playSe('cancel');
    setIsSettingsOpen(false);
  }

  function startChangeUsername() {
    void playSe('tap');
    setIsSettingsOpen(false);
  }

  function startDeleteAccount() {
    void playSe('tap');
    setIsSettingsOpen(false);
    setDeleteAccountError(null);
    setDeleteConfirmStep('first');
  }

  function cancelDeleteAccount() {
    if (isDeletingAccount) {
      return;
    }
    void playSe('cancel');
    setDeleteConfirmStep(null);
    setDeleteAccountError(null);
  }

  function confirmDeleteAccountFirst() {
    void playSe('tap');
    setDeleteAccountError(null);
    setDeleteConfirmStep('second');
  }

  function backToDeleteAccountFirst() {
    void playSe('tap');
    setDeleteAccountError(null);
    setDeleteConfirmStep('first');
  }

  async function confirmDeleteAccountSecond() {
    if (!accessToken || isDeletingAccount) {
      return;
    }
    void playSe('tap');
    setIsDeletingAccount(true);
    setDeleteAccountError(null);

    try {
      await deleteAccount(accessToken);
      setDeleteConfirmStep(null);
      await reinitializeSession();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'アカウントの削除に失敗しました。';
      setDeleteAccountError(message);
    } finally {
      setIsDeletingAccount(false);
    }
  }

  if (!isReady || isTransitioning) {
    return <AppLoadingScreen />;
  }

  return (
    <ImageBackground source={homeAssets.titleBackground} resizeMode="cover" className="flex-1">
      <SafeAreaView className="flex-1">
        <View className="flex-1 bg-black/20">
          <TapToStartScreen onPressStart={startHomeTransition} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="チュートリアル画面を開く"
            onPress={openTutorial}
            style={{
              bottom: TITLE_TUTORIAL_BUTTON_BOTTOM,
              right: TITLE_TUTORIAL_BUTTON_RIGHT,
              width: TITLE_TUTORIAL_BUTTON_WIDTH,
              height: TITLE_TUTORIAL_BUTTON_HEIGHT,
            }}
            className="absolute z-10 active:scale-95"
          >
            <Image
              source={homeAssets.tutorialButton}
              contentFit="contain"
              style={{ width: '100%', height: '100%' }}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="お知らせを開く"
            onPress={openAnnouncements}
            style={{
              position: 'absolute',
              zIndex: 10,
              left: TITLE_INFORMATION_BUTTON_LEFT,
              top: TITLE_INFORMATION_BUTTON_TOP,
              width: TITLE_INFORMATION_BUTTON_WIDTH,
              height: TITLE_INFORMATION_BUTTON_HEIGHT,
            }}
            className="active:scale-95"
          >
            <Image
              source={homeAssets.informationButton}
              contentFit="contain"
              style={{ width: '100%', height: '100%' }}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="設定を開く"
            onPress={openSettings}
            style={{
              position: 'absolute',
              zIndex: 10,
              left: TITLE_SETTINGS_BUTTON_LEFT,
              top: TITLE_SETTINGS_BUTTON_TOP,
              width: TITLE_SETTINGS_BUTTON_WIDTH,
              height: TITLE_SETTINGS_BUTTON_HEIGHT,
            }}
            className="active:scale-95"
          >
            <Image
              source={homeAssets.settingsButton}
              contentFit="contain"
              style={{ width: '100%', height: '100%' }}
            />
          </Pressable>
          <Modal
            animationType="fade"
            transparent
            visible={isAnnouncementOpen}
            onRequestClose={closeAnnouncements}
          >
            <View className="flex-1 justify-center bg-black/70 px-5">
              <View className="max-h-[70%] rounded-lg border border-white/25 bg-[#16110d] p-5">
                <View className="mb-4 flex-row items-center justify-between">
                  <Text className="text-xl font-bold text-white">お知らせ</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="お知らせを閉じる"
                    onPress={closeAnnouncements}
                    className="rounded-md border border-white/40 px-4 py-2 active:scale-95"
                  >
                    <Text className="font-bold text-white">閉じる</Text>
                  </Pressable>
                </View>
                {isAnnouncementLoading ? (
                  <View className="items-center py-8">
                    <ActivityIndicator color="#ffffff" />
                  </View>
                ) : announcementError ? (
                  <Text className="text-sm leading-6 text-red-200">{announcementError}</Text>
                ) : announcements.length === 0 ? (
                  <Text className="text-sm leading-6 text-white/80">
                    現在お知らせはありません。
                  </Text>
                ) : (
                  <ScrollView className="pr-1">
                    {announcements.map((announcement) => (
                      <View
                        key={announcement.id}
                        className="mb-4 border-b border-white/15 pb-4 last:mb-0 last:border-b-0"
                      >
                        <Text className="mb-1 text-base font-bold text-white">
                          {announcement.title}
                        </Text>
                        <Text className="mb-2 text-xs text-white/60">
                          {formatAnnouncementDate(announcement.publishedAt)}
                        </Text>
                        <Text className="text-sm leading-6 text-white/85">
                          {announcement.contents}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
          </Modal>
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
            onConfirmSecond={confirmDeleteAccountSecond}
            onBackToFirst={backToDeleteAccountFirst}
          />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}
