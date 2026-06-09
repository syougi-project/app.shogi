import { resolveWinnerSideFromWire } from '@/lib/matching-server/online-battle-outcome';
import type { MatchingGameState } from '@/domain/matching-server/protocol';

describe('online-battle-outcome', () => {
  test('returns enemy when ally king is missing on wire board', () => {
    const wire: MatchingGameState = {
      version: 2,
      turn: 'white',
      board: {
        '5i': 'black:OU',
      },
      hands: { black: {}, white: {} },
    };

    expect(resolveWinnerSideFromWire(wire, 'white')).toBe('enemy');
    expect(resolveWinnerSideFromWire(wire, 'black')).toBe('player');
  });

  test('returns null while both kings remain', () => {
    const wire: MatchingGameState = {
      version: 1,
      turn: 'black',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
      },
      hands: { black: {}, white: {} },
    };

    expect(resolveWinnerSideFromWire(wire, 'black')).toBeNull();
  });
});
