import { normalizeSkillPieceCode } from '@/lib/matching-server/skill-piece-code';

describe('skill-piece-code', () => {
  it('normalizes BFF gacha and char-based instance ids', () => {
    expect(normalizeSkillPieceCode('PIECE_GACHA_BAKU', '爆')).toBe('GACHA_BAKU');
    expect(normalizeSkillPieceCode('PIECE_C518B11858F2', '炎')).toBe('ENN');
    expect(normalizeSkillPieceCode('PIECE_FLAME', '炎')).toBe('FLAME');
    expect(normalizeSkillPieceCode('WATER', '水')).toBe('SUI');
  });
});
