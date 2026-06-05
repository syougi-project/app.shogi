import {
  battleMoveToServerPayload,
  catalogDefsByCode,
  decodeEncodedBoardPiece,
  matchingGameToBoardPieces,
} from '@/lib/matching-server/game-bridge';
import type { MatchingGameState } from '@/domain/matching-server/protocol';

describe('matching-server game-bridge', () => {
  it('decodes promoted board cells', () => {
    expect(decodeEncodedBoardPiece('black:FU+')).toEqual({
      serverSide: 'black',
      code: 'FU',
      promoted: true,
    });
  });

  it('maps server board to ui pieces for black player', () => {
    const game: MatchingGameState = {
      version: 1,
      turn: 'black',
      board: { '7g': 'black:FU', '3c': 'white:OU' },
      hands: { black: {}, white: {} },
    };
    const pieces = matchingGameToBoardPieces(game, 'black');
    expect(pieces.find((p) => p.pieceCode === 'FU')?.side).toBe('player');
    expect(pieces.find((p) => p.pieceCode === 'FU')?.char).toBe('歩');
    expect(pieces.find((p) => p.pieceCode === 'OU')?.side).toBe('enemy');
    expect(pieces.find((p) => p.pieceCode === 'OU')?.char).toBe('玉');
  });

  it('converts battle move to server payload', () => {
    expect(
      battleMoveToServerPayload(
        {
          fromRow: 6,
          fromCol: 2,
          toRow: 5,
          toCol: 2,
          pieceCode: 'FU',
          promote: false,
          dropPieceCode: null,
          capturedPieceCode: null,
          notation: null,
        },
        'black',
      ),
    ).toEqual({
      from: '7g',
      to: '7f',
      piece: 'FU',
      promote: false,
      drop: false,
    });
  });

  it('converts drop move to server payload', () => {
    expect(
      battleMoveToServerPayload(
        {
          fromRow: null,
          fromCol: null,
          toRow: 4,
          toCol: 4,
          pieceCode: 'FU',
          promote: false,
          dropPieceCode: 'FU',
          capturedPieceCode: null,
          notation: null,
        },
        'black',
      ),
    ).toEqual({
      to: '5e',
      piece: 'FU',
      drop: true,
      promote: false,
    });
  });

  it('indexes catalog definitions by canonical code for special pieces', () => {
    const mist = {
      pieceId: 54,
      pieceCode: 'piece_ae158934197b',
      canonicalCode: 'MIST',
      char: '霧',
      name: '霧',
      unlock: 'test',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [],
      isRepeatable: false,
    };

    const defs = catalogDefsByCode([mist]);

    expect(defs.PIECE_AE158934197B?.pieceCode).toBe('PIECE_AE158934197B');
    expect(defs.MIST?.pieceCode).toBe('PIECE_AE158934197B');
    expect(defs.MIST?.canonicalCode).toBe('MIST');
  });
});
