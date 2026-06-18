import {
  clearActiveMatchProfile,
  setActiveMatchProfile,
} from '@/lib/matching-server/match-profile-store';
import {
  buildPvpRatingPreview,
  resolvePvpRatingInputs,
} from '@/lib/online-match/resolve-pvp-rating-preview';

describe('resolve-pvp-rating-preview', () => {
  afterEach(() => {
    clearActiveMatchProfile();
  });

  it('reads ratings from active match profile', () => {
    setActiveMatchProfile({
      self: { userId: 'self', displayName: 'Self', rating: 1500 },
      opponent: { userId: 'opp', displayName: 'Opp', rating: 1400 },
    });

    expect(resolvePvpRatingInputs()).toEqual({
      selfRating: 1500,
      opponentRating: 1400,
    });
  });

  it('falls back to session labels when profile is missing', () => {
    clearActiveMatchProfile();

    expect(
      resolvePvpRatingInputs({
        playerLabel: 'あなた: Alice (R1200)',
        opponentLabel: '相手: Bob (R1300)',
      }),
    ).toEqual({
      selfRating: 1200,
      opponentRating: 1300,
    });
  });

  it('builds preview delta for wins and losses', () => {
    const preview = buildPvpRatingPreview({
      won: true,
      cached: { selfRating: 1500, opponentRating: 1500 },
    });

    expect(preview).toEqual({ delta: 16, ratingAfter: 1516 });
  });
});
