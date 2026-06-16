import { generateLegalMoves } from '@/ai/engine/legal-moves';
import type { AiBattlePosition, AiPieceDefinition } from '@/ai/model';

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
    pieceCode: 'KI',
    canonicalCode: 'KI',
    sfenCode: 'G',
    char: '金',
    name: '金',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'KE',
    canonicalCode: 'KE',
    sfenCode: 'N',
    char: '桂',
    name: '桂',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [
      { dx: -1, dy: -2, maxStep: 1 },
      { dx: 1, dy: -2, maxStep: 1 },
    ],
    isRepeatable: true,
  },
  {
    pieceCode: 'KA',
    canonicalCode: 'KA',
    sfenCode: 'B',
    char: '角',
    name: '角',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    // 敢えて maxStep: 1 を与え、生成側の角専用補正で 9 歩化されることを確認する。
    moveVectors: [
      { dx: -1, dy: -1, maxStep: 1 },
      { dx: 1, dy: -1, maxStep: 1 },
      { dx: -1, dy: 1, maxStep: 1 },
      { dx: 1, dy: 1, maxStep: 1 },
    ],
    isRepeatable: true,
  },
  {
    pieceCode: 'HIK',
    canonicalCode: 'HIK',
    sfenCode: '!',
    char: '光',
    name: '光',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [
      { dx: -1, dy: -1, maxStep: 9 },
      { dx: 1, dy: -1, maxStep: 9 },
      { dx: -1, dy: 1, maxStep: 9 },
      { dx: 1, dy: 1, maxStep: 9 },
    ],
    isRepeatable: true,
  },
  {
    pieceCode: 'HOU',
    canonicalCode: 'HOU',
    sfenCode: 'h',
    char: '砲',
    name: '砲',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [
      { dx: 0, dy: -1, maxStep: 9, captureMode: 'LeapOverOne' },
      { dx: 0, dy: 1, maxStep: 9, captureMode: 'LeapOverOne' },
      { dx: -1, dy: 0, maxStep: 9, captureMode: 'LeapOverOne' },
      { dx: 1, dy: 0, maxStep: 9, captureMode: 'LeapOverOne' },
    ],
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
    pieceCode: 'MIRROR',
    canonicalCode: 'MIRROR',
    sfenCode: ']',
    char: '鏡',
    name: '鏡',
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
    pieceCode: 'BOOK',
    canonicalCode: 'BOOK',
    sfenCode: 'o',
    char: '書',
    name: '書',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
  {
    pieceCode: 'SEAL',
    canonicalCode: 'SEAL',
    sfenCode: 'e',
    char: '封',
    name: '封',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
];

describe('ai engine legal moves', () => {
  it('keeps king movable after moving once', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const first = generateLegalMoves({ position, pieceCatalog });
    const kingMoves = first.legalMoves.filter((m) => m.fromRow === 8 && m.fromCol === 4);
    expect(kingMoves.length).toBeGreaterThan(0);
  });

  it('keeps king movable even when char is 玉', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 3,
      moveCount: 2,
      sfen: '4k4/9/9/9/9/9/9/4K4/9 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 7, col: 4, pieceCode: null, char: '玉', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(legal.legalMoves.some((m) => m.fromRow === 7 && m.fromCol === 4)).toBe(true);
  });

  it('enforces mandatory promotion for a pawn entering the last row', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/4P4/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 1, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const legal = generateLegalMoves({ position, pieceCatalog });
    const pawnMoves = legal.legalMoves.filter((move) => move.fromRow === 1 && move.toRow === 0);

    expect(pawnMoves).toHaveLength(1);
    expect(pawnMoves[0]?.promote).toBe(true);
  });

  it('prevents promotion for pawns transformed by a-skill', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/4P4/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 1, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_state: {
          piece_statuses: [
            {
              side: 'player',
              row: 1,
              col: 4,
              status_type: 'a_transform',
              remaining_turns: 2,
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };

    const legal = generateLegalMoves({ position, pieceCatalog });
    const pawnMoves = legal.legalMoves.filter((move) => move.fromRow === 1 && move.toRow === 0);

    expect(pawnMoves).toHaveLength(1);
    expect(pawnMoves[0]?.promote).toBe(false);
  });

  it('rejects illegal pawn drops in a file with another unpromoted pawn', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/9/9/4P4/4K4 b P 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 7, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: { FU: 1 }, enemy: {} },
    };

    const legal = generateLegalMoves({ position, pieceCatalog });

    expect(legal.legalMoves.some((move) => move.dropPieceCode === 'FU' && move.toCol === 4)).toBe(
      false,
    );
  });

  it('rejects drops onto rock obstacle cells', () => {
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
        skill_state: {
          board_hazards: [
            {
              row: 6,
              col: 4,
              hazard_type: 'rock_obstacle',
              affects_side: 'both',
              remaining_turns: 2,
            },
          ],
        },
      },
      hands: { player: { FU: 1 }, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(
      legal.legalMoves.some(
        (move) => move.dropPieceCode === 'FU' && move.toRow === 6 && move.toCol === 4,
      ),
    ).toBe(false);
  });

  it('blocks moves for stunned pieces from piece_statuses', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4p4/9/9/4K4 w - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_state: {
          piece_statuses: [
            {
              side: 'enemy',
              row: 5,
              col: 4,
              status_type: 'stun',
              remaining_turns: 2,
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };

    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(legal.legalMoves.some((move) => move.fromRow === 5 && move.fromCol === 4)).toBe(false);
  });

  it('blocks moves for prison_fence_stun pieces like stun', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4p4/9/9/4K4 w - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_state: {
          piece_statuses: [
            {
              side: 'enemy',
              row: 5,
              col: 4,
              status_type: 'prison_fence_stun',
              remaining_turns: 2,
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };

    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(legal.legalMoves.some((move) => move.fromRow === 5 && move.fromCol === 4)).toBe(false);
  });

  it('blocks moves for enemy special pieces when peak exists on board', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 2,
      moveCount: 1,
      sfen: '4k4/9/9/9/4m4/4P4/9/9/4K4 w - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'MIRROR', char: '鏡', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'PEAK', char: '峰', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_state: {
          piece_statuses: [
            {
              side: 'enemy',
              row: 4,
              col: 4,
              status_type: 'peak_lock',
              remaining_turns: 1,
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(legal.legalMoves.some((move) => move.fromRow === 4 && move.fromCol === 4)).toBe(false);
  });

  it('does not immobilize king even with time_stop status', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 3,
      moveCount: 2,
      sfen: '4k4/9/9/9/9/9/9/4K4/9 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 7, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_state: {
          piece_statuses: [
            {
              side: 'player',
              row: 7,
              col: 4,
              status_type: 'time_stop',
              remaining_turns: 2,
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(legal.legalMoves.some((move) => move.fromRow === 7 && move.fromCol === 4)).toBe(true);
  });

  it('applies orthogonal_step_only movement modifier to king as well', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 3,
      moveCount: 2,
      sfen: '4k4/9/9/9/9/9/9/4K4/9 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 7, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_state: {
          movement_modifiers: [
            {
              side: 'player',
              row: 7,
              col: 4,
              movement_rule: 'orthogonal_step_only',
              remaining_turns: 2,
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    const kingMoves = legal.legalMoves.filter((move) => move.fromRow === 7 && move.fromCol === 4);
    expect(kingMoves.length).toBe(4);
    expect(
      kingMoves.every((move) => Math.abs(move.toRow - 7) + Math.abs(move.toCol - 4) === 1),
    ).toBe(true);
  });

  it('blocks moves for dark_blind pieces', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 3,
      moveCount: 2,
      sfen: '4k4/9/9/9/4p4/9/9/9/4K4 w - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_state: {
          piece_statuses: [
            {
              side: 'enemy',
              row: 4,
              col: 4,
              status_type: 'dark_blind',
              remaining_turns: 3,
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(legal.legalMoves.some((move) => move.fromRow === 4 && move.fromCol === 4)).toBe(false);
  });

  it('cloud piece can capture allied piece', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 5,
      moveCount: 4,
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
    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(
      legal.legalMoves.some((move) => move.fromRow === 5 && move.fromCol === 4 && move.toRow === 4),
    ).toBe(true);
  });

  it('cloud piece cannot capture enemy piece', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 5,
      moveCount: 4,
      sfen: '4k4/9/9/9/4p4/4,4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'CLOUD', char: '雲', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(
      legal.legalMoves.some(
        (move) => move.fromRow === 5 && move.fromCol === 4 && move.toRow === 4 && move.toCol === 4,
      ),
    ).toBe(false);
  });

  it('cloud piece cannot capture allied king', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 5,
      moveCount: 4,
      sfen: '4k4/9/9/9/4K4/4,4/9/9/9 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'CLOUD', char: '雲', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(
      legal.legalMoves.some(
        (move) => move.fromRow === 5 && move.fromCol === 4 && move.toRow === 4 && move.toCol === 4,
      ),
    ).toBe(false);
  });

  it('king cannot move onto poison cell', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 6,
      moveCount: 5,
      sfen: '4k4/9/9/9/9/9/9/4K4/9 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 7, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_state: {
          board_hazards: [
            {
              row: 6,
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
    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(
      legal.legalMoves.some(
        (move) => move.fromRow === 7 && move.fromCol === 4 && move.toRow === 6 && move.toCol === 4,
      ),
    ).toBe(false);
  });

  it('any piece cannot move onto rock obstacle cell', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 6,
      moveCount: 5,
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
              hazard_type: 'rock_obstacle',
              affects_side: 'both',
              remaining_turns: 2,
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(
      legal.legalMoves.some(
        (move) => move.fromRow === 5 && move.fromCol === 4 && move.toRow === 4 && move.toCol === 4,
      ),
    ).toBe(false);
  });

  it('mirror piece copies movement vectors from front-facing enemy', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 7,
      moveCount: 6,
      sfen: '4k4/9/9/9/9/4]4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 2, col: 2, pieceCode: 'KE', char: '桂', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'MIRROR', char: '鏡', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    const mirrorMoves = legal.legalMoves.filter((move) => move.fromRow === 5 && move.fromCol === 4);
    const targets = mirrorMoves.map((m) => `${m.toRow}:${m.toCol}`);
    expect(targets).toContain('4:3');
    expect(targets).toContain('4:4');
    expect(targets).toContain('4:5');
    expect(targets).not.toContain('3:2');
    expect(targets).not.toContain('3:6');
  });

  it('mirror piece moves orthogonally when no enemy is directly in front', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4]4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 0, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'MIRROR', char: '鏡', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    const mirrorMoves = legal.legalMoves.filter((move) => move.fromRow === 5 && move.fromCol === 4);
    const targets = new Set(mirrorMoves.map((m) => `${m.toRow}:${m.toCol}`));
    expect(targets).toEqual(new Set(['4:4', '5:3', '5:5', '6:4']));
  });

  it('prevents capturing dark_blind covered enemy piece', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 3,
      moveCount: 2,
      sfen: '4k4/9/9/9/4p4/5P3/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_state: {
          piece_statuses: [
            {
              side: 'enemy',
              row: 4,
              col: 4,
              status_type: 'dark_blind',
              remaining_turns: 3,
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(
      legal.legalMoves.some(
        (move) => move.fromRow === 5 && move.fromCol === 5 && move.toRow === 4 && move.toCol === 4,
      ),
    ).toBe(false);
  });

  it('generates reflective diagonal moves for HIK piece', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/4!4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'HIK', char: '光', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(
      legal.legalMoves.some(
        (m) => m.fromRow === 5 && m.fromCol === 4 && m.toRow === 4 && m.toCol === 3,
      ),
    ).toBe(true);
    expect(
      legal.legalMoves.some(
        (m) => m.fromRow === 5 && m.fromCol === 4 && m.toRow === 4 && m.toCol === 5,
      ),
    ).toBe(true);
  });

  it('allows HOU leap-over-one capture with one platform piece', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/4p4/4p4/4h4/9/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 2, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 3, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'HOU', char: '砲', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(
      legal.legalMoves.some(
        (m) => m.fromRow === 4 && m.fromCol === 4 && m.toRow === 2 && m.toCol === 4,
      ),
    ).toBe(true);
  });

  it('allows KA bishop to move diagonally any distance', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4B4/9/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'KA', char: '角', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    expect(
      legal.legalMoves.some(
        (m) => m.fromRow === 4 && m.fromCol === 4 && m.toRow === 0 && m.toCol === 0,
      ),
    ).toBe(true);
    expect(
      legal.legalMoves.some(
        (m) => m.fromRow === 4 && m.fromCol === 4 && m.toRow === 7 && m.toCol === 7,
      ),
    ).toBe(true);
  });

  it('forces KI gold move set to forward/diag-forward/sides/backward only', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4G4/9/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    const goldMoves = legal.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 4);
    expect(goldMoves.some((m) => m.toRow === 3 && m.toCol === 3)).toBe(true);
    expect(goldMoves.some((m) => m.toRow === 3 && m.toCol === 4)).toBe(true);
    expect(goldMoves.some((m) => m.toRow === 3 && m.toCol === 5)).toBe(true);
    expect(goldMoves.some((m) => m.toRow === 4 && m.toCol === 3)).toBe(true);
    expect(goldMoves.some((m) => m.toRow === 4 && m.toCol === 5)).toBe(true);
    expect(goldMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(true);
    expect(goldMoves.some((m) => m.toRow === 5 && m.toCol === 3)).toBe(false);
    expect(goldMoves.some((m) => m.toRow === 5 && m.toCol === 5)).toBe(false);
    expect(goldMoves).toHaveLength(6);
  });

  it('does not throw when book is on board with no last enemy move (turn 1)', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/9 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'player', row: 6, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 7, col: 3, pieceCode: 'BOOK', char: '書', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '玉', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    expect(() => generateLegalMoves({ position, pieceCatalog })).not.toThrow();
    const legal = generateLegalMoves({ position, pieceCatalog });
    const pawnMoves = legal.legalMoves.filter((m) => m.fromRow === 6 && m.fromCol === 4);
    expect(pawnMoves.length).toBeGreaterThan(0);
  });

  it('book copies opponent last moved piece move range', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 3,
      moveCount: 2,
      sfen: '4k4/9/9/9/4N4/4o4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'BOOK', char: '書', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_state: {
          last_enemy_moved_piece: {
            side: 'enemy',
            row: 4,
            col: 4,
            pieceCode: 'KE',
            char: '桂',
            promoted: false,
            copiedMoveVectors: [
              { dx: -1, dy: -2, maxStep: 1 },
              { dx: 1, dy: -2, maxStep: 1 },
            ],
          },
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    const bookMoves = legal.legalMoves.filter((m) => m.fromRow === 5 && m.fromCol === 4);
    expect(bookMoves.some((m) => m.toRow === 3 && m.toCol === 3)).toBe(true);
    expect(bookMoves.some((m) => m.toRow === 3 && m.toCol === 5)).toBe(true);
    expect(bookMoves.some((m) => m.toRow === 5 && m.toCol === 3)).toBe(false);
  });

  it('book falls back to orthogonal one step when opponent last move is unknown', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/9/9/9/4o4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 7, col: 4, pieceCode: 'BOOK', char: '書', promoted: false },
          { side: 'player', row: 8, col: 3, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    const bookMoves = legal.legalMoves.filter((m) => m.fromRow === 7 && m.fromCol === 4);
    expect(bookMoves.some((m) => m.toRow === 6 && m.toCol === 4)).toBe(true);
    expect(bookMoves.some((m) => m.toRow === 8 && m.toCol === 4)).toBe(true);
    expect(bookMoves.some((m) => m.toRow === 7 && m.toCol === 3)).toBe(true);
    expect(bookMoves.some((m) => m.toRow === 7 && m.toCol === 5)).toBe(true);
    expect(bookMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(false);
  });

  it('seal immobilizes enemies on diagonal adjacent cells', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/3p1p3/4e4/3p1p3/9/9/4K4 w - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 3, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 3, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 5, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 5, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'SEAL', char: '封', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    const diagEnemyMoves = legal.legalMoves.filter(
      (m) =>
        m.fromRow != null &&
        m.fromCol != null &&
        ((m.fromRow === 3 && m.fromCol === 3) ||
          (m.fromRow === 3 && m.fromCol === 5) ||
          (m.fromRow === 5 && m.fromCol === 3) ||
          (m.fromRow === 5 && m.fromCol === 5)),
    );
    expect(diagEnemyMoves).toHaveLength(0);
  });

  it('tane piece generates silver-like moves even when catalog vectors are empty', () => {
    const taneCatalog: AiPieceDefinition = {
      pieceCode: 'piece_shop_tane',
      canonicalCode: 'TANE',
      sfenCode: ',',
      char: '種',
      name: '種',
      unlock: 'shop',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [],
      isRepeatable: false,
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'tane-silver',
      boardState: {
        pieces: [
          {
            side: 'player',
            row: 6,
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
    const legal = generateLegalMoves({ position, pieceCatalog: [...pieceCatalog, taneCatalog] });
    const taneMoves = legal.legalMoves.filter((m) => m.fromRow === 6 && m.fromCol === 4);
    expect(taneMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(true);
    expect(taneMoves.some((m) => m.toRow === 5 && m.toCol === 3)).toBe(true);
    expect(taneMoves.some((m) => m.toRow === 5 && m.toCol === 5)).toBe(true);
  });

  it('copper piece generates knight jump and forward slide even when catalog vectors are gold-like', () => {
    const copperCatalog: AiPieceDefinition = {
      pieceCode: 'COPPER',
      canonicalCode: 'COPPER',
      sfenCode: 'A',
      char: '銅',
      name: '銅',
      unlock: 'default',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
      isRepeatable: false,
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'copper-move',
      boardState: {
        pieces: [
          {
            side: 'player',
            row: 6,
            col: 4,
            pieceCode: 'COPPER',
            char: '銅',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog: [...pieceCatalog, copperCatalog] });
    const copperMoves = legal.legalMoves.filter((m) => m.fromRow === 6 && m.fromCol === 4);
    expect(copperMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(true);
    expect(copperMoves.some((m) => m.toRow === 4 && m.toCol === 4)).toBe(true);
    expect(copperMoves.some((m) => m.toRow === 4 && m.toCol === 3)).toBe(true);
    expect(copperMoves.some((m) => m.toRow === 4 && m.toCol === 5)).toBe(true);
    expect(copperMoves.some((m) => m.toRow === 6 && m.toCol === 5)).toBe(false);
  });

  it('wave piece generates 2-square orthogonal moves even when catalog vectors are pawn-like', () => {
    const waveCatalog: AiPieceDefinition = {
      pieceCode: 'NAM',
      canonicalCode: 'NAM',
      sfenCode: 'Q',
      char: '波',
      name: '波',
      unlock: 'default',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
      isRepeatable: false,
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'wave-move',
      boardState: {
        pieces: [
          {
            side: 'player',
            row: 6,
            col: 4,
            pieceCode: 'NAM',
            char: '波',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog: [...pieceCatalog, waveCatalog] });
    const waveMoves = legal.legalMoves.filter((m) => m.fromRow === 6 && m.fromCol === 4);
    expect(waveMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(true);
    expect(waveMoves.some((m) => m.toRow === 4 && m.toCol === 4)).toBe(true);
    expect(waveMoves.some((m) => m.toRow === 6 && m.toCol === 3)).toBe(true);
    expect(waveMoves.some((m) => m.toRow === 6 && m.toCol === 2)).toBe(true);
    expect(waveMoves.some((m) => m.toRow === 3 && m.toCol === 4)).toBe(false);
  });

  it('pig piece generates 2-square orthogonal moves before inheriting enemy movement', () => {
    const pigCatalog: AiPieceDefinition = {
      pieceCode: 'PIG',
      canonicalCode: 'PIG',
      sfenCode: 'P',
      char: '豚',
      name: '豚',
      unlock: 'default',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
      isRepeatable: false,
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'pig-move',
      boardState: {
        pieces: [
          {
            side: 'player',
            row: 6,
            col: 4,
            pieceCode: 'PIG',
            char: '豚',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog: [...pieceCatalog, pigCatalog] });
    const pigMoves = legal.legalMoves.filter((m) => m.fromRow === 6 && m.fromCol === 4);
    expect(pigMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(true);
    expect(pigMoves.some((m) => m.toRow === 4 && m.toCol === 4)).toBe(true);
    expect(pigMoves.some((m) => m.toRow === 6 && m.toCol === 3)).toBe(true);
    expect(pigMoves.some((m) => m.toRow === 6 && m.toCol === 2)).toBe(true);
    expect(pigMoves.some((m) => m.toRow === 3 && m.toCol === 4)).toBe(false);
  });

  it('pig with inherited movement uses captured piece vectors instead of base pig move', () => {
    const pigCatalog: AiPieceDefinition = {
      pieceCode: 'PIG',
      canonicalCode: 'PIG',
      sfenCode: 'P',
      char: '豚',
      name: '豚',
      unlock: 'default',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
      isRepeatable: false,
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'pig-inherit',
      boardState: {
        pieces: [
          {
            side: 'player',
            row: 6,
            col: 4,
            pieceCode: 'PIG',
            char: '豚',
            promoted: false,
            pigInheritedPieceCode: 'FU',
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog: [...pieceCatalog, pigCatalog] });
    const pigMoves = legal.legalMoves.filter((m) => m.fromRow === 6 && m.fromCol === 4);
    expect(pigMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(true);
    expect(pigMoves.some((m) => m.toRow === 4 && m.toCol === 4)).toBe(false);
    expect(pigMoves.some((m) => m.toRow === 6 && m.toCol === 3)).toBe(false);
  });

  it('run piece moves up to 2 squares forward when path is clear', () => {
    const runCatalog: AiPieceDefinition = {
      pieceCode: 'piece_shop_so',
      canonicalCode: 'SO',
      sfenCode: '+',
      char: '走',
      name: '走',
      unlock: 'shop',
      desc: 'なし',
      skill: '',
      move: '前方に最大2マス進める。1マス目に駒がある場合は2マス目には進めない。',
      moveVectors: [],
      isRepeatable: false,
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'run-clear',
      boardState: {
        pieces: [
          {
            side: 'player',
            row: 6,
            col: 4,
            pieceCode: 'piece_shop_so',
            char: '走',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog: [...pieceCatalog, runCatalog] });
    const runMoves = legal.legalMoves.filter((m) => m.fromRow === 6 && m.fromCol === 4);
    expect(runMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(true);
    expect(runMoves.some((m) => m.toRow === 4 && m.toCol === 4)).toBe(true);
  });

  it('run piece cannot reach 2nd square when 1st square is occupied', () => {
    const runCatalog: AiPieceDefinition = {
      pieceCode: 'piece_shop_so',
      canonicalCode: 'SO',
      sfenCode: '+',
      char: '走',
      name: '走',
      unlock: 'shop',
      desc: 'なし',
      skill: '',
      move: '',
      moveVectors: [],
      isRepeatable: false,
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'run-blocked',
      boardState: {
        pieces: [
          {
            side: 'player',
            row: 6,
            col: 4,
            pieceCode: 'piece_shop_so',
            char: '走',
            promoted: false,
          },
          { side: 'enemy', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog: [...pieceCatalog, runCatalog] });
    const runMoves = legal.legalMoves.filter((m) => m.fromRow === 6 && m.fromCol === 4);
    expect(runMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(true);
    expect(runMoves.some((m) => m.toRow === 4 && m.toCol === 4)).toBe(false);
  });

  it('kirin piece generates moves even when catalog vectors are empty', () => {
    const kirinCatalog: AiPieceDefinition = {
      pieceCode: 'piece_shop_kirin',
      canonicalCode: 'KIRIN',
      sfenCode: '-',
      char: '麒',
      name: '麒',
      unlock: 'shop',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [],
      isRepeatable: true,
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'kirin-moves',
      boardState: {
        pieces: [
          {
            side: 'player',
            row: 4,
            col: 4,
            pieceCode: 'piece_shop_kirin',
            char: '麒',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog: [...pieceCatalog, kirinCatalog] });
    const kirinMoves = legal.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 4);
    expect(kirinMoves.some((m) => m.toRow === 3 && m.toCol === 4)).toBe(true);
    expect(kirinMoves.some((m) => m.toRow === 4 && m.toCol === 3)).toBe(true);
    expect(kirinMoves.some((m) => m.toRow === 3 && m.toCol === 3)).toBe(true);
  });

  it('kirin cannot be captured by enemy pawn gold or silver', () => {
    const kirinCatalog: AiPieceDefinition = {
      pieceCode: 'piece_shop_kirin',
      canonicalCode: 'KIRIN',
      sfenCode: '-',
      char: '麒',
      name: '麒',
      unlock: 'shop',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [
        { dx: -1, dy: 0, maxStep: 9 },
        { dx: 1, dy: 0, maxStep: 9 },
        { dx: 0, dy: -1, maxStep: 9 },
        { dx: 0, dy: 1, maxStep: 9 },
        { dx: -1, dy: -1, maxStep: 1 },
        { dx: 1, dy: -1, maxStep: 1 },
        { dx: -1, dy: 1, maxStep: 1 },
        { dx: 1, dy: 1, maxStep: 1 },
      ],
      isRepeatable: true,
    };
    const silverCatalog: AiPieceDefinition = {
      pieceCode: 'GI',
      canonicalCode: 'GI',
      sfenCode: 'S',
      char: '銀',
      name: '銀',
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
      isRepeatable: false,
    };
    const catalog = [...pieceCatalog, kirinCatalog, silverCatalog];
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'kirin-immune',
      boardState: {
        pieces: [
          {
            side: 'enemy',
            row: 4,
            col: 4,
            pieceCode: 'piece_shop_kirin',
            char: '麒',
            promoted: false,
          },
          { side: 'player', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 3, pieceCode: 'GI', char: '銀', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog: catalog });
    const pawnCapture = legal.legalMoves.some(
      (m) => m.fromRow === 5 && m.fromCol === 4 && m.toRow === 4 && m.toCol === 4,
    );
    const silverCapture = legal.legalMoves.some(
      (m) => m.fromRow === 5 && m.fromCol === 3 && m.toRow === 4 && m.toCol === 4,
    );
    expect(pawnCapture).toBe(false);
    expect(silverCapture).toBe(false);
  });

  it('shop P piece generates orthogonal moves even when catalog vectors are empty', () => {
    const pCatalog: AiPieceDefinition = {
      pieceCode: 'piece_shop_p',
      canonicalCode: 'SHOP_P',
      sfenCode: '!',
      char: 'P',
      name: 'P',
      unlock: 'shop',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [],
      isRepeatable: false,
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'shop-p-moves',
      boardState: {
        pieces: [
          {
            side: 'player',
            row: 4,
            col: 4,
            pieceCode: 'piece_shop_p',
            char: 'P',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog: [...pieceCatalog, pCatalog] });
    const pMoves = legal.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 4);
    expect(pMoves.some((m) => m.toRow === 3 && m.toCol === 4)).toBe(true);
    expect(pMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(true);
    expect(pMoves.some((m) => m.toRow === 4 && m.toCol === 3)).toBe(true);
    expect(pMoves.some((m) => m.toRow === 4 && m.toCol === 5)).toBe(true);
    expect(pMoves).toHaveLength(4);
  });

  it('shop P immobilizes enemies on the same row or column', () => {
    const pCatalog: AiPieceDefinition = {
      pieceCode: 'piece_shop_p',
      canonicalCode: 'SHOP_P',
      sfenCode: '!',
      char: 'P',
      name: 'P',
      unlock: 'shop',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [],
      isRepeatable: false,
    };
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/1p1p1p3/4P4/9/4K4 w - 1',
      stateHash: 'shop-p-lock',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 2, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 3, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 2, col: 2, pieceCode: 'FU', char: '歩', promoted: false },
          {
            side: 'player',
            row: 4,
            col: 4,
            pieceCode: 'piece_shop_p',
            char: 'P',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog: [...pieceCatalog, pCatalog] });
    const lockedEnemyMoves = legal.legalMoves.filter(
      (m) =>
        m.fromRow != null &&
        m.fromCol != null &&
        ((m.fromRow === 4 && m.fromCol === 2) || (m.fromRow === 3 && m.fromCol === 4)),
    );
    const freeEnemyMoves = legal.legalMoves.filter((m) => m.fromRow === 2 && m.fromCol === 2);
    expect(lockedEnemyMoves).toHaveLength(0);
    expect(freeEnemyMoves.length).toBeGreaterThan(0);
  });

  it('shop P does not immobilize enemy king or giant on same row or column', () => {
    const pCatalog: AiPieceDefinition = {
      pieceCode: 'piece_shop_p',
      canonicalCode: 'SHOP_P',
      sfenCode: '!',
      char: 'P',
      name: 'P',
      unlock: 'shop',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [],
      isRepeatable: false,
    };
    const giantCatalog: AiPieceDefinition = {
      pieceCode: 'GIANT',
      canonicalCode: 'GIANT',
      sfenCode: 'g',
      char: '巨',
      name: '巨',
      unlock: 'default',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [],
      isRepeatable: false,
    };
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/9/4G4/4P4/4K4 w - 1',
      stateHash: 'shop-p-exempt',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          {
            side: 'enemy',
            row: 4,
            col: 6,
            pieceCode: 'GIANT',
            char: '巨',
            promoted: false,
          },
          {
            side: 'player',
            row: 4,
            col: 4,
            pieceCode: 'piece_shop_p',
            char: 'P',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({
      position,
      pieceCatalog: [...pieceCatalog, pCatalog, giantCatalog],
    });
    const kingMoves = legal.legalMoves.filter((m) => m.fromRow === 0 && m.fromCol === 4);
    const giantMoves = legal.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 6);
    expect(kingMoves.length).toBeGreaterThan(0);
    expect(giantMoves.length).toBeGreaterThan(0);
  });

  it('naku piece generates silver-like moves even when catalog vectors are empty', () => {
    const nakuCatalog: AiPieceDefinition = {
      pieceCode: 'piece_shop_naku',
      canonicalCode: 'NAKU',
      sfenCode: '@',
      char: '鳴',
      name: '鳴',
      unlock: 'shop',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [],
      isRepeatable: false,
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'naku-silver',
      boardState: {
        pieces: [
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
    const legal = generateLegalMoves({ position, pieceCatalog: [...pieceCatalog, nakuCatalog] });
    const nakuMoves = legal.legalMoves.filter((m) => m.fromRow === 6 && m.fromCol === 4);
    expect(nakuMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(true);
    expect(nakuMoves.some((m) => m.toRow === 5 && m.toCol === 3)).toBe(true);
    expect(nakuMoves.some((m) => m.toRow === 5 && m.toCol === 5)).toBe(true);
    expect(nakuMoves.some((m) => m.toRow === 7 && m.toCol === 3)).toBe(true);
    expect(nakuMoves.some((m) => m.toRow === 7 && m.toCol === 5)).toBe(true);
  });

  it('mai piece generates gold-like moves even when catalog vectors are empty', () => {
    const maiCatalog: AiPieceDefinition = {
      pieceCode: 'piece_shop_mai',
      canonicalCode: 'MAI',
      sfenCode: '.',
      char: '舞',
      name: '舞',
      unlock: 'shop',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [],
      isRepeatable: false,
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '9/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'mai-moves',
      boardState: {
        pieces: [
          {
            side: 'player',
            row: 4,
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
    const legal = generateLegalMoves({ position, pieceCatalog: [...pieceCatalog, maiCatalog] });
    const maiMoves = legal.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 4);
    expect(maiMoves).toHaveLength(6);
    expect(maiMoves.some((m) => m.toRow === 3 && m.toCol === 4)).toBe(true);
    expect(maiMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(true);
  });

  it('mai without moving does not restrict adjacent enemies', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4G4/4.4/9/9/4K4 w - 1',
      stateHash: 'mai-idle',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'KI', char: '金', promoted: false },
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
    const legal = generateLegalMoves({ position, pieceCatalog });
    const goldMoves = legal.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 4);
    expect(goldMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(true);
    expect(goldMoves.length).toBeGreaterThan(2);
  });

  it('applies diagonal_forward_step_only movement modifier', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4G4/9/9/9/4K4 w - 1',
      stateHash: 'mai-restrict',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'KI', char: '金', promoted: false },
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
              side: 'enemy',
              row: 4,
              col: 4,
              movement_rule: 'diagonal_forward_step_only',
              remaining_turns: 999,
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    const goldMoves = legal.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 4);
    expect(goldMoves.some((m) => m.toRow === 5 && m.toCol === 3)).toBe(true);
    expect(goldMoves.some((m) => m.toRow === 5 && m.toCol === 5)).toBe(true);
    expect(goldMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(false);
    expect(goldMoves.some((m) => m.toRow === 3 && m.toCol === 4)).toBe(false);
    expect(goldMoves).toHaveLength(2);
  });

  it('diagonal_forward_step_only gives pawn only synthesized diagonal-forward moves', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4P4/9/9/9/4K4 w - 1',
      stateHash: 'mai-pawn-restrict',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
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
              side: 'enemy',
              row: 4,
              col: 4,
              movement_rule: 'diagonal_forward_step_only',
              remaining_turns: 999,
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    const pawnMoves = legal.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 4);
    expect(pawnMoves.some((m) => m.toRow === 5 && m.toCol === 3)).toBe(true);
    expect(pawnMoves.some((m) => m.toRow === 5 && m.toCol === 5)).toBe(true);
    expect(pawnMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(false);
    expect(pawnMoves).toHaveLength(2);
  });

  it('phantom piece generates orthogonal one-step and knight jump even when catalog vectors are gold-like', () => {
    const phantomCatalog: AiPieceDefinition = {
      pieceId: 9001,
      pieceCode: 'PHANTOM',
      canonicalCode: 'PHANTOM',
      char: '幻',
      name: '幻',
      unlock: 'test',
      desc: '',
      skill: '',
      move: 'phantom',
      isRepeatable: false,
      moveVectors: [
        { dx: -1, dy: -1, maxStep: 1 },
        { dx: 0, dy: -1, maxStep: 1 },
        { dx: 1, dy: -1, maxStep: 1 },
        { dx: -1, dy: 0, maxStep: 1 },
        { dx: 1, dy: 0, maxStep: 1 },
        { dx: 0, dy: 1, maxStep: 1 },
      ],
      canJump: false,
      isPromoted: false,
      moveConstraints: null,
      moveRules: [],
      skillDefinitionsV2: null,
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'phantom-move',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 6, col: 4, pieceCode: 'PHANTOM', char: '幻', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog: [...pieceCatalog, phantomCatalog] });
    const phantomMoves = legal.legalMoves.filter((m) => m.fromRow === 6 && m.fromCol === 4);
    expect(phantomMoves.some((m) => m.toRow === 5 && m.toCol === 4)).toBe(true);
    expect(phantomMoves.some((m) => m.toRow === 6 && m.toCol === 3)).toBe(true);
    expect(phantomMoves.some((m) => m.toRow === 4 && m.toCol === 3)).toBe(true);
    expect(phantomMoves.some((m) => m.toRow === 4 && m.toCol === 5)).toBe(true);
    expect(phantomMoves.some((m) => m.toRow === 5 && m.toCol === 3)).toBe(false);
  });

  it('yama piece generates diagonal one-step moves even when catalog vectors are forward-only', () => {
    const yamaCatalog: AiPieceDefinition = {
      pieceId: 9002,
      pieceCode: 'YAMA',
      canonicalCode: 'YAMA',
      char: '山',
      name: '山',
      unlock: 'test',
      desc: '',
      skill: '',
      move: 'yama',
      isRepeatable: false,
      moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
      canJump: false,
      isPromoted: false,
      moveConstraints: null,
      moveRules: [],
      skillDefinitionsV2: null,
    };
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/9/9/9/4K4 b - 1',
      stateHash: 'yama-move',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'YAMA', char: '山', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog: [...pieceCatalog, yamaCatalog] });
    const yamaMoves = legal.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 4);
    expect(yamaMoves.some((m) => m.toRow === 3 && m.toCol === 3)).toBe(true);
    expect(yamaMoves.some((m) => m.toRow === 3 && m.toCol === 5)).toBe(true);
    expect(yamaMoves.some((m) => m.toRow === 5 && m.toCol === 3)).toBe(true);
    expect(yamaMoves.some((m) => m.toRow === 5 && m.toCol === 5)).toBe(true);
    expect(yamaMoves.some((m) => m.toRow === 3 && m.toCol === 4)).toBe(false);
    expect(yamaMoves).toHaveLength(4);
  });
});
