import { moveRandomAllyToCellBehindBird } from '@/ai/engine/bird-skill';
import { computePiecesAfterOptimisticMove } from '@/features/stage-shogi/ui/stage-shogi-screen.optimistic';
import type { BoardPiece } from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';

describe('bird skill transport', () => {
  it('moves a random ally behind the bird landing cell', () => {
    const pieces = [
      { side: 'player', row: 4, col: 4, pieceCode: 'BIRD', char: '禽', promoted: false },
      { side: 'player', row: 6, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
    ] as BoardPiece[];

    const moved = moveRandomAllyToCellBehindBird({
      pieces,
      actorSide: 'player',
      movedBird: { row: 4, col: 5 },
      random: () => 0,
    });

    expect(moved).toBe(true);
    expect(pieces.find((piece) => piece.char === '歩')).toEqual(
      expect.objectContaining({ row: 5, col: 5 }),
    );
  });

  it('applies bird transport in optimistic move preview', () => {
    const prev = [
      { side: 'player', row: 4, col: 4, pieceCode: 'BIRD', char: '禽', promoted: false },
      { side: 'player', row: 6, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
    ] as BoardPiece[];
    const move: BattleMove = {
      fromRow: 4,
      fromCol: 4,
      toRow: 4,
      toCol: 5,
      pieceCode: 'BIRD',
      promote: false,
      dropPieceCode: null,
      capturedPieceCode: null,
      notation: null,
    };
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const next = computePiecesAfterOptimisticMove(prev, 'player', move, {}, {}, {});
    randomSpy.mockRestore();

    expect(next.find((piece) => piece.char === '歩')).toEqual(
      expect.objectContaining({ row: 5, col: 5 }),
    );
    expect(next.find((piece) => piece.char === '禽')).toEqual(
      expect.objectContaining({ row: 4, col: 5 }),
    );
  });
});
