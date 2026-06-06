import { applyMove } from '@/ai/engine';
import type { AiBattlePosition, AiPieceDefinition } from '@/ai/model';
import { matchingWireToCanonicalPosition } from '@/lib/matching-server/canonical-game';
import { normalizeSkillPieceCode } from '@/lib/matching-server/skill-piece-code';
import type { MatchingGameState } from '@/domain/matching-server/protocol';
import fixture from '../../../../test-fixtures/online-skill-parity/ported-skill-cases.json';

const cases = fixture.cases.map((entry) => ({
  pieceCode: entry.pieceCode,
  actorPieceCode: entry.actorPieceCode ?? entry.pieceCode,
  appMove: {
    ...fixture.defaults.appMove,
    pieceCode: entry.actorPieceCode ?? entry.pieceCode,
    ...(entry.appMove ?? {}),
  },
}));

describe('matching-server online skill pieces', () => {
  const originalRandom = Math.random;

  afterEach(() => {
    Math.random = originalRandom;
  });

  it.each(cases)('keeps $pieceCode in canonical online conversion', ({ pieceCode }) => {
    const wire: MatchingGameState = {
      version: 1,
      turn: 'black',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '5e': `black:${pieceCode}`,
      },
      hands: { black: {}, white: {} },
      skillState: {
        movement_modifiers: [
          {
            row: 4,
            col: 4,
            side: 'black',
            movement_rule: 'orthogonal_step_only',
            remaining_turns: 1,
          },
        ],
      },
    };

    const position = matchingWireToCanonicalPosition(wire, []);
    const pieces =
      (
        position.boardState as {
          pieces?: Array<{ pieceCode?: string; char?: string; row?: number; col?: number }>;
        }
      ).pieces ?? [];
    const skillState = (position.boardState as { skill_state?: MatchingGameState['skillState'] })
      .skill_state;
    const placed = pieces.find((piece) => piece.row === 4 && piece.col === 4);
    const expectedCode = normalizeSkillPieceCode(pieceCode, placed?.char ?? pieceCode);

    expect(placed?.pieceCode).toBe(expectedCode);
    expect(skillState?.movement_modifiers?.[0]?.side).toBe('player');
  });

  it.each(cases)('runs $pieceCode through the app vsAI rule engine', ({
    pieceCode,
    actorPieceCode,
    appMove,
  }) => {
    Math.random = deterministicRandom([0, 0.37, 0.73, 0.11, 0.91, 0.23]);
    const committed = applyMove({
      position: createAppSkillPosition(pieceCode, actorPieceCode),
      pieceCatalog: createPieceCatalog(),
      move: {
        fromRow: appMove.fromRow,
        fromCol: appMove.fromCol,
        toRow: appMove.toRow,
        toCol: appMove.toCol,
        pieceCode: appMove.pieceCode,
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const pieces =
      (committed.position.boardState as { pieces?: Array<{ pieceCode?: string }> }).pieces ?? [];
    expect(committed.position.moveCount).toBe(1);
    expect(committed.position.sideToMove).toBe('enemy');
    expect(pieces.some((piece) => piece.pieceCode === actorPieceCode)).toBe(true);
  });
});

function deterministicRandom(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0;
    index += 1;
    return value;
  };
}

function createAppSkillPosition(pieceCode: string, actorPieceCode: string): AiBattlePosition {
  return {
    sideToMove: 'player',
    turnNumber: 1,
    moveCount: 0,
    sfen: 'fixture',
    stateHash: 'fixture',
    boardState: {
      pieces: [
        { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '玉', promoted: false },
        {
          side: 'player',
          row: 4,
          col: 4,
          pieceCode: actorPieceCode,
          char: actorPieceCode,
          promoted: false,
        },
        { side: 'player', row: 3, col: 4, pieceCode, char: pieceCode, promoted: false },
        { side: 'player', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
        { side: 'enemy', row: 6, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
        { side: 'enemy', row: 6, col: 3, pieceCode: 'GI', char: '銀', promoted: false },
        { side: 'enemy', row: 7, col: 4, pieceCode: 'KI', char: '金', promoted: false },
      ],
      skill_state: {
        board_hazards: [],
        board_arrow_tiles: [],
        movement_modifiers: [],
        piece_statuses: [],
        piece_defenses: [],
      },
      skill_definitions_v2: { definitions: [] },
    },
    hands: {
      player: { FU: 1 },
      enemy: { FU: 2, GI: 1 },
    },
  };
}

function createPieceCatalog(): AiPieceDefinition[] {
  const codes = new Set<string>([
    'OU',
    'FU',
    'GI',
    'KI',
    'KA',
    'COPPER',
    'MUTANT',
    'YAMA',
    'SPIRIT',
    ...cases.flatMap((entry) => [entry.pieceCode, entry.actorPieceCode]),
  ]);
  return Array.from(codes).map((code) => ({
    pieceCode: code,
    canonicalCode: code,
    sfenCode: code,
    char: code,
    name: code,
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: kingLikeVectors(),
    isRepeatable: true,
  }));
}

function kingLikeVectors(): AiPieceDefinition['moveVectors'] {
  return [
    { dx: -1, dy: -1, maxStep: 1 },
    { dx: 0, dy: -1, maxStep: 1 },
    { dx: 1, dy: -1, maxStep: 1 },
    { dx: -1, dy: 0, maxStep: 1 },
    { dx: 1, dy: 0, maxStep: 1 },
    { dx: -1, dy: 1, maxStep: 1 },
    { dx: 0, dy: 1, maxStep: 1 },
    { dx: 1, dy: 1, maxStep: 1 },
  ];
}
