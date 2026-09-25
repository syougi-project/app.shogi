import { applyMove } from '@/ai/engine/apply-move';
import { generateLegalMoves } from '@/ai/engine/legal-moves';
import type { AiBattlePosition, AiPieceDefinition } from '@/ai/model';

type TestBoardPiece = {
  side: 'player' | 'enemy';
  row: number;
  col: number;
  pieceCode: string;
  char?: string;
  promoted?: boolean;
};

function boardPieces(position: { boardState?: unknown }): TestBoardPiece[] {
  const boardState = position.boardState as { pieces?: TestBoardPiece[] } | undefined;
  return boardState?.pieces ?? [];
}

function handTotal(hand: Record<string, number | undefined>): number {
  return Object.values(hand).reduce<number>(
    (sum, value) => sum + (typeof value === 'number' ? value : 0),
    0,
  );
}

const pieceCatalog: AiPieceDefinition[] = [
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
    moveVectors: [
      { dx: -1, dy: -1, maxStep: 1 },
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: 1, dy: -1, maxStep: 1 },
      { dx: -1, dy: 0, maxStep: 1 },
      { dx: 1, dy: 0, maxStep: 1 },
      { dx: -1, dy: 1, maxStep: 1 },
      { dx: 0, dy: 1, maxStep: 1 },
      { dx: 1, dy: 1, maxStep: 1 },
    ],
    isRepeatable: true,
  },
  {
    pieceCode: 'FU',
    canonicalCode: 'FU',
    sfenCode: 'P',
    char: '歩',
    name: '歩',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'FIRE',
    canonicalCode: 'FIRE',
    sfenCode: 'J',
    char: '火',
    name: '火',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'WATER',
    canonicalCode: 'WATER',
    sfenCode: 'W',
    char: '水',
    name: '水',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'IRON',
    canonicalCode: 'IRON',
    sfenCode: 'O',
    char: '鉄',
    name: '鉄',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'TIN',
    canonicalCode: 'TIN',
    sfenCode: 'Z',
    char: '錫',
    name: '錫',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'ELECTRIC',
    canonicalCode: 'ELECTRIC',
    sfenCode: '&',
    char: '電',
    name: '電',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'THUNDER',
    canonicalCode: 'THUNDER',
    sfenCode: '(',
    char: '雷',
    name: '雷',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'TIME',
    canonicalCode: 'TIME',
    sfenCode: '#',
    char: '時',
    name: '時',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'ICE',
    canonicalCode: 'ICE',
    sfenCode: '@',
    char: '氷',
    name: '氷',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'SNOW',
    canonicalCode: 'SNOW',
    sfenCode: '^',
    char: '雪',
    name: '雪',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'SAND',
    canonicalCode: 'SAND',
    sfenCode: '[',
    char: '砂',
    name: '砂',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'WIND',
    canonicalCode: 'WIND',
    sfenCode: '<',
    char: '風',
    name: '風',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'FISH',
    canonicalCode: 'FISH',
    sfenCode: ':',
    char: '魚',
    name: '魚',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'MOSS',
    canonicalCode: 'MOSS',
    sfenCode: '{',
    char: '苔',
    name: '苔',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'RAINBOW',
    canonicalCode: 'RAINBOW',
    sfenCode: '"',
    char: '虹',
    name: '虹',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'CLOUD',
    canonicalCode: 'CLOUD',
    sfenCode: ',',
    char: '雲',
    name: '雲',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'SWAMP',
    canonicalCode: 'SWAMP',
    sfenCode: '|',
    char: '沼',
    name: '沼',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'POISON',
    canonicalCode: 'POISON',
    sfenCode: ';',
    char: '毒',
    name: '毒',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'PRISON',
    canonicalCode: 'PRISON',
    sfenCode: '}',
    char: '牢',
    name: '牢',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'FENCE',
    canonicalCode: 'FENCE',
    sfenCode: '~',
    char: '柵',
    name: '柵',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'RIDGE',
    canonicalCode: 'RIDGE',
    sfenCode: 'r',
    char: '嶺',
    name: '嶺',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'PEAK',
    canonicalCode: 'PEAK',
    sfenCode: 'p',
    char: '峰',
    name: '峰',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'YAMA',
    canonicalCode: 'YAMA',
    sfenCode: 'y',
    char: '山',
    name: '山',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'ORE',
    canonicalCode: 'ORE',
    sfenCode: 'o',
    char: '鉱',
    name: '鉱',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'ROCK',
    canonicalCode: 'ROCK',
    sfenCode: 'R',
    char: '岩',
    name: '岩',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'GRAVE',
    canonicalCode: 'GRAVE',
    sfenCode: 'g',
    char: '墓',
    name: '墓',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'MIST',
    canonicalCode: 'MIST',
    sfenCode: 'm',
    char: '霧',
    name: '霧',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [
      { dx: -1, dy: -1, maxStep: 1 },
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: 1, dy: -1, maxStep: 1 },
      { dx: -1, dy: 0, maxStep: 1 },
      { dx: 1, dy: 0, maxStep: 1 },
      { dx: -1, dy: 1, maxStep: 1 },
      { dx: 0, dy: 1, maxStep: 1 },
      { dx: 1, dy: 1, maxStep: 1 },
    ],
    isRepeatable: true,
  },
  {
    pieceCode: 'MOON',
    canonicalCode: 'MOON',
    sfenCode: 'ZMO',
    char: '月',
    name: '月',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [
      { dx: -1, dy: -1, maxStep: 1 },
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: 1, dy: -1, maxStep: 1 },
      { dx: -1, dy: 0, maxStep: 1 },
      { dx: 1, dy: 0, maxStep: 1 },
      { dx: -1, dy: 1, maxStep: 1 },
      { dx: 0, dy: 1, maxStep: 1 },
      { dx: 1, dy: 1, maxStep: 1 },
    ],
    isRepeatable: true,
  },
  {
    pieceCode: 'BOAT',
    canonicalCode: 'BOAT',
    sfenCode: 'ZBO',
    char: '舟',
    name: '舟',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [
      { dx: -1, dy: 0, maxStep: 9 },
      { dx: 1, dy: 0, maxStep: 9 },
      { dx: 0, dy: -1, maxStep: 9 },
      { dx: 0, dy: 1, maxStep: 9 },
    ],
    isRepeatable: true,
  },
  {
    pieceCode: 'BIRD',
    canonicalCode: 'BIRD',
    sfenCode: 'ZBI',
    char: '禽',
    name: '禽',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [
      { dx: -1, dy: 0, maxStep: 9 },
      { dx: 1, dy: 0, maxStep: 9 },
      { dx: 0, dy: -1, maxStep: 9 },
      { dx: 0, dy: 1, maxStep: 9 },
    ],
    isRepeatable: true,
  },
  {
    pieceCode: 'PHANTOM',
    canonicalCode: 'PHANTOM',
    sfenCode: 'h',
    char: '幻',
    name: '幻',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'SPIRIT',
    canonicalCode: 'SPIRIT',
    sfenCode: 's',
    char: '霊',
    name: '霊',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'A',
    canonicalCode: 'A',
    sfenCode: 'a',
    char: 'あ',
    name: 'あ',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'TREASURE',
    canonicalCode: 'TREASURE',
    sfenCode: '$',
    char: '宝',
    name: '宝',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'NAM',
    canonicalCode: 'NAM',
    sfenCode: 'N',
    char: '波',
    name: '波',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'MOK',
    canonicalCode: 'MOK',
    sfenCode: 'M',
    char: '木',
    name: '木',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'HAA',
    canonicalCode: 'HAA',
    sfenCode: 'L',
    char: '葉',
    name: '葉',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'TANE',
    canonicalCode: 'TANE',
    sfenCode: ',',
    char: '種',
    name: '種',
    unlock: 'shop',
    desc: '',
    skill: '移動時20%の確率で、周囲8マスのランダムな空きマス1マスに「葉」駒を召喚する。',
    move: '',
    moveVectors: [
      { dx: -1, dy: -1, maxStep: 1 },
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: 1, dy: -1, maxStep: 1 },
      { dx: -1, dy: 1, maxStep: 1 },
      { dx: 1, dy: 1, maxStep: 1 },
    ],
    isRepeatable: false,
  },
  {
    pieceCode: 'piece_shop_tane',
    canonicalCode: 'TANE',
    sfenCode: ',',
    char: '種',
    name: '種',
    unlock: 'shop',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [
      { dx: -1, dy: -1, maxStep: 1 },
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: 1, dy: -1, maxStep: 1 },
      { dx: -1, dy: 1, maxStep: 1 },
      { dx: 1, dy: 1, maxStep: 1 },
    ],
    isRepeatable: false,
  },
  {
    pieceCode: 'HOS',
    canonicalCode: 'HOS',
    sfenCode: 'S',
    char: '星',
    name: '星',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'MAK',
    canonicalCode: 'MAK',
    sfenCode: 'D',
    char: '魔',
    name: '魔',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'KBOSS',
    canonicalCode: 'KBOSS',
    sfenCode: 'ZKD',
    char: 'K',
    name: 'K',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [
      { dx: -1, dy: -1, maxStep: 1 },
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: 1, dy: -1, maxStep: 1 },
      { dx: -1, dy: 0, maxStep: 1 },
      { dx: 1, dy: 0, maxStep: 1 },
      { dx: -1, dy: 1, maxStep: 1 },
      { dx: 0, dy: 1, maxStep: 1 },
      { dx: 1, dy: 1, maxStep: 1 },
    ],
    isRepeatable: true,
  },
  {
    pieceCode: 'EXPERIMENT',
    canonicalCode: 'EXPERIMENT',
    sfenCode: 'ZJI',
    char: '実',
    name: '実',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [
      { dx: -1, dy: -1, maxStep: 1 },
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: 1, dy: -1, maxStep: 1 },
      { dx: -1, dy: 0, maxStep: 1 },
      { dx: 1, dy: 0, maxStep: 1 },
      { dx: -1, dy: 1, maxStep: 1 },
      { dx: 0, dy: 1, maxStep: 1 },
      { dx: 1, dy: 1, maxStep: 1 },
    ],
    isRepeatable: true,
  },
  {
    pieceCode: 'MUTANT',
    canonicalCode: 'MUTANT',
    sfenCode: 'ZIH',
    char: '異',
    name: '異',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
];

