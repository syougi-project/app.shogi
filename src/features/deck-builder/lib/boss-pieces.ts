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

/** ステージボス専用駒（朧・死・魂・巨・あ・K・実・異・鬼 など）および対応 pieceCode。 */
export function isBossPiece(input: BossPieceLike): boolean {
  const ch = normKanji(input.char);
  if (
    ch === '朧' ||
    ch === '死' ||
    ch === '魂' ||
    ch === '巨' ||
    ch === 'あ' ||
    ch === 'K' ||
    ch === '実' ||
    ch === '異' ||
    ch === '鬼' ||
    ch === '赤鬼' ||
    ch === '青鬼' ||
    ch === '黒鬼'
  ) {
    return true;
  }

  const name = normKanji(input.name ?? '');
  if (name === 'あ人' || name.includes('あ人')) return true;
  if (name === '赤鬼' || name === '青鬼' || name === '黒鬼') return true;
  if (name === 'K博士' || name.includes('K博士')) return true;
  if (name === '実験体' || name.includes('実験体')) return true;
  if (name === '変異体' || name.includes('変異体')) return true;

  const pc = (input.pieceCode ?? '').toUpperCase();
  if (pc.includes('OBORO')) return true;
  if (pc.includes('DEATH')) return true;
  if (pc.includes('SOUL')) return true;
  if (pc.includes('GIANT') || pc.includes('C4AEB81F3634')) return true;
  if (pc === 'AH' || pc.includes('GACHA_AH') || pc.includes('A9C2AD579732')) return true;
  if (pc === 'KBOSS' || pc.includes('9C0038EF7D22')) return true;
  if (pc === 'EXPERIMENT' || pc.includes('96F3DCA867EC')) return true;
  if (pc === 'MUTANT' || pc.includes('A8A8CD0FEACC')) return true;
  if (pc === 'REDONI' || pc === 'BLUEONI' || pc === 'BLACKONI' || pc.includes('533B7FEC5456')) {
    return true;
  }

  return false;
}
