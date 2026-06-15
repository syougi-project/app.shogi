import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BoardCell } from '@/features/stage-shogi/domain/game-rules';
import type { BoardPiece } from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import {
  BOARD_INNER,
  BOARD_PIECE_SIZE_OVERRIDES,
  BOARD_PADDING_RATIO,
  BOARD_VIEWBOX,
  KING_PIECE_SIZE_PERCENT,
  NORMAL_PIECE_SIZE_PERCENT,
  collectStandardBaseCodesForLocalPromotedImage,
  getDisplayChar,
  getPieceImageSource,
  isEnemySide,
  isKingChar,
  isPromotedVisualPiece,
  localPromotedModuleFromBaseCodeCandidates,
  pieceCharFromCode,
  POISON_CELL_IMAGE_SOURCE,
  PRISON_CHAIN_IMAGE_SOURCE,
  ROCK_OBSTACLE_IMAGE_SOURCE,
  BATSU_CELL_IMAGE_SOURCE,
  CHRYSANTHEMUM_REVIVAL_IMAGE_SOURCE,
  THORN_CELL_IMAGE_SOURCE,
  preferBundledPromotedImageOverRemoteUrl,
  resolvePromotedImageSource,
} from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import { OnlineBattleSkillParticleLayer } from '@/features/online-battle/ui/components/online-battle-skill-particle-layer';
import type { SkillVisualEffect } from '@/domain/battle/skill-visual-effect';
import { toViewCoord } from '@/lib/matching-server/game-bridge';
import { normalizeWirePieceCode } from '@/lib/matching-server/piece-display';
import type { PlayerSide } from '@/domain/matching-server/protocol';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

const BOARD_SIZE = 9;

function isTargetCell(targets: BoardCell[], row: number, col: number) {
  return targets.some((t) => t.row === row && t.col === col);
}

