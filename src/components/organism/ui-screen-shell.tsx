import { useRouter } from 'expo-router';
import { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  ImageBackground,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/atom/back-button';
import { GlobalHomeHud } from '@/components/organism/global-home-hud';
import { navigateBackOrReplace } from '@/lib/navigation/safe-router-back';
import { playSe } from '@/lib/audio/audio-manager';

type UiScreenShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  hideBackButton?: boolean;
  /** 指定時は既定のテキスト「戻る」ボタンの代わりに表示する */
  backAction?: ReactNode;
  rightAction?: ReactNode;
  hideTitleText?: boolean;
  /** タイトル帯を1行にまとめて縦幅を抑える（デッキビルダー等） */
  compactHeader?: boolean;
  plainHeader?: boolean;
  homeButtonTextClassName?: string;
  /** ユーザーバー（GlobalHomeHud）直下〜画面下端までを覆う背景。タイトル帯・スクロール領域の下にまで伸びる */
  fullBleedBackgroundSource?: ImageSourcePropType;
  useBlackBackgroundWhenNoImage?: boolean;
  noImageBackgroundClassName?: string;
  /** 画像なし時の下地色（`noImageBackgroundClassName` より確実に反映させたいとき） */
  noImageBackgroundColor?: string;
};

export function UiScreenShell({
  title,
  subtitle,
  children,
  hideBackButton = false,
  backAction,
  rightAction,
  hideTitleText = false,
  compactHeader = false,
  plainHeader = false,
  homeButtonTextClassName = 'text-ink',
  fullBleedBackgroundSource,
  useBlackBackgroundWhenNoImage = false,
  noImageBackgroundClassName,
  noImageBackgroundColor,
}: UiScreenShellProps) {
  const router = useRouter();

  const header = compactHeader ? (
    <View className="bg-black/35 px-3 py-1">
      <View className="flex-row items-center justify-between gap-2">
        {!hideTitleText ? (
          <View className="min-w-0 flex-1 pr-2">
            <Text className="text-lg font-black text-white" numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text className="mt-0.5 text-[11px] leading-4 text-white/85" numberOfLines={2}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="flex-1" />
        )}
        {rightAction ??
          (hideBackButton
            ? null
            : (backAction ?? (
                <BackButton
                  onPress={() => {
                    void playSe('tap');
                    navigateBackOrReplace(router, '/home');
                  }}
                />
              ))) ??
          (hideBackButton ? null : (
            <Pressable
              onPress={() => {
                void playSe('tap');
                router.replace('/home');
              }}
              className="rounded-md border border-accent px-3 py-1 active:scale-95"
            >
              <Text className={`text-sm font-bold ${homeButtonTextClassName}`}>ホーム</Text>
            </Pressable>
          ))}
      </View>
    </View>
  ) : (
    <View
      className={
        plainHeader
          ? `px-4 ${hideBackButton ? 'py-1.5' : 'py-2'}`
          : `border-b-2 border-accent/50 bg-[#f2e4c2] px-4 ${hideBackButton ? 'py-1.5' : 'py-3'}`
      }
    >
      <View className="flex-row items-center justify-between">
        {hideBackButton ? (
          <View />
        ) : (
          (backAction ?? (
            <BackButton
              onPress={() => {
                void playSe('tap');
                navigateBackOrReplace(router, '/home');
              }}
            />
          ))
        )}
        {rightAction ?? (
          <Pressable
            onPress={() => {
              void playSe('tap');
              router.replace('/home');
            }}
            className="rounded-md border border-accent px-3 py-1 active:scale-95"
          >
            <Text className={`text-sm font-bold ${homeButtonTextClassName}`}>ホーム</Text>
          </Pressable>
        )}
      </View>
      {!hideTitleText ? (
        <>
          <Text className={`${hideBackButton ? 'mt-0' : 'mt-3'} text-2xl font-black text-ink`}>
            {title}
          </Text>
          {subtitle ? (
            <Text className={`${hideBackButton ? 'mt-0' : 'mt-1'} text-sm text-[#6b4532]`}>
              {subtitle}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );

  const scroll = (
    <ScrollView
      className="flex-1"
      contentContainerClassName={compactHeader ? 'px-3 pt-2 pb-10' : 'p-4 pb-10'}
    >
      {children}
    </ScrollView>
  );

  const shellBackgroundStyle: StyleProp<ViewStyle> | undefined =
    !fullBleedBackgroundSource && noImageBackgroundColor
      ? { backgroundColor: noImageBackgroundColor }
      : undefined;

  const shellClassName = (() => {
    if (fullBleedBackgroundSource) return 'flex-1 bg-black';
    if (noImageBackgroundColor) return 'flex-1';
    if (noImageBackgroundClassName) return `flex-1 ${noImageBackgroundClassName}`;
    if (useBlackBackgroundWhenNoImage) return 'flex-1 bg-black';
    return 'flex-1 bg-paper';
  })();

  return (
    <SafeAreaView
      className={shellClassName}
      style={shellBackgroundStyle}
      edges={['left', 'right', 'bottom']}
    >
      <GlobalHomeHud />
      {fullBleedBackgroundSource ? (
        <ImageBackground
          source={fullBleedBackgroundSource}
          resizeMode="cover"
          style={{ flex: 1, width: '100%' }}
        >
          <View className="flex-1">
            {header}
            {scroll}
          </View>
        </ImageBackground>
      ) : (
        <>
          {header}
          {scroll}
        </>
      )}
    </SafeAreaView>
  );
}
