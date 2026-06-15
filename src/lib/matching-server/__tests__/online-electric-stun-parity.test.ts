import { generateLegalMoves } from '@/ai/engine';
import {
  getMyLegalMoves,
  removeOnlineBattleGame,
  syncFromServerWire,
} from '@/ai/online-battle-registry';
import { normalizePieceCatalog } from '@/ai/model';
import type { MatchingGameState } from '@/domain/matching-server/protocol';
import { buildStunSkillFxFromWireSkillStateDiff } from '@/lib/matching-server/online-skill-stun-fx';
import { resolveOnlineBattlePositionFromWire } from '@/lib/matching-server/canonical-game';

const minimalCatalog = normalizePieceCatalog([
  {
    pieceCode: 'OU',
    canonicalCode: 'OU',
    char: '王',
    name: '王',
    unlock: 'test',
    desc: '',
    skill: '',
    move: 'king',
    isRepeatable: false,
    moveVectors: [{ dx: -1, dy: -1, maxStep: 1 }],
    canJump: false,
    isPromoted: false,
    moveConstraints: null,
    moveRules: [],
    skillDefinitionsV2: null,
  },
  {
    pieceCode: 'FU',
    canonicalCode: 'FU',
    char: '歩',
    name: '歩',
    unlock: 'test',
    desc: '',
    skill: '',
    move: 'pawn',
    isRepeatable: false,
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    canJump: false,
    isPromoted: false,
    moveConstraints: null,
    moveRules: [],
    skillDefinitionsV2: null,
  },
  {
    pieceCode: 'ELECTRIC',
    canonicalCode: 'ELECTRIC',
    char: '電',
    name: '電',
    unlock: 'test',
    desc: '',
    skill: '',
    move: 'electric',
    isRepeatable: false,
    moveVectors: [
      { dx: -1, dy: 0, maxStep: 8 },
      { dx: 1, dy: 0, maxStep: 8 },
      { dx: 0, dy: -1, maxStep: 8 },
      { dx: 0, dy: 1, maxStep: 8 },
    ],
    canJump: false,
    isPromoted: false,
    moveConstraints: null,
    moveRules: [],
    skillDefinitionsV2: null,
  },
]);

describe('online electric stun parity', () => {
  afterEach(() => {
    removeOnlineBattleGame('electric-stun-test');
    removeOnlineBattleGame('electric-canonical-merge');
  });

  it('blocks legal moves for stunned enemy after electric skill sync', () => {
    const wire: MatchingGameState = {
      version: 2,
      turn: 'white',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '5d': 'black:ELECTRIC',
        '4e': 'white:FU',
        '6e': 'white:GI',
      },
      hands: { black: {}, white: {} },
      skillState: {
        piece_statuses: [
          { row: 4, col: 5, side: 'white', status_type: 'stun', remaining_turns: 1 },
          { row: 4, col: 3, side: 'white', status_type: 'stun', remaining_turns: 1 },
        ],
      },
      lastSkillTriggered: true,
    };

    syncFromServerWire({
      matchId: 'electric-stun-test',
      myRole: 'white',
      wire,
      pieceCatalog: minimalCatalog,
    });

    const legal = getMyLegalMoves('electric-stun-test');
    expect(legal.some((move) => move.fromRow === 4 && move.fromCol === 5)).toBe(false);
    expect(legal.some((move) => move.fromRow === 4 && move.fromCol === 3)).toBe(false);
  });

  it('prefers wire skillState over canonicalState without skill_state', () => {
    const wire: MatchingGameState = {
      version: 2,
      turn: 'white',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '4e': 'white:FU',
      },
      hands: { black: {}, white: {} },
      skillState: {
        piece_statuses: [
          { row: 4, col: 5, side: 'white', status_type: 'stun', remaining_turns: 1 },
        ],
      },
      canonicalState: {
        sideToMove: 'enemy',
        turnNumber: 2,
        moveCount: 1,
        sfen: 'online-match',
        stateHash: 'v2',
        boardState: {
          pieces: [
            { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
            { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
            { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          ],
        },
        hands: { player: {}, enemy: {} },
      },
    };

    syncFromServerWire({
      matchId: 'electric-canonical-merge',
      myRole: 'white',
      wire,
      pieceCatalog: minimalCatalog,
    });

    const legal = getMyLegalMoves('electric-canonical-merge');
    expect(legal.some((move) => move.fromRow === 4 && move.fromCol === 5)).toBe(false);
  });

  it('builds board FX for newly stunned cells after electric move', () => {
    const fx = buildStunSkillFxFromWireSkillStateDiff({
      before: { piece_statuses: [] },
      after: {
        piece_statuses: [
          { row: 4, col: 5, side: 'white', status_type: 'stun', remaining_turns: 1 },
        ],
      },
      moveCount: 3,
      lastMovePieceCode: 'ELECTRIC',
    });

    expect(fx).toHaveLength(1);
    expect(fx[0]?.pieceChar).toBe('電');
  });
});

describe('generateLegalMoves with electric stun wire state', () => {
  it('blocks stunned pawn moves from synced skill_state', () => {
    const wire: MatchingGameState = {
      version: 2,
      turn: 'white',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '4e': 'white:FU',
      },
      hands: { black: {}, white: {} },
      skillState: {
        piece_statuses: [
          { row: 4, col: 5, side: 'white', status_type: 'stun', remaining_turns: 1 },
        ],
      },
    };

    const position = resolveOnlineBattlePositionFromWire(wire, minimalCatalog);
    const legal = generateLegalMoves({ position, pieceCatalog: minimalCatalog });
    expect(legal.legalMoves.some((move) => move.fromRow === 4 && move.fromCol === 5)).toBe(false);
  });
});
