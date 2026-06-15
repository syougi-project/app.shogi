import { applyMove, generateLegalMoves } from '@/ai/engine';
import { normalizePieceCatalog } from '@/ai/model';
import { matchingWireToCanonicalPosition } from '@/lib/matching-server/canonical-game';
import {
  battleMoveToServerPayload,
  filterBattleMovesForServerWire,
} from '@/lib/matching-server/game-bridge';
import type { MatchingGameState } from '@/domain/matching-server/protocol';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

const minimalCatalog: PieceCatalogItem[] = [
  {
    pieceCode: 'FU',
    char: '歩',
    name: 'Pawn',
    skill: '',
    move: '',
    unlock: '',
    desc: '',
    moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    isRepeatable: false,
  },
  {
    pieceCode: 'OU',
    char: '王',
    name: 'King',
    skill: '',
    move: '',
    unlock: '',
    desc: '',
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
    isRepeatable: false,
  },
];

describe('online poison parity', () => {
  it('allows non-king to move onto poison cell after wire sync and removes piece on apply', () => {
    const wire: MatchingGameState = {
      version: 3,
      turn: 'white',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '5d': 'white:FU',
      },
      hands: { black: {}, white: {} },
      skillState: {
        board_hazards: [
          {
            row: 4,
            col: 4,
            hazard_type: 'poison_cell',
            affects_side: 'white',
            remaining_turns: 4,
          },
        ],
      },
    };

    const position = matchingWireToCanonicalPosition(wire, minimalCatalog);
    const catalog = normalizePieceCatalog(minimalCatalog);
    const legal = generateLegalMoves({ position, pieceCatalog: catalog });
    const poisonMove = legal.legalMoves.find(
      (move) => move.fromRow === 3 && move.fromCol === 4 && move.toRow === 4 && move.toCol === 4,
    );
    expect(poisonMove).toBeDefined();

    const filtered = filterBattleMovesForServerWire(
      legal.legalMoves,
      wire,
      'white',
      minimalCatalog,
    );
    expect(filtered.some((move) => move.toRow === 4 && move.toCol === 4)).toBe(true);

    expect(() =>
      battleMoveToServerPayload(poisonMove!, 'white', wire, minimalCatalog),
    ).not.toThrow();

    const committed = applyMove({
      position,
      pieceCatalog: catalog,
      move: poisonMove!,
    });
    const pieces = committed.position.boardState.pieces as Array<{
      row: number;
      col: number;
      pieceCode: string;
    }>;
    expect(pieces.some((p) => p.row === 4 && p.col === 4 && p.pieceCode === 'FU')).toBe(false);
  });
});
