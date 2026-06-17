import { MaterialIcons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppLoadingScreen } from '@/components/organism/app-loading-screen';
import {
  onlineBattleHtmlAssets,
  onlineBattleHtmlPreloadTargets,
} from '@/constants/online-battle-html-assets';
import { skillParticleAssetPreloadTargets } from '@/constants/skill-particle-assets';
import { stageShogiBattleAssetPreloadTargets } from '@/constants/stage-shogi-battle-assets';
import { StageShogiHandSkillParticleLayer } from '@/features/stage-shogi/ui/components/stage-shogi-hand-skill-particle-layer';
import { BattleEndResultOverlay } from '@/features/stage-shogi/ui/components/battle-end-result-overlay';
import { homeAssets } from '@/constants/home-assets';
import { OnlineBattleBoard } from '@/features/online-battle/ui/components/online-battle-board';
import {
  StageShogiHouseSkillModal,
  StageShogiInspectModal,
  StageShogiTimeActionModal,
} from '@/features/stage-shogi/ui/components/stage-shogi-modals';
import { parseOnlineBattleDisplay } from '@/features/online-battle/lib/parse-session-labels';
import { useOnlineBattleScreen } from '@/features/online-battle/ui/use-online-battle-screen';
import { StageShogiHandsRow } from '@/features/stage-shogi/ui/components/stage-shogi-hands-row';
import { patchHomeSnapshotRating } from '@/hooks/common/home-snapshot-store';
import { useAssetPreload } from '@/hooks/common/use-asset-preload';
import { useScreenBgm } from '@/hooks/common/use-screen-bgm';
import { playSe } from '@/lib/audio/audio-manager';

/** HTML `.app` の max-width に合わせる */
const HTML_APP_MAX_WIDTH = 540;

