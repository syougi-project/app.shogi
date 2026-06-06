/** matching_server の gacha-skill-piece-code と同じ正規化（オンライン同期用） */

const GACHA_CHAR_TO_SKILL_CODE: Readonly<Record<string, string>> = {
  爆: 'GACHA_BAKU',
  室: 'GACHA_SHITSU',
  定: 'GACHA_SADAME',
  安: 'GACHA_AN',
  宋: 'GACHA_SO',
  灯: 'GACHA_TOU',
  辺: 'GACHA_HEN',
  逸: 'GACHA_ITSU',
  逃: 'GACHA_TOU2',
  艸: 'GACHA_SOU',
  膠: 'GACHA_KOU',
};

const EXPLICIT_GACHA_CODE_ALIASES: Readonly<Record<string, string>> = {
  PIECE_GACHA_KO: 'GACHA_KOU',
  PIECE_GACHA_KOU: 'GACHA_KOU',
  GACHA_KO: 'GACHA_KOU',
  PIECE_GACHA_MURO: 'GACHA_SHITSU',
  PIECE_GACHA_SHITSU: 'GACHA_SHITSU',
  GACHA_MURO: 'GACHA_SHITSU',
  PIECE_GACHA_TO: 'GACHA_TOU2',
  GACHA_TO: 'GACHA_TOU2',
  PIECE_GACHA_BAKU: 'GACHA_BAKU',
  PIECE_GACHA_SADAME: 'GACHA_SADAME',
  PIECE_GACHA_AN: 'GACHA_AN',
  PIECE_GACHA_SO: 'GACHA_SO',
  PIECE_GACHA_TOU: 'GACHA_TOU',
  PIECE_GACHA_HEN: 'GACHA_HEN',
  PIECE_GACHA_ITSU: 'GACHA_ITSU',
  PIECE_GACHA_TOU2: 'GACHA_TOU2',
  PIECE_GACHA_SOU: 'GACHA_SOU',
};

const PORTED_GACHA_CODES = new Set(Object.values(GACHA_CHAR_TO_SKILL_CODE));

function gachaSuffixToSkillCode(suffix: string): string | null {
  const upper = suffix.trim().toUpperCase();
  const remapped =
    upper === 'KO' ? 'KOU' : upper === 'MURO' ? 'SHITSU' : upper === 'TO' ? 'TOU2' : upper;
  const candidate = `GACHA_${remapped}`;
  return PORTED_GACHA_CODES.has(candidate) ? candidate : null;
}

export function normalizeGachaSkillPieceCode(raw: string, char?: string | null): string {
  const upper = raw.trim().toUpperCase();
  const alias = EXPLICIT_GACHA_CODE_ALIASES[upper];
  if (alias) return alias;

  const pieceGachaMatch = upper.match(/^PIECE_GACHA_(.+)$/);
  if (pieceGachaMatch) {
    const mapped = gachaSuffixToSkillCode(pieceGachaMatch[1]!);
    if (mapped) return mapped;
  }

  const gachaMatch = upper.match(/^GACHA_(.+)$/);
  if (gachaMatch) {
    const mapped = gachaSuffixToSkillCode(gachaMatch[1]!);
    if (mapped) return mapped;
  }

  if (PORTED_GACHA_CODES.has(upper)) return upper;

  const trimmedChar = char?.trim();
  if (trimmedChar && GACHA_CHAR_TO_SKILL_CODE[trimmedChar]) {
    return GACHA_CHAR_TO_SKILL_CODE[trimmedChar];
  }

  return upper;
}
