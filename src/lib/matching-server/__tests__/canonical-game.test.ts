import {
  canonicalToMatchingWire,
  matchingWireToCanonicalPosition,
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

    expect(pieces.find((piece) => piece.pieceCode === 'PIECE_GACHA_KO')?.char).toBe('膠');
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
});