export function OnlineBattleBoard(props: {
  boardSize: number;
  boardImage: number;
  pieces: BoardPiece[];
  myRole: PlayerSide;
  selectedCell: BoardCell | null;
  legalTargets: BoardCell[];
  enemyPreviewTargets?: BoardCell[];
  pieceDefsByCode: Record<string, PieceCatalogItem>;
  promotedPieceDefsByCode?: Record<string, PieceCatalogItem>;
  canInteract: boolean;
  poisonHazardCells?: BoardCell[];
  rockObstacleCells?: BoardCell[];
  batsuHazardCells?: BoardCell[];
  thornHazardCells?: BoardCell[];
  skillVisualEffects?: SkillVisualEffect[];
  onSkillVisualEffectFinished?: (effect: SkillVisualEffect) => void;
  onCellPress: (viewRow: number, viewCol: number) => void;
  onCellLongPress: (viewRow: number, viewCol: number) => void;
}) {
  const {
    boardSize,
    boardImage,
    pieces,
    myRole,
    selectedCell,
    legalTargets,
    enemyPreviewTargets = [],
    pieceDefsByCode,
    promotedPieceDefsByCode = {},
    canInteract,
    poisonHazardCells = [],
    rockObstacleCells = [],
    batsuHazardCells = [],
    thornHazardCells = [],
    skillVisualEffects = [],
    onSkillVisualEffectFinished,
    onCellPress,
    onCellLongPress,
  } = props;
  const boardInnerRatio = BOARD_INNER / BOARD_VIEWBOX;
  const boardInnerSize = boardSize * boardInnerRatio;
  const cellSize = boardInnerSize / BOARD_SIZE;

  const piecesByView = pieces.map((piece) => {
    const view = toViewCoord(piece.row, piece.col, myRole);
    return { ...piece, viewRow: view.row, viewCol: view.col };
  });

  const selectedView = selectedCell
    ? toViewCoord(selectedCell.row, selectedCell.col, myRole)
    : null;
  const targetsView = legalTargets.map((t) => toViewCoord(t.row, t.col, myRole));
  const enemyTargetsView = enemyPreviewTargets.map((t) => toViewCoord(t.row, t.col, myRole));
  const poisonHazardsView = poisonHazardCells.map((cell) => ({
    ...cell,
    ...toViewCoord(cell.row, cell.col, myRole),
  }));
  const rockObstaclesView = rockObstacleCells.map((cell) => ({
    ...cell,
    ...toViewCoord(cell.row, cell.col, myRole),
  }));
  const batsuHazardsView = batsuHazardCells.map((cell) => ({
    ...cell,
    ...toViewCoord(cell.row, cell.col, myRole),
  }));
  const thornHazardsView = thornHazardCells.map((cell) => ({
    ...cell,
    ...toViewCoord(cell.row, cell.col, myRole),
  }));

  return (
    <View style={[styles.frame, { width: boardSize, height: boardSize }]}>
      <Image source={boardImage} contentFit="cover" style={StyleSheet.absoluteFillObject} />
      <View
        style={[
          styles.innerBoard,
          {
            left: boardSize * BOARD_PADDING_RATIO,
            top: boardSize * BOARD_PADDING_RATIO,
            width: boardInnerSize,
            height: boardInnerSize,
          },
        ]}
      >
        {Array.from({ length: BOARD_SIZE }, (_, viewRow) =>
          Array.from({ length: BOARD_SIZE }, (_, viewCol) => {
            const isSelected =
              selectedView != null && selectedView.row === viewRow && selectedView.col === viewCol;
            const isTarget = isTargetCell(targetsView, viewRow, viewCol);
            const isEnemyTarget = isTargetCell(enemyTargetsView, viewRow, viewCol);
            return (
              <Pressable
                key={`cell-${viewRow}-${viewCol}`}
                onPress={() => {
                  if (!canInteract) return;
                  onCellPress(viewRow, viewCol);
                }}
                onLongPress={() => onCellLongPress(viewRow, viewCol)}
                delayLongPress={350}
                style={[
                  styles.cell,
                  {
                    left: viewCol * cellSize,
                    top: viewRow * cellSize,
                    width: cellSize,
                    height: cellSize,
                  },
                  isSelected && styles.cellSelected,
                  isTarget && styles.cellTarget,
                  isEnemyTarget && styles.cellEnemyTarget,
                ]}
              />
            );
          }),
        )}
        {poisonHazardsView.map((cell) => (
          <View
            key={`poison-${cell.row}-${cell.col}`}
            pointerEvents="none"
            style={[
              styles.poisonCell,
              {
                left: cell.col * cellSize,
                top: cell.row * cellSize,
                width: cellSize,
                height: cellSize,
              },
            ]}
          >
            <Image
              source={POISON_CELL_IMAGE_SOURCE}
              contentFit="cover"
              style={styles.poisonCellImage}
            />
          </View>
        ))}
        {piecesByView.map((piece) => {
          const pieceCode = piece.pieceCode?.toUpperCase();
          const baseCode = pieceCode ?? '';
          const promotedDef =
            piece.promoted && baseCode ? promotedPieceDefsByCode[baseCode] : undefined;
          const pieceDef = pieceCode
            ? (promotedDef ??
              pieceDefsByCode[pieceCode] ??
              pieceDefsByCode[normalizeWirePieceCode(pieceCode)])
            : undefined;
          const displayChar =
            piece.promoted && baseCode
              ? pieceCharFromCode(baseCode, piece.side, true)
              : getDisplayChar(piece);
          const imageSignedUrl = preferBundledPromotedImageOverRemoteUrl(
            baseCode || null,
            Boolean(piece.promoted),
            promotedDef?.imageSignedUrl ?? pieceDef?.imageSignedUrl ?? piece.imageSignedUrl ?? null,
          );
          const bundledPromoted =
            piece.promoted || isPromotedVisualPiece(piece)
              ? localPromotedModuleFromBaseCodeCandidates(
                  collectStandardBaseCodesForLocalPromotedImage(piece),
                )
              : null;
          const promotedRemote = resolvePromotedImageSource({
            ...piece,
            char: displayChar,
            imageSignedUrl,
          });
          const source =
            bundledPromoted ??
            promotedRemote ??
            getPieceImageSource({
              pieceId: pieceDef?.pieceId,
              pieceCode: piece.pieceCode ?? pieceDef?.pieceCode,
              char: displayChar,
              imageSignedUrl,
            });
          const enemy = isEnemySide(piece.side);
          const king = piece.pieceCode === 'OU' || isKingChar(displayChar ?? piece.char);
          const darkVeiled = Boolean(piece.darkVeiled);
          const stunnedAura = Boolean(piece.stunnedAura);
          const prisonChained = Boolean(piece.prisonChained);
          const chrysanthemumRevivalMark = Boolean(piece.chrysanthemumRevivalMark);
          const yangSkillSparkle = Boolean(piece.yangSkillSparkle);
          const yinSkillSparkle = Boolean(piece.yinSkillSparkle);
          const pieceScalePercent =
            BOARD_PIECE_SIZE_OVERRIDES[displayChar ?? piece.char] ??
            (king ? KING_PIECE_SIZE_PERCENT : NORMAL_PIECE_SIZE_PERCENT);
          return (
            <View
              key={`${piece.row}-${piece.col}-${piece.pieceCode}`}
              pointerEvents="none"
              style={[
                styles.pieceWrap,
                {
                  left: piece.viewCol * cellSize,
                  top: piece.viewRow * cellSize,
                  width: cellSize,
                  height: cellSize,
                },
              ]}
            >
              {source ? (
                <View
                  style={{
                    width: `${pieceScalePercent}%`,
                    height: `${pieceScalePercent}%`,
                    transform: [{ rotate: enemy ? '180deg' : '0deg' }],
                  }}
                >
                  <Image source={source} contentFit="contain" style={styles.pieceImage} />
                </View>
              ) : (
                <Text
                  style={[
                    styles.pieceFallback,
                    { transform: [{ rotate: enemy ? '180deg' : '0deg' }] },
                  ]}
                >
                  {darkVeiled ? '' : (displayChar ?? piece.char)}
                </Text>
              )}
              {darkVeiled ? <View pointerEvents="none" style={styles.darkVeilOverlay} /> : null}
              {prisonChained && !darkVeiled ? (
                <View pointerEvents="none" style={styles.prisonChainOverlay}>
                  <Image
                    source={PRISON_CHAIN_IMAGE_SOURCE}
                    contentFit="contain"
                    style={styles.prisonChainImage}
                  />
                </View>
              ) : null}
              {stunnedAura && !darkVeiled ? (
                <View pointerEvents="none" style={styles.stunAuraOverlay} />
              ) : null}
              {chrysanthemumRevivalMark && !darkVeiled ? (
                <View pointerEvents="none" style={styles.chrysanthemumRevivalMarkOverlay}>
                  <Image
                    source={CHRYSANTHEMUM_REVIVAL_IMAGE_SOURCE}
                    contentFit="contain"
                    style={styles.chrysanthemumRevivalMarkImage}
                  />
                </View>
              ) : null}
              {yangSkillSparkle && !darkVeiled ? (
                <View pointerEvents="none" style={styles.yangSkillAuraOverlay} />
              ) : null}
              {yinSkillSparkle && !darkVeiled ? (
                <View pointerEvents="none" style={styles.yinSkillAuraOverlay} />
              ) : null}
            </View>
          );
        })}
        {rockObstaclesView.map((cell) => (
          <View
            key={`rock-obstacle-${cell.row}-${cell.col}`}
            pointerEvents="none"
            style={[
              styles.rockObstacleCell,
              {
                left: cell.col * cellSize,
                top: cell.row * cellSize,
                width: cellSize,
                height: cellSize,
              },
            ]}
          >
            <Image
              source={ROCK_OBSTACLE_IMAGE_SOURCE}
              contentFit="cover"
              style={styles.rockObstacleCellImage}
            />
          </View>
        ))}
        {batsuHazardsView.map((cell) => (
          <View
            key={`batsu-hazard-${cell.row}-${cell.col}`}
            pointerEvents="none"
            style={[
              styles.batsuHazardCell,
              {
                left: cell.col * cellSize,
                top: cell.row * cellSize,
                width: cellSize,
                height: cellSize,
              },
            ]}
          >
            <Image
              source={BATSU_CELL_IMAGE_SOURCE}
              contentFit="cover"
              style={styles.batsuHazardCellImage}
            />
          </View>
        ))}
        {thornHazardsView.map((cell) => (
          <View
            key={`thorn-hazard-${cell.row}-${cell.col}`}
            pointerEvents="none"
            style={[
              styles.thornHazardCell,
              {
                left: cell.col * cellSize,
                top: cell.row * cellSize,
                width: cellSize,
                height: cellSize,
              },
            ]}
          >
            <Image
              source={THORN_CELL_IMAGE_SOURCE}
              contentFit="cover"
              style={styles.thornHazardCellImage}
            />
          </View>
        ))}
        {onSkillVisualEffectFinished ? (
          <OnlineBattleSkillParticleLayer
            effects={skillVisualEffects}
            boardSize={boardInnerSize}
            myRole={myRole}
            onEffectFinished={onSkillVisualEffectFinished}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#2a1810',
    position: 'relative',
  },
  cell: {
    position: 'absolute',
  },
  innerBoard: {
    position: 'absolute',
    overflow: 'visible',
  },
  cellSelected: {
    backgroundColor: 'rgba(250, 204, 21, 0.35)',
  },
  cellTarget: {
    backgroundColor: 'rgba(34, 197, 94, 0.4)',
  },
  cellEnemyTarget: {
    backgroundColor: 'rgba(59, 130, 246, 0.45)',
  },
  poisonCell: {
    position: 'absolute',
    backgroundColor: '#7c3aed33',
    zIndex: 1,
  },
  poisonCellImage: {
    width: '100%',
    height: '100%',
  },
  rockObstacleCell: {
    position: 'absolute',
    zIndex: 22,
  },
  rockObstacleCellImage: {
    width: '100%',
    height: '100%',
  },
  batsuHazardCell: {
    position: 'absolute',
    zIndex: 21,
  },
  batsuHazardCellImage: {
    width: '100%',
    height: '100%',
  },
  thornHazardCell: {
    position: 'absolute',
    zIndex: 23,
  },
  thornHazardCellImage: {
    width: '100%',
    height: '100%',
  },
  pieceWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  darkVeilOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  prisonChainOverlay: {
    position: 'absolute',
    left: '6%',
    right: '6%',
    top: '8%',
    bottom: '8%',
    opacity: 0.88,
  },
  prisonChainImage: {
    width: '100%',
    height: '100%',
  },
  stunAuraOverlay: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '10%',
    bottom: '10%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.95)',
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
  },
  chrysanthemumRevivalMarkOverlay: {
    position: 'absolute',
    top: '-2%',
    right: '2%',
    width: '54%',
    height: '54%',
    maxWidth: 56,
    maxHeight: 56,
  },
  chrysanthemumRevivalMarkImage: {
    width: '100%',
    height: '100%',
  },
  yangSkillAuraOverlay: {
    position: 'absolute',
    left: '4%',
    right: '4%',
    top: '5%',
    bottom: '5%',
    borderRadius: 999,
    borderWidth: 2.5,
    borderColor: 'rgba(249, 115, 22, 0.98)',
    backgroundColor: 'rgba(255, 237, 213, 0.28)',
  },
  yinSkillAuraOverlay: {
    position: 'absolute',
    left: '11%',
    right: '11%',
    top: '12%',
    bottom: '12%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(168, 85, 247, 0.98)',
    backgroundColor: 'rgba(126, 34, 206, 0.24)',
  },
  pieceImage: {
    width: '100%',
    height: '100%',
  },
  pieceFallback: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 11,
  },
});
