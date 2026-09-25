import { applyLocalMove, computeLocalAiTurn, generateLocalLegalMoves } from '@/ai/local-engine';
import type { AiBattlePosition } from '@/ai/model';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

const pieceCatalog: PieceCatalogItem[] = [
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
];

function createPosition(): AiBattlePosition {
  return {
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
    hands: {
      player: {},
      enemy: {},
    },
  };
}

describe('local engine', () => {
  it('generates board moves and drops for the current side', () => {
    const legal = generateLocalLegalMoves({
      position: {
        ...createPosition(),
        hands: { player: { KI: 1 }, enemy: {} },
      },
      pieceCatalog,
    });

    expect(legal.sideToMove).toBe('player');
    expect(legal.legalMoves.some((move) => move.dropPieceCode === 'KI')).toBe(true);
    expect(
      legal.legalMoves.some(
        (move) =>
          move.fromRow === 7 &&
          move.fromCol === 4 &&
          move.toRow === 6 &&
          move.toCol === 4 &&
          move.dropPieceCode === null,
      ),
    ).toBe(true);
  });

  it('applies a move and adds captured pieces to hand', () => {
    const committed = applyLocalMove({
      position: {
        ...createPosition(),
        boardState: {
          pieces: [
            { side: 'enemy', row: 6, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
            { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
            { side: 'player', row: 7, col: 4, pieceCode: 'KI', char: '金', promoted: false },
            { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          ],
        },
      },
      pieceCatalog,
      move: {
        fromRow: 7,
        fromCol: 4,
        toRow: 6,
        toCol: 4,
        pieceCode: 'KI',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: 'FU',
        notation: null,
      },
    });

    expect(committed.position.hands.player.FU).toBe(1);
    expect(committed.position.moveCount).toBe(1);
    expect(committed.position.sideToMove).toBe('enemy');
  });

  it('lets the AI capture the king and finish the game', () => {
    const result = computeLocalAiTurn({
      position: {
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
      },
      pieceCatalog,
    });

    expect(result.selectedMove?.toRow).toBe(7);
    expect(result.selectedMove?.toCol).toBe(4);
    expect(result.game.status).toBe('finished');
    expect(result.game.winnerSide).toBe('enemy');
  });

  it('allows non-escaping moves under check in normal dungeon', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 2,
      moveCount: 1,
      sfen: '9/9/9/9/4k4/3+S5/9/p8/4K4 b - 2',
      stateHash: 'seed-player-check',
      boardState: {
        pieces: [
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          { side: 'player', row: 7, col: 0, pieceCode: 'FU', char: '歩', promoted: false },
          { side: 'enemy', row: 4, col: 4, pieceCode: 'OU', char: '玉', promoted: false },
          { side: 'enemy', row: 5, col: 3, pieceCode: 'GI', char: '成銀', promoted: true },
        ],
      },
      hands: { player: {}, enemy: {} },
    };

    const legal = generateLocalLegalMoves({ position, pieceCatalog });

    expect(legal.legalMoves.some((move) => move.fromRow === 7 && move.fromCol === 0)).toBe(true);
  });
});
