/**
 * ステージボス専用駒（マイデッキ・対戦用デッキには入れない）。
 * 表示用・配置禁止の判定に共通利用する。
 */
export type BossPieceLike = {
  char: string;
  name?: string | null;
  pieceCode?: string | null;
};

function normKanji(s: string): string {
  const t = (s ?? '').trim();
  try {
    return t.normalize('NFKC');
  } catch {
    return t;
  }
}

/** 「朧」「死」「魂」「巨」「あ」および対応 pieceCode。 */
export function isBossPiece(input: BossPieceLike): boolean {
  const ch = normKanji(input.char);
  if (ch === '朧' || ch === '死' || ch === '魂' || ch === '巨' || ch === 'あ') return true;

  const name = normKanji(input.name ?? '');
  if (name === 'あ人' || name.includes('あ人')) return true;

  const pc = (input.pieceCode ?? '').toUpperCase();
  if (pc.includes('OBORO')) return true;
  if (pc.includes('DEATH')) return true;
  if (pc.includes('SOUL')) return true;
  if (pc.includes('GIANT') || pc.includes('C4AEB81F3634')) return true;
  if (pc === 'AH' || pc.includes('GACHA_AH') || pc.includes('A9C2AD579732')) return true;

  return false;
}
