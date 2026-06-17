import { isRatedOnlineMatchEndReason } from '@/lib/online-match/online-match-rating-policy';

describe('online-match-rating-policy', () => {
  it('treats disconnect finishes as non-rated', () => {
    expect(isRatedOnlineMatchEndReason('disconnect')).toBe(false);
    expect(isRatedOnlineMatchEndReason('disconnect_timeout')).toBe(false);
    expect(isRatedOnlineMatchEndReason('king_capture')).toBe(true);
  });
});
