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

  it('decodes cow charge suffix on board cells', () => {
    expect(decodeEncodedBoardPiece('black:COW@1')).toEqual({
      serverSide: 'black',
      code: 'COW',
      promoted: false,
      cowChargeCount: 1,
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

  it('maps charged cow to 牛 with cowChargeCount', () => {
    const game: MatchingGameState = {
      version: 1,
      turn: 'black',
      board: { '5f': 'black:COW@1' },
      hands: { black: {}, white: {} },
    };
    const pieces = matchingGameToBoardPieces(game, 'black');
    const cow = pieces.find((p) => p.pieceCode === 'COW');
    expect(cow?.char).toBe('牛');
    expect(cow?.cowChargeCount).toBe(1);
  });

  it('maps pig with inherited movement suffix to 豚 with metadata', () => {
    const game: MatchingGameState = {
      version: 1,
      turn: 'black',
      board: { '5d': 'black:PIG>FU' },
      hands: { black: { FU: 1 }, white: {} },
    };
    const pieces = matchingGameToBoardPieces(game, 'black');
    const pig = pieces.find((p) => p.row === 4 && p.col === 4);
    expect(pig?.pieceCode).toBe('PIG');
    expect(pig?.char).toBe('豚');
    expect(pig?.pigInheritedPieceCode).toBe('FU');
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

  it('maps display drop code to opaque server hand key', () => {
    const pawnCatalog = [
      {
        pieceId: 1,
        pieceCode: 'piece_c518b11858f2',
        canonicalCode: 'pawn',
        char: '歩',
        name: 'Pawn',
        unlock: 'test',
        desc: '',
        skill: '',
        move: '',
        moveVectors: [],
        isRepeatable: false,
      },
    ];
    const wire: MatchingGameState = {
      version: 1,
      turn: 'black',
      board: { '5i': 'black:OU', '5a': 'white:OU' },
      hands: { black: { PIECE_C518B11858F2: 1 }, white: {} },
    };
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
        wire,
        pawnCatalog,
      ),
    ).toEqual({
      to: '5e',
      piece: 'PIECE_C518B11858F2',
      drop: true,
      promote: false,
    });
  });

  it('rejects drop when server hand does not contain the piece', () => {
    const wire = {
      board: { '5i': 'black:OU', '5a': 'white:OU' },
      hands: { black: {}, white: {} },
    };
    expect(() =>
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
        wire,
      ),
    ).toThrow('サーバー持ち駒と打ち駒が一致しません');
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
