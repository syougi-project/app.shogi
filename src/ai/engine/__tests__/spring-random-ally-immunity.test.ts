import { applyMove } from '@/ai/engine/apply-move';
import { generateLegalMoves } from '@/ai/engine/legal-moves';
import { normalizePieceCatalog } from '@/ai/model';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';
import { piecesFromBoardState } from '@/ai/model';
import { createPosition } from '@/ai/engine/shared';

const catalog: PieceCatalogItem[] = normalizePieceCatalog([
  {
    char: '泉',
    pieceCode: 'SPRING',
    sfenCode: 'ZQN',
    name: '泉',
    unlock: 't',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: 0, dy: 1, maxStep: 1 },
      { dx: -1, dy: 0, maxStep: 1 },
      { dx: 1, dy: 0, maxStep: 1 },
    ],
    isRepeatable: false,
  },
  {
    char: '歩',
    pieceCode: 'FU',
    sfenCode: 'P',
    name: '歩',
    unlock: 't',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: false,
  },
  {
    char: '銀',
    pieceCode: 'GI',
    sfenCode: 'S',
    name: '銀',
    unlock: 't',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: false,
  },
  {
    char: '王',
    pieceCode: 'OU',
    sfenCode: 'K',
    name: '王',
    unlock: 't',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: false,
  },
]);

describe('spring random ally immunity', () => {
  const originalRandom = Math.random;

  afterEach(() => {
    Math.random = originalRandom;
  });

  it('grants immunity to a random ally when spring moves', () => {
    Math.random = () => 0;
    const position = createPosition({
      pieces: [
        { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        { side: 'player', row: 4, col: 4, pieceCode: 'SPRING', char: '泉', promoted: false },
        { side: 'player', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
        { side: 'enemy', row: 3, col: 3, pieceCode: 'GI', char: '銀', promoted: false },
      ],
      hands: { player: {}, enemy: {} },
      sideToMove: 'player',
      moveCount: 0,
      pieceCatalog: catalog,
    });

    const committed = applyMove({
      position,
      move: {
        fromRow: 4,
        fromCol: 4,
        toRow: 5,
        toCol: 4,
        pieceCode: 'SPRING',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
      pieceCatalog: catalog,
    });

    const skillState = (
      committed.position.boardState as { skill_state?: { piece_defenses?: unknown[] } }
    ).skill_state;
    const defenses = skillState?.piece_defenses ?? [];
    expect(defenses).toHaveLength(1);
    expect(defenses[0]).toMatchObject({
      row: 4,
      col: 3,
      side: 'player',
      mode: 'immunity',
      remaining_turns: 5,
    });
  });

  it('blocks enemy capture against spring-enhanced ally', () => {
    Math.random = () => 0;
    let position = createPosition({
      pieces: [
        { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        { side: 'player', row: 4, col: 4, pieceCode: 'SPRING', char: '泉', promoted: false },
        { side: 'player', row: 4, col: 3, pieceCode: 'FU', char: '歩', promoted: false },
        { side: 'enemy', row: 3, col: 3, pieceCode: 'GI', char: '銀', promoted: false },
      ],
      hands: { player: {}, enemy: {} },
      sideToMove: 'player',
      moveCount: 0,
      pieceCatalog: catalog,
    });

    position = applyMove({
      position,
      move: {
        fromRow: 4,
        fromCol: 4,
        toRow: 5,
        toCol: 4,
        pieceCode: 'SPRING',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
      pieceCatalog: catalog,
    }).position;

    const enemyMoves = generateLegalMoves({ position, pieceCatalog: catalog }).legalMoves;
    const capture = enemyMoves.find(
      (move) => move.toRow === 4 && move.toCol === 3 && move.pieceCode === 'GI',
    );
    expect(capture).toBeUndefined();
    expect(
      piecesFromBoardState(position).some((p) => p.row === 4 && p.col === 3 && p.char === '歩'),
    ).toBe(true);
  });
});
