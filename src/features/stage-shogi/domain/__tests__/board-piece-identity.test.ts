import { piecesFromBoardState } from '@/ai/model/position';
import {
  canonicalizeBoardPieceIdentity,
  resolveStagePlacementIdentity,
} from '@/features/stage-shogi/domain/board-piece-identity';
import { getPieceImageSource } from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';

describe('canonicalizeBoardPieceIdentity', () => {
  it('maps opaque 歩 id + 歩 char to FU', () => {
    expect(canonicalizeBoardPieceIdentity('piece_c518b11858f2', '歩')).toEqual({
      pieceCode: 'FU',
      char: '歩',
    });
  });

  it('strips pig inherited wire suffix from piece codes', () => {
    expect(canonicalizeBoardPieceIdentity('PIG>FU', '豚')).toEqual({
      pieceCode: 'PIG',
      char: '豚',
    });
  });

  it('maps FIR + 火 for summoned fire', () => {
    expect(canonicalizeBoardPieceIdentity('FIR', '火')).toEqual({
      pieceCode: 'FIR',
      char: '火',
    });
  });

  it('maps blueOni + 鬼 to BLUEONI / 青鬼', () => {
    expect(canonicalizeBoardPieceIdentity('blueOni', '鬼')).toEqual({
      pieceCode: 'BLUEONI',
      char: '青鬼',
    });
  });

  it('maps blackOni + 鬼 to BLACKONI / 黒鬼', () => {
    expect(canonicalizeBoardPieceIdentity('blackOni', '鬼')).toEqual({
      pieceCode: 'BLACKONI',
      char: '黒鬼',
    });
  });

  it('maps 鬼 without variant code to REDONI / 赤鬼', () => {
    expect(canonicalizeBoardPieceIdentity('piece_533b7fec5456', '鬼')).toEqual({
      pieceCode: 'REDONI',
      char: '赤鬼',
    });
  });
});

describe('resolveStagePlacementIdentity', () => {
  it('does not use opaque code as char when char is missing', () => {
    expect(
      resolveStagePlacementIdentity({
        char: null,
        code: 'piece_c518b11858f2',
      }),
    ).toEqual({ pieceCode: 'FU', char: '歩' });
  });
});

describe('piecesFromBoardState canonical codes', () => {
  it('normalizes opaque deck piece to FU for legal move lookup', () => {
    const pieces = piecesFromBoardState({
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/9 b - 1',
      stateHash: null,
      boardState: {
        pieces: [
          {
            side: 'player',
            row: 6,
            col: 4,
            pieceCode: 'piece_c518b11858f2',
            char: '歩',
            promoted: false,
          },
        ],
      },
      hands: { player: {}, enemy: {} },
    });
    expect(pieces[0]?.pieceCode).toBe('FU');
    expect(pieces[0]?.char).toBe('歩');
  });
});

describe('getPieceImageSource', () => {
  it('resolves 火 by char when pieceCode is canonical FIR', () => {
    expect(getPieceImageSource({ pieceCode: 'FIR', char: '火' })).not.toBeNull();
  });
});
