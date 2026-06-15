import {
  canonicalToMatchingWire,
  matchingWireToCanonicalPosition,
  resolveOnlineBattlePositionFromWire,
} from '@/lib/matching-server/canonical-game';
import type { MatchingGameState } from '@/domain/matching-server/protocol';

describe('matching-server canonical-game', () => {
  it('keeps standard game codes displayable through canonical conversion', () => {
    const wire: MatchingGameState = {
      version: 1,
      turn: 'black',
      board: {
        '7g': 'black:FU',
        '5i': 'black:OU',
        '3c': 'white:FU',
        '5a': 'white:OU',
      },
      hands: { black: { FU: 1 }, white: {} },
    };

    const position = matchingWireToCanonicalPosition(wire, []);
    const pieces =
      (position.boardState as { pieces?: Array<{ pieceCode?: string; char: string }> }).pieces ??
      [];

    expect(pieces.find((piece) => piece.pieceCode === 'FU')?.char).toBe('歩');
    expect(pieces.find((piece) => piece.pieceCode === 'OU')?.char).toBe('王');
    expect(canonicalToMatchingWire(position).board['7g']).toBe('black:FU');
  });

  it('resolves gacha deck piece char from catalog when wire uses BFF piece code', () => {
    const wire: MatchingGameState = {
      version: 1,
      turn: 'black',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '5e': 'black:PIECE_GACHA_KO',
      },
      hands: { black: {}, white: {} },
    };
    const catalog = [
      {
        pieceId: 127,
        pieceCode: 'piece_gacha_ko',
        canonicalCode: 'GACHA_KOU',
        char: '膠',
        name: '膠',
        unlock: 'test',
        desc: '',
        skill: '',
        move: '',
        moveVectors: [],
        isRepeatable: false,
      },
    ];

    const position = matchingWireToCanonicalPosition(wire, catalog);
    const pieces =
      (position.boardState as { pieces?: Array<{ pieceCode?: string; char: string }> }).pieces ??
      [];

    expect(pieces.find((piece) => piece.pieceCode === 'GACHA_KOU')?.char).toBe('膠');
  });

  it('normalizes BFF gacha baku wire code to engine skill code', () => {
    const wire: MatchingGameState = {
      version: 1,
      turn: 'black',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '5e': 'black:PIECE_GACHA_BAKU',
      },
      hands: { black: {}, white: {} },
    };
    const catalog = [
      {
        pieceId: 120,
        pieceCode: 'piece_gacha_baku',
        canonicalCode: 'GACHA_BAKU',
        char: '爆',
        name: '爆',
        unlock: 'test',
        desc: '',
        skill: '',
        move: '',
        moveVectors: [],
        isRepeatable: false,
      },
    ];

    const position = matchingWireToCanonicalPosition(wire, catalog);
    const pieces =
      (position.boardState as { pieces?: Array<{ pieceCode?: string; char: string }> }).pieces ??
      [];

    expect(pieces.find((piece) => piece.char === '爆')?.pieceCode).toBe('GACHA_BAKU');
  });

  it('preserves cow charge suffix from wire board encoding', () => {
    const wire: MatchingGameState = {
      version: 2,
      turn: 'black',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '5f': 'black:COW@1',
      },
      hands: { black: {}, white: {} },
    };

    const position = matchingWireToCanonicalPosition(wire, []);
    const pieces =
      (
        position.boardState as {
          pieces?: Array<{
            pieceCode?: string;
            char?: string;
            cowChargeCount?: number;
            row?: number;
            col?: number;
          }>;
        }
      ).pieces ?? [];

    const cow = pieces.find((piece) => piece.row === 5 && piece.col === 4);
    expect(cow?.pieceCode).toBe('COW');
    expect(cow?.char).toBe('牛');
    expect(cow?.cowChargeCount).toBe(1);
    expect(canonicalToMatchingWire(position).board['5f']).toBe('black:COW@1');
  });

  it('preserves promoted pieces from wire board encoding', () => {
    const wire: MatchingGameState = {
      version: 2,
      turn: 'white',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '3f': 'black:FU+',
      },
      hands: { black: {}, white: {} },
    };

    const position = matchingWireToCanonicalPosition(wire, []);
    const pieces =
      (
        position.boardState as {
          pieces?: Array<{
            pieceCode?: string;
            char?: string;
            promoted?: boolean;
            row?: number;
            col?: number;
          }>;
        }
      ).pieces ?? [];

    const promoted = pieces.find((piece) => piece.row === 5 && piece.col === 6);
    expect(promoted?.pieceCode).toBe('FU');
    expect(promoted?.promoted).toBe(true);
    expect(promoted?.char).toBe('と');
    expect(canonicalToMatchingWire(position).board['3f']).toBe('black:FU+');
  });

  it('preserves server skill state on wire sync for online battle parity', () => {
    const wire: MatchingGameState = {
      version: 2,
      turn: 'white',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '5e': 'black:RAINBOW',
      },
      hands: { black: {}, white: {} },
      skillState: {
        movement_modifiers: [
          {
            row: 4,
            col: 4,
            side: 'black',
            movement_rule: 'orthogonal_step_only',
            remaining_turns: 2,
          },
        ],
      },
    };

    const position = matchingWireToCanonicalPosition(wire, []);
    const skillState = (position.boardState as { skill_state?: MatchingGameState['skillState'] })
      .skill_state;

    expect(skillState?.movement_modifiers?.[0]?.side).toBe('player');
    expect(skillState?.movement_modifiers?.[0]?.movement_rule).toBe('orthogonal_step_only');
  });

  it('preserves server skill state through canonical conversion with side mapping', () => {
    const wire: MatchingGameState = {
      version: 2,
      turn: 'white',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '4f': 'white:KA',
      },
      hands: { black: {}, white: {} },
      skillState: {
        movement_modifiers: [
          {
            row: 5,
            col: 5,
            side: 'white',
            movement_rule: 'orthogonal_step_only',
            remaining_turns: 1,
          },
        ],
        board_hazards: [
          {
            row: 4,
            col: 4,
            hazard_type: 'poison_cell',
            affects_side: 'white',
            remaining_turns: 3,
          },
        ],
      },
    };

    const position = matchingWireToCanonicalPosition(wire, []);
    const skillState = (position.boardState as { skill_state?: MatchingGameState['skillState'] })
      .skill_state;

    expect(skillState?.movement_modifiers?.[0]?.side).toBe('enemy');
    expect(skillState?.board_hazards?.[0]?.affects_side).toBe('enemy');

    const roundTrip = canonicalToMatchingWire(position);
    expect(roundTrip.skillState?.movement_modifiers?.[0]?.side).toBe('white');
    expect(roundTrip.skillState?.board_hazards?.[0]?.affects_side).toBe('white');
  });

  it('resolveOnlineBattlePositionFromWire prefers wire.board over stale canonicalState pieces', () => {
    const wire: MatchingGameState = {
      version: 3,
      turn: 'white',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '4e': 'white:PHANTOM',
        '5f': 'black:GI',
      },
      hands: { black: {}, white: {} },
      skillState: {},
      canonicalState: {
        sideToMove: 'enemy',
        turnNumber: 3,
        moveCount: 2,
        sfen: 'online-match',
        stateHash: 'v3',
        boardState: {
          pieces: [
            { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
            { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
            { side: 'player', row: 5, col: 4, pieceCode: 'GI', char: '銀', promoted: false },
            { side: 'enemy', row: 4, col: 4, pieceCode: 'FU', char: '歩', promoted: false },
          ],
        },
        hands: { player: {}, enemy: {} },
      },
    };

    const position = resolveOnlineBattlePositionFromWire(wire, []);
    const pieces =
      (position.boardState as { pieces?: Array<{ pieceCode?: string; row: number; col: number }> })
        .pieces ?? [];

    expect(
      pieces.some((piece) => piece.pieceCode === 'PHANTOM' && piece.row === 4 && piece.col === 5),
    ).toBe(true);
    expect(
      pieces.some((piece) => piece.pieceCode === 'GI' && piece.row === 5 && piece.col === 4),
    ).toBe(true);
    expect(
      pieces.some((piece) => piece.pieceCode === 'FU' && piece.row === 4 && piece.col === 4),
    ).toBe(false);
  });
});
