import {
  battleMoveToServerPayload,
  catalogDefsByCode,
  decodeEncodedBoardPiece,
  filterBattleMovesForServerWire,
  findEncodedBoardPieceAt,
  lookupWireBoardEncoded,
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

  it('rejects board moves without a from square', () => {
    expect(() =>
      battleMoveToServerPayload(
        {
          fromRow: null,
          fromCol: null,
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
    ).toThrow('盤上の着手に移動元がありません');
  });

  it('looks up board cells case-insensitively', () => {
    expect(lookupWireBoardEncoded({ '7G': 'black:FU' }, '7g')).toBe('black:FU');
    expect(findEncodedBoardPieceAt({ board: { '7G': 'black:FU' } }, 'black', 6, 2)?.code).toBe(
      'FU',
    );
  });

  it('rejects moves when from square is absent on server wire', () => {
    const wire = {
      board: { '7g': 'black:FU' },
      hands: { black: {}, white: {} },
    };
    expect(() =>
      battleMoveToServerPayload(
        {
          fromRow: 6,
          fromCol: 3,
          toRow: 5,
          toCol: 3,
          pieceCode: 'FU',
          promote: false,
          dropPieceCode: null,
          capturedPieceCode: null,
          notation: null,
        },
        'black',
        wire,
      ),
    ).toThrow('サーバー盤面と着手が一致しません');
  });

  it('filters legal moves to those present on server wire', () => {
    const wire = {
      board: { '7g': 'black:FU' },
      hands: { black: {}, white: {} },
    };
    const filtered = filterBattleMovesForServerWire(
      [
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
        {
          fromRow: 6,
          fromCol: 3,
          toRow: 5,
          toCol: 3,
          pieceCode: 'FU',
          promote: false,
          dropPieceCode: null,
          capturedPieceCode: null,
          notation: null,
        },
      ],
      wire,
      'black',
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.fromCol).toBe(2);
  });

  it('uses server board piece code instead of canonicalized app code', () => {
    const wire: MatchingGameState = {
      version: 1,
      turn: 'black',
      board: { '5e': 'black:PIECE_GACHA_KO' },
      hands: { black: {}, white: {} },
    };
    expect(
      battleMoveToServerPayload(
        {
          fromRow: 4,
          fromCol: 4,
          toRow: 5,
          toCol: 4,
          pieceCode: 'GACHA_KOU',
          promote: false,
          dropPieceCode: null,
          capturedPieceCode: null,
          notation: null,
        },
        'black',
        wire,
      ),
    ).toEqual({
      from: '5e',
      to: '5f',
      piece: 'PIECE_GACHA_KO',
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
