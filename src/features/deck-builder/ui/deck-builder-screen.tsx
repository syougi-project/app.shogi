import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View, ScrollView } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { AppLoadingScreen } from '@/components/organism/app-loading-screen';
import { deckBuilderAssets, deckBuilderPreloadTargets } from '@/constants/deck-builder-assets';
import { homeAssets } from '@/constants/home-assets';
import {
  DECK_BUILDER_HEADER_ACTION_GAP,
  DECK_BUILDER_HEADER_ACTIONS_MARGIN_RIGHT,
} from '@/features/deck-builder/ui/deck-builder-layout';
import { DeckBuilderBackButton } from '@/features/deck-builder/ui/parts/deck-builder-back-button';
import { DeckBuilderHelpButton } from '@/features/deck-builder/ui/parts/deck-builder-help-button';
import { DeckBuilderHelpModal } from '@/features/deck-builder/ui/parts/deck-builder-help-modal';
import { UiScreenShell } from '@/components/organism/ui-screen-shell';
import { isBossPiece } from '@/features/deck-builder/lib/boss-pieces';
import {
  isPieceBannedFromMyDeck,
  useDeckBuilderScreen,
} from '@/features/deck-builder/ui/use-deck-builder-screen';
import { navigateBackOrReplace } from '@/lib/navigation/safe-router-back';
import { useAssetPreload } from '@/hooks/common/use-asset-preload';
import { useAuthSession } from '@/hooks/common/auth-session-context';
import { useScreenBgm } from '@/hooks/common/use-screen-bgm';
import { playSe } from '@/lib/audio/audio-manager';
import { resolvePieceImageSource } from '@/lib/piece-image';
import { getDeckBuilderPieceCost } from '@/features/deck-builder/lib/deck-builder-piece-cost';
import { saveOnlineMatchSetupFromDeck } from '@/lib/online-match/save-online-match-setup-from-deck';

const BOARD_SIZE = 9;
const BOARD_VIEWBOX = 900;
const BOARD_PADDING = 36;
const BOARD_INNER = BOARD_VIEWBOX - BOARD_PADDING * 2;
const BOARD_CELL = BOARD_INNER / BOARD_SIZE;
const BOARD_PADDING_RATIO = BOARD_PADDING / BOARD_VIEWBOX;
const BOARD_CELL_INNER_RATIO = 1 / BOARD_SIZE;
const PLACED_PIECE_OFFSET_X = 0;
const PLACED_PIECE_OFFSET_Y = -2;
const BOARD_CELL_DOUBLE_TAP_MS = 320;

type DeckBuilderScreenProps = {
  mode?: 'default' | 'online-match-setup';
};

