import type { Side } from '@/features/stage-shogi/domain/game-rules';
import type { BoardPiece } from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import {
  alignLegalMovesToBoardPieces,
  applyKirinImmunityShieldMarkToPieces,
  buildBoardPiecesFromSnapshotPlacements,
  immobilizedKeysFromCanonical,
  inferSnapshotPlacementCoordinateMode,
  kirinShowsImmunityShieldMark,
  legalMovesForBoardPiece,
  pieceCharFromCode,
  reconcileExtendedPieceHandsAgainstBoard,
  reconcilePieceIdentity,
  rewriteMoveCoordsToBoardCell,
  uniqueTargetsFromMoves,
} from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';

describe('snapshot placement coordinates', () => {
  it('treats rows 1–8 only as 0-based (deck / engine)', () => {
    expect(
      inferSnapshotPlacementCoordinateMode([
        { row: 6, col: 2 },
        { row: 7, col: 4 },
        { row: 8, col: 4 },
      ]),
    ).toBe('zero');
  });

  it('treats rank/file 9 as 1-based BFF', () => {
    expect(
      inferSnapshotPlacementCoordinateMode([
        { row: 1, col: 5 },
        { row: 9, col: 5 },
      ]),
    ).toBe('one');
  });

  it('maps 1-based king on rank 9 to board row 8', () => {
    const pieces = buildBoardPiecesFromSnapshotPlacements(
      [{ side: 'player', row: 9, col: 5, pieceCode: 'OU', char: '王' }],
      {},
    );
    expect(pieces[0]?.row).toBe(8);
    expect(pieces[0]?.col).toBe(4);
  });
});

describe('alignLegalMovesToBoardPieces', () => {
  const baseMove = {
    pieceCode: 'FU',
    promote: false,
    dropPieceCode: null,
    capturedPieceCode: null,
    notation: null,
  } satisfies Omit<BattleMove, 'fromRow' | 'fromCol' | 'toRow' | 'toCol'>;

  const boardPawn: BoardPiece = {
    side: 'player',
    row: 6,
    col: 2,
    pieceCode: 'FU',
    char: '歩',
    promoted: false,
    imageSignedUrl: null,
  };

  it('rewrites 1-based legal move origins onto 0-based board cells', () => {
    const moves: BattleMove[] = [{ ...baseMove, fromRow: 7, fromCol: 3, toRow: 6, toCol: 3 }];
    const aligned = alignLegalMovesToBoardPieces([boardPawn], moves);
    expect(aligned[0]).toMatchObject({ fromRow: 6, fromCol: 2, toRow: 5, toCol: 2 });
    expect(legalMovesForBoardPiece(aligned, 6, 2)).toHaveLength(1);
  });

  it('rewriteMoveCoordsToBoardCell shifts targets with origin', () => {
    const move: BattleMove = {
      ...baseMove,
      fromRow: 8,
      fromCol: 4,
      toRow: 7,
      toCol: 4,
    };
    expect(rewriteMoveCoordsToBoardCell(move, 7, 3)).toMatchObject({
      fromRow: 7,
      fromCol: 3,
      toRow: 6,
      toCol: 3,
    });
  });

  it('keeps 逸 legal moves when diagonally adjacent 辺 shares the 1-based origin cell', () => {
    const itsu: BoardPiece = {
      side: 'player',
      row: 4,
      col: 4,
      pieceCode: 'piece_gacha_itsu',
      char: '逸',
      promoted: false,
      imageSignedUrl: null,
    };
    const hen: BoardPiece = {
      side: 'player',
      row: 5,
      col: 5,
      pieceCode: 'piece_gacha_hen',
      char: '辺',
      promoted: false,
      imageSignedUrl: null,
    };
    const moves: BattleMove[] = [
      {
        ...baseMove,
        pieceCode: 'GACHA_ITSU',
        fromRow: 5,
        fromCol: 5,
        toRow: 4,
        toCol: 4,
      },
      {
        ...baseMove,
        pieceCode: 'GACHA_HEN',
        fromRow: 6,
        fromCol: 6,
        toRow: 5,
        toCol: 5,
      },
    ];
    const aligned = alignLegalMovesToBoardPieces([hen, itsu], moves);
    expect(legalMovesForBoardPiece(aligned, 4, 4)).toHaveLength(1);
    expect(legalMovesForBoardPiece(aligned, 4, 4)[0].pieceCode).toBe('GACHA_ITSU');
    expect(legalMovesForBoardPiece(aligned, 5, 5)).toHaveLength(1);
    expect(legalMovesForBoardPiece(aligned, 5, 5)[0].pieceCode).toBe('GACHA_HEN');
  });

  it('keeps 灯 legal moves when diagonally adjacent 逃 shares the 1-based origin cell', () => {
    const tou: BoardPiece = {
      side: 'player',
      row: 4,
      col: 4,
      pieceCode: 'piece_gacha_tou',
      char: '灯',
      promoted: false,
      imageSignedUrl: null,
    };
    const nige: BoardPiece = {
      side: 'player',
      row: 5,
      col: 5,
      pieceCode: 'piece_gacha_tou2',
      char: '逃',
      promoted: false,
      imageSignedUrl: null,
    };
    const moves: BattleMove[] = [
      {
        ...baseMove,
        pieceCode: 'GACHA_TOU',
        fromRow: 5,
        fromCol: 5,
        toRow: 4,
        toCol: 5,
      },
      {
        ...baseMove,
        pieceCode: 'GACHA_TOU2',
        fromRow: 6,
        fromCol: 6,
        toRow: 5,
        toCol: 6,
      },
    ];
    const aligned = alignLegalMovesToBoardPieces([nige, tou], moves);
    expect(legalMovesForBoardPiece(aligned, 4, 4)).toHaveLength(1);
    expect(legalMovesForBoardPiece(aligned, 4, 4)[0]).toMatchObject({
      fromRow: 4,
      fromCol: 4,
      toRow: 3,
      toCol: 4,
      pieceCode: 'GACHA_TOU',
    });
    expect(legalMovesForBoardPiece(aligned, 5, 5)).toHaveLength(1);
    expect(legalMovesForBoardPiece(aligned, 5, 5)[0].pieceCode).toBe('GACHA_TOU2');
  });
});

