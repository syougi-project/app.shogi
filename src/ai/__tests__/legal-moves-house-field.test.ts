import { applyMove } from '@/ai/engine/apply-move';
import { generateLegalMoves } from '@/ai/engine/legal-moves';
import type { AiBattlePosition, AiPieceDefinition } from '@/ai/model';

const kingMoves: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: -1, dy: 1, maxStep: 1 },
  { dx: 0, dy: 1, maxStep: 1 },
  { dx: 1, dy: 1, maxStep: 1 },
];

const catalog: AiPieceDefinition[] = [
  {
    pieceCode: 'OU',
    canonicalCode: 'OU',
    sfenCode: 'K',
    char: '王',
    name: '王',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: kingMoves,
    isRepeatable: true,
  },
  {
    pieceCode: 'HOUSE',
    canonicalCode: 'HOUSE',
    sfenCode: 'ZIE',
    char: '家',
    name: '家',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 1, dy: 0, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'FIELD',
    canonicalCode: 'FIELD',
    sfenCode: 'ZTA',
    char: '畑',
    name: '畑',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 1, dy: 0, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'PEOPLE',
    canonicalCode: 'PEOPLE',
    sfenCode: 'ZMN',
    char: '民',
    name: '民',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 1, dy: 0, maxStep: 1 }],
    isRepeatable: true,
  },
];

function countPeople(p: AiBattlePosition): number {
  const pieces = (p.boardState as { pieces?: { char?: string; pieceCode?: string | null }[] })
    .pieces;
  return (
    pieces?.filter((x) => (x.pieceCode ?? '').toUpperCase() === 'PEOPLE' || x.char === '民')
      .length ?? 0
  );
}

describe('legal moves: 家・畑', () => {
  test('家と畑は移動手が生成されない（固定駒）', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'x',
      stateHash: 's',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'HOUSE', char: '家', promoted: false },
          { side: 'player', row: 4, col: 5, pieceCode: 'FIELD', char: '畑', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog: catalog });
    const fromHouse = legal.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 4);
    const fromField = legal.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 5);
    expect(fromHouse.every((m) => m.notation === 'house_skill_only')).toBe(true);
    expect(fromField.length).toBe(0);
  });

  it('ZTAコードの畑も桂馬相当のカタログベクトルがあっても移動手が出ない', () => {
    const ztaCatalog: AiPieceDefinition = {
      ...catalog.find((p) => p.char === '畑')!,
      pieceCode: 'ZTA',
      canonicalCode: 'FIELD',
      sfenCode: 'ZTA',
      moveVectors: [
        { dx: -1, dy: -2, maxStep: 1 },
        { dx: 1, dy: -2, maxStep: 1 },
      ],
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'x',
      stateHash: 's',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'ZTA', char: '畑', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({
      position,
      pieceCatalog: [...catalog.filter((p) => p.char !== '畑'), ztaCatalog],
    });
    expect(legal.legalMoves.some((m) => m.fromRow === 4 && m.fromCol === 4)).toBe(false);
  });

  it('民が5体いると家の house_skill_only が出ない', () => {
    const people = [0, 1, 2, 3, 4].map((col) => ({
      side: 'player' as const,
      row: 0,
      col,
      pieceCode: 'PEOPLE',
      char: '民',
      promoted: false,
    }));
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'x',
      stateHash: 's',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 8, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'HOUSE', char: '家', promoted: false },
          ...people,
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog: catalog });
    expect(legal.legalMoves.some((m) => m.notation === 'house_skill_only')).toBe(false);
  });

  it('house_skill_only で自陣4行の空マスに民が1体増える', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'x',
      stateHash: 's',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 8, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'HOUSE', char: '家', promoted: false },
          { side: 'player', row: 0, col: 0, pieceCode: 'PEOPLE', char: '民', promoted: false },
          { side: 'player', row: 0, col: 1, pieceCode: 'PEOPLE', char: '民', promoted: false },
          { side: 'player', row: 0, col: 2, pieceCode: 'PEOPLE', char: '民', promoted: false },
          { side: 'player', row: 1, col: 0, pieceCode: 'PEOPLE', char: '民', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    expect(countPeople(position)).toBe(4);
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const committed = applyMove({
      position,
      pieceCatalog: catalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 5,
        toCol: 4,
        pieceCode: 'HOUSE',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: 'house_skill_only',
      },
    });
    jest.restoreAllMocks();
    expect(countPeople(committed.position as unknown as AiBattlePosition)).toBe(5);
    const pieces = (committed.position.boardState as { pieces: { row: number; col: number }[] })
      .pieces;
    const peopleInPlayerHomeRows = pieces.filter(
      (p) =>
        p.row >= 5 && p.row <= 8 && ((p as { pieceCode?: string }).pieceCode ?? '') === 'PEOPLE',
    );
    expect(peopleInPlayerHomeRows.length).toBe(1);
  });

  it('味方の畑がいるとき民は斜め4方向にも1マス進める', () => {
    const basePieces = [
      { side: 'enemy' as const, row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
      { side: 'player' as const, row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
      { side: 'player' as const, row: 4, col: 4, pieceCode: 'PEOPLE', char: '民', promoted: false },
    ];
    const withoutField: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'x',
      stateHash: 's',
      boardState: { pieces: basePieces },
      hands: { player: {}, enemy: {} },
    };
    const legalNoField = generateLegalMoves({ position: withoutField, pieceCatalog: catalog });
    const movesNoField = legalNoField.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 4);
    expect(movesNoField.length).toBe(4);
    const destNoField = new Set(movesNoField.map((m) => `${m.toRow},${m.toCol}`));
    expect(destNoField.has('4,5')).toBe(true);
    expect(destNoField.has('4,3')).toBe(true);
    expect(destNoField.has('3,4')).toBe(true);
    expect(destNoField.has('5,4')).toBe(true);

    const withAllyField: AiBattlePosition = {
      ...withoutField,
      boardState: {
        pieces: [
          ...basePieces,
          { side: 'player', row: 8, col: 0, pieceCode: 'FIELD', char: '畑', promoted: false },
        ],
      },
    };
    const legalWithField = generateLegalMoves({ position: withAllyField, pieceCatalog: catalog });
    const movesWith = legalWithField.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 4);
    expect(movesWith.length).toBe(8);
    const dest = new Set(movesWith.map((m) => `${m.toRow},${m.toCol}`));
    expect(dest.has('4,5')).toBe(true);
    expect(dest.has('3,3')).toBe(true);
    expect(dest.has('3,5')).toBe(true);
    expect(dest.has('5,3')).toBe(true);
    expect(dest.has('5,5')).toBe(true);

    const withEnemyField: AiBattlePosition = {
      ...withoutField,
      boardState: {
        pieces: [
          ...basePieces,
          { side: 'enemy', row: 1, col: 1, pieceCode: 'FIELD', char: '畑', promoted: false },
        ],
      },
    };
    const legalEnemyField = generateLegalMoves({ position: withEnemyField, pieceCatalog: catalog });
    const movesEnemyField = legalEnemyField.legalMoves.filter(
      (m) => m.fromRow === 4 && m.fromCol === 4,
    );
    expect(movesEnemyField.length).toBe(4);
  });
});
