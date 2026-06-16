import {
  detectHolySwordCaptureEvadeFromPieces,
  detectHolySwordCaptureEvadeFromWire,
} from '@/lib/battle/holy-sword-capture-evade';
import type { BoardPiece } from '@/features/stage-shogi/domain/game-rules';

describe('holy-sword capture evade detection', () => {
  const swordAt5e: BoardPiece = {
    row: 4,
    col: 4,
    side: 'enemy',
    pieceCode: 'HOLY_SWORD',
    char: '剣',
    promoted: false,
    imageSignedUrl: null,
  };

  it('detects sidestep evade on board pieces', () => {
    const before = [swordAt5e];
    const after: BoardPiece[] = [
      { ...swordAt5e, col: 3 },
      {
        row: 4,
        col: 4,
        side: 'player',
        pieceCode: 'FU',
        char: '歩',
        promoted: false,
        imageSignedUrl: null,
      },
    ];
    expect(
      detectHolySwordCaptureEvadeFromPieces(before, after, {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        dropPieceCode: null,
      }),
    ).toBe(true);
  });

  it('detects sidestep evade from wire board diff', () => {
    const before = { '5e': 'white:HOLY_SWORD' };
    const after = {
      '5e': 'white:FU',
      '4e': 'white:HOLY_SWORD',
    };
    expect(
      detectHolySwordCaptureEvadeFromWire(before, after, {
        from: '5f',
        to: '5e',
        piece: 'FU',
        drop: false,
      }),
    ).toBe(true);
  });

  it('returns false when sword is captured', () => {
    const before = { '5e': 'white:HOLY_SWORD' };
    const after = { '5e': 'black:FU' };
    expect(
      detectHolySwordCaptureEvadeFromWire(before, after, {
        from: '5f',
        to: '5e',
        piece: 'FU',
        drop: false,
      }),
    ).toBe(false);
  });
});
