import { pickRandomTimeoutBattleMove } from '@/lib/battle/pick-random-timeout-battle-move';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';

function move(partial: Partial<BattleMove> & Pick<BattleMove, 'toRow' | 'toCol'>): BattleMove {
  return {
    fromRow: 4,
    fromCol: 4,
    pieceCode: 'FU',
    promote: false,
    dropPieceCode: null,
    capturedPieceCode: null,
    notation: null,
    ...partial,
  };
}

describe('pickRandomTimeoutBattleMove', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns a physical move when available', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const chosen = pickRandomTimeoutBattleMove([
      move({ toRow: 3, toCol: 4 }),
      move({ notation: 'house_skill_only', fromRow: 4, fromCol: 4, toRow: 4, toCol: 4 }),
    ]);
    expect(chosen?.toRow).toBe(3);
    expect(chosen?.notation).not.toBe('house_skill_only');
  });

  it('falls back to skill-only moves when no physical move exists', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const chosen = pickRandomTimeoutBattleMove([
      move({ notation: 'house_skill_only', fromRow: 2, fromCol: 2, toRow: 2, toCol: 2 }),
    ]);
    expect(chosen?.notation).toBe('house_skill_only');
  });

  it('returns null when no candidate exists', () => {
    expect(pickRandomTimeoutBattleMove([])).toBeNull();
  });
});
