import { Image } from 'expo-image';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLoadingScreen } from '@/components/organism/app-loading-screen';
import { GlobalHomeHud } from '@/components/organism/global-home-hud';
import { homeAssets } from '@/constants/home-assets';
import { pieceInfoAssets, pieceInfoPreloadTargets } from '@/constants/piece-info-assets';
import { isBossPiece } from '@/features/deck-builder/lib/boss-pieces';
import { PieceSwipeCarousel } from '@/features/piece-info/ui/components/piece-swipe-carousel';
import { PieceInfoBackButton } from '@/features/piece-info/ui/parts/piece-info-back-button';
import { usePieceCatalogScreen } from '@/features/piece-info/ui/use-piece-catalog-screen';
import { useAssetPreload } from '@/hooks/common/use-asset-preload';
import { useSafeRouterBack } from '@/lib/navigation/safe-router-back';
import { useScreenBgm } from '@/hooks/common/use-screen-bgm';
import { playSe } from '@/lib/audio/audio-manager';
import { MoveVector } from '@/domain/models/piece';

// 5x5グリッド（中心 [2][2] = 駒位置）
const GRID_SIZE = 5;
const CENTER = 2;

function MovementGrid({ vectors, isRepeatable }: { vectors: MoveVector[]; isRepeatable: boolean }) {
  // グリッドセルに移動可能かどうかをマーク
  const grid: boolean[][] = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(false));

  for (const { dx, dy, maxStep } of vectors) {
    const steps = isRepeatable ? GRID_SIZE - 1 : Math.min(maxStep, CENTER);
    for (let s = 1; s <= steps; s++) {
      const row = CENTER + dy * s;
      const col = CENTER + dx * s;
      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        grid[row][col] = true;
      }
    }
  }

  return (
    <View className="items-center">
      <Text className="text-xs font-black text-[#7f1d1d]">【移動範囲】</Text>
      <View className="mt-2 border border-[#8b0000]/30">
        {grid.map((row, rowIdx) => (
          <View key={rowIdx} className="flex-row">
            {row.map((canMove, colIdx) => {
              const isCenter = rowIdx === CENTER && colIdx === CENTER;
              return (
                <View
                  key={colIdx}
                  style={{ width: 36, height: 36 }}
                  className={`items-center justify-center border border-[#8b0000]/20 ${
                    isCenter ? 'bg-[#8b0000]' : canMove ? 'bg-[#fcd34d]/70' : 'bg-white/60'
                  }`}
                >
                  {isCenter && <Text className="text-xs font-black text-white">駒</Text>}
                  {canMove && !isCenter && <Text className="text-xs text-[#92400e]">●</Text>}
                </View>
              );
            })}
          </View>
        ))}
      </View>
      {isRepeatable && (
        <Text className="mt-1 text-[10px] text-[#6b4532]">● = 何マスでも移動可</Text>
      )}
    </View>
  );
}

export function PieceInfoScreen() {
  const goBack = useSafeRouterBack('/home');
  const { piece, items, index, total, selectIndex, isLoading } = usePieceCatalogScreen();
  const carouselItems = useMemo(() => (items.length > 0 ? items : [piece]), [items, piece]);
  const remotePieceUrls = useMemo(
    () =>
      items
        .map((item) => item.imageSignedUrl)
        .filter((url): url is string => typeof url === 'string' && url.length > 0),
    [items],
  );
  const { isReady: areAssetsReady } = useAssetPreload(
    [...pieceInfoPreloadTargets, ...remotePieceUrls],
    {
      enabled: !isLoading,
    },
  );
  useScreenBgm('catalog');

  if (isLoading || !areAssetsReady) {
    return <AppLoadingScreen imageSource={homeAssets.loadingImage} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['left', 'right', 'bottom']}>
      <GlobalHomeHud />
      <View className="flex-1">
        <View className="absolute inset-0">
          <Image
            source={pieceInfoAssets.background}
            contentFit="fill"
            style={{ width: '100%', height: '100%' }}
          />
        </View>

        <PieceInfoBackButton
          onPress={() => {
            void playSe('tap');
            goBack();
          }}
        />

        <View className="mt-4 flex-1 px-4 pb-2">
          <Text className="text-lg font-black text-[#2f1b14]">駒情報</Text>

          <View className="mt-1 items-center justify-center">
            <Text
              className="text-[32px] text-[#2f1b14]"
              style={{
                fontFamily: 'ShipporiMincho_700Bold',
                textShadowColor: 'rgba(47, 27, 20, 0.22)',
                textShadowOffset: { width: 0.6, height: 0.6 },
                textShadowRadius: 0.4,
              }}
            >
              駒図鑑
            </Text>
          </View>

          <ScrollView
            className="mt-1 flex-1"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            contentContainerStyle={{ paddingBottom: 16 }}
          >
            <View style={{ transform: [{ translateY: -24 }] }}>
              <View className="-mx-4 -mt-2 h-[300px] justify-center">
                <View style={{ transform: [{ translateY: -26 }] }}>
                  <PieceSwipeCarousel
                    items={carouselItems}
                    selectedIndex={index}
                    onSelectIndex={selectIndex}
                    onChangeEffect={() => {
                      void playSe('tap');
                    }}
                    itemWidth={144}
                    itemGap={0}
                    cellHeight={300}
                    activeImageSize={228}
                    inactiveImageSize={164}
                    activeScale={1}
                    inactiveScale={0.92}
                  />
                </View>
              </View>
              <Text className="mt-1 text-center text-sm font-bold text-[#6b4532]">{`${index + 1} / ${total}`}</Text>

              <View className="-mt-20 rounded-xl border border-[#8b0000]/50 bg-white/90 p-4">
                {isBossPiece({
                  char: piece.char,
                  name: piece.name,
                  pieceCode: piece.pieceCode,
                }) ? (
                  <View className="mb-3 rounded-lg border border-[#78350f] bg-[#78350f]/95 px-3 py-2">
                    <Text className="text-center text-xs font-black text-[#fde68a]">
                      ボス駒（ステージ専用・マイデッキには入れません）
                    </Text>
                  </View>
                ) : null}
                {piece.moveVectors.length > 0 && (
                  <MovementGrid vectors={piece.moveVectors} isRepeatable={piece.isRepeatable} />
                )}

                <Text className="mt-3 text-sm font-black text-[#7f1d1d]">【スキル】</Text>
                <Text className="mt-1 text-base leading-6 text-[#1f2937]">{piece.skill}</Text>

                <Text className="mt-3 text-sm font-black text-[#7f1d1d]">【移動】</Text>
                <Text className="mt-1 text-base leading-6 text-[#1f2937]">{piece.move}</Text>
                {piece.canJump && (
                  <Text className="mt-1 text-xs font-bold text-[#92400e]">
                    障害物を飛び越えて移動可能
                  </Text>
                )}
              </View>
            </View>

            <View className="h-2" />
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}
