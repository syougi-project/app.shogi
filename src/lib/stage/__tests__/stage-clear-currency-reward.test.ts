import {
  computeStageClearCurrencyGrant,
  firstClearStageCurrencyGrant,
  hasStageClearCurrencyGrant,
} from '@/lib/stage/stage-clear-currency-reward';

describe('stage-clear-currency-reward (app)', () => {
  it('matches BFF tiered first-clear formula', () => {
    expect(firstClearStageCurrencyGrant(1)).toEqual({ pawn: 5, gold: 0 });
    expect(firstClearStageCurrencyGrant(5)).toEqual({ pawn: 5, gold: 0 });
    expect(firstClearStageCurrencyGrant(6)).toEqual({ pawn: 5, gold: 1 });
    expect(firstClearStageCurrencyGrant(10)).toEqual({ pawn: 5, gold: 1 });
    expect(firstClearStageCurrencyGrant(11)).toEqual({ pawn: 8, gold: 2 });
    expect(firstClearStageCurrencyGrant(20)).toEqual({ pawn: 8, gold: 2 });
    expect(firstClearStageCurrencyGrant(21)).toEqual({ pawn: 12, gold: 2 });
    expect(firstClearStageCurrencyGrant(30)).toEqual({ pawn: 12, gold: 2 });
    expect(firstClearStageCurrencyGrant(31)).toEqual({ pawn: 20, gold: 3 });
    expect(firstClearStageCurrencyGrant(40)).toEqual({ pawn: 20, gold: 3 });
    expect(firstClearStageCurrencyGrant(41)).toEqual({ pawn: 25, gold: 3 });
    expect(firstClearStageCurrencyGrant(50)).toEqual({ pawn: 25, gold: 3 });
    expect(computeStageClearCurrencyGrant(3, true)).toEqual({ pawn: 5, gold: 0 });
    expect(computeStageClearCurrencyGrant(7, false)).toEqual({ pawn: 3, gold: 0 });
  });

  it('detects non-zero currency grants', () => {
    expect(hasStageClearCurrencyGrant({ pawn: 5, gold: 0 })).toBe(true);
    expect(hasStageClearCurrencyGrant({ pawn: 8, gold: 2 })).toBe(true);
    expect(hasStageClearCurrencyGrant({ pawn: 0, gold: 0 })).toBe(false);
  });
});
