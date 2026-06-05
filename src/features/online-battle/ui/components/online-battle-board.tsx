import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { BoardCell, BoardPiece } from '@/features/stage-shogi/domain/game-rules';
import {
  BOARD_INNER,
  BOARD_PIECE_SIZE_OVERRIDES,
  BOARD_PADDING_RATIO,
  BOARD_VIEWBOX,
  KING_PIECE_SIZE_PERCENT,
  NORMAL_PIECE_SIZE_PERCENT,
  getPieceImageSource,
  isEnemySide,
  isKingChar,
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
  canInteract: boolean;
  skillVisualEffects?: SkillVisualEffect[];
  onSkillVisualEffectFinished?: (effect: SkillVisualEffect) => void;
  onCellPress: (viewRow: number, viewCol: number) => void;
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
    canInteract,
    skillVisualEffects = [],
    onSkillVisualEffectFinished,
    onCellPress,
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
                disabled={!canInteract}
                onPress={() => onCellPress(viewRow, viewCol)}
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
        {piecesByView.map((piece) => {
          const pieceCode = piece.pieceCode?.toUpperCase();
          const pieceDef = pieceCode
            ? (pieceDefsByCode[pieceCode] ?? pieceDefsByCode[normalizeWirePieceCode(pieceCode)])
            : undefined;
          const displayChar = piece.char && piece.char !== '?' ? piece.char : pieceDef?.char;
          const source = getPieceImageSource({
            pieceId: pieceDef?.pieceId,
            pieceCode: piece.pieceCode ?? pieceDef?.pieceCode,
            char: displayChar,
            imageSignedUrl: pieceDef?.imageSignedUrl ?? null,
          });
          const enemy = isEnemySide(piece.side);
          const king = piece.pieceCode === 'OU' || isKingChar(displayChar ?? piece.char);
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
                  {displayChar ?? piece.char}
                </Text>
              )}
            </View>
          );
        })}
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
  pieceWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
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
