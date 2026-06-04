import { isBossPiece } from '@/features/deck-builder/lib/boss-pieces';

describe('isBossPiece', () => {
  it('treats あ as boss', () => {
    expect(isBossPiece({ char: 'あ' })).toBe(true);
    expect(isBossPiece({ char: 'あ', name: 'あ人' })).toBe(true);
  });

  it('treats existing boss kanji as boss', () => {
    expect(isBossPiece({ char: '魂' })).toBe(true);
    expect(isBossPiece({ char: '巨' })).toBe(true);
  });

  it('does not treat normal pieces as boss', () => {
    expect(isBossPiece({ char: '歩' })).toBe(false);
    expect(isBossPiece({ char: '忍' })).toBe(false);
  });
});
