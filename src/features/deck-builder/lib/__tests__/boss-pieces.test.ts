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

  it('treats stage 30 and oni boss kanji as boss', () => {
    expect(isBossPiece({ char: 'K' })).toBe(true);
    expect(isBossPiece({ char: '実' })).toBe(true);
    expect(isBossPiece({ char: '異' })).toBe(true);
    expect(isBossPiece({ char: '鬼' })).toBe(true);
    expect(isBossPiece({ char: '赤鬼' })).toBe(true);
    expect(isBossPiece({ char: '青鬼' })).toBe(true);
    expect(isBossPiece({ char: '黒鬼' })).toBe(true);
    expect(isBossPiece({ pieceCode: 'KBOSS' })).toBe(true);
    expect(isBossPiece({ pieceCode: 'EXPERIMENT' })).toBe(true);
    expect(isBossPiece({ pieceCode: 'MUTANT' })).toBe(true);
    expect(isBossPiece({ pieceCode: 'REDONI' })).toBe(true);
  });

  it('does not treat normal pieces as boss', () => {
    expect(isBossPiece({ char: '歩' })).toBe(false);
    expect(isBossPiece({ char: '忍' })).toBe(false);
  });
});