describe('legal move coordinates', () => {
  const baseMove = {
    pieceCode: 'FU',
    promote: false,
    dropPieceCode: null,
    capturedPieceCode: null,
    notation: null,
  } satisfies Omit<BattleMove, 'fromRow' | 'fromCol' | 'toRow' | 'toCol'>;

  it('matches board cell when API sends 1-based from coordinates', () => {
    const moves: BattleMove[] = [
      {
        ...baseMove,
        fromRow: 7,
        fromCol: 3,
        toRow: 6,
        toCol: 3,
      },
    ];
    const boardPiece = {
      side: 'player' as const,
      row: 6,
      col: 2,
      pieceCode: 'FU',
      char: '歩',
      promoted: false,
    };
    const aligned = alignLegalMovesToBoardPieces([boardPiece], moves);
    expect(legalMovesForBoardPiece(aligned, 6, 2)).toEqual(aligned);
    expect(aligned[0]?.fromRow).toBe(6);
    expect(aligned[0]?.fromCol).toBe(2);
  });

  it('normalizes move targets to 0-based cells', () => {
    const moves: BattleMove[] = [
      {
        ...baseMove,
        fromRow: 7,
        fromCol: 4,
        toRow: 6,
        toCol: 4,
      },
    ];
    expect(uniqueTargetsFromMoves(moves, { row: 6, col: 3 })).toEqual([{ row: 5, col: 3 }]);
  });
});

describe('pieceCharFromCode', () => {
  it('resolves opaque piece id via image registry', () => {
    expect(pieceCharFromCode('PIECE_C518B11858F2', 'player', false)).toBe('歩');
  });
});