export function DeckBuilderScreen({ mode = 'default' }: DeckBuilderScreenProps) {
  const router = useRouter();
  const { accessToken } = useAuthSession();
  const vm = useDeckBuilderScreen();
  const {
    placeSelectedPieceAt,
    removePieceAt,
    isValidPlacementAt,
    selectedPieceForPlacement,
    openPieceDetail,
  } = vm;
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const lastBoardCellTapRef = useRef<{ row: number; col: number; time: number } | null>(null);
  const [applyBattleBusy, setApplyBattleBusy] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const remotePieceUrls = useMemo(
    () =>
      vm.ownedPieces
        .map((piece) => piece.imageSignedUrl)
        .filter((url): url is string => typeof url === 'string' && url.length > 0),
    [vm.ownedPieces],
  );
  const { isReady: areAssetsReady } = useAssetPreload(
    [...deckBuilderPreloadTargets, ...remotePieceUrls],
    {
      enabled: !vm.isLoading,
    },
  );
  useScreenBgm('deckBuilder');
  const resolveDeckPieceImageSource = useCallback(
    (piece: {
      pieceId?: number;
      pieceCode?: string | null;
      char?: string | null;
      imageSignedUrl?: string | null;
    }) =>
      resolvePieceImageSource(piece) ??
      (piece.imageSignedUrl ? ({ uri: piece.imageSignedUrl } as const) : null),
    [],
  );
  const formattedDeckTotalCost = Number.isFinite(vm.deckTotalCost) ? `${vm.deckTotalCost}` : '0';
  const isOnlineMatchSetup = mode === 'online-match-setup';
  const screenTitle = isOnlineMatchSetup ? '対戦準備' : 'マイデッキ作成';
  const screenSubtitle = isOnlineMatchSetup
    ? 'オンライン対戦の初期盤面を試しながら整える'
    : '駒を配置して保存';
  const paletteDescription = isOnlineMatchSetup
    ? '所持駒からオンライン対戦用の並びを試せます。今はマイデッキ編集UIを流用しています。'
    : '所持駒（駒を選択して緑マスをタップで配置・盤上の駒をダブルタップでデッキから外す）。';
  const applyButtonTitle = isOnlineMatchSetup ? '対戦準備として反映' : '反映';
  const applyButtonSubtitle = isOnlineMatchSetup
    ? '現在の盤面をオンライン対戦の準備用として試す'
    : '現在の盤面をマイデッキとして対戦に使用';
  const appliedSuccessMessage = isOnlineMatchSetup
    ? '対戦準備の盤面として反映されました。'
    : '反映されました';

  const persistOnlineMatchSetup = useCallback(async () => {
    await saveOnlineMatchSetupFromDeck(vm.boardPlacements, accessToken ?? undefined);
  }, [accessToken, vm.boardPlacements]);

  const goToMatching = useCallback(() => {
    router.replace('/matching');
  }, [router]);

  const handleBoardCellPress = useCallback(
    (row: number, col: number, hasPiece: boolean) => {
      const now = Date.now();
      const lastTap = lastBoardCellTapRef.current;
      const isDoubleTap =
        hasPiece &&
        lastTap != null &&
        lastTap.row === row &&
        lastTap.col === col &&
        now - lastTap.time < BOARD_CELL_DOUBLE_TAP_MS;

      if (isDoubleTap) {
        lastBoardCellTapRef.current = null;
        setActiveCell({ row, col });
        removePieceAt(row, col);
        void playSe('cancel');
        return;
      }

      lastBoardCellTapRef.current = { row, col, time: now };
      setActiveCell({ row, col });
      void playSe('tap');

      if (hasPiece && !selectedPieceForPlacement) {
        return;
      }

      placeSelectedPieceAt(row, col);
    },
    [placeSelectedPieceAt, removePieceAt, selectedPieceForPlacement],
  );

  if (vm.isLoading || !areAssetsReady) {
    return <AppLoadingScreen imageSource={homeAssets.loadingImage} />;
  }

  return (
    <UiScreenShell
      title={screenTitle}
      subtitle={screenSubtitle}
      compactHeader
      hideBackButton
      fullBleedBackgroundSource={deckBuilderAssets.bg}
      rightAction={
        <View
          style={{
            marginRight: DECK_BUILDER_HEADER_ACTIONS_MARGIN_RIGHT,
            flexDirection: 'row',
            alignItems: 'center',
            gap: DECK_BUILDER_HEADER_ACTION_GAP,
          }}
        >
          <DeckBuilderHelpButton
            onPress={() => {
              void playSe('tap');
              setHelpModalOpen(true);
            }}
          />
          <DeckBuilderBackButton
            onPress={() => {
              void playSe('tap');
              navigateBackOrReplace(router, '/home');
            }}
          />
        </View>
      }
    >
      <View>
        <View className="relative w-full self-center" style={{ aspectRatio: 1 }}>
          <Svg width="100%" height="100%" viewBox={`0 0 ${BOARD_VIEWBOX} ${BOARD_VIEWBOX}`}>
            <Rect x={0} y={0} width={BOARD_VIEWBOX} height={BOARD_VIEWBOX} fill="#deb887" />
            <Rect
              x={BOARD_PADDING}
              y={BOARD_PADDING}
              width={BOARD_INNER}
              height={BOARD_INNER}
              fill="#e8c88e"
              stroke="#7a4b20"
              strokeWidth={2}
            />
            {Array.from({ length: BOARD_SIZE + 1 }).map((_, i) => {
              const p = BOARD_PADDING + BOARD_CELL * i;
              return (
                <Line
                  key={`v-${i}`}
                  x1={p}
                  y1={BOARD_PADDING}
                  x2={p}
                  y2={BOARD_PADDING + BOARD_INNER}
                  stroke="#6b3f1a"
                  strokeWidth={1.5}
                />
              );
            })}
            {Array.from({ length: BOARD_SIZE + 1 }).map((_, i) => {
              const p = BOARD_PADDING + BOARD_CELL * i;
              return (
                <Line
                  key={`h-${i}`}
                  x1={BOARD_PADDING}
                  y1={p}
                  x2={BOARD_PADDING + BOARD_INNER}
                  y2={p}
                  stroke="#6b3f1a"
                  strokeWidth={1.5}
                />
              );
            })}
          </Svg>
          <View
            className="absolute"
            style={{
              top: `${BOARD_PADDING_RATIO * 100}%`,
              left: `${BOARD_PADDING_RATIO * 100}%`,
              width: `${(BOARD_INNER / BOARD_VIEWBOX) * 100}%`,
              height: `${(BOARD_INNER / BOARD_VIEWBOX) * 100}%`,
            }}
          >
            <Svg
              width="100%"
              height="100%"
              viewBox={`0 0 ${BOARD_INNER} ${BOARD_INNER}`}
              style={{ position: 'absolute', top: 0, left: 0 }}
              pointerEvents="none"
            >
              {selectedPieceForPlacement
                ? Array.from({ length: BOARD_SIZE }, (_, row) =>
                    Array.from({ length: BOARD_SIZE }, (_, col) => {
                      if (!isValidPlacementAt(row, col)) return null;
                      return (
                        <Rect
                          key={`place-hl-${row}-${col}`}
                          x={col * BOARD_CELL}
                          y={row * BOARD_CELL}
                          width={BOARD_CELL}
                          height={BOARD_CELL}
                          fill="rgba(34, 197, 94, 0.32)"
                        />
                      );
                    }),
                  ).flat()
                : null}
              {vm.isDeckFormationIncomplete
                ? vm.emptyRequiredDeckCells.map((cell) => (
                    <Rect
                      key={`required-empty-${cell.row}-${cell.col}`}
                      x={cell.col * BOARD_CELL}
                      y={cell.row * BOARD_CELL}
                      width={BOARD_CELL}
                      height={BOARD_CELL}
                      fill="rgba(239, 68, 68, 0.42)"
                    />
                  ))
                : null}
              {activeCell ? (
                <Rect
                  x={activeCell.col * BOARD_CELL}
                  y={activeCell.row * BOARD_CELL}
                  width={BOARD_CELL}
                  height={BOARD_CELL}
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth={4}
                />
              ) : null}
            </Svg>
            {Array.from({ length: BOARD_SIZE }).map((_, row) =>
              Array.from({ length: BOARD_SIZE }).map((__, col) => {
                const placement =
                  vm.boardPlacements.find((cell) => cell.row === row && cell.col === col) ?? null;
                return (
                  <Pressable
                    key={`cell-${row}-${col}`}
                    className="absolute items-center justify-center overflow-visible"
                    style={{
                      top: `${row * BOARD_CELL_INNER_RATIO * 100}%`,
                      left: `${col * BOARD_CELL_INNER_RATIO * 100}%`,
                      width: `${BOARD_CELL_INNER_RATIO * 100}%`,
                      height: `${BOARD_CELL_INNER_RATIO * 100}%`,
                    }}
                    delayLongPress={420}
                    onPress={() => {
                      handleBoardCellPress(row, col, placement != null);
                    }}
                    onLongPress={placement ? () => openPieceDetail(placement.piece) : undefined}
                  >
                    {placement ? (
                      resolveDeckPieceImageSource(placement.piece) ? (
                        <Image
                          source={resolveDeckPieceImageSource(placement.piece)!}
                          contentFit="contain"
                          style={{
                            width: '140%',
                            height: '140%',
                            transform: [
                              { translateX: PLACED_PIECE_OFFSET_X },
                              { translateY: PLACED_PIECE_OFFSET_Y },
                            ],
                          }}
                        />
                      ) : (
                        <Text className="text-base font-black text-[#2f1b14]">
                          {placement.piece.char}
                        </Text>
                      )
                    ) : null}
                  </Pressable>
                );
              }),
            )}
          </View>
        </View>
        <View className="mt-2 items-end">
          {vm.isDeckFormationIncomplete ? (
            <Text className="mb-1 text-right text-xs font-black text-[#fecaca]">
              {vm.deckRequiredCellMessage}
            </Text>
          ) : null}
          <Text className="text-right text-xs font-black text-white">
            合計コスト{' '}
            <Text
              className={
                vm.isDeckCostOverLimit ? 'font-black text-[#ff4444]' : 'font-black text-white'
              }
            >
              {formattedDeckTotalCost}
            </Text>
            {` / ${vm.deckCostLimit}`}
          </Text>
          <Text className="mt-0.5 text-right text-xs font-black text-white">
            {`特殊駒 ${vm.deckSpecialPieceCount}個`}
          </Text>
        </View>
      </View>

      {/* 所持駒パレット */}
      <View className="mt-4 rounded-xl border border-[#8b0000]/30 bg-white p-3">
        <Text className="text-sm font-black text-[#2f1b14]">{paletteDescription}</Text>
        <View className="mt-2 flex-row flex-wrap gap-2">
          {vm.ownedPieces.map((piece) => {
            const remaining = vm.getRemainingCount(piece);
            const outOfStock = remaining <= 0;
            const bannedFromDeck = isPieceBannedFromMyDeck(piece);
            const bossPiece = isBossPiece({ char: piece.char, name: piece.name });
            const cost = getDeckBuilderPieceCost(piece.char, piece.name);
            const paletteKey =
              typeof piece.pieceId === 'number'
                ? `id-${piece.pieceId}`
                : `c-${piece.char}-n-${(piece.name ?? '').slice(0, 24)}`;
            return (
              <Pressable
                key={paletteKey}
                disabled={bannedFromDeck}
                onPress={() => {
                  if (bannedFromDeck) return;
                  void playSe('tap');
                  vm.selectPieceForPlacement(piece);
                }}
                onLongPress={() => {
                  vm.openPieceDetail(piece);
                }}
                className={`relative h-20 w-16 items-center justify-start pt-1 active:scale-95 ${
                  vm.selectedPieceForPlacement?.pieceId === piece.pieceId
                    ? 'rounded-md border border-[#8b0000]/50 bg-[#fff7e6]'
                    : ''
                } ${outOfStock ? 'opacity-45' : ''} ${bannedFromDeck ? 'opacity-40' : ''}`}
              >
                {bossPiece ? (
                  <View className="absolute right-0 top-0 z-10 rounded bg-[#7f1d1d] px-1 py-0.5">
                    <Text className="text-[8px] font-black text-[#fde68a]">ボス</Text>
                  </View>
                ) : null}
                {resolveDeckPieceImageSource(piece) ? (
                  <Image
                    source={resolveDeckPieceImageSource(piece)!}
                    contentFit="contain"
                    style={{ width: 60, height: 60 }}
                  />
                ) : (
                  <Text className="text-lg font-black text-[#2f1b14]">{piece.char}</Text>
                )}
                <Text className="mt-1 text-[10px] font-black text-[#7f1d1d]">{`コスト ${cost}`}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 操作ボタン */}
      <View className="mt-4 flex-row gap-2">
        <Pressable
          onPress={() => {
            void playSe('tap');
            vm.openDefaultModal();
          }}
          className="h-20 flex-1 items-center justify-center rounded-xl border-2 border-[#8b0000]/40 bg-white px-3 active:scale-95"
        >
          <Text className="text-center text-base font-black text-[#2f1b14]">デフォルト</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void playSe('tap');
            vm.openLoadModal();
          }}
          className="h-20 flex-1 items-center justify-center rounded-xl border-2 border-[#8b0000]/40 bg-white px-3 active:scale-95"
        >
          <Text className="text-center text-base font-black text-[#2f1b14]">読込</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (vm.isDeckFormationIncomplete) {
              void playSe('cancel');
              Alert.alert('保存できません', vm.deckRequiredCellMessage);
              return;
            }
            if (vm.isDeckCostOverLimit) {
              void playSe('cancel');
              Alert.alert(
                '保存できません',
                `合計コストが上限（${vm.deckCostLimit}）を超えています。配置を調整してください。`,
              );
              return;
            }
            void playSe('confirm');
            vm.openSaveModal();
          }}
          className={`h-20 flex-1 items-center justify-center rounded-xl px-3 active:scale-95 ${
            vm.cannotApplyOrSaveDeck ? 'bg-neutral-400' : 'bg-[#8b0000]'
          }`}
        >
          <Text className="text-center text-base font-black text-[#ffe6a5]">保存</Text>
        </Pressable>
      </View>

      <Pressable
        disabled={vm.cannotApplyOrSaveDeck || applyBattleBusy}
        onPress={() => {
          if (vm.isDeckFormationIncomplete) {
            void playSe('cancel');
            Alert.alert('反映できません', vm.deckRequiredCellMessage);
            return;
          }
          if (vm.isDeckCostOverLimit) {
            void playSe('cancel');
            Alert.alert(
              '反映できません',
              `合計コストが上限（${vm.deckCostLimit}）を超えています。配置を調整してください。`,
            );
            return;
          }
          void playSe('confirm');
          setApplyBattleBusy(true);
          void (async () => {
            if (!isOnlineMatchSetup) {
              return vm.applyAsBattleDeck();
            }
            await persistOnlineMatchSetup();
            return true;
          })()
            .then((ok) => {
              if (ok) {
                Alert.alert(appliedSuccessMessage);
              } else {
                Alert.alert('反映に失敗しました', '通信または保存処理を確認してください。');
              }
            })
            .catch((error: unknown) => {
              const message =
                error instanceof Error ? error.message : '通信または保存処理を確認してください。';
              Alert.alert('反映に失敗しました', message);
            })
            .finally(() => {
              setApplyBattleBusy(false);
            });
        }}
        className={`mt-2 h-14 items-center justify-center rounded-xl px-3 active:scale-95 ${
          vm.cannotApplyOrSaveDeck || applyBattleBusy ? 'bg-neutral-400' : 'bg-[#166534]'
        }`}
      >
        {applyBattleBusy ? (
          <Text className="text-center text-base font-black text-white">反映中…</Text>
        ) : (
          <View>
            <Text className="text-center text-base font-black text-white">{applyButtonTitle}</Text>
            <Text className="mt-0.5 text-center text-[11px] font-bold text-white/90">
              {applyButtonSubtitle}
            </Text>
          </View>
        )}
      </Pressable>

      {isOnlineMatchSetup ? (
        <Pressable
          disabled={vm.cannotApplyOrSaveDeck || applyBattleBusy}
          onPress={() => {
            if (vm.isDeckFormationIncomplete) {
              void playSe('cancel');
              Alert.alert('マッチングできません', vm.deckRequiredCellMessage);
              return;
            }
            if (vm.isDeckCostOverLimit) {
              void playSe('cancel');
              Alert.alert(
                'マッチングできません',
                `合計コストが上限（${vm.deckCostLimit}）を超えています。配置を調整してください。`,
              );
              return;
            }
            void playSe('confirm');
            setApplyBattleBusy(true);
            void persistOnlineMatchSetup()
              .then(() => {
                goToMatching();
              })
              .catch((error: unknown) => {
                const message =
                  error instanceof Error ? error.message : '通信または保存処理を確認してください。';
                Alert.alert('マッチングを開始できません', message);
              })
              .finally(() => {
                setApplyBattleBusy(false);
              });
          }}
          className={`mt-2 h-14 items-center justify-center rounded-xl px-3 active:scale-95 ${
            vm.cannotApplyOrSaveDeck || applyBattleBusy ? 'bg-neutral-400' : 'bg-[#1d4ed8]'
          }`}
        >
          {applyBattleBusy ? (
            <Text className="text-center text-base font-black text-white">準備中…</Text>
          ) : (
            <View>
              <Text className="text-center text-base font-black text-white">マッチング開始</Text>
              <Text className="mt-0.5 text-center text-[11px] font-bold text-white/90">
                盤面を保存して対戦相手を探す
              </Text>
            </View>
          )}
        </Pressable>
      ) : null}

      {/* 駒詳細モーダル */}
      <Modal
        visible={!!vm.selectedPiece}
        transparent
        animationType="fade"
        onRequestClose={vm.closePieceDetail}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-6">
          <View className="w-full max-w-sm rounded-xl bg-[#fff7e6] p-4">
            {vm.selectedPiece && resolveDeckPieceImageSource(vm.selectedPiece) ? (
              <Image
                source={resolveDeckPieceImageSource(vm.selectedPiece)!}
                contentFit="contain"
                style={{ width: 56, height: 56, alignSelf: 'center' }}
              />
            ) : (
              <Text className="text-3xl font-black text-[#2f1b14] text-center">
                {vm.selectedPiece?.char}
              </Text>
            )}
            <Text className="mt-1 text-base font-black text-[#2f1b14] text-center">
              {vm.selectedPiece?.name}
            </Text>
            {vm.selectedPiece &&
            isBossPiece({ char: vm.selectedPiece.char, name: vm.selectedPiece.name }) ? (
              <View className="mt-2 rounded-lg bg-[#78350f] px-3 py-2">
                <Text className="text-center text-xs font-black text-[#fde68a]">
                  ボス駒のためマイデッキには配置できません
                </Text>
              </View>
            ) : null}
            <Text className="mt-3 text-xs font-black text-[#7f1d1d]">【スキル】</Text>
            <Text className="mt-1 text-sm leading-5 text-[#1f2937]">{vm.selectedPiece?.skill}</Text>
            <Text className="mt-3 text-xs font-black text-[#7f1d1d]">【移動】</Text>
            <Text className="mt-1 text-sm leading-5 text-[#1f2937]">{vm.selectedPiece?.move}</Text>
            <Pressable
              onPress={() => {
                void playSe('cancel');
                vm.closePieceDetail();
              }}
              className="mt-4 rounded-md bg-[#8b0000] px-3 py-2"
            >
              <Text className="text-center font-black text-[#ffd56a]">閉じる</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <DeckBuilderHelpModal
        visible={helpModalOpen}
        onClose={() => {
          void playSe('cancel');
          setHelpModalOpen(false);
        }}
      />

      {/* デッキ保存モーダル */}
      <Modal
        visible={vm.saveModalOpen}
        transparent
        animationType="fade"
        onRequestClose={vm.closeSaveModal}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-6">
          <View className="w-full max-w-sm rounded-xl bg-[#fff7e6] p-4">
            <Text className="text-base font-black text-[#2f1b14]">デッキを保存</Text>
            <TextInput
              value={vm.deckName}
              onChangeText={vm.setDeckName}
              placeholder="デッキ名を入力"
              placeholderTextColor="#9ca3af"
              className="mt-3 rounded-md border border-[#8b0000]/30 bg-white px-3 py-2 text-sm text-[#1f2937]"
            />
            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={() => {
                  if (vm.isDeckFormationIncomplete) {
                    void playSe('cancel');
                    Alert.alert('保存できません', vm.deckRequiredCellMessage);
                    return;
                  }
                  if (vm.isDeckCostOverLimit) {
                    void playSe('cancel');
                    Alert.alert(
                      '保存できません',
                      `合計コストが上限（${vm.deckCostLimit}）を超えています。配置を調整してください。`,
                    );
                    return;
                  }
                  void playSe('confirm');
                  vm.saveDeck();
                }}
                className="flex-1 rounded-md bg-[#8b0000] px-3 py-2"
              >
                <Text className="text-center font-black text-[#ffd56a]">保存</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void playSe('cancel');
                  vm.closeSaveModal();
                }}
                className="flex-1 rounded-md border border-[#8b0000] bg-white px-3 py-2"
              >
                <Text className="text-center font-black text-[#7f1d1d]">キャンセル</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* デッキ読込モーダル */}
      <Modal
        visible={vm.loadModalOpen}
        transparent
        animationType="fade"
        onRequestClose={vm.closeLoadModal}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-6">
          <View className="w-full max-w-sm rounded-xl bg-[#fff7e6] p-4">
            <Text className="text-base font-black text-[#2f1b14]">デッキを読込</Text>
            <ScrollView className="mt-3 max-h-64">
              {vm.savedDecks.length === 0 ? (
                <Text className="text-sm text-[#6b4532]">保存済みデッキがありません。</Text>
              ) : (
                vm.savedDecks.map((deck) => (
                  <View
                    key={deck.id}
                    className="mb-2 flex-row items-center justify-between rounded-lg border border-[#8b0000]/20 bg-white px-3 py-2"
                  >
                    <View className="flex-1">
                      <Text className="text-sm font-black text-[#2f1b14]">{deck.name}</Text>
                      <Text className="text-xs text-[#6b4532]">{deck.savedAt}</Text>
                    </View>
                    <Pressable
                      onPress={() => {
                        void playSe('cancel');
                        vm.deleteDeck(deck.id);
                      }}
                      className="ml-2 rounded px-2 py-1 active:opacity-70"
                      style={{ backgroundColor: '#fee2e2' }}
                    >
                      <Text className="text-xs font-black text-[#b91c1c]">削除</Text>
                    </Pressable>
                  </View>
                ))
              )}
            </ScrollView>
            <Pressable
              onPress={() => {
                void playSe('cancel');
                vm.closeLoadModal();
              }}
              className="mt-3 rounded-md border border-[#8b0000] bg-white px-3 py-2"
            >
              <Text className="text-center font-black text-[#7f1d1d]">閉じる</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* デフォルト読込確認モーダル */}
      <Modal
        visible={vm.defaultModalOpen}
        transparent
        animationType="fade"
        onRequestClose={vm.closeDefaultModal}
      >
        <View className="flex-1 items-center justify-center bg-black/45 px-6">
          <View className="w-full max-w-xs rounded-xl bg-[#fff7e6] p-4">
            <Text className="text-center text-base font-black text-[#2f1b14]">
              デフォルトデッキを読込みますか？
            </Text>
            <Text className="mt-1 text-center text-xs text-[#6b4532]">
              現在の配置がリセットされます。
            </Text>
            <View className="mt-4 flex-row gap-2">
              <Pressable
                onPress={() => {
                  void playSe('confirm');
                  vm.loadDefault();
                }}
                className="flex-1 rounded-md bg-[#8b0000] px-3 py-2"
              >
                <Text className="text-center font-black text-[#ffd56a]">はい</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void playSe('cancel');
                  vm.closeDefaultModal();
                }}
                className="flex-1 rounded-md border border-[#8b0000] bg-white px-3 py-2"
              >
                <Text className="text-center font-black text-[#7f1d1d]">いいえ</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </UiScreenShell>
  );
}
