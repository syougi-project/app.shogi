import {
  findSatoriMoveAt,
  resolveHeartAllyPick,
  resolvePendingSatoriCellPress,
  resolveSatoriEnemyPick,
} from '@/lib/battle/battle-skill-interaction';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';

describe('battle-skill-interaction', () => {
  it('resolveSatoriEnemyPick returns targets when multiple stun notations exist', () => {
    const moves: BattleMove[] = [
      {
        fromRow: 4,
        fromCol: 4,
        toRow: 3,
        toCol: 4,
        pieceCode: 'SATORI',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: 'satori_stun:2:3',
      },
      {
        fromRow: 4,
        fromCol: 4,
        toRow: 3,
        toCol: 4,
        pieceCode: 'SATORI',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: 'satori_stun:2:5',
      },
    ];
    const pick = resolveSatoriEnemyPick(moves);
    expect(pick).not.toBeNull();
    expect(pick!.targetCells).toEqual([
      { row: 2, col: 3 },
      { row: 2, col: 5 },
    ]);
  });

  it('findSatoriMoveAt matches cell from notation', () => {
    const moves: BattleMove[] = [
      {
        fromRow: 0,
        fromCol: 0,
        toRow: 1,
        toCol: 1,
        pieceCode: 'SATORI',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: 'satori_stun:3:4',
      },
    ];
    expect(findSatoriMoveAt(moves, 3, 4)?.notation).toBe('satori_stun:3:4');
  });

  it('resolvePendingSatoriCellPress commits on destination (capture square) to avoid freeze', () => {
    const moves: BattleMove[] = [
      {
        fromRow: 7,
        fromCol: 7,
        toRow: 1,
        toCol: 1,
        pieceCode: 'SATORI',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'SATORI',
        notation: 'satori_stun:2:3',
      },
      {
        fromRow: 7,
        fromCol: 7,
        toRow: 1,
        toCol: 1,
        pieceCode: 'SATORI',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'SATORI',
        notation: 'satori_stun:2:5',
      },
    ];
    // 捕獲マス（移動先）はスタン対象外。以前はここで無反応のまま固まっていた。
    expect(resolvePendingSatoriCellPress(moves, 1, 1)).toEqual({
      kind: 'commit',
      move: moves[0],
    });
    expect(resolvePendingSatoriCellPress(moves, 2, 5)).toEqual({
      kind: 'commit',
      move: moves[1],
    });
    expect(resolvePendingSatoriCellPress(moves, 4, 4)).toEqual({ kind: 'cancel' });
  });

  it('resolveHeartAllyPick returns null for single protect variant', () => {
    const moves: BattleMove[] = [
      {
        fromRow: 4,
        fromCol: 4,
        toRow: 3,
        toCol: 4,
        pieceCode: 'HEART',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: 'heart_protect:5:5',
      },
    ];
    expect(resolveHeartAllyPick(moves)).toBeNull();
  });
});
