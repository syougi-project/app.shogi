import {
  calculateEloRatingDelta,
  formatPvpRatingDelta,
  normalizePvpRating,
} from '@/lib/online-match/elo-rating';

describe('elo-rating', () => {
  it('calculates symmetric deltas for equal ratings', () => {
    expect(calculateEloRatingDelta(1500, 1500, true)).toBe(16);
    expect(calculateEloRatingDelta(1500, 1500, false)).toBe(-16);
  });

  it('formats signed delta text', () => {
    expect(formatPvpRatingDelta(12)).toBe('+12');
    expect(formatPvpRatingDelta(-8)).toBe('-8');
    expect(formatPvpRatingDelta(0)).toBe('0');
  });

  it('normalizes invalid ratings to zero', () => {
    expect(normalizePvpRating('x')).toBe(0);
    expect(normalizePvpRating(-3)).toBe(0);
  });
});
