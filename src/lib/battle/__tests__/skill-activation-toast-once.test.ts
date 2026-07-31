import {
  createSkillActivationToastOnceTracker,
  skillActivationToastOnceKey,
} from '@/lib/battle/skill-activation-toast-once';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';

function move(pieceCode: string): BattleMove {
  return {
    fromRow: 4,
    fromCol: 4,
    toRow: 3,
    toCol: 4,
    pieceCode,
    promote: false,
    dropPieceCode: null,
    capturedPieceCode: null,
    notation: null,
  };
}

describe('skill-activation-toast-once', () => {
  it('uses base piece code as once-key', () => {
    expect(skillActivationToastOnceKey(move('SATORI'))).toBe('SATORI');
    expect(skillActivationToastOnceKey(move('piece_6d4afa9cdf1c'))).toBeTruthy();
  });

  it('shows each skill only once per battle tracker', () => {
    const tracker = createSkillActivationToastOnceTracker();
    expect(tracker.consume('FIRE')).toBe(true);
    expect(tracker.consume('FIRE')).toBe(false);
    expect(tracker.consume('WATER')).toBe(true);
    expect(tracker.consume('WATER')).toBe(false);
    tracker.reset();
    expect(tracker.consume('FIRE')).toBe(true);
  });
});
