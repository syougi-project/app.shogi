import { movePayloadToBattleMove } from '@/lib/battle/battle-move-audio';
import type { MovePayload } from '@/domain/matching-server/protocol';

describe('movePayloadToBattleMove', () => {
  it('treats server drop lastMove without from as a drop', () => {
    const payload: MovePayload = {
      to: '5e',
      piece: 'FU',
      promote: false,
      drop: true,
    };
    const move = movePayloadToBattleMove(payload);
    expect(move.dropPieceCode).toBe('FU');
    expect(move.fromRow).toBeNull();
    expect(move.toRow).toBe(4);
    expect(move.toCol).toBe(4);
  });

  it('treats missing drop flag as drop when from is absent', () => {
    const payload: MovePayload = {
      to: '5e',
      piece: 'PIECE_C518B11858F2',
    };
    const move = movePayloadToBattleMove(payload);
    expect(move.dropPieceCode).toBe('PIECE_C518B11858F2');
    expect(move.fromRow).toBeNull();
  });
});
