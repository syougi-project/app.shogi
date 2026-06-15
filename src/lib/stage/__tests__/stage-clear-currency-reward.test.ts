import {
  computeStageClearCurrencyGrant,
  hasStageClearCurrencyGrant,
} from '@/lib/stage/stage-clear-currency-reward';

describe('stage-clear-currency-reward (app)', () => {
  it('matches BFF formula', () => {
    expect(computeStageClearCurrencyGrant(3, true)).toEqual({ pawn: 20, gold: 1 });
    expect(computeStageClearCurrencyGrant(7, false)).toEqual({ pawn: 3, gold: 0 });
  });

  it('detects non-zero currency grants', () => {
    expect(hasStageClearCurrencyGrant({ pawn: 20, gold: 1 })).toBe(true);
    expect(hasStageClearCurrencyGrant({ pawn: 3, gold: 0 })).toBe(true);
    expect(hasStageClearCurrencyGrant({ pawn: 0, gold: 0 })).toBe(false);
  });
});
