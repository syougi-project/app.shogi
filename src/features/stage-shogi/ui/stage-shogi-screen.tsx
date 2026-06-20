import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { AppLoadingScreen } from '@/components/organism/app-loading-screen';
import { UiScreenShell } from '@/components/organism/ui-screen-shell';
import { homeAssets } from '@/constants/home-assets';
import { getNormalDungeonStagePreviewSource } from '@/constants/normal-dungeon-stage-previews';
import { skillParticleAssetPreloadTargets } from '@/constants/skill-particle-assets';
import { stageShogiBattleAssetPreloadTargets } from '@/constants/stage-shogi-battle-assets';
import { StageShogiHandSkillParticleLayer } from '@/features/stage-shogi/ui/components/stage-shogi-hand-skill-particle-layer';
import { StageShogiBoard } from '@/features/stage-shogi/ui/components/stage-shogi-board';
import { StageShogiHandsRow } from '@/features/stage-shogi/ui/components/stage-shogi-hands-row';
import {
  StageShogiHouseSkillModal,
  StageShogiInspectModal,
  StageShogiPromotionModal,
  StageShogiResultOverlay,
  StageShogiSkillToast,
  StageShogiTimeActionModal,
} from '@/features/stage-shogi/ui/components/stage-shogi-modals';
import { StageShogiBackButton } from '@/features/stage-shogi/ui/parts/stage-shogi-back-button';
import { useStageShogiScreen } from '@/features/stage-shogi/ui/use-stage-shogi-screen';
import { useAssetPreload } from '@/hooks/common/use-asset-preload';
import { playSe } from '@/lib/audio/audio-manager';
import { useSafeRouterBack } from '@/lib/navigation/safe-router-back';
import { useAuthSession } from '@/hooks/common/use-auth-session';
import { useScreenBgm } from '@/hooks/common/use-screen-bgm';
import { listLocalPieceImageModules } from '@/lib/piece-image';