export function OnlineBattleScreen() {
  const router = useRouter();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ matchId?: string; opponent?: string; rating?: string }>();
  const vm = useOnlineBattleScreen(params.matchId);
  const {
    session,
    isLoading,
    disconnect,
    pieces,
    hands,
    poisonHazardCells,
    rockObstacleCells,
    batsuHazardCells,
    thornHazardCells,
    safeRoomHazardCells,
    role,
    pieceCatalog,
    pieceDefsByCode,
    promotedPieceDefsByCode,
    pieceSfenMapping,
    selectedCell,
    selectedDropPieceCode,
    legalTargets,
    enemyPreviewTargets,
    pendingPromotion,
    pendingTimeActionCell,
    pendingHouseSkillCell,
    pendingSatoriEnemyPick,
    pendingHeartAllyPick,
    moveError,
    turnSecondsLeft,
    isTurnTimerVisible,
    canInteract,
    handleCellPress,
    handleCellLongPress,
    handleHandPiecePress,
    handleHandPieceLongPress,
    closeInspectingPiece,
    inspectingPiece,
    commitMove,
    setPendingPromotion,
    confirmTimeAction,
    cancelTimeAction,
    confirmHouseSkill,
    cancelHouseSkill,
    skillVisualEffects,
    handleSkillVisualEffectFinished,
  } = vm;
  const [isExitConfirmVisible, setIsExitConfirmVisible] = useState(false);
  const { isReady: areAssetsReady } = useAssetPreload([
    ...onlineBattleHtmlPreloadTargets,
    ...stageShogiBattleAssetPreloadTargets,
    ...skillParticleAssetPreloadTargets,
  ]);
  useScreenBgm('onlineBattle');

  const contentWidth = Math.min(windowWidth - 24, HTML_APP_MAX_WIDTH);
  const boardSize = Math.min(contentWidth - 8, HTML_APP_MAX_WIDTH);

  const display = parseOnlineBattleDisplay(session);

  const returnHomeAfterBattle = useCallback(() => {
    disconnect();
    if (session.pvpRatingAfter != null) {
      patchHomeSnapshotRating(session.pvpRatingAfter);
    }
    router.replace('/home');
  }, [disconnect, router, session.pvpRatingAfter]);

  const openExitConfirm = useCallback(() => {
    void playSe('cancel');
    if (session.winnerSide) {
      returnHomeAfterBattle();
      return;
    }
    setIsExitConfirmVisible(true);
  }, [returnHomeAfterBattle, session.winnerSide]);

  const cancelExit = useCallback(() => {
    void playSe('tap');
    setIsExitConfirmVisible(false);
  }, []);

  const confirmExit = useCallback(() => {
    void playSe('cancel');
    setIsExitConfirmVisible(false);
    disconnect();
    router.replace('/home');
  }, [disconnect, router]);

  if (isLoading || !areAssetsReady) {
    return <AppLoadingScreen imageSource={homeAssets.loadingImage} />;
  }

  return (
    <ImageBackground
      source={onlineBattleHtmlAssets.pageBackground}
      resizeMode="cover"
      style={styles.pageRoot}
    >
      <Stack.Screen options={{ gestureEnabled: false, fullScreenGestureEnabled: false }} />
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeTop}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 }]}
        >
          <View
            style={[
              styles.appColumn,
              {
                maxWidth: HTML_APP_MAX_WIDTH,
                width: '100%',
                alignSelf: 'center',
                position: 'relative',
                minHeight: Math.max(480, windowHeight * 0.55),
              },
            ]}
          >
            {/* HTML .header */}
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={session.winnerSide ? 'ホームに戻る' : '対局を終了する'}
                  onPress={openExitConfirm}
                  style={({ pressed }) => [styles.homeBackBtn, { opacity: pressed ? 0.85 : 1 }]}
                >
                  <MaterialIcons
                    name={session.winnerSide ? 'home' : 'logout'}
                    size={28}
                    color="#fff"
                  />
                </Pressable>
              </View>

              <View style={styles.ratingPanel}>
                <View style={styles.ratingCardOffsetLeft}>
                  <View style={styles.ratingCardInner}>
                    <Text style={styles.ratingLabel}>Opponent</Text>
                    <Text style={styles.ratingValue} numberOfLines={1}>
                      {display.opponentName}
                    </Text>
                    <Text style={styles.ratingMeta}>
                      レート <Text style={styles.ratingMetaStrong}>{display.opponentRating}</Text>
                    </Text>
                  </View>
                </View>
                <View style={styles.ratingCardOffsetRight}>
                  <View style={styles.ratingCardInner}>
                    <Text style={styles.ratingLabel}>You</Text>
                    <Text style={styles.ratingValue} numberOfLines={1}>
                      {display.playerName}
                    </Text>
                    <Text style={styles.ratingMeta}>
                      レート <Text style={styles.ratingMetaStrong}>{display.playerRating}</Text>
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {moveError ? <Text style={styles.moveErrorText}>{moveError}</Text> : null}

            {/* HTML .row: 盤 → サイド */}
            <View style={styles.rowColumn}>
              <View style={styles.boardWrap}>
                {role ? (
                  <OnlineBattleBoard
                    boardSize={boardSize}
                    boardImage={onlineBattleHtmlAssets.board}
                    pieces={pieces}
                    myRole={role}
                    selectedCell={selectedCell}
                    legalTargets={legalTargets}
                    enemyPreviewTargets={enemyPreviewTargets}
                    pieceDefsByCode={pieceDefsByCode}
                    promotedPieceDefsByCode={promotedPieceDefsByCode}
                    poisonHazardCells={poisonHazardCells}
                    rockObstacleCells={rockObstacleCells}
                    batsuHazardCells={batsuHazardCells}
                    thornHazardCells={thornHazardCells}
                    safeRoomHazardCells={safeRoomHazardCells}
                    canInteract={
                      canInteract ||
                      Boolean(pendingSatoriEnemyPick?.length) ||
                      Boolean(pendingHeartAllyPick?.length)
                    }
                    onCellPress={handleCellPress}
                    onCellLongPress={handleCellLongPress}
                    skillVisualEffects={skillVisualEffects}
                    onSkillVisualEffectFinished={handleSkillVisualEffectFinished}
                  />
                ) : null}
                {pendingSatoriEnemyPick && pendingSatoriEnemyPick.length > 1 ? (
                  <Text style={styles.skillHintSatori}>
                    「悟」のスキル：味方が移動したあと、行動を止める敵駒のマスをタップしてください（王・玉は選べません）
                  </Text>
                ) : null}
                {pendingHeartAllyPick && pendingHeartAllyPick.length > 1 ? (
                  <Text style={styles.skillHintHeart}>
                    「心」のスキル：味方が移動したあと、2ターン捕獲されないように守る味方駒のマスをタップしてください（王・玉は選べません）
                  </Text>
                ) : null}
                <View style={styles.statusBar}>
                  {isTurnTimerVisible ? (
                    <View
                      style={[
                        styles.turnTimerBadge,
                        session.isMyTurn
                          ? styles.turnTimerBadgeMine
                          : styles.turnTimerBadgeOpponent,
                        turnSecondsLeft <= 5 ? styles.turnTimerBadgeUrgent : null,
                      ]}
                    >
                      <Text style={styles.turnTimerValue}>{turnSecondsLeft}</Text>
                      <Text style={styles.turnTimerLabel}>秒</Text>
                    </View>
                  ) : null}
                  <Text style={styles.statusText}>{session.connectionStatus}</Text>
                </View>
              </View>

              <View style={[styles.side, { width: contentWidth }]}>
                <Text style={styles.sideHeading}>対戦情報</Text>
                <View style={styles.infoList}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoItemLabel}>ターン</Text>
                    <Text style={styles.infoItemValue}>{session.turnLabel}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoItemLabel}>ルーム</Text>
                    <Text style={styles.infoItemValue}>#{session.roomId}</Text>
                  </View>
                </View>

                <Text style={[styles.sideHeading, { marginTop: 12 }]}>あなたの持ち駒</Text>
                {pieceSfenMapping ? (
                  <View style={styles.handParticleWrap}>
                    <StageShogiHandsRow
                      side="player"
                      hands={hands}
                      pieceSfenMapping={pieceSfenMapping}
                      pieceDefsByCode={pieceDefsByCode}
                      selectedDropPieceCode={selectedDropPieceCode}
                      sideToMove="player"
                      isAiThinking={false}
                      isCreatingGame={false}
                      isFinished={Boolean(session.winnerSide)}
                      hasPendingPromotion={Boolean(pendingPromotion)}
                      pieceCatalog={pieceCatalog}
                      compact
                      onPressPiece={handleHandPiecePress}
                      onLongPressPiece={handleHandPieceLongPress}
                    />
                    <StageShogiHandSkillParticleLayer
                      effects={skillVisualEffects}
                      side="player"
                      hands={hands}
                      pieceCatalog={pieceCatalog}
                      onEffectFinished={handleSkillVisualEffectFinished}
                    />
                  </View>
                ) : (
                  <Text style={styles.handSummaryText}>{session.playerHandSummary}</Text>
                )}

                <Text style={[styles.sideHeading, { marginTop: 12 }]}>敵の持ち駒</Text>
                {pieceSfenMapping ? (
                  <View style={styles.handParticleWrap}>
                    <StageShogiHandsRow
                      side="enemy"
                      hands={hands}
                      pieceSfenMapping={pieceSfenMapping}
                      pieceDefsByCode={pieceDefsByCode}
                      selectedDropPieceCode={null}
                      sideToMove="player"
                      isAiThinking={false}
                      isCreatingGame={false}
                      isFinished={Boolean(session.winnerSide)}
                      hasPendingPromotion={false}
                      pieceCatalog={pieceCatalog}
                      compact
                      onPressPiece={() => undefined}
                      onLongPressPiece={handleHandPieceLongPress}
                    />
                    <StageShogiHandSkillParticleLayer
                      effects={skillVisualEffects}
                      side="enemy"
                      hands={hands}
                      pieceCatalog={pieceCatalog}
                      onEffectFinished={handleSkillVisualEffectFinished}
                    />
                  </View>
                ) : (
                  <Text style={styles.handSummaryText}>{session.opponentHandSummary}</Text>
                )}

                <Text style={[styles.sideHeading, { marginTop: 12 }]}>対戦ログ</Text>
                <View style={styles.logPanel}>
                  {session.logLines.length === 0 ? (
                    <Text style={styles.logLine}>
                      <Text style={styles.logStrong}>システム</Text> ログ待機中
                    </Text>
                  ) : (
                    session.logLines.map((line, index) => (
                      <Text key={`${index}-${line}`} style={styles.logLine}>
                        <Text style={styles.logStrong}>・</Text> {line}
                      </Text>
                    ))
                  )}
                </View>
              </View>
            </View>

            {session.winnerSide ? (
              <BattleEndResultOverlay
                winner={session.winnerSide}
                pvpRatingDelta={session.pvpRatingDelta}
                pvpRatingAfter={session.pvpRatingAfter}
                onPress={openExitConfirm}
              />
            ) : null}

            <StageShogiInspectModal
              inspectingPiece={inspectingPiece}
              onClose={closeInspectingPiece}
            />
            <StageShogiTimeActionModal
              pending={pendingTimeActionCell}
              onConfirm={confirmTimeAction}
              onCancel={cancelTimeAction}
            />
            <StageShogiHouseSkillModal
              pending={pendingHouseSkillCell}
              onUseSkill={confirmHouseSkill}
              onCancel={cancelHouseSkill}
            />

            <Modal visible={Boolean(pendingPromotion)} transparent animationType="fade">
              <View style={styles.promoOverlay}>
                <View style={styles.promoCard}>
                  <Text style={styles.promoTitle}>成りますか？</Text>
                  <View style={styles.promoButtons}>
                    <Pressable
                      style={[styles.promoBtn, styles.promoBtnPrimary]}
                      onPress={() => {
                        if (pendingPromotion) {
                          commitMove(pendingPromotion.promoteMove);
                          setPendingPromotion(null);
                        }
                      }}
                    >
                      <Text style={styles.promoBtnText}>成る</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.promoBtn, styles.promoBtnSecondary]}
                      onPress={() => {
                        if (pendingPromotion) {
                          commitMove(pendingPromotion.nonPromoteMove);
                          setPendingPromotion(null);
                        }
                      }}
                    >
                      <Text style={styles.promoBtnText}>成らない</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>

            <Modal visible={isExitConfirmVisible} transparent animationType="fade">
              <View style={styles.promoOverlay}>
                <View style={styles.promoCard}>
                  <Text style={styles.promoTitle}>対局を終了しますか？</Text>
                  <Text style={styles.exitConfirmText}>
                    終了するとあなたの負けとして記録され、相手の勝利になります。
                  </Text>
                  <View style={styles.promoButtons}>
                    <Pressable
                      style={[styles.promoBtn, styles.promoBtnSecondary]}
                      onPress={cancelExit}
                    >
                      <Text style={styles.promoBtnText}>続ける</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.promoBtn, styles.promoBtnDanger]}
                      onPress={confirmExit}
                    >
                      <Text style={styles.promoBtnText}>負けで終了</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>
          </View>
        </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  pageRoot: {
    flex: 1,
  },
  safeTop: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    alignItems: 'stretch',
  },
  appColumn: {},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 0,
  },
  headerLeft: {
    flexShrink: 1,
  },
  homeBackBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(139, 0, 0, 0.88)',
    padding: 10,
  },
  ratingPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginLeft: 'auto',
    justifyContent: 'flex-end',
    maxWidth: '100%',
  },
  ratingCardOffsetLeft: {
    transform: [{ translateX: -8 }],
  },
  ratingCardOffsetRight: {
    transform: [{ translateX: 8 }],
  },
  ratingCardInner: {
    minWidth: 160,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  ratingLabel: {
    fontSize: 12,
    color: '#fff',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  ratingValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginTop: 2,
  },
  ratingMeta: {
    fontSize: 12,
    color: '#fff',
    marginTop: 4,
  },
  ratingMetaStrong: {
    fontWeight: '700',
  },
  moveErrorText: {
    marginTop: 8,
    marginBottom: 4,
    color: '#fecaca',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  promoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  promoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    minWidth: 260,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    textAlign: 'center',
    marginBottom: 16,
  },
  exitConfirmText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  promoButtons: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  promoBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  promoBtnPrimary: {
    backgroundColor: '#2563eb',
  },
  promoBtnDanger: {
    backgroundColor: '#dc2626',
  },
  promoBtnSecondary: {
    backgroundColor: '#64748b',
  },
  promoBtnText: {
    color: '#fff',
    fontWeight: '800',
  },
  handSummaryText: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 20,
  },
  handParticleWrap: {
    position: 'relative',
    minHeight: 40,
  },
  rowColumn: {
    flexDirection: 'column',
    gap: 16,
    alignItems: 'stretch',
    marginTop: 4,
  },
  boardWrap: {
    position: 'relative',
    alignItems: 'center',
  },
  turnTimerBadge: {
    minWidth: 48,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 2,
    flexShrink: 0,
  },
  turnTimerBadgeMine: {
    backgroundColor: 'rgba(22, 101, 52, 0.92)',
  },
  turnTimerBadgeOpponent: {
    backgroundColor: 'rgba(120, 53, 15, 0.92)',
  },
  turnTimerBadgeUrgent: {
    backgroundColor: 'rgba(185, 28, 28, 0.95)',
  },
  turnTimerValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
  },
  turnTimerLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  statusBar: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(23, 162, 184, 0.95)',
    width: '100%',
    maxWidth: HTML_APP_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusText: {
    flex: 1,
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 14,
  },
  side: {
    alignSelf: 'center',
    backgroundColor: '#f7f9fc',
    borderWidth: 1,
    borderColor: '#e6edf5',
    borderRadius: 12,
    padding: 16,
  },
  sideHeading: {
    marginBottom: 12,
    fontSize: 16,
    fontWeight: '800',
    color: '#333',
  },
  infoList: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  infoItemLabel: {
    fontSize: 14,
    color: '#555',
  },
  infoItemValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  handPlaceholder: {
    minHeight: 48,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  logPanel: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 12,
    minHeight: 120,
    maxHeight: 240,
  },
  logLine: {
    fontSize: 13,
    color: '#f8fafc',
    opacity: 0.95,
    lineHeight: 20,
  },
  logStrong: {
    color: '#fff',
    fontWeight: '800',
    marginRight: 6,
  },
  skillHintSatori: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  skillHintHeart: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#92400e',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
