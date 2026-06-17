import { normalizeSkillPieceCode } from '@/lib/matching-server/skill-piece-code';

describe('normalizeSkillPieceCode', () => {
  const cases = [
    ['PIECE_F75D88C48D6D', '牛', 'COW'],
    ['PIECE_5D848242A136', '書', 'BOOK'],
    ['PIECE_7FC715661514', '財', 'ZAI'],
    ['PIECE_124C31EA5D7A', '桜', 'CHERRY'],
    ['PIECE_C4AEB81F3634', '巨', 'GIANT'],
    ['PIECE_3EFA5702E75B', '豚', 'PIG'],
    ['PIECE_29ECAB1EF3C3', '禽', 'BIRD'],
    ['PIECE_SHOP_SO', '走', 'SHOP_SO'],
    ['PIECE_FIELD', '畑', 'FIELD'],
  ] as const;

  for (const [raw, char, expected] of cases) {
    test(`normalizeSkillPieceCode(${raw}, ${char}) -> ${expected}`, () => {
      expect(normalizeSkillPieceCode(raw, char)).toBe(expected);
    });
  }
});
