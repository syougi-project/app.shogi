import { applyMove, generateLegalMoves } from '@/ai/engine';
import type { AiBattlePosition, AiPieceDefinition } from '@/ai/model';
import { matchingWireToCanonicalPosition } from '@/lib/matching-server/canonical-game';
import { normalizeSkillPieceCode } from '@/lib/matching-server/skill-piece-code';
import type { MatchingGameState } from '@/domain/matching-server/protocol';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';
import fixture from '../../../../test-fixtures/online-skill-parity/ported-skill-cases.json';

const cases = fixture.cases.map((entry) => ({
  pieceCode: entry.pieceCode,
  actorPieceCode: entry.actorPieceCode ?? entry.pieceCode,
  hasExplicitAppMove: Boolean(entry.appMove),
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
          pieces?: { pieceCode?: string; char?: string; row?: number; col?: number }[];
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
    hasExplicitAppMove,
    appMove,
  }) => {
    Math.random = deterministicRandom([0, 0.37, 0.73, 0.11, 0.91, 0.23]);
    const position = createAppSkillPosition(pieceCode, actorPieceCode);
    const pieceCatalog = createPieceCatalog();
    const resolvedMove = hasExplicitAppMove
      ? appMove
      : resolveDefaultAppMove(position, pieceCatalog, appMove);
    const committed = applyMove({
      position,
      pieceCatalog,
      move: {
        fromRow: resolvedMove.fromRow,
        fromCol: resolvedMove.fromCol,
        toRow: resolvedMove.toRow,
        toCol: resolvedMove.toCol,
        pieceCode: resolvedMove.pieceCode ?? appMove.pieceCode,
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const pieces =
      (committed.position.boardState as { pieces?: { pieceCode?: string }[] }).pieces ?? [];
    expect(committed.position.moveCount).toBe(1);
    expect(committed.position.sideToMove).toBe('enemy');
    expect(pieces.some((piece) => piece.pieceCode === actorPieceCode)).toBe(true);
  });
});

function resolveDefaultAppMove(
  position: AiBattlePosition,
  pieceCatalog: AiPieceDefinition[],
  fallback: (typeof cases)[number]['appMove'],
): (typeof cases)[number]['appMove'] {
  const legal = generateLegalMoves({ position, pieceCatalog });
  const matched =
    legal.legalMoves.find(
      (move) =>
        move.dropPieceCode === null &&
        move.fromRow === fallback.fromRow &&
        move.fromCol === fallback.fromCol &&
        isPlainBoardMove(move),
    ) ??
    legal.legalMoves.find(
      (move) =>
        move.dropPieceCode === null &&
        move.fromRow === fallback.fromRow &&
        move.fromCol === fallback.fromCol,
    );
  if (!matched || matched.fromRow == null || matched.fromCol == null) {
    throw new Error(
      `no legal move from (${fallback.fromRow},${fallback.fromCol}) for ${fallback.pieceCode}`,
    );
  }
  return {
    fromRow: matched.fromRow,
    fromCol: matched.fromCol,
    toRow: matched.toRow,
    toCol: matched.toCol,
    pieceCode: matched.pieceCode ?? fallback.pieceCode,
  };
}

function isPlainBoardMove(move: BattleMove): boolean {
  const notation = move.notation ?? '';
  if (notation === 'house_skill_only' || notation === 'time_skill_only') return false;
  if (notation.startsWith('satori_stun:') || notation.startsWith('heart_protect:')) return false;
  return true;
}

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
        { side: 'enemy', row: 7, col: 8, pieceCode: 'KI', char: '金', promoted: false },
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
