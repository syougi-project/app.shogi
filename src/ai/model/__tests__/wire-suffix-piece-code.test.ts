import { toBasePieceCode } from '@/ai/model/move';
import { piecesFromBoardState } from '@/ai/model/position';

describe('stage45 wire suffix piece codes', () => {
  it('normalizes pig inherited suffix in toBasePieceCode', () => {
    expect(toBasePieceCode('PIG>FU')).toBe('PIG');
    expect(toBasePieceCode('COW@2')).toBe('COW');
  });

  it('extracts pig inherit metadata from encoded pieceCode in board state', () => {
    const pieces = piecesFromBoardState({
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'test',
      stateHash: null,
      boardState: {
        pieces: [
          {
            side: 'player',
            row: 4,
            col: 4,
            pieceCode: 'PIG>FU+',
            char: '豚',
            promoted: false,
          },
        ],
      },
      hands: { player: {}, enemy: {} },
    });

    expect(pieces[0]?.pieceCode).toBe('PIG');
    expect(pieces[0]?.char).toBe('豚');
    expect(pieces[0]?.pigInheritedPieceCode).toBe('FU');
    expect(pieces[0]?.pigInheritedPromoted).toBe(true);
  });
});
