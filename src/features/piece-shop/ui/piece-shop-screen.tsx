import { Image } from 'expo-image';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLoadingScreen } from '@/components/organism/app-loading-screen';
import { homeAssets } from '@/constants/home-assets';
import { pieceShopAssets, pieceShopPreloadTargets } from '@/constants/piece-shop-assets';
import {
  PIECE_SHOP_BACK_BUTTON_MARGIN_RIGHT,
  PIECE_SHOP_CURRENCY_MARGIN_LEFT,
  PIECE_SHOP_CURRENCY_MARGIN_TOP,
  PIECE_SHOP_HEADER_PADDING_TOP,
} from '@/features/piece-shop/ui/piece-shop-layout';
import { PieceShopBackButton } from '@/features/piece-shop/ui/parts/piece-shop-back-button';
import { PieceShopCurrencyBar } from '@/features/piece-shop/ui/parts/piece-shop-currency-bar';
import { usePieceShopScreen } from '@/features/piece-shop/ui/use-piece-shop-screen';
import { useAssetPreload } from '@/hooks/common/use-asset-preload';
import { useScreenBgm } from '@/hooks/common/use-screen-bgm';
import { playSe } from '@/lib/audio/audio-manager';
import { useSafeRouterBack } from '@/lib/navigation/safe-router-back';
import { ShopItem } from '@/domain/models/shop';

const piecePlacementByKey: Record<
  ShopItem['key'],
  { width: number; height: number; marginTop: number; offsetX?: number; offsetY?: number }
> = {
  走: { width: 170, height: 194, marginTop: 70, offsetX: 0, offsetY: 0 },
  種: { width: 168, height: 190, marginTop: 52, offsetX: 3, offsetY: 0 },
  麒: { width: 172, height: 194, marginTop: 60, offsetX: -10, offsetY: -5 },
  舞: { width: 186, height: 210, marginTop: 32, offsetX: 6, offsetY: -40 },
  P: { width: 186, height: 210, marginTop: 32, offsetX: 0, offsetY: -44 },
  鳴: { width: 186, height: 210, marginTop: 32, offsetX: -6, offsetY: -34 },
};

