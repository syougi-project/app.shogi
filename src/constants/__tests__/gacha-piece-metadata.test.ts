import { resolveGachaPieceDisplayRarity } from '@/constants/gacha-piece-metadata';

describe('gacha piece metadata', () => {
  it('resolveGachaPieceDisplayRarity maps 膠 to SSR even when API returns UR', () => {
    expect(resolveGachaPieceDisplayRarity('膠', 'UR')).toBe('SSR');
    expect(resolveGachaPieceDisplayRarity('閹', 'UR')).toBe('UR');
  });
});
