import { computeAiMove } from '@/ai/engine/compute-ai-move';
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
    isRepeatable: false,
  },
  {
    pieceCode: 'HI',
    canonicalCode: 'HI',
    sfenCode: 'R',
    char: '飛',
    name: '飛',
    unlock: 'default',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [
      { dx: 0, dy: -1, maxStep: 8 },
      { dx: 0, dy: 1, maxStep: 8 },
      { dx: -1, dy: 0, maxStep: 8 },
      { dx: 1, dy: 0, maxStep: 8 },
    ],
    isRepeatable: true,
  },
];

describe('ai engine compute ai move', () => {
  it('returns player win when enemy has no legal move', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 2,
      moveCount: 1,
      sfen: '9/9/9/9/9/9/9/9/4K4 w - 2',
      stateHash: 'seed',
      boardState: {
        pieces: [{ side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false }],
      },
      hands: { player: {}, enemy: {} },
    };

    const result = computeAiMove({ position, pieceCatalog });

    expect(result.selectedMove).toBeNull();
    expect(result.game.result).toBe('player_win');
  });

  it('returns player win when enemy has no escape from a promoted piece check', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 2,
      moveCount: 1,
      sfen: '9/9/9/3ppp3/3pkp3/3+Spp3/9/9/3RK4 w - 2',
      stateHash: 'seed-promoted-silver-mate',
      boardState: {
        pieces: [
          { side: 'enemy', row: 4, col: 4, pieceCode: 'OU', char: '玉', promoted: false },
          { side: 'enemy', row: 3, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 3, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 3, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 5, col: 3, pieceCode: 'GI', char: '成銀', promoted: true },
          { side: 'enemy', row: 5, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 5, col: 5, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 3, pieceCode: 'HI', char: '飛', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_state: {
          piece_statuses: [
            { side: 'enemy', row: 3, col: 3, status_type: 'stun', remaining_turns: 1 },
            { side: 'enemy', row: 3, col: 4, status_type: 'stun', remaining_turns: 1 },
            { side: 'enemy', row: 3, col: 5, status_type: 'stun', remaining_turns: 1 },
            { side: 'enemy', row: 4, col: 3, status_type: 'stun', remaining_turns: 1 },
            { side: 'enemy', row: 4, col: 5, status_type: 'stun', remaining_turns: 1 },
            { side: 'enemy', row: 5, col: 4, status_type: 'stun', remaining_turns: 1 },
            { side: 'enemy', row: 5, col: 5, status_type: 'stun', remaining_turns: 1 },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };

    const result = computeAiMove({
      position,
      pieceCatalog,
      legalMoveOptions: { enforceKingSafety: true },
    });

    expect(result.selectedMove).toBeNull();
    expect(result.game).toMatchObject({
      status: 'finished',
      result: 'player_win',
      winnerSide: 'player',
    });
  });

  it('returns meta for a computed move', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 2,
      moveCount: 1,
      sfen: '9/9/9/9/9/9/4g4/4K4/9 w - 2',
      stateHash: 'seed-2',
      boardState: {
        pieces: [
          { side: 'enemy', row: 6, col: 4, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 7, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const result = computeAiMove({ position, pieceCatalog });

    expect(result.selectedMove).not.toBeNull();
    expect(result.meta?.candidateCount).toBeGreaterThan(0);
    expect(result.meta?.engineVersion).toBe('local-ts');
  });

  it('can penalize a repeated move and choose a different candidate', () => {
    const repeatedMove = {
      fromRow: 6,
      fromCol: 4,
      toRow: 7,
      toCol: 4,
      pieceCode: 'KI',
      promote: false,
      dropPieceCode: null,
      capturedPieceCode: null,
      notation: null,
    };
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 2,
      moveCount: 1,
      sfen: '9/9/9/9/9/9/4g4/9/8K w - 2',
      stateHash: 'seed-3',
      boardState: {
        pieces: [
          { side: 'enemy', row: 6, col: 4, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 8, col: 8, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const result = computeAiMove({
      position,
      pieceCatalog,
      recentEnemyMoves: [repeatedMove],
      config: {
        searchDepth: 3,
        candidateScoreTolerance: 0,
        temperature: 0,
        repeatMovePenalty: 200,
        samePiecePenalty: 0,
        returnMovePenalty: 0,
      },
    });

    expect(result.selectedMove).not.toMatchObject(repeatedMove);
    expect(result.meta?.configApplied.repeatMovePenalty).toBe(200);
    expect(result.meta?.searchDepth).toBe(3);
    expect(result.meta?.configApplied.searchDepth).toBe(3);
  });

  it('does not prefer moving the king just because the king has the highest piece value', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 2,
      moveCount: 1,
      sfen: '4k4/9/4p4/9/9/9/9/9/8K w - 2',
      stateHash: 'seed-king-activity',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 2, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 8, col: 8, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const result = computeAiMove({
      position,
      pieceCatalog,
      config: {
        candidateScoreTolerance: 0,
        temperature: 0,
      },
    });

    expect(result.selectedMove).toMatchObject({
      fromRow: 2,
      fromCol: 4,
      toRow: 3,
      toCol: 4,
      pieceCode: 'FU',
    });
  });

  it('avoids exposing its king to the next player capture when king safety is weighted', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 2,
      moveCount: 1,
      sfen: '4k4/4g4/3G4/9/9/9/9/9/4R3K w - 2',
      stateHash: 'seed-king-safety',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'enemy', row: 1, col: 4, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'enemy', row: 3, col: 8, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'player', row: 2, col: 3, pieceCode: 'KI', char: '金', promoted: false },
          { side: 'player', row: 8, col: 4, pieceCode: 'HI', char: '飛', promoted: false },
          { side: 'player', row: 8, col: 8, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const result = computeAiMove({
      position,
      pieceCatalog,
      config: {
        candidateScoreTolerance: 0,
        temperature: 0,
        kingInDangerPenalty: 10000,
        kingAdjacentAttackPenalty: 80,
        kingEscapeSquareBonus: 20,
      },
    });

    expect(result.selectedMove).not.toMatchObject({
      fromRow: 1,
      fromCol: 4,
      toRow: 2,
      toCol: 3,
      pieceCode: 'KI',
    });
  });
});
