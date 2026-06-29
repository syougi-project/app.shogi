import {
  addHandPiece,
  applyPlayerMove,
  BoardPiece,
  canDropPiece,
  canPromoteByMove,
  capturedToHandPieceCode,
  createEmptyHandsState,
  getLegalTargetsFromVectors,
  hasKing,
  mustPromoteByMove,
} from '@/features/stage-shogi/domain/game-rules';

function sortCells(cells: { row: number; col: number }[]) {
  return [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
}

describe('stage shogi game rules', () => {
  it('returns legal targets from move vectors and blocks at own piece', () => {
    const placements: BoardPiece[] = [
      { side: 'player', row: 4, col: 4, pieceCode: 'HI', char: '飛' },
      { side: 'player', row: 4, col: 6, pieceCode: 'FU', char: '歩' },
      { side: 'enemy', row: 4, col: 2, pieceCode: 'FU', char: '歩' },
    ];

    const targets = getLegalTargetsFromVectors(
      placements,
      placements[0],
      [
        { dx: 1, dy: 0, maxStep: 8 },
        { dx: -1, dy: 0, maxStep: 8 },
      ],
      9,
    );

    expect(sortCells(targets)).toEqual(
      sortCells([
        { row: 4, col: 5 },
        { row: 4, col: 3 },
        { row: 4, col: 2 },
      ]),
    );
  });

  it('mirrors vector orientation for enemy pieces', () => {
    const placements: BoardPiece[] = [
      { side: 'enemy', row: 4, col: 4, pieceCode: 'FU', char: '歩' },
    ];
    const targets = getLegalTargetsFromVectors(
      placements,
      placements[0],
      [{ dx: 0, dy: -1, maxStep: 1 }],
      9,
    );

    expect(targets).toEqual([{ row: 5, col: 4 }]);
  });

  it('applies player move and captures destination piece', () => {
    const placements: BoardPiece[] = [
      { side: 'player', row: 6, col: 4, pieceCode: 'FU', char: '歩' },
      { side: 'enemy', row: 5, col: 4, pieceCode: 'FU', char: '歩' },
    ];

    const next = applyPlayerMove(placements, { row: 6, col: 4 }, { row: 5, col: 4 });

    expect(next).toEqual([
      { side: 'player', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
    ]);
  });

  it('judges optional promotion and forced promotion', () => {
    const pawn: BoardPiece = {
      side: 'player',
      row: 3,
      col: 4,
      pieceCode: 'FU',
      char: '歩',
      promoted: false,
    };

    expect(canPromoteByMove(pawn, { row: 3, col: 4 }, { row: 2, col: 4 })).toBe(true);
    expect(mustPromoteByMove(pawn, { row: 0, col: 4 })).toBe(true);
  });

  it('validates legal drop with nifu and dead-end checks', () => {
    const placements: BoardPiece[] = [
      { side: 'player', row: 6, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
    ];
    let hands = createEmptyHandsState();
    hands = addHandPiece(hands, 'player', 'FU', 1);
    hands = addHandPiece(hands, 'player', 'KE', 1);

    expect(canDropPiece(placements, hands, 'player', 'FU', { row: 4, col: 4 })).toBe(false);
    expect(canDropPiece(placements, hands, 'player', 'FU', { row: 4, col: 3 })).toBe(true);
    expect(canDropPiece(placements, hands, 'player', 'KE', { row: 0, col: 2 })).toBe(false);
  });

  it('applies promoted player move when requested', () => {
    const placements: BoardPiece[] = [
      { side: 'player', row: 1, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
    ];
    const next = applyPlayerMove(placements, { row: 1, col: 4 }, { row: 0, col: 4 }, true);
    expect(next[0].promoted).toBe(true);
  });

  it('detects game end by king presence', () => {
    const placements: BoardPiece[] = [
      { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王' },
      { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '玉' },
    ];

    expect(hasKing(placements, 'player')).toBe(true);
    expect(hasKing(placements, 'enemy')).toBe(true);
    expect(
      hasKing(
        placements.filter((p) => p.side !== 'enemy'),
        'enemy',
      ),
    ).toBe(false);
  });

  it('maps captured rock/ore by char when pieceCode is null', () => {
    const capturedRock: BoardPiece = {
      side: 'enemy',
      row: 4,
      col: 4,
      pieceCode: null,
      char: '岩',
    };
    const capturedOre: BoardPiece = {
      side: 'enemy',
      row: 4,
      col: 5,
      pieceCode: null,
      char: '鉱',
    };
    expect(capturedToHandPieceCode(capturedRock)).toBe('ROCK');
    expect(capturedToHandPieceCode(capturedOre)).toBe('ORE');
  });

  it('maps captured 悟／心 from kanji or opaque piece id', () => {
    const satoriOpaque: BoardPiece = {
      side: 'enemy',
      row: 0,
      col: 0,
      pieceCode: 'piece_6d4afa9cdf1c',
      char: '悟',
    };
    const heartOpaque: BoardPiece = {
      side: 'enemy',
      row: 0,
      col: 0,
      pieceCode: 'piece_ca16911978ff',
      char: '心',
    };
    expect(capturedToHandPieceCode(satoriOpaque)).toBe('SATORI');
    expect(capturedToHandPieceCode(heartOpaque)).toBe('HEART');
  });

  it('maps captured 焼／炒／煮 from kanji or stage opaque piece id', () => {
    expect(
      capturedToHandPieceCode({
        side: 'enemy',
        row: 0,
        col: 0,
        pieceCode: 'piece_fdc83cf95746',
        char: '焼',
      }),
    ).toBe('SEAR');
    expect(
      capturedToHandPieceCode({
        side: 'enemy',
        row: 0,
        col: 0,
        pieceCode: null,
        char: '炒',
      }),
    ).toBe('SAUTE');
    expect(
      capturedToHandPieceCode({
        side: 'enemy',
        row: 0,
        col: 0,
        pieceCode: 'PIECE_8DE5676A5E92',
        char: '煮',
      }),
    ).toBe('STEW');
  });

  it('maps captured 陽／陰 from kanji or opaque piece id', () => {
    expect(
      capturedToHandPieceCode({
        side: 'enemy',
        row: 0,
        col: 0,
        pieceCode: 'piece_313b9456c8ac',
        char: '陽',
      }),
    ).toBe('YANG');
    expect(
      capturedToHandPieceCode({
        side: 'enemy',
        row: 0,
        col: 0,
        pieceCode: null,
        char: '陰',
      }),
    ).toBe('YIN');
  });

  it('maps captured 銭／財 from kanji or opaque piece id', () => {
    expect(
      capturedToHandPieceCode({
        side: 'enemy',
        row: 0,
        col: 0,
        pieceCode: 'PIECE_EACC7F540399',
        char: '銭',
      }),
    ).toBe('SEN');
    expect(
      capturedToHandPieceCode({
        side: 'player',
        row: 0,
        col: 0,
        pieceCode: 'piece_7fc715661514',
        char: '財',
      }),
    ).toBe('ZAI');
  });

  it('maps captured shop naku from kanji or opaque piece id', () => {
    expect(
      capturedToHandPieceCode({
        side: 'player',
        row: 0,
        col: 0,
        pieceCode: 'piece_shop_naku',
        char: '鳴',
      }),
    ).toBe('NAKU');
    expect(
      capturedToHandPieceCode({
        side: 'player',
        row: 0,
        col: 0,
        pieceCode: 'piece_e9e01aac8e',
        char: '鳴',
      }),
    ).toBe('NAKU');
    expect(
      capturedToHandPieceCode({
        side: 'player',
        row: 0,
        col: 0,
        pieceCode: 'piece_e9e01aac8e',
        char: '',
      }),
    ).toBe('NAKU');
  });
});