describe('ai engine apply move', () => {
  it('applies a legal drop and consumes a hand piece', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/9/9/9/4K4 b P 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: { FU: 1 }, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: null,
        fromCol: null,
        toRow: 6,
        toCol: 3,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: 'FU',
        capturedPieceCode: null,
        notation: 'FU*63',
      },
    });

    expect(committed.position.hands.player.FU).toBeUndefined();
    expect(committed.position.sideToMove).toBe('enemy');
    expect(committed.skillTriggered).toBe(false);
    expect(committed.skillVisualEffects).toEqual([]);
  });

  it('rejects an illegal move', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/9/9/4P4/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 7, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    expect(() =>
      applyMove({
        position,
        pieceCatalog,
        move: {
          fromRow: 7,
          fromCol: 4,
          toRow: 5,
          toCol: 4,
          pieceCode: 'FU',
          promote: false,
          dropPieceCode: null,
          capturedPieceCode: null,
          notation: null,
        },
      }),
    ).toThrow('guardrail rejected move: move is outside session catalog legal range');
  });

  it('applies after_capture return_to_hand to self_piece', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4p4/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['FU'],
              trigger: { type: 'after_capture' },
              effects: [
                {
                  type: 'return_to_hand',
                  target: { group: 'self', selector: 'self_piece' },
                  params: { handOwner: 'self' },
                },
              ],
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'FU',
        notation: null,
      },
    });

    expect(
      boardPieces(committed.position).some(
        (piece) =>
          piece.side === 'player' && piece.row === 4 && piece.col === 4 && piece.pieceCode === 'FU',
      ),
    ).toBe(false);
    expect(committed.position.hands.player.FU).toBe(2);
  });

  it('applies summon_piece to adjacent_empty cells', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['FU'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'summon_piece',
                  target: { group: 'adjacent', selector: 'adjacent_empty' },
                  params: { summonPieceCode: 'FU', summonPieceChar: '歩' },
                },
              ],
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const summonedCount =
      boardPieces(committed.position).filter(
        (piece) => piece.side === 'player' && piece.pieceCode === 'FU',
      ).length ?? 0;
    // ai.shogi互換: adjacent_empty は最初の空き1マスのみ召喚
    expect(summonedCount).toBe(2);
  });

  it('applies apply_status to adjacent enemy pieces', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['FU'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'apply_status',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: { statusType: 'stun', durationTurns: 2 },
                },
              ],
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const skillState = committed.position.boardState.skill_state as
      | {
          piece_statuses?: {
            side?: string;
            row?: number;
            col?: number;
            status_type?: string;
          }[];
        }
      | undefined;
    const statuses = skillState?.piece_statuses ?? [];
    expect(
      statuses.some(
        (s) => s.side === 'enemy' && s.row === 4 && s.col === 3 && s.status_type === 'stun',
      ),
    ).toBe(true);
    expect(
      statuses.some(
        (s) => s.side === 'enemy' && s.row === 4 && s.col === 5 && s.status_type === 'stun',
      ),
    ).toBe(true);
  });

  it('applies remove_piece to one random adjacent enemy only when chance_roll passes', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['FU'],
              trigger: { type: 'after_move' },
              conditions: [{ type: 'chance_roll', params: { procChance: 0.2 } }],
              effects: [
                {
                  type: 'remove_piece',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: { randomOne: true },
                },
              ],
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random');
    // 1回目: chance_roll 成功 (<=0.2), 2回目: 候補 index を選択
    randomSpy.mockReturnValueOnce(0.1).mockReturnValueOnce(0.75);
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const remainingAdjacentEnemy =
      boardPieces(committed.position).filter(
        (piece) =>
          piece.side === 'enemy' && piece.row === 4 && (piece.col === 3 || piece.col === 5),
      ) ?? [];
    expect(remainingAdjacentEnemy).toHaveLength(1);
  });

  it('does not apply remove_piece when chance_roll fails', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['FU'],
              trigger: { type: 'after_move' },
              conditions: [{ type: 'chance_roll', params: { procChance: 0.2 } }],
              effects: [
                {
                  type: 'remove_piece',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: { randomOne: true },
                },
              ],
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.9);
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const remainingAdjacentEnemy =
      boardPieces(committed.position).filter(
        (piece) =>
          piece.side === 'enemy' && piece.row === 4 && (piece.col === 3 || piece.col === 5),
      ) ?? [];
    expect(remainingAdjacentEnemy).toHaveLength(2);
  });

  it('fire skill removes one enemy hand piece when proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'FIRE', char: '火', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: { FU: 1, KI: 1 } },
    };

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'FIRE',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const enemyHandTotal = handTotal(committed.position.hands.enemy);
    expect(enemyHandTotal).toBe(1);
  });

  it('fire skill does not remove enemy hand piece when proc fails', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'FIRE', char: '火', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: { FU: 1, KI: 1 } },
    };

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.9);
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'FIRE',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const enemyHandTotal = handTotal(committed.position.hands.enemy);
    expect(enemyHandTotal).toBe(2);
  });

  it('water skill pushes adjacent enemy pieces by one cell', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4W4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'WATER', char: '水', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'WATER',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const enemyAt42 = boardPieces(committed.position).find(
      (piece) => piece.side === 'enemy' && piece.row === 4 && piece.col === 2,
    );
    const enemyAt46 = boardPieces(committed.position).find(
      (piece) => piece.side === 'enemy' && piece.row === 4 && piece.col === 6,
    );
    expect(enemyAt42?.pieceCode).toBe('FU');
    expect(enemyAt46?.pieceCode).toBe('FU');
  });

  it('wave skill pushes adjacent enemy pieces by one cell', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4N4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'NAM', char: '波', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'NAM',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const enemyAt42 = boardPieces(committed.position).find(
      (piece) => piece.side === 'enemy' && piece.row === 4 && piece.col === 2,
    );
    const enemyAt46 = boardPieces(committed.position).find(
      (piece) => piece.side === 'enemy' && piece.row === 4 && piece.col === 6,
    );
    expect(enemyAt42?.pieceCode).toBe('FU');
    expect(enemyAt46?.pieceCode).toBe('FU');
  });

  it('iron skill pushes adjacent enemy pieces by one cell like water', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4O4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'IRON', char: '鉄', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'IRON',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const enemyAt42 = boardPieces(committed.position).find(
      (piece) => piece.side === 'enemy' && piece.row === 4 && piece.col === 2,
    );
    const enemyAt46 = boardPieces(committed.position).find(
      (piece) => piece.side === 'enemy' && piece.row === 4 && piece.col === 6,
    );
    expect(enemyAt42?.pieceCode).toBe('FU');
    expect(enemyAt46?.pieceCode).toBe('FU');
  });

  it('tin skill applies stun to adjacent enemies when 10% proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4Z4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'TIN', char: '錫', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.05);
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'TIN',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const skillState = committed.position.boardState.skill_state as
      | { piece_statuses?: Record<string, unknown>[] }
      | undefined;
    const statuses = skillState?.piece_statuses ?? [];
    const stuns = statuses.filter((s) => (s.status_type as string) === 'stun');
    expect(stuns.length).toBeGreaterThanOrEqual(1);
    expect(stuns.every((s) => (s.remaining_turns as number) === 2)).toBe(true);
  });

  it('treasure skill adds one random KI/GI/COPPER to hand when 20% proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4$4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'TREASURE', char: '宝', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.05); // 20% 発動成功
    randomSpy.mockReturnValueOnce(0.8); // reward index => COPPER
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'TREASURE',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    expect(committed.position.hands.player.COPPER).toBe(1);
    expect(committed.position.hands.player.KI).toBeUndefined();
    expect(committed.position.hands.player.GI).toBeUndefined();
  });

  it('electric skill stuns all adjacent enemies for 1 turn when 20% proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4&4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'ELECTRIC', char: '電', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.05); // 20% 発動成功
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'ELECTRIC',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const skillState = committed.position.boardState.skill_state as
      | { piece_statuses?: Record<string, unknown>[] }
      | undefined;
    const statuses = skillState?.piece_statuses ?? [];
    const stuns = statuses.filter((s) => (s.status_type as string) === 'stun');
    expect(stuns).toHaveLength(2);
    expect(stuns[0]?.remaining_turns).toBe(2);
  });

  it('thunder skill removes up to two random enemy hand pieces when 10% proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4(4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'THUNDER', char: '雷', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: { FU: 1, GI: 1, KI: 1 } },
    };

    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.05); // 10% 発動成功
    randomSpy.mockReturnValueOnce(0.0); // first remove key index
    randomSpy.mockReturnValueOnce(0.0); // second remove key index (recomputed keys)
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 3,
        pieceCode: 'THUNDER',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const enemyHandTotal = handTotal(committed.position.hands.enemy);
    expect(enemyHandTotal).toBe(1);
  });

  it('time piece can move one step in all directions', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4#4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'TIME', char: '時', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 3,
        pieceCode: 'TIME',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: 'time_normal',
      },
    });

    const moved = boardPieces(committed.position).find(
      (piece) => piece.side === 'player' && piece.pieceCode === 'TIME',
    );
    expect(moved?.row).toBe(4);
    expect(moved?.col).toBe(3);
    expect(committed.skillTriggered).toBe(false);
  });

  it('time skill only stuns adjacent enemies for 4 turns', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4#4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'TIME', char: '時', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 5,
        toCol: 4,
        pieceCode: 'TIME',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: 'time_skill_only',
      },
    });

    const skillState = committed.position.boardState.skill_state as
      | { piece_statuses?: Record<string, unknown>[] }
      | undefined;
    const statuses = skillState?.piece_statuses ?? [];
    const stuns = statuses.filter((s) => (s.status_type as string) === 'stun');
    expect(stuns).toHaveLength(2);
    expect(stuns.every((s) => (s.remaining_turns as number) === 4)).toBe(true);
  });

  it('ice skill stuns one adjacent enemy for 2 turns when 30% proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4@4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'ICE', char: '氷', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.1); // 30% 発動成功
    randomSpy.mockReturnValueOnce(0.0); // target index
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'ICE',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const skillState = committed.position.boardState.skill_state as
      | { piece_statuses?: Record<string, unknown>[] }
      | undefined;
    const statuses = skillState?.piece_statuses ?? [];
    const stuns = statuses.filter((s) => (s.status_type as string) === 'stun');
    expect(stuns).toHaveLength(1);
    expect(stuns[0]?.remaining_turns).toBe(2);
  });

  it('snow skill adds ICE to hand when 20% proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4^4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'SNOW', char: '雪', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.05);
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'SNOW',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    expect(committed.position.hands.player.ICE).toBe(1);
  });

  it('sand skill moves adjacent ally sand in linked movement', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/3[[4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 3, pieceCode: 'SAND', char: '砂', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'SAND', char: '砂', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'SAND',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const linked = boardPieces(committed.position).find(
      (piece) => piece.side === 'player' && piece.pieceCode === 'SAND' && piece.col === 3,
    );
    expect(linked?.row).toBe(4);
    expect(linked?.col).toBe(3);
    const leader = boardPieces(committed.position).find(
      (piece) => piece.side === 'player' && piece.pieceCode === 'SAND' && piece.col === 4,
    );
    expect(leader?.row).toBe(4);
    expect(
      boardPieces(committed.position).filter(
        (piece) => piece.side === 'player' && piece.pieceCode === 'SAND',
      ),
    ).toHaveLength(2);
  });

  it('wind skill pushes orthogonal adjacent enemies to edge', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4p4/3<p4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 5, col: 4, pieceCode: 'HI', char: '飛', promoted: false },
          { side: 'player', row: 5, col: 3, pieceCode: 'WIND', char: '風', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 3,
        toRow: 4,
        toCol: 3,
        pieceCode: 'WIND',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const pushedRight = boardPieces(committed.position).find(
      (piece) => piece.side === 'enemy' && piece.col === 8 && piece.row === 4,
    );
    expect(pushedRight?.pieceCode).toBe('FU');
  });

  it('fish skill stuns one adjacent enemy for 3 turns when 30% proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4:4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'FISH', char: '魚', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.1); // 30% 発動成功
    randomSpy.mockReturnValueOnce(0.0); // target index
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'FISH',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const skillState = committed.position.boardState.skill_state as
      | { piece_statuses?: Record<string, unknown>[] }
      | undefined;
    const statuses = skillState?.piece_statuses ?? [];
    const stuns = statuses.filter((s) => (s.status_type as string) === 'stun');
    expect(stuns).toHaveLength(1);
    expect(stuns[0]?.remaining_turns).toBe(3);
  });

  it('moss skill summons one moss piece when 30% proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4{4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'MOSS', char: '苔', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.1); // 30% 発動成功
    randomSpy.mockReturnValueOnce(0.0); // summon candidate index
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'MOSS',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const mossCount =
      boardPieces(committed.position).filter(
        (piece) => piece.side === 'player' && piece.pieceCode === 'MOSS',
      ).length ?? 0;
    expect(mossCount).toBe(2);
  });

  it('rainbow skill applies orthogonal-step movement restriction to adjacent enemies', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4"4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'RAINBOW', char: '虹', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'RAINBOW',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const skillState = committed.position.boardState.skill_state as
      | { movement_modifiers?: Record<string, unknown>[] }
      | undefined;
    const modifiers = skillState?.movement_modifiers ?? [];
    const ortho = modifiers.filter((m) => (m.movement_rule as string) === 'orthogonal_step_only');
    expect(ortho.length).toBeGreaterThanOrEqual(1);
    expect(ortho.every((m) => (m.remaining_turns as number) === 4)).toBe(true);
  });

  it('mai move applies diagonal-forward restriction to adjacent enemies at that moment', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4.4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          {
            side: 'player',
            row: 5,
            col: 4,
            pieceCode: 'piece_shop_mai',
            char: '舞',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'piece_shop_mai',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const skillState = committed.position.boardState.skill_state as
      | { movement_modifiers?: Record<string, unknown>[] }
      | undefined;
    const danceMods = (skillState?.movement_modifiers ?? []).filter(
      (m) => (m.movement_rule as string) === 'diagonal_forward_step_only',
    );
    expect(danceMods.length).toBeGreaterThanOrEqual(2);
    expect(danceMods.every((m) => (m.remaining_turns as number) === 999)).toBe(true);
  });

  it('mai move does not transform adjacent enemies into pawns', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3s1n3/4.4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'GI', char: '銀', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'KE', char: '桂', promoted: false },
          {
            side: 'player',
            row: 5,
            col: 4,
            pieceCode: 'piece_shop_mai',
            char: '舞',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'piece_shop_mai',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const pieces = committed.position.boardState.pieces as {
      side: 'player' | 'enemy';
      row: number;
      col: number;
      pieceCode: string;
      char: string;
    }[];
    const left = pieces.find((p) => p.side === 'enemy' && p.row === 4 && p.col === 3);
    const right = pieces.find((p) => p.side === 'enemy' && p.row === 4 && p.col === 5);
    expect(left?.pieceCode).toBe('GI');
    expect(left?.char).toBe('銀');
    expect(right?.pieceCode).toBe('KE');
    expect(right?.char).toBe('桂');
    const statuses =
      (
        committed.position.boardState as {
          skill_state?: { piece_statuses?: Record<string, unknown>[] };
        }
      ).skill_state?.piece_statuses ?? [];
    expect(statuses.some((s) => (s.status_type as string) === 'a_transform')).toBe(false);
  });

  it('dance movement restriction is removed when mai is no longer adjacent', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/9/4.4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          {
            side: 'player',
            row: 5,
            col: 4,
            pieceCode: 'piece_shop_mai',
            char: '舞',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_state: {
          movement_modifiers: [
            {
              row: 4,
              col: 3,
              side: 'enemy',
              movement_rule: 'diagonal_forward_step_only',
              remaining_turns: 999,
            },
            {
              row: 4,
              col: 5,
              side: 'enemy',
              movement_rule: 'diagonal_forward_step_only',
              remaining_turns: 999,
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 6,
        toCol: 4,
        pieceCode: 'piece_shop_mai',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const skillState = committed.position.boardState.skill_state as
      | { movement_modifiers?: Record<string, unknown>[] }
      | undefined;
    const danceMods = (skillState?.movement_modifiers ?? []).filter(
      (m) => (m.movement_rule as string) === 'diagonal_forward_step_only',
    );
    expect(danceMods).toHaveLength(0);
  });

  it('cloud piece captures allied piece and adds it to hand', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4P4/4,4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'CLOUD', char: '雲', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'CLOUD',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'FU',
        notation: null,
      },
    });
    const pieces = committed.position.boardState.pieces as {
      side: 'player' | 'enemy';
      row: number;
      col: number;
      pieceCode: string;
    }[];
    expect(
      pieces.some(
        (piece) =>
          piece.side === 'player' &&
          piece.row === 4 &&
          piece.col === 4 &&
          piece.pieceCode === 'CLOUD',
      ),
    ).toBe(true);
    expect(
      pieces.some(
        (piece) =>
          piece.side === 'player' && piece.row === 4 && piece.col === 4 && piece.pieceCode === 'FU',
      ),
    ).toBe(false);
    expect(committed.position.hands.player.FU ?? 0).toBe(1);
  });

  it('cloud piece cannot capture allied boss piece あ', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4a4/4,4/9/9/4K4 w - 1',
      stateHash: 'seed-stage20-cloud-boss',
      boardState: {
        pieces: [
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'A', char: 'あ', promoted: false },
          { side: 'enemy', row: 5, col: 4, pieceCode: 'CLOUD', char: '雲', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    expect(() =>
      applyMove({
        position,
        pieceCatalog,
        move: {
          fromRow: 5,
          fromCol: 4,
          toRow: 4,
          toCol: 4,
          pieceCode: 'CLOUD',
          promote: false,
          dropPieceCode: null,
          capturedPieceCode: 'A',
          notation: null,
        },
        options: { trustedLegalMove: true },
      }),
    ).toThrow('CLOUD cannot capture allied king or boss piece');
  });

  it('cloud piece captures allied shop naku and adds it to hand', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4n4/4,4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          {
            side: 'player',
            row: 4,
            col: 4,
            pieceCode: 'piece_shop_naku',
            char: '鳴',
            promoted: false,
          },
          { side: 'player', row: 5, col: 4, pieceCode: 'CLOUD', char: '雲', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'CLOUD',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    expect(handTotal(committed.position.hands.player)).toBe(1);
  });

  it('cloud friendly capture adds shop naku to hand when only opaque piece id is set', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4n4/4,4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          {
            side: 'player',
            row: 4,
            col: 4,
            pieceCode: 'piece_e9e01aac8e',
            char: '鳴',
            promoted: false,
          },
          { side: 'player', row: 5, col: 4, pieceCode: 'CLOUD', char: '雲', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'CLOUD',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    expect(handTotal(committed.position.hands.player)).toBe(1);
  });

  it('cloud friendly capture adds shop naku to hand when captured piece has only opaque id without char', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4n4/4,4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          {
            side: 'player',
            row: 4,
            col: 4,
            pieceCode: 'piece_e9e01aac8e',
            char: '',
            promoted: false,
          },
          { side: 'player', row: 5, col: 4, pieceCode: 'CLOUD', char: '雲', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'CLOUD',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'PIECE_E9E01AAC8E',
        notation: null,
      },
    });
    expect(handTotal(committed.position.hands.player)).toBe(1);
  });

  it('swamp skill applies vertical-step movement restriction to adjacent enemies', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4|4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'SWAMP', char: '沼', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'SWAMP',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const skillState = committed.position.boardState.skill_state as
      | { movement_modifiers?: Record<string, unknown>[] }
      | undefined;
    const modifiers = skillState?.movement_modifiers ?? [];
    const verticalOnly = modifiers.filter(
      (m) => (m.movement_rule as string) === 'vertical_step_only',
    );
    expect(verticalOnly.length).toBeGreaterThanOrEqual(1);
    expect(verticalOnly.every((m) => (m.remaining_turns as number) === 2)).toBe(true);
  });

  it('poison skill creates origin poison cell with 4 turns', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4;4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'POISON', char: '毒', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'POISON',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const hazards = ((
      committed.position.boardState.skill_state as {
        board_hazards?: Record<string, unknown>[];
      }
    )?.board_hazards ?? []) as Record<string, unknown>[];
    expect(
      hazards.some(
        (h) =>
          h.row === 5 &&
          h.col === 4 &&
          h.hazard_type === 'poison_cell' &&
          h.affects_side === 'enemy' &&
          h.remaining_turns === 4,
      ),
    ).toBe(true);
  });

  it('enemy piece is removed when stepping onto poison cell', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 2,
      moveCount: 1,
      sfen: '4k4/9/9/9/9/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_state: {
          board_hazards: [
            {
              row: 4,
              col: 4,
              hazard_type: 'poison_cell',
              affects_side: 'player',
              remaining_turns: 3,
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const pieces = committed.position.boardState.pieces as {
      side: 'player' | 'enemy';
      row: number;
      col: number;
    }[];
    expect(
      pieces.some((piece) => piece.side === 'player' && piece.row === 4 && piece.col === 4),
    ).toBe(false);
  });

  it('prison piece on move applies prison_fence_stun for 2 turns to one random enemy', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 2, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'PRISON', char: '牢', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'PRISON',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const skillState = (
      committed.position.boardState as {
        skill_state?: { piece_statuses?: Record<string, unknown>[] };
      }
    ).skill_state;
    const stuns = (skillState?.piece_statuses ?? []).filter(
      (s) => (s.status_type as string) === 'prison_fence_stun',
    );
    expect(stuns).toHaveLength(1);
    expect(stuns[0]?.remaining_turns).toBe(2);
    expect(stuns[0]?.side).toBe('enemy');
    expect(stuns[0]?.row).toBe(2);
    expect(stuns[0]?.col).toBe(4);
  });

  it('fence piece on move applies prison_fence_stun for 2 turns to one random enemy', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 2, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'FENCE', char: '柵', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'FENCE',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const skillState = (
      committed.position.boardState as {
        skill_state?: { piece_statuses?: Record<string, unknown>[] };
      }
    ).skill_state;
    const stuns = (skillState?.piece_statuses ?? []).filter(
      (s) => (s.status_type as string) === 'prison_fence_stun',
    );
    expect(stuns).toHaveLength(1);
    expect(stuns[0]?.remaining_turns).toBe(2);
  });

  it('a skill transforms adjacent enemy pieces into pawns', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3s1n3/4a4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'GI', char: '銀', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'KE', char: '桂', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'A', char: 'あ', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'A',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const pieces = committed.position.boardState.pieces as {
      side: 'player' | 'enemy';
      row: number;
      col: number;
      pieceCode: string;
      char: string;
    }[];
    const left = pieces.find((p) => p.side === 'enemy' && p.row === 4 && p.col === 3);
    const right = pieces.find((p) => p.side === 'enemy' && p.row === 4 && p.col === 5);
    expect(left?.pieceCode).toBe('FU');
    expect(left?.char).toBe('歩');
    expect(right?.pieceCode).toBe('FU');
    expect(right?.char).toBe('歩');
    const skillState = (
      committed.position.boardState as {
        skill_state?: { piece_statuses?: Record<string, unknown>[] };
      }
    ).skill_state;
    const statuses = skillState?.piece_statuses ?? [];
    expect(
      statuses.some(
        (status) =>
          status.status_type === 'a_transform' &&
          status.side === 'enemy' &&
          status.row === 4 &&
          status.col === 3,
      ),
    ).toBe(true);
    expect(
      statuses.some(
        (status) =>
          status.status_type === 'a_transform' &&
          status.side === 'enemy' &&
          status.row === 4 &&
          status.col === 5,
      ),
    ).toBe(true);
  });

  it('wood skill summons one wood piece when proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4M4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'MOK', char: '木', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.05); // 10% 抽選成功
    randomSpy.mockReturnValueOnce(0.4); // 候補セル index
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'MOK',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const woodCount =
      boardPieces(committed.position).filter(
        (piece) => piece.side === 'player' && piece.pieceCode === 'MOK',
      ).length ?? 0;
    expect(woodCount).toBe(2);
  });

  it('tane skill summons one leaf piece on random adjacent cell when 20% proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4T4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          {
            side: 'player',
            row: 5,
            col: 4,
            pieceCode: 'piece_shop_tane',
            char: '種',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.1); // 20% 抽選成功
    randomSpy.mockReturnValueOnce(0.6); // 候補セル index
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'piece_shop_tane',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const leafCount =
      boardPieces(committed.position).filter(
        (piece) => piece.side === 'player' && piece.char === '葉',
      ).length ?? 0;
    expect(leafCount).toBe(1);
  });

  it('leaf skill summons one leaf piece when proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4L4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'HAA', char: '葉', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.05); // 10% 抽選成功
    randomSpy.mockReturnValueOnce(0.6); // 候補セル index
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'HAA',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const leafCount =
      boardPieces(committed.position).filter(
        (piece) => piece.side === 'player' && piece.pieceCode === 'HAA',
      ).length ?? 0;
    expect(leafCount).toBe(2);
  });

  it('ridge skill summons one yama piece around mover when 20% proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4R4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'RIDGE', char: '嶺', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.05); // 20% 抽選成功
    randomSpy.mockReturnValueOnce(0.4); // 候補セル index
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 3,
        pieceCode: 'RIDGE',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const yamaCount =
      boardPieces(committed.position).filter(
        (piece) => piece.side === 'player' && piece.char === '山',
      ).length ?? 0;
    expect(yamaCount).toBe(1);
  });

  it('ore skill transforms one allied pawn when 20% proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4O4/4P4/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'ORE', char: '鉱', promoted: false },
          { side: 'player', row: 6, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.05); // 20% 抽選成功
    randomSpy.mockReturnValueOnce(0.0); // 歩候補 index
    randomSpy.mockReturnValueOnce(0.99); // 変化先 index -> COPPER
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'ORE',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const transformed = boardPieces(committed.position).find(
      (piece) => piece.side === 'player' && piece.row === 6 && piece.col === 4,
    );
    expect(transformed?.pieceCode).toBe('COPPER');
    expect(transformed?.char).toBe('銅');
  });

  it('rock skill summons left and right obstacles for 2 turns on empty cells', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4R4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'ROCK', char: '岩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'ROCK',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const boardState = committed.position.boardState as {
      skill_state?: { board_hazards?: Record<string, unknown>[] };
    };
    const hazards = boardState.skill_state?.board_hazards ?? [];
    const rockObstacles = hazards.filter((h) => h.hazard_type === 'rock_obstacle');
    expect(rockObstacles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 4, col: 3, remaining_turns: 2 }),
        expect.objectContaining({ row: 4, col: 5, remaining_turns: 2 }),
      ]),
    );
  });

  it('grave skill summons one spirit around mover when 20% proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4g4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'GRAVE', char: '墓', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.05); // 20% 抽選成功
    randomSpy.mockReturnValueOnce(0.0); // 周囲候補 index
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'GRAVE',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();
    const spiritCount =
      boardPieces(committed.position).filter(
        (piece) => piece.side === 'player' && piece.char === '霊',
      ).length ?? 0;
    expect(spiritCount).toBe(1);
  });

  it('mist skill sends one adjacent enemy to owner hand when 30% proc succeeds (pieceChars 霧 matches MIST)', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p4/4M4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'MIST', char: '霧', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              skillId: 39,
              pieceChars: ['霧'],
              trigger: { type: 'after_move' },
              conditions: [{ type: 'chance_roll', params: { procChance: 0.3 } }],
              effects: [
                {
                  type: 'send_to_hand',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: { handOwner: 'target_owner' },
                },
              ],
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.1); // 30% 抽選成功
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'MIST',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const stillOnBoard = boardPieces(committed.position).some(
      (p) => p.side === 'enemy' && p.row === 4 && p.col === 3,
    );
    expect(stillOnBoard).toBe(false);
    expect(committed.position.hands.enemy?.FU ?? 0).toBe(1);
  });

  it('phantom evades capture to adjacent empty when 50% proc succeeds (pieceChars 幻 matches PHANTOM)', () => {
    const phantomSkillDef = {
      skillId: 38,
      pieceChars: ['幻'],
      trigger: { type: 'continuous_rule' },
      conditions: [{ type: 'chance_roll', params: { procChance: 0.5 } }],
      effects: [
        {
          type: 'defense_or_immunity',
          target: { group: 'self', selector: 'self_piece' },
          params: { mode: 'evade_capture' },
        },
      ],
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3H4/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'PHANTOM', char: '幻', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [phantomSkillDef],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.2); // 50% 回避成功
    randomSpy.mockReturnValueOnce(0); // 退避先 index
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'PHANTOM',
        notation: null,
      },
    });
    randomSpy.mockRestore();

    expect(committed.position.hands.player?.PHANTOM ?? 0).toBe(0);
    const phantom = boardPieces(committed.position).find((p) => p.char === '幻');
    expect(phantom).toBeTruthy();
    expect(phantom?.row === 4 && phantom?.col === 4).toBe(false);
  });

  it('phantom is captured on optimistic online apply when suppressRandomSkillProcs is true', () => {
    const phantomSkillDef = {
      skillId: 38,
      pieceChars: ['幻'],
      trigger: { type: 'continuous_rule' },
      conditions: [{ type: 'chance_roll', params: { procChance: 0.5 } }],
      effects: [
        {
          type: 'defense_or_immunity',
          target: { group: 'self', selector: 'self_piece' },
          params: { mode: 'evade_capture' },
        },
      ],
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3H4/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'PHANTOM', char: '幻', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [phantomSkillDef],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'PHANTOM',
        notation: null,
      },
      options: { suppressRandomSkillProcs: true },
    });
    randomSpy.mockRestore();

    expect(committed.position.hands.player?.PHANTOM ?? 0).toBe(1);
    expect(boardPieces(committed.position).some((p) => p.char === '幻')).toBe(false);
  });

  it('phantom is captured normally when 50% evade proc fails', () => {
    const phantomSkillDef = {
      skillId: 38,
      pieceChars: ['幻'],
      trigger: { type: 'continuous_rule' },
      conditions: [{ type: 'chance_roll', params: { procChance: 0.5 } }],
      effects: [
        {
          type: 'defense_or_immunity',
          target: { group: 'self', selector: 'self_piece' },
          params: { mode: 'evade_capture' },
        },
      ],
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3H4/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'PHANTOM', char: '幻', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [phantomSkillDef],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.99); // 50% 回避失敗
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'PHANTOM',
        notation: null,
      },
    });
    randomSpy.mockRestore();

    expect(boardPieces(committed.position).some((p) => p.char === '幻')).toBe(false);
    expect(committed.position.hands.player?.PHANTOM ?? 0).toBe(1);
  });

  it('boat tows ally directly behind along the same move vector', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4B4/9/4P4/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'BOAT', char: '舟', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 4,
        fromCol: 4,
        toRow: 3,
        toCol: 4,
        pieceCode: 'BOAT',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const towed = boardPieces(committed.position).find(
      (p) => p.side === 'player' && p.char === '歩',
    );
    expect(towed?.row).toBe(4);
    expect(towed?.col).toBe(4);
    const boat = boardPieces(committed.position).find((p) => p.char === '舟');
    expect(boat?.row).toBe(3);
    expect(boat?.col).toBe(4);
  });

  it('bird transports a random ally to the cell directly behind after moving', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4b4/9/4P4/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'BIRD', char: '禽', promoted: false },
          { side: 'player', row: 6, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 4,
        fromCol: 4,
        toRow: 4,
        toCol: 5,
        pieceCode: 'BIRD',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const towed = boardPieces(committed.position).find(
      (piece) => piece.side === 'player' && piece.char === '歩',
    );
    expect(towed?.row).toBe(5);
    expect(towed?.col).toBe(5);
    const bird = boardPieces(committed.position).find((piece) => piece.char === '禽');
    expect(bird?.row).toBe(4);
    expect(bird?.col).toBe(5);
    expect(committed.skillTriggered).toBe(true);
  });

  it('capturing spirit does not add spirit to capturer hand', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4p4/4s4/9/4K4 w - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 6, col: 4, pieceCode: 'SPIRIT', char: '霊', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 6,
        toCol: 4,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'SPIRIT',
        notation: null,
      },
    });
    expect(committed.position.hands.enemy.SPIRIT).toBeUndefined();
  });

  it('star skill returns captured star to owner hand when proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/4k4/4S4/9/9/9/4K4 w - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 3, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'HOS', char: '星', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.1);
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 3,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'OU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'HOS',
        notation: null,
      },
    });
    randomSpy.mockRestore();

    expect(committed.position.hands.player.HOS).toBe(1);
    expect(committed.position.hands.enemy.HOS).toBeUndefined();
    expect(committed.skillTriggered).toBe(true);
  });

  it('star skill gives captured star to capturer hand when proc fails', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/4k4/4S4/9/9/9/4K4 w - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 3, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'HOS', char: '星', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.9);
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 3,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'OU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'HOS',
        notation: null,
      },
    });
    randomSpy.mockRestore();

    expect(committed.position.hands.player.HOS).toBeUndefined();
    expect(committed.position.hands.enemy.HOS).toBe(1);
    expect(committed.skillTriggered).toBe(false);
  });

  it('demon skill removes up to two adjacent enemies when proc succeeds', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4D4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'MAK', char: '魔', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0.05); // 10%抽選成功
    randomSpy.mockReturnValueOnce(0.1); // 1体目選択
    randomSpy.mockReturnValueOnce(0.1); // 2体目選択
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'MAK',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const remainingAdjacentEnemies =
      boardPieces(committed.position).filter(
        (piece) =>
          piece.side === 'enemy' && piece.row === 4 && (piece.col === 3 || piece.col === 5),
      ) ?? [];
    expect(remainingAdjacentEnemies).toHaveLength(0);
  });

  it('demon skill does not remove adjacent enemies when proc fails', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p1p3/4D4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'MAK', char: '魔', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.9); // 10%抽選失敗
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'MAK',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    randomSpy.mockRestore();

    const remainingAdjacentEnemies =
      boardPieces(committed.position).filter(
        (piece) =>
          piece.side === 'enemy' && piece.row === 4 && (piece.col === 3 || piece.col === 5),
      ) ?? [];
    expect(remainingAdjacentEnemies).toHaveLength(2);
  });

  it('keeps original char after moving piece with opaque pieceCode', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4x4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'BA421EA0D85', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'BA421EA0D85',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const pieces = committed.position.boardState.pieces as {
      row: number;
      col: number;
      char: string;
    }[];
    const moved = pieces.find((piece) => piece.row === 4 && piece.col === 4);
    expect(moved?.char).toBe('歩');
  });

  it('K 博士は初回取られで盤上に残り歩は元位置のまま手番が交代する', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'seed',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 5, col: 4, pieceCode: 'KBOSS', char: 'K', promoted: false },
          { side: 'player', row: 6, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 6,
        fromCol: 4,
        toRow: 5,
        toCol: 4,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'KBOSS',
        notation: null,
      },
    });

    expect(committed.position.sideToMove).toBe('enemy');
    const after = boardPieces(committed.position);
    const k = after.find((p) => p.row === 5 && p.col === 4 && p.char === 'K');
    expect(k).toBeTruthy();
    expect((k as { kbossLivesRemaining?: number }).kbossLivesRemaining).toBe(1);
    const fu = after.find((p) => p.pieceCode === 'FU' && p.side === 'player');
    expect(fu?.row).toBe(6);
    expect(fu?.col).toBe(4);
    expect(handTotal(committed.position.hands.player)).toBe(0);
  });

  it('K 博士は kbossLivesRemaining が 1 のとき通常どおり取られて盤から消える', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'seed',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          {
            side: 'enemy',
            row: 5,
            col: 4,
            pieceCode: 'KBOSS',
            char: 'K',
            promoted: false,
            kbossLivesRemaining: 1,
          },
          { side: 'player', row: 6, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 6,
        fromCol: 4,
        toRow: 5,
        toCol: 4,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'KBOSS',
        notation: null,
      },
    });

    expect(boardPieces(committed.position).some((p) => p.char === 'K')).toBe(false);
    expect(handTotal(committed.position.hands.player)).toBe(0);
  });

  it('刀が前方1マスで敵を取ったとき着地点の左右の敵も取る', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3ppp3/4S4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'SWORD', char: '刀', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'SWORD',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'FU',
        notation: null,
      },
    });

    const enemiesOnRow4 = boardPieces(committed.position).filter(
      (p) => p.side === 'enemy' && p.row === 4 && (p.col === 3 || p.col === 4 || p.col === 5),
    );
    expect(enemiesOnRow4).toHaveLength(0);
  });

  it('凸は1手目の後も手番が続き、2手目でも取れる', () => {
    const convexDef: AiPieceDefinition = {
      pieceCode: 'CONVEX',
      canonicalCode: 'CONVEX',
      sfenCode: '+',
      char: '凸',
      name: '凸',
      unlock: 'default',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [
        { dx: 0, dy: -1, maxStep: 9 },
        { dx: 0, dy: 1, maxStep: 9 },
        { dx: -1, dy: 0, maxStep: 9 },
        { dx: 1, dy: 0, maxStep: 9 },
      ],
      isRepeatable: true,
    };
    const catalog: AiPieceDefinition[] = [...pieceCatalog, convexDef];

    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'seed',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 7, col: 4, pieceCode: 'CONVEX', char: '凸', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const first = applyMove({
      position,
      pieceCatalog: catalog,
      move: {
        fromRow: 7,
        fromCol: 4,
        toRow: 5,
        toCol: 4,
        pieceCode: 'CONVEX',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'FU',
        notation: null,
      },
    });

    expect(first.turnConsumed).toBe(false);
    expect(first.position.sideToMove).toBe('player');
    expect(first.position.moveCount).toBe(0);
    const skillState = (first.position.boardState as { skill_state?: Record<string, unknown> })
      .skill_state;
    const statuses = (skillState?.piece_statuses ?? []) as Record<string, unknown>[];
    expect(statuses.some((s) => String(s.status_type) === 'convex_followup')).toBe(true);

    const second = applyMove({
      position: first.position as AiBattlePosition,
      pieceCatalog: catalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'CONVEX',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'FU',
        notation: null,
      },
    });

    expect(second.turnConsumed).toBe(true);
    expect(second.position.sideToMove).toBe('enemy');
    expect(second.position.moveCount).toBe(1);
    expect(Math.max(0, second.position.hands.player.FU ?? 0)).toBeGreaterThanOrEqual(2);
  });

  it('乙は敵駒を取ったあと1手追加移動でき、2手目は取れない', () => {
    const otsuDef: AiPieceDefinition = {
      pieceCode: 'OTSU',
      canonicalCode: 'OTSU',
      sfenCode: '+',
      char: '乙',
      name: '乙',
      unlock: 'default',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [
        { dx: -1, dy: -1, maxStep: 1 },
        { dx: 0, dy: -1, maxStep: 1 },
        { dx: 1, dy: -1, maxStep: 1 },
        { dx: -1, dy: 1, maxStep: 1 },
        { dx: 1, dy: 1, maxStep: 1 },
      ],
      isRepeatable: true,
    };
    const catalog: AiPieceDefinition[] = [...pieceCatalog, otsuDef];

    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'seed',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 3, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'OTSU', char: '乙', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const first = applyMove({
      position,
      pieceCatalog: catalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'OTSU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'FU',
        notation: null,
      },
    });

    expect(first.turnConsumed).toBe(false);
    expect(first.position.sideToMove).toBe('player');
    const skillState = (first.position.boardState as { skill_state?: Record<string, unknown> })
      .skill_state;
    const statuses = (skillState?.piece_statuses ?? []) as Record<string, unknown>[];
    expect(statuses.some((s) => String(s.status_type) === 'otsu_followup')).toBe(true);

    const followupLegal = generateLegalMoves({
      position: first.position as AiBattlePosition,
      pieceCatalog: catalog,
    }).legalMoves;
    expect(
      followupLegal.some(
        (move) =>
          move.fromRow === 4 &&
          move.fromCol === 4 &&
          move.toRow === 3 &&
          move.toCol === 5 &&
          move.capturedPieceCode,
      ),
    ).toBe(false);
    expect(
      followupLegal.some(
        (move) =>
          move.fromRow === 4 &&
          move.fromCol === 4 &&
          move.toRow === 3 &&
          move.toCol === 3 &&
          !move.capturedPieceCode,
      ),
    ).toBe(true);

    const second = applyMove({
      position: first.position as AiBattlePosition,
      pieceCatalog: catalog,
      move: {
        fromRow: 4,
        fromCol: 4,
        toRow: 3,
        toCol: 3,
        pieceCode: 'OTSU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    expect(second.turnConsumed).toBe(true);
    expect(second.position.sideToMove).toBe('enemy');
    expect(second.position.moveCount).toBe(1);
  });

  const nakuCatalog: AiPieceDefinition = {
    pieceCode: 'piece_shop_naku',
    canonicalCode: 'NAKU',
    sfenCode: 'n',
    char: '鳴',
    name: '鳴',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [
      { dx: -1, dy: -1, maxStep: 1 },
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: 1, dy: -1, maxStep: 1 },
      { dx: -1, dy: 1, maxStep: 1 },
      { dx: 1, dy: 1, maxStep: 1 },
    ],
    isRepeatable: true,
  };

  it('鳴が敵歩を取ったとき同種が盤面に2体以上いれば合計3体までまとめて取る', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/3ppp3/4N4/9/4K4 b - 1',
      stateHash: 'naku-pon',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 5, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 5, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          {
            side: 'player',
            row: 6,
            col: 4,
            pieceCode: 'piece_shop_naku',
            char: '鳴',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog: [...pieceCatalog, nakuCatalog],
      move: {
        fromRow: 6,
        fromCol: 4,
        toRow: 5,
        toCol: 4,
        pieceCode: 'piece_shop_naku',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'FU',
        notation: null,
      },
    });

    const enemyPawns = boardPieces(committed.position).filter(
      (p) => p.side === 'enemy' && p.pieceCode === 'FU',
    );
    expect(enemyPawns).toHaveLength(0);
    expect(handTotal(committed.position.hands.player)).toBe(3);
    expect(committed.skillTriggered).toBe(true);
  });

  it('鳴のポン取りは同種が1体だけのとき追加で取らない', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/1p7/4N4/9/4K4 b - 1',
      stateHash: 'naku-single',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          {
            side: 'player',
            row: 6,
            col: 3,
            pieceCode: 'piece_shop_naku',
            char: '鳴',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog: [...pieceCatalog, nakuCatalog],
      move: {
        fromRow: 6,
        fromCol: 3,
        toRow: 5,
        toCol: 4,
        pieceCode: 'piece_shop_naku',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'FU',
        notation: null,
      },
    });

    expect(handTotal(committed.position.hands.player)).toBe(1);
  });

  it('鳴のポン取りは同種が4体以上いても合計3体まで', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4pppp1/4N4/9/4K4 b - 1',
      stateHash: 'naku-cap',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 5, col: 2, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 5, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 5, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          {
            side: 'player',
            row: 6,
            col: 4,
            pieceCode: 'piece_shop_naku',
            char: '鳴',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position,
      pieceCatalog: [...pieceCatalog, nakuCatalog],
      move: {
        fromRow: 6,
        fromCol: 4,
        toRow: 5,
        toCol: 4,
        pieceCode: 'piece_shop_naku',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'FU',
        notation: null,
      },
    });

    expect(handTotal(committed.position.hands.player)).toBe(3);
    expect(
      boardPieces(committed.position).filter((p) => p.side === 'enemy' && p.pieceCode === 'FU'),
    ).toHaveLength(1);
  });
});
