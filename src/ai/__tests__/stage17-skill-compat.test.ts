import { applyMove } from '@/ai/engine/apply-move';
import { generateLegalMoves } from '@/ai/engine/legal-moves';
import type { AiBattlePosition, AiPieceDefinition } from '@/ai/model';

type TestBoardPiece = {
  side: 'player' | 'enemy';
  row: number;
  col: number;
  pieceCode: string;
  char?: string;
};

function asAiPosition(position: unknown): AiBattlePosition {
  return position as AiBattlePosition;
}

function boardPieces(position: { boardState?: unknown }): TestBoardPiece[] {
  const boardState = position.boardState as { pieces?: TestBoardPiece[] } | undefined;
  return boardState?.pieces ?? [];
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
    pieceCode: 'KI',
    canonicalCode: 'KI',
    sfenCode: 'G',
    char: '金',
    name: '金',
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
      { dx: 0, dy: 1, maxStep: 1 },
    ],
    isRepeatable: true,
  },
  {
    pieceCode: 'POISON',
    canonicalCode: 'POISON',
    sfenCode: '=',
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
    pieceCode: 'DARK',
    canonicalCode: 'DARK',
    sfenCode: '!',
    char: '闇',
    name: '闇',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: true,
  },
];

describe('stage17 skill compatibility', () => {
  it('keeps poison origin hazard for subsequent turn', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/9/4P4/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 6, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['FU'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'board_hazard',
                  target: { group: 'board', selector: 'origin_cell' },
                  params: { hazardType: 'poison_cell', durationTurns: 2 },
                },
              ],
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };

    const first = applyMove({
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
        capturedPieceCode: null,
        notation: null,
      },
    });
    const second = applyMove({
      position: asAiPosition(first.position),
      pieceCatalog,
      move: {
        fromRow: 0,
        fromCol: 4,
        toRow: 0,
        toCol: 3,
        pieceCode: 'OU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const skillState = second.position.boardState.skill_state as
      | {
          board_hazards?: {
            row?: number;
            col?: number;
            hazard_type?: string;
            remaining_turns?: number;
          }[];
        }
      | undefined;
    const hazards = skillState?.board_hazards ?? [];
    expect(
      hazards.some(
        (h) =>
          h.row === 6 &&
          h.col === 4 &&
          h.hazard_type === 'poison_cell' &&
          Number(h.remaining_turns) === 1,
      ),
    ).toBe(true);
  });

  it('applies vertical_step_only to adjacent enemy piece legal moves', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4g4/5P3/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 5, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['FU'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'modify_movement',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: { movementRule: 'vertical_step_only', durationTurns: 2 },
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
        fromCol: 5,
        toRow: 4,
        toCol: 5,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const legal = generateLegalMoves({ position: asAiPosition(committed.position), pieceCatalog });
    const goldMoves = legal.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 4);

    expect(goldMoves.length).toBeGreaterThan(0);
    expect(goldMoves.every((m) => m.toCol === 4 && Math.abs((m.toRow ?? 0) - 4) === 1)).toBe(true);
  });

  it('does not apply movement modifier to enemy king', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/5P3/9/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['FU'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'modify_movement',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: { movementRule: 'orthogonal_step_only', durationTurns: 2 },
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
        fromRow: 4,
        fromCol: 5,
        toRow: 3,
        toCol: 5,
        pieceCode: 'FU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const skillState = committed.position.boardState.skill_state as
      | { movement_modifiers?: { row?: number; col?: number; side?: string }[] }
      | undefined;
    const movementModifiers = skillState?.movement_modifiers ?? [];
    expect(movementModifiers.some((m) => m.side === 'enemy' && m.row === 0 && m.col === 4)).toBe(
      false,
    );
  });

  it('applies orthogonal_step_only to adjacent enemy piece legal moves', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4g4/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['KI'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'modify_movement',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: { movementRule: 'orthogonal_step_only', durationTurns: 2 },
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
        toRow: 5,
        toCol: 5,
        pieceCode: 'KI',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const legal = generateLegalMoves({ position: asAiPosition(committed.position), pieceCatalog });
    const goldMoves = legal.legalMoves.filter((m) => m.fromRow === 4 && m.fromCol === 4);
    expect(goldMoves.length).toBeGreaterThan(0);
    expect(
      goldMoves.every((m) => Math.abs((m.toRow ?? 0) - 4) + Math.abs((m.toCol ?? 0) - 4) === 1),
    ).toBe(true);
  });

  it('applies dark_blind status and decrements duration on next move', () => {
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
                  params: { statusType: 'dark_blind', durationTurns: 2 },
                },
              ],
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };

    const first = applyMove({
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
    const firstStatuses =
      ((first.position.boardState.skill_state as { piece_statuses?: Record<string, unknown>[] })
        ?.piece_statuses as Record<string, unknown>[]) ?? [];
    expect(
      firstStatuses.some(
        (s) =>
          s.side === 'enemy' &&
          s.row === 4 &&
          s.col === 3 &&
          s.status_type === 'dark_blind' &&
          Number(s.remaining_turns) === 2,
      ),
    ).toBe(true);

    const second = applyMove({
      position: asAiPosition(first.position),
      pieceCatalog,
      move: {
        fromRow: 0,
        fromCol: 4,
        toRow: 0,
        toCol: 3,
        pieceCode: 'OU',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const secondStatuses =
      ((
        second.position.boardState.skill_state as {
          piece_statuses?: Record<string, unknown>[];
        }
      )?.piece_statuses as Record<string, unknown>[]) ?? [];
    expect(
      secondStatuses.some(
        (s) =>
          s.side === 'enemy' &&
          s.row === 4 &&
          s.col === 3 &&
          s.status_type === 'dark_blind' &&
          Number(s.remaining_turns) === 1,
      ),
    ).toBe(true);
  });

  it('sends adjacent enemy piece to enemy hand', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p5/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
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
                  type: 'send_to_hand',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: {},
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

    expect(
      boardPieces(committed.position).some(
        (p) => p.side === 'enemy' && p.row === 4 && p.col === 3 && p.pieceCode === 'FU',
      ),
    ).toBe(false);
    expect(committed.position.hands.enemy.FU).toBe(1);
  });

  it('applies multiple effects from single after_move trigger', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3g5/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'KI', char: '金', promoted: false },
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
                  type: 'board_hazard',
                  target: { group: 'board', selector: 'origin_cell' },
                  params: { hazardType: 'poison_cell', durationTurns: 2 },
                },
                {
                  type: 'modify_movement',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: { movementRule: 'vertical_step_only', durationTurns: 2 },
                },
                {
                  type: 'apply_status',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: { statusType: 'dark_blind', durationTurns: 2 },
                },
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

    const skillState = committed.position.boardState.skill_state as
      | {
          board_hazards?: Record<string, unknown>[];
          movement_modifiers?: Record<string, unknown>[];
          piece_statuses?: Record<string, unknown>[];
        }
      | undefined;
    const hazards = skillState?.board_hazards ?? [];
    const movementModifiers = skillState?.movement_modifiers ?? [];
    const statuses = skillState?.piece_statuses ?? [];

    expect(
      hazards.some(
        (h) =>
          h.row === 5 && h.col === 4 && h.hazard_type === 'poison_cell' && h.remaining_turns === 2,
      ),
    ).toBe(true);
    expect(
      movementModifiers.some(
        (m) =>
          m.side === 'enemy' &&
          m.row === 4 &&
          m.col === 3 &&
          m.movement_rule === 'vertical_step_only',
      ),
    ).toBe(true);
    expect(
      statuses.some(
        (s) => s.side === 'enemy' && s.row === 4 && s.col === 3 && s.status_type === 'dark_blind',
      ),
    ).toBe(true);
    const playerFuCount =
      boardPieces(committed.position).filter((p) => p.side === 'player' && p.pieceCode === 'FU')
        .length ?? 0;
    expect(playerFuCount).toBe(2);
  });

  it('applies time_stop and blocks target piece legal moves', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3g5/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'KI', char: '金', promoted: false },
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
                  params: { statusType: 'time_stop', durationTurns: 2 },
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

    const statuses =
      ((
        committed.position.boardState.skill_state as {
          piece_statuses?: Record<string, unknown>[];
        }
      )?.piece_statuses as Record<string, unknown>[]) ?? [];
    expect(
      statuses.some(
        (s) =>
          s.side === 'enemy' &&
          s.row === 4 &&
          s.col === 3 &&
          s.status_type === 'time_stop' &&
          Number(s.remaining_turns) === 2,
      ),
    ).toBe(true);

    const legal = generateLegalMoves({ position: asAiPosition(committed.position), pieceCatalog });
    expect(legal.legalMoves.some((m) => m.fromRow === 4 && m.fromCol === 3)).toBe(false);
  });

  it('supports stage17 piece codes for poison/swamp/rainbow/dark skills', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3g5/4=4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'POISON', char: '毒', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['POISON'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'board_hazard',
                  target: { group: 'board', selector: 'origin_cell' },
                  params: { hazardType: 'poison_cell', durationTurns: 2 },
                },
              ],
            },
            {
              pieceChars: ['SWAMP'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'modify_movement',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: { movementRule: 'vertical_step_only', durationTurns: 2 },
                },
              ],
            },
            {
              pieceChars: ['RAINBOW'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'modify_movement',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: { movementRule: 'orthogonal_step_only', durationTurns: 4 },
                },
              ],
            },
            {
              pieceChars: ['DARK'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'apply_status',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: { statusType: 'dark_blind', durationTurns: 2 },
                },
              ],
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };

    const poisonCommitted = applyMove({
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
    const poisonHazards =
      ((
        poisonCommitted.position.boardState.skill_state as {
          board_hazards?: Record<string, unknown>[];
        }
      )?.board_hazards as Record<string, unknown>[]) ?? [];
    expect(
      poisonHazards.some((h) => h.row === 5 && h.col === 4 && h.hazard_type === 'poison_cell'),
    ).toBe(true);

    const swampPosition: AiBattlePosition = {
      ...position,
      boardState: {
        ...position.boardState,
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'SWAMP', char: '沼', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
    };
    const swampCommitted = applyMove({
      position: swampPosition,
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
    const swampModifiers =
      ((
        swampCommitted.position.boardState.skill_state as {
          movement_modifiers?: Record<string, unknown>[];
        }
      )?.movement_modifiers as Record<string, unknown>[]) ?? [];
    expect(
      swampModifiers.some(
        (m) =>
          m.side === 'enemy' &&
          m.row === 4 &&
          m.col === 3 &&
          m.movement_rule === 'vertical_step_only',
      ),
    ).toBe(true);

    const rainbowPosition: AiBattlePosition = {
      ...position,
      boardState: {
        ...position.boardState,
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'RAINBOW', char: '虹', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
    };
    const rainbowCommitted = applyMove({
      position: rainbowPosition,
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
    const rainbowModifiers =
      ((
        rainbowCommitted.position.boardState.skill_state as {
          movement_modifiers?: Record<string, unknown>[];
        }
      )?.movement_modifiers as Record<string, unknown>[]) ?? [];
    expect(
      rainbowModifiers.some(
        (m) =>
          m.side === 'enemy' &&
          m.row === 4 &&
          m.col === 3 &&
          m.movement_rule === 'orthogonal_step_only',
      ),
    ).toBe(true);

    const darkPosition: AiBattlePosition = {
      ...position,
      boardState: {
        ...position.boardState,
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'DARK', char: '闇', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
    };
    const darkCommitted = applyMove({
      position: darkPosition,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'DARK',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const darkStatuses =
      ((
        darkCommitted.position.boardState.skill_state as {
          piece_statuses?: Record<string, unknown>[];
        }
      )?.piece_statuses as Record<string, unknown>[]) ?? [];
    expect(
      darkStatuses.some(
        (s) => s.side === 'enemy' && s.row === 4 && s.col === 3 && s.status_type === 'dark_blind',
      ),
    ).toBe(true);
  });

  it('applies board_hazard on adjacent_empty cells', () => {
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
                  type: 'board_hazard',
                  target: { group: 'adjacent', selector: 'adjacent_empty' },
                  params: { hazardType: 'poison_cell', durationTurns: 2 },
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
    const hazards =
      ((
        committed.position.boardState.skill_state as {
          board_hazards?: Record<string, unknown>[];
        }
      )?.board_hazards as Record<string, unknown>[]) ?? [];
    expect(hazards.length).toBeGreaterThan(0);
    expect(
      hazards.some((h) => h.hazard_type === 'poison_cell' && Number(h.remaining_turns) === 2),
    ).toBe(true);
  });

  it('applies status hazard on origin_cell', () => {
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
                  type: 'apply_status',
                  target: { group: 'board', selector: 'origin_cell' },
                  params: { statusType: 'time_stop', durationTurns: 2 },
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
    const hazards =
      ((
        committed.position.boardState.skill_state as {
          board_hazards?: Record<string, unknown>[];
        }
      )?.board_hazards as Record<string, unknown>[]) ?? [];
    expect(
      hazards.some((h) => h.row === 5 && h.col === 4 && h.hazard_type === 'status:time_stop'),
    ).toBe(true);
  });

  it('applies multi_capture to adjacent enemies except king', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3pp4/4G4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 4, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['KI'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'multi_capture',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: {},
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
        toRow: 5,
        toCol: 3,
        pieceCode: 'KI',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    expect(
      boardPieces(committed.position).some((p) => p.side === 'enemy' && p.row === 4 && p.col === 3),
    ).toBe(false);
    expect(
      boardPieces(committed.position).some((p) => p.side === 'enemy' && p.row === 4 && p.col === 4),
    ).toBe(false);
  });

  it('applies transform_piece to adjacent enemy', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/3p5/4P4/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
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
                  type: 'transform_piece',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: { toPieceCode: 'KI', toPieceChar: '金' },
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
    expect(
      boardPieces(committed.position).some(
        (p) =>
          p.side === 'enemy' &&
          p.row === 4 &&
          p.col === 3 &&
          p.pieceCode === 'KI' &&
          p.char === '金',
      ),
    ).toBe(true);
  });

  it('applies seal_skill and disable_piece statuses to adjacent enemies', () => {
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
                  type: 'seal_skill',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: {},
                },
                {
                  type: 'disable_piece',
                  target: { group: 'adjacent', selector: 'adjacent_enemy' },
                  params: {},
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
    const statuses =
      ((
        committed.position.boardState.skill_state as {
          piece_statuses?: Record<string, unknown>[];
        }
      )?.piece_statuses as Record<string, unknown>[]) ?? [];
    expect(
      statuses.some(
        (s) => s.side === 'enemy' && s.row === 4 && s.col === 3 && s.status_type === 'skill_sealed',
      ),
    ).toBe(true);
    expect(
      statuses.some(
        (s) => s.side === 'enemy' && s.row === 4 && s.col === 3 && s.status_type === 'disabled',
      ),
    ).toBe(true);
  });

  it('applies defense_or_immunity to self and adjacent allies', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4P4/3G5/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 3, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['KI'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'defense_or_immunity',
                  target: { group: 'self', selector: 'self_piece' },
                  params: { mode: 'immunity', durationTurns: 2 },
                },
                {
                  type: 'defense_or_immunity',
                  target: { group: 'adjacent', selector: 'adjacent_ally' },
                  params: { mode: 'immunity', durationTurns: 2 },
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
        fromCol: 3,
        toRow: 4,
        toCol: 3,
        pieceCode: 'KI',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    const defenses =
      ((
        committed.position.boardState.skill_state as {
          piece_defenses?: Record<string, unknown>[];
        }
      )?.piece_defenses as Record<string, unknown>[]) ?? [];
    expect(
      defenses.some(
        (d) => d.side === 'player' && d.row === 4 && d.col === 3 && d.mode === 'immunity',
      ),
    ).toBe(true);
    expect(
      defenses.some(
        (d) => d.side === 'player' && d.row === 4 && d.col === 4 && d.mode === 'immunity',
      ),
    ).toBe(true);
  });

  it('applies transform self/all_ally and gain/substitute/revive style statuses', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/4P4/3G5/9/9/4K4 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 3, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 4, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['KI'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'transform_piece',
                  target: { group: 'self', selector: 'self_piece' },
                  params: { toPieceCode: 'FU', toPieceChar: '歩' },
                },
                {
                  type: 'transform_piece',
                  target: { group: 'global', selector: 'all_ally' },
                  params: { fromPieceCode: 'FU', toPieceCode: 'KI', toPieceChar: '金' },
                },
                {
                  type: 'gain_piece',
                  target: { group: 'hand', selector: 'ally_hand_piece' },
                  params: { gainPieceCode: 'FU' },
                },
                {
                  type: 'substitute',
                  target: { group: 'self', selector: 'self_piece' },
                  params: {},
                },
                {
                  type: 'revive',
                  target: { group: 'adjacent', selector: 'adjacent_ally' },
                  params: {},
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
        fromCol: 3,
        toRow: 4,
        toCol: 3,
        pieceCode: 'KI',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    expect(committed.position.hands.player.FU).toBe(1);
    expect(
      boardPieces(committed.position).some(
        (p) => p.side === 'player' && p.row === 4 && p.col === 3 && p.pieceCode === 'KI',
      ),
    ).toBe(true);
    const skillState = committed.position.boardState.skill_state as {
      piece_defenses?: Record<string, unknown>[];
      piece_statuses?: Record<string, unknown>[];
    };
    expect((skillState.piece_defenses ?? []).some((d) => d.mode === 'substitute')).toBe(true);
    expect(
      (skillState.piece_statuses ?? []).some(
        (s) =>
          s.status_type === 'revive' &&
          s.side === 'player' &&
          s.row === 4 &&
          s.col === 4 &&
          s.remaining_turns === 2,
      ),
    ).toBe(true);
  });

  it('applies script_hook safe_room_king_relocation and escape_king_follow', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: '4k4/9/9/9/9/3G5/9/4K4/9 b - 1',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 3, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 7, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['KI'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'script_hook',
                  target: { group: 'self', selector: 'self_piece' },
                  params: { hook: 'safe_room_king_relocation' },
                },
              ],
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };

    const relocated = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 3,
        toRow: 4,
        toCol: 3,
        pieceCode: 'KI',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    expect(
      boardPieces(relocated.position).some(
        (p) => p.side === 'player' && p.pieceCode === 'OU' && p.row === 8 && p.col === 4,
      ),
    ).toBe(true);

    const followPosition: AiBattlePosition = {
      ...position,
      boardState: {
        ...position.boardState,
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 5, col: 3, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 7, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: {
          definitions: [
            {
              pieceChars: ['KI'],
              trigger: { type: 'after_move' },
              effects: [
                {
                  type: 'script_hook',
                  target: { group: 'self', selector: 'self_piece' },
                  params: { hook: 'escape_king_follow' },
                },
              ],
            },
          ],
        },
      },
    };
    const followed = applyMove({
      position: followPosition,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 3,
        toRow: 4,
        toCol: 3,
        pieceCode: 'KI',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });
    expect(
      boardPieces(followed.position).some(
        (p) => p.side === 'player' && p.pieceCode === 'OU' && p.row === 6 && p.col === 4,
      ),
    ).toBe(true);
  });
});