export function StageShogiScreen() {
  const goBack = useSafeRouterBack('/stage-select');
  const params = useLocalSearchParams<{ stage?: string }>();
  const stageParam = Array.isArray(params.stage) ? params.stage[0] : params.stage;
  const { isReady: isAuthReady, userId } = useAuthSession();
  const vm = useStageShogiScreen(stageParam, isAuthReady ? (userId ?? 'guest') : undefined);
  const { isReady: areAssetsReady } = useAssetPreload([
    ...listLocalPieceImageModules(),
    ...stageShogiBattleAssetPreloadTargets,
    ...skillParticleAssetPreloadTargets,
  ]);
  useScreenBgm('battle');

  useFocusEffect(
    useCallback(() => {
      const onHardwareBack = () => {
        goBack();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
      return () => subscription.remove();
    }, [goBack]),
  );

  if (vm.isLoading || !areAssetsReady || vm.isBootstrappingBattle) {
    return <AppLoadingScreen imageSource={homeAssets.loadingImage} />;
  }

  const stageNoFromParam = Number(stageParam);
  const stageNoFromLabel = (() => {
    const raw = (vm.snapshot.stageLabel ?? '').replace(/\s+/g, ' ').trim();
    const m = /^STAGE\s+(\d+)$/i.exec(raw) ?? /^ステージ\s*(\d+)$/i.exec(raw);
    return m ? Number(m[1]) : Number.NaN;
  })();
  const stageNo =
    Number.isFinite(stageNoFromParam) && stageNoFromParam > 0
      ? stageNoFromParam
      : Number.isFinite(stageNoFromLabel) && stageNoFromLabel > 0
        ? stageNoFromLabel
        : Number.NaN;

  const forceBlackBackground = Number.isFinite(stageNo) && stageNo === 33;
  const forceBlueBackground = Number.isFinite(stageNo) && stageNo === 43;
  const forceGreenBackground = Number.isFinite(stageNo) && stageNo === 45;
  const stageBattleBackgroundSource =
    Number.isFinite(stageNo) && stageNo > 0 && stageNo !== 33 && stageNo !== 43 && stageNo !== 45
      ? getNormalDungeonStagePreviewSource(stageNo)
      : null;

  return (
    <View className="flex-1">
      <UiScreenShell
        title="Stage Shogi"
        subtitle="バトル画面（AI接続）"
        hideTitleText
        hideBackButton
        plainHeader
        homeButtonTextClassName="text-white"
        fullBleedBackgroundSource={stageBattleBackgroundSource ?? undefined}
        useBlackBackgroundWhenNoImage={forceBlackBackground}
        noImageBackgroundColor={
          forceGreenBackground ? '#166534' : forceBlueBackground ? '#1e40af' : undefined
        }
      >
        <View className="relative">
          <View className="rounded-xl border-2 border-accent bg-[#f3ead3] p-3">
            <Text className="text-sm font-bold text-[#6b4532]">{`TURN ${vm.moveNo}`}</Text>
            <Text className="text-base font-black text-ink">{`${vm.snapshot.stageLabel}  手番: ${vm.sideToMove === 'player' ? 'あなた' : 'CPU'}`}</Text>
            {vm.aiError ? <Text className="mt-1 text-xs text-red-600">{vm.aiError}</Text> : null}
          </View>

          <View className="relative -mx-2 mt-20 mb-20">
            <View className="absolute -top-16 left-0 right-1 z-10 flex-row items-center justify-between gap-2">
              <View className="relative flex-1">
                <StageShogiHandsRow
                  side="enemy"
                  hands={vm.hands}
                  pieceSfenMapping={vm.pieceSfenMapping}
                  pieceDefsByCode={vm.pieceDefsByCode}
                  selectedDropPieceCode={vm.selectedDropPieceCode}
                  sideToMove={vm.sideToMove}
                  isAiThinking={vm.isAiThinking}
                  isCreatingGame={vm.isCreatingGame}
                  isFinished={vm.isFinished}
                  hasPendingPromotion={vm.pendingPromotion !== null}
                  pieceCatalog={vm.pieceCatalog}
                  compact
                  onPressPiece={vm.handleHandPiecePress}
                  onLongPressPiece={vm.handleHandPieceLongPress}
                />
                <StageShogiHandSkillParticleLayer
                  effects={vm.skillVisualEffects}
                  side="enemy"
                  hands={vm.hands}
                  pieceCatalog={vm.pieceCatalog}
                  onEffectFinished={vm.handleSkillVisualEffectFinished}
                />
              </View>
              <View className="pointer-events-none rounded-md border border-blue-700 bg-white/80 px-2 py-1">
                <Text className="text-lg font-black text-blue-700">後手</Text>
              </View>
            </View>
            <View className="absolute -bottom-16 left-0 right-1 z-10 flex-row items-center justify-between gap-2">
              <View className="relative flex-1">
                <StageShogiHandsRow
                  side="player"
                  hands={vm.hands}
                  pieceSfenMapping={vm.pieceSfenMapping}
                  pieceDefsByCode={vm.pieceDefsByCode}
                  selectedDropPieceCode={vm.selectedDropPieceCode}
                  sideToMove={vm.sideToMove}
                  isAiThinking={vm.isAiThinking}
                  isCreatingGame={vm.isCreatingGame}
                  isFinished={vm.isFinished}
                  hasPendingPromotion={vm.pendingPromotion !== null}
                  pieceCatalog={vm.pieceCatalog}
                  compact
                  onPressPiece={vm.handleHandPiecePress}
                  onLongPressPiece={vm.handleHandPieceLongPress}
                />
                <StageShogiHandSkillParticleLayer
                  effects={vm.skillVisualEffects}
                  side="player"
                  hands={vm.hands}
                  pieceCatalog={vm.pieceCatalog}
                  onEffectFinished={vm.handleSkillVisualEffectFinished}
                />
              </View>
              <View className="pointer-events-none rounded-md border border-blue-700 bg-white/80 px-2 py-1">
                <Text className="text-lg font-black text-blue-700">先手</Text>
              </View>
            </View>

            <StageShogiBoard
              pieces={vm.pieces}
              failedImageKeys={vm.failedImageKeys}
              onPieceImageError={vm.handlePieceImageError}
              spriteEpoch={vm.boardSpriteEpoch}
              promotionImageFlash={vm.promotionImageFlash}
              selectedCell={vm.selectedCell}
              legalTargets={vm.legalTargets}
              aiPreviewTarget={vm.aiPreviewTarget}
              enemyPreviewTargets={vm.enemyPreviewTargets}
              poisonHazardCells={vm.poisonHazardCells}
              rockObstacleCells={vm.rockObstacleCells}
              batsuHazardCells={vm.batsuHazardCells}
              arrowCells={vm.arrowCells}
              thornHazardCells={vm.thornHazardCells}
              safeRoomHazardCells={vm.safeRoomHazardCells}
              henEdgeHighlightCells={vm.henEdgeHighlightCells}
              skillVisualEffects={vm.skillVisualEffects}
              onSkillVisualEffectFinished={vm.handleSkillVisualEffectFinished}
              onCellPress={vm.handleBoardCellPress}
              onCellLongPress={vm.handleCellLongPress}
            />
          </View>

          <StageShogiPromotionModal
            pendingPromotion={vm.pendingPromotion}
            onCommit={vm.commitPendingPromotion}
          />
          <StageShogiTimeActionModal
            pending={vm.pendingTimeActionCell}
            onConfirm={vm.confirmTimeAction}
            onCancel={vm.cancelTimeAction}
          />
          <StageShogiHouseSkillModal
            pending={vm.pendingHouseSkillCell}
            onUseSkill={vm.confirmHouseSkill}
            onCancel={vm.cancelHouseSkill}
          />
          <StageShogiSkillToast text={vm.skillActivationText} />

          {vm.pendingSatoriEnemyPick && vm.pendingSatoriEnemyPick.length > 1 ? (
            <Text className="mt-2 text-xs font-bold text-[#1d4ed8]">
              「悟」のスキル：味方が移動したあと、行動を止める敵駒のマスをタップしてください（王・玉は選べません）
            </Text>
          ) : null}

          {vm.pendingHeartAllyPick && vm.pendingHeartAllyPick.length > 1 ? (
            <Text className="mt-2 text-xs font-bold text-amber-900">
              「心」のスキル：味方が移動したあと、2ターン捕獲されないように守る味方駒のマスをタップしてください（王・玉は選べません）
            </Text>
          ) : null}

          {vm.selectedDropPieceCode && vm.legalTargets.length === 0 ? (
            <Text className="mt-2 text-xs text-red-600">その駒は打てる場所がありません。</Text>
          ) : null}

          <StageShogiInspectModal
            inspectingPiece={vm.inspectingPiece}
            onClose={vm.closeInspectingPiece}
          />

          {vm.isAiThinking ? (
            <View className="absolute bottom-3 right-3 rounded-md bg-black/65 px-2 py-1">
              <Text className="text-xs font-bold text-white">Loading...</Text>
            </View>
          ) : null}

          <StageShogiResultOverlay winner={vm.winner} clearReward={vm.clearReward} />
        </View>
      </UiScreenShell>
      <StageShogiBackButton
        onPress={() => {
          void playSe('tap');
          goBack();
        }}
      />
    </View>
  );
}