describe('reconcilePieceIdentity', () => {
  it('keeps existing kanji when canonical sync would fall back to ?', () => {
    const existing: BoardPiece[] = [
      {
        side: 'player',
        row: 4,
        col: 4,
        pieceCode: 'PIECE_C518B11858F2',
        char: '歩',
        promoted: false,
        imageSignedUrl: null,
      },
    ];
    const next: BoardPiece[] = [
      {
        side: 'player',
        row: 4,
        col: 4,
        pieceCode: 'FU',
        char: '?',
        promoted: false,
        imageSignedUrl: null,
      },
    ];
    const out = reconcilePieceIdentity(next, existing, {});
    expect(out[0]?.char).toBe('歩');
    expect(out[0]?.pieceCode).toBe('FU');
  });
});

describe('reconcileExtendedPieceHandsAgainstBoard', () => {
  it('does not subtract on-board GEAR from in-hand count (canonical hands are already in-hand only)', () => {
    const hands = {
      player: { GEAR: 1 },
      enemy: {},
    };
    const pieces: BoardPiece[] = [
      {
        side: 'player',
        row: 4,
        col: 4,
        pieceCode: 'GEAR',
        char: '歯',
        promoted: false,
        imageSignedUrl: null,
      },
    ];
    const out = reconcileExtendedPieceHandsAgainstBoard(hands, pieces);
    expect(out.player.GEAR).toBe(1);
  });

  it('does not subtract on-board MACHINE from in-hand count', () => {
    const hands = {
      player: { MACHINE: 2 },
      enemy: {},
    };
    const pieces: BoardPiece[] = [
      {
        side: 'player',
        row: 2,
        col: 2,
        pieceCode: 'MACHINE',
        char: '機',
        promoted: false,
        imageSignedUrl: null,
      },
    ];
    const out = reconcileExtendedPieceHandsAgainstBoard(hands, pieces);
    expect(out.player.MACHINE).toBe(2);
  });

  it('does not subtract on-board HOLE from in-hand count', () => {
    const hands = {
      player: { HOLE: 1 },
      enemy: {},
    };
    const pieces: BoardPiece[] = [
      {
        side: 'player',
        row: 3,
        col: 3,
        pieceCode: 'HOLE',
        char: '穴',
        promoted: false,
        imageSignedUrl: null,
      },
    ];
    const out = reconcileExtendedPieceHandsAgainstBoard(hands, pieces);
    expect(out.player.HOLE).toBe(1);
  });

  it('does not subtract on-board ABYSS from in-hand count', () => {
    const hands = {
      player: { ABYSS: 1 },
      enemy: {},
    };
    const pieces: BoardPiece[] = [
      {
        side: 'player',
        row: 5,
        col: 5,
        pieceCode: 'ABYSS',
        char: '淵',
        promoted: false,
        imageSignedUrl: null,
      },
    ];
    const out = reconcileExtendedPieceHandsAgainstBoard(hands, pieces);
    expect(out.player.ABYSS).toBe(1);
  });

  it('does not subtract on-board COW from in-hand COW (captured piece vs own piece)', () => {
    const hands = { player: {}, enemy: { COW: 1 } };
    const pieces: BoardPiece[] = [
      {
        side: 'enemy',
        row: 4,
        col: 4,
        pieceCode: 'COW',
        char: '牛',
        promoted: false,
        imageSignedUrl: null,
      },
    ];
    const out = reconcileExtendedPieceHandsAgainstBoard(hands, pieces);
    expect(out.enemy.COW).toBe(1);
  });

  it('does not subtract on-board PIG from in-hand PIG', () => {
    const hands = { player: {}, enemy: { PIG: 1 } };
    const pieces: BoardPiece[] = [
      {
        side: 'enemy',
        row: 3,
        col: 3,
        pieceCode: 'PIG',
        char: '豚',
        promoted: false,
        imageSignedUrl: null,
      },
    ];
    const out = reconcileExtendedPieceHandsAgainstBoard(hands, pieces);
    expect(out.enemy.PIG).toBe(1);
  });

  it('does not subtract on-board CHICKEN from in-hand CHICKEN', () => {
    const hands = { player: {}, enemy: { CHICKEN: 1 } };
    const pieces: BoardPiece[] = [
      {
        side: 'enemy',
        row: 2,
        col: 2,
        pieceCode: 'CHICKEN',
        char: '鶏',
        promoted: false,
        imageSignedUrl: null,
      },
    ];
    const out = reconcileExtendedPieceHandsAgainstBoard(hands, pieces);
    expect(out.enemy.CHICKEN).toBe(1);
  });

  it('does not subtract on-board HAA from in-hand HAA (CODE_TO_CHAR extended)', () => {
    const hands = { player: {}, enemy: { HAA: 1 } };
    const pieces: BoardPiece[] = [
      {
        side: 'enemy',
        row: 1,
        col: 1,
        pieceCode: 'HAA',
        char: '葉',
        promoted: false,
        imageSignedUrl: null,
      },
    ];
    const out = reconcileExtendedPieceHandsAgainstBoard(hands, pieces);
    expect(out.enemy.HAA).toBe(1);
  });
});