export function PieceShopScreen() {
  const goBack = useSafeRouterBack('/home');
  const vm = usePieceShopScreen();
  const { isReady: areAssetsReady } = useAssetPreload([...pieceShopPreloadTargets]);
  useScreenBgm('shop');

  function openPurchase(piece: ShopItem) {
    if (vm.owned.includes(piece.key)) {
      void playSe('cancel');
      return;
    }
    void playSe('confirm');
    vm.openConfirm(piece);
  }

  if (vm.isLoading || !areAssetsReady) {
    return <AppLoadingScreen imageSource={homeAssets.loadingImage} />;
  }

  return (
    <SafeAreaView className="flex-1 bg-[#140b06]" edges={['top', 'left', 'right', 'bottom']}>
      <View className="flex-1">
        <View className="absolute inset-0">
          <Image
            source={pieceShopAssets.background}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </View>

        <View className="flex-1 px-4 pb-4">
          <View className="z-20" style={{ paddingTop: PIECE_SHOP_HEADER_PADDING_TOP }}>
            <View
              className="items-end"
              style={{ marginRight: PIECE_SHOP_BACK_BUTTON_MARGIN_RIGHT }}
            >
              <PieceShopBackButton
                onPress={() => {
                  void playSe('tap');
                  goBack();
                }}
              />
            </View>
            <View
              className="items-start"
              style={{
                marginTop: PIECE_SHOP_CURRENCY_MARGIN_TOP,
                marginLeft: PIECE_SHOP_CURRENCY_MARGIN_LEFT,
              }}
            >
              <PieceShopCurrencyBar pawnCurrency={vm.pawnCurrency} goldCurrency={vm.goldCurrency} />
            </View>
          </View>
          <ScrollView className="mt-2 flex-1" contentContainerClassName="pb-6">
            <View className="flex-row flex-wrap justify-between">
              {vm.items.map((piece, index) => {
                const isOwned = vm.owned.includes(piece.key);
                const priceText =
                  piece.costType === 'pawn' ? `歩 ${piece.cost}` : `金 ${piece.cost}`;
                const isTopRow = index < 3;
                const placement = piecePlacementByKey[piece.key];

                return (
                  <View key={piece.key} className={`w-[31%] ${isTopRow ? 'mt-10' : 'mt-8'}`}>
                    <Pressable
                      onPress={() => {
                        void playSe('tap');
                        vm.openDetail(piece);
                      }}
                      className="h-[248px] items-center active:scale-95"
                    >
                      <Image
                        source={pieceShopAssets.pieces[piece.key]}
                        contentFit="contain"
                        style={{
                          width: placement.width,
                          height: placement.height,
                          marginTop: placement.marginTop,
                          transform: [
                            { translateX: placement.offsetX ?? 0 },
                            { translateY: placement.offsetY ?? 0 },
                          ],
                        }}
                      />
                    </Pressable>

                    <Pressable
                      onPress={() => openPurchase(piece)}
                      disabled={isOwned}
                      className={`${isTopRow ? 'mt-[-36px]' : 'mt-[-54px]'} rounded-md border border-[#8B0000] px-2 py-2 ${isOwned ? 'bg-[#4b3a2f]' : 'bg-[#8f2a1a]'}`}
                    >
                      <Text
                        className={`text-center text-xs font-black ${isOwned ? 'text-[#d9c8b3]' : 'text-[#ffe1a3]'}`}
                      >
                        {isOwned ? '購入済み' : `購入 ${priceText}`}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>

      <Modal
        visible={!!vm.detailPiece}
        transparent
        animationType="fade"
        onRequestClose={vm.closeDetail}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-6">
          <View className="w-full max-w-sm rounded-xl border border-[#f0c98a]/45 bg-[#2a170d]/95 p-4">
            <Text className="text-xl font-black text-[#ffe2af]">{vm.detailPiece?.key}</Text>
            <Text className="mt-3 text-xs font-black text-[#f2c98b]">【スキルの説明】</Text>
            <Text className="mt-1 text-sm text-[#f4e8d6]">{vm.detailPiece?.desc}</Text>
            <Text className="mt-3 text-xs font-black text-[#f2c98b]">【移動範囲】</Text>
            <Text className="mt-1 text-sm text-[#f4e8d6]">{vm.detailPiece?.move}</Text>
            <Text className="mt-3 text-xs font-black text-[#f2c98b]">【購入コスト】</Text>
            <Text className="mt-1 text-sm text-[#f4e8d6]">
              {vm.detailPiece
                ? `${vm.detailPiece.costType === 'pawn' ? '歩' : '金'} ${vm.detailPiece.cost}`
                : ''}
            </Text>
            <Pressable
              onPress={() => {
                void playSe('cancel');
                vm.closeDetail();
              }}
              className="mt-4 rounded-md bg-[#8f2a1a] px-3 py-2"
            >
              <Text className="text-center font-black text-[#ffe2ac]">閉じる</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!vm.confirmPiece}
        transparent
        animationType="fade"
        onRequestClose={vm.closeConfirm}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-6">
          <View className="w-full max-w-xs rounded-xl border border-[#f0c98a]/45 bg-[#2a170d]/95 p-4">
            <Text className="text-center text-base font-black text-[#ffe2af]">購入しますか</Text>
            <Text className="mt-2 text-center text-sm text-[#f4e8d6]">
              {vm.confirmPiece
                ? `${vm.confirmPiece.key} (${vm.confirmPiece.costType === 'pawn' ? '歩' : '金'} ${vm.confirmPiece.cost})`
                : ''}
            </Text>
            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={() => {
                  void playSe('confirm');
                  void vm.purchase();
                }}
                className="flex-1 rounded-md bg-[#8f2a1a] px-3 py-2"
              >
                <Text className="text-center font-black text-[#ffe2ac]">はい</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void playSe('cancel');
                  vm.closeConfirm();
                }}
                className="flex-1 rounded-md border border-[#b37a45] bg-[#f6ead8] px-3 py-2"
              >
                <Text className="text-center font-black text-[#6b2a16]">いいえ</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
