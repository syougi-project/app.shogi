import { isRatedOnlineMatchEndReason } from '@/lib/online-match/online-match-rating-policy';

describe('online-match-rating-policy', () => {
  it('rates intentional disconnect but not disconnect timeout', () => {
    expect(isRatedOnlineMatchEndReason('disconnect')).toBe(true);
    expect(isRatedOnlineMatchEndReason('disconnect_timeout')).toBe(false);
    expect(isRatedOnlineMatchEndReason('king_capture')).toBe(true);
  });
});