describe('immobilizedKeysFromCanonical', () => {
  it('駒ショップPの同行・同列の敵を移動不能キーに含める', () => {
    const keys = immobilizedKeysFromCanonical({
      sideToMove: 'enemy',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/9 b - 1',
      stateHash: 'p-ui',
      boardState: {
        pieces: [
          { side: 'enemy', row: 4, col: 2, pieceCode: 'FU', char: '歩', promoted: false },
          {
            side: 'player',
            row: 4,
            col: 4,
            pieceCode: 'piece_shop_p',
            char: 'P',
            promoted: false,
          },
        ],
      },
      hands: { player: {}, enemy: {} },
    });
    expect(keys.has('enemy:4:2')).toBe(true);
    expect(keys.has('player:4:4')).toBe(false);
  });
});

describe('applyKirinImmunityShieldMarkToPieces', () => {
  const kirin: BoardPiece = {
    side: 'player',
    row: 4,
    col: 4,
    pieceCode: 'piece_shop_kirin',
    char: '麒',
    promoted: false,
    imageSignedUrl: null,
  };

  it('敵の歩・金・銀に隣接しているときだけ盾マークを付ける', () => {
    const withPawn = applyKirinImmunityShieldMarkToPieces([
      kirin,
      {
        side: 'enemy',
        row: 4,
        col: 5,
        pieceCode: 'FU',
        char: '歩',
        promoted: false,
        imageSignedUrl: null,
      },
    ]);
    expect(withPawn[0]?.kirinImmunityShieldMark).toBe(true);

    const withKnight = applyKirinImmunityShieldMarkToPieces([
      kirin,
      {
        side: 'enemy',
        row: 2,
        col: 4,
        pieceCode: 'KE',
        char: '桂',
        promoted: false,
        imageSignedUrl: null,
      },
    ]);
    expect(withKnight[0]?.kirinImmunityShieldMark).toBe(false);
  });

  it('敵が隣接から離れると盾マークが消える', () => {
    const kirin: BoardPiece = {
      side: 'player',
      row: 4,
      col: 4,
      pieceCode: 'piece_shop_kirin',
      char: '麒',
      promoted: false,
      imageSignedUrl: null,
    };
    const adjacent: BoardPiece[] = [
      kirin,
      {
        side: 'enemy' as Side,
        row: 4,
        col: 5,
        pieceCode: 'FU',
        char: '歩',
        promoted: false,
        imageSignedUrl: null,
      },
    ];
    expect(kirinShowsImmunityShieldMark(adjacent, kirin)).toBe(true);
    const far: BoardPiece[] = [
      kirin,
      {
        side: 'enemy' as Side,
        row: 2,
        col: 2,
        pieceCode: 'FU',
        char: '歩',
        promoted: false,
        imageSignedUrl: null,
      },
    ];
    expect(kirinShowsImmunityShieldMark(far, kirin)).toBe(false);
  });
});
