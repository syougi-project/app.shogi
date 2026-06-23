import { CHAR_TO_CODE } from '@/features/stage-shogi/domain/piece-conversion';
import { toBasePieceCode } from '@/ai/model/move';
import { normalizeGachaSkillPieceCode } from '@/lib/matching-server/gacha-piece-code';

type PieceLike = {
  pieceCode: string | null;
  char: string;
};

type SkillMoverFlagName =
  | 'isFlameMover'
  | 'isFireMover'
  | 'isWaterMover'
  | 'isTreasureMover'
  | 'isIronMover'
  | 'isWaveMover'
  | 'isTinMover'
  | 'isElectricMover'
  | 'isThunderMover'
  | 'isTimeMover'
  | 'isIceMover'
  | 'isSnowMover'
  | 'isSandMover'
  | 'isWindMover'
  | 'isFishMover'
  | 'isMossMover'
  | 'isRainbowMover'
  | 'isDanceMover'
  | 'isSwampMover'
  | 'isPoisonMover'
  | 'isWaterfallMover'
  | 'isAMover'
  | 'isWoodMover'
  | 'isLeafMover'
  | 'isBullMover'
  | 'isBignoiseMover'
  | 'isDemonMover'
  | 'isDarkMover'
  | 'isRidgeMover'
  | 'isRockMover'
  | 'isOreMover'
  | 'isGraveMover'
  | 'isDepressionMover'
  | 'isRoseMover'
  | 'isChrysanthemumMover'
  | 'isPrisonFenceMover'
  | 'isBlueOniMover'
  | 'isBlackOniMover'
  | 'isRedOniMover'
  | 'isTatsuGodMover'
  | 'isExperimentMover'
  | 'isKbossMover'
  | 'isBoatMover'
  | 'isBirdMover';

export type SkillMoverFlags = Record<SkillMoverFlagName, boolean>;

type SkillMoverSpec = {
  key: Exclude<
    SkillMoverFlagName,
    | 'isAMover'
    | 'isBoatMover'
    | 'isBirdMover'
    | 'isTatsuGodMover'
    | 'isExperimentMover'
    | 'isKbossMover'
  >;
  aliases: readonly string[];
};

const FLAME_PIECE_CODES = ['ENN', 'FLAME', '炎'] as const;
const FIRE_PIECE_CODES = ['FIRE', 'FIR', '火'] as const;
const WATER_PIECE_CODES = ['WATER', 'SUI', '水'] as const;
const TREASURE_PIECE_CODES = ['TREASURE', '宝'] as const;
const IRON_PIECE_CODES = ['IRON', '鉄'] as const;
const WAVE_PIECE_CODES = ['WAVE', 'NAM', '波'] as const;
const TIN_PIECE_CODES = ['TIN', '錫'] as const;
const ELECTRIC_PIECE_CODES = ['ELECTRIC', '電'] as const;
const THUNDER_PIECE_CODES = ['THUNDER', '雷'] as const;
const TIME_PIECE_CODES = ['TIME', '時'] as const;
const ICE_PIECE_CODES = ['ICE', '氷'] as const;
const SNOW_PIECE_CODES = ['SNOW', '雪'] as const;
const SAND_PIECE_CODES = ['SAND', '砂'] as const;
const WIND_PIECE_CODES = ['WIND', '風'] as const;
const FISH_PIECE_CODES = ['FISH', '魚'] as const;
const MOSS_PIECE_CODES = ['MOSS', '苔'] as const;
const RAINBOW_PIECE_CODES = ['RAINBOW', '虹'] as const;
const DANCE_PIECE_CODES = ['MAI', 'SHOP_MAI', '舞'] as const;
const SWAMP_PIECE_CODES = ['SWAMP', '沼'] as const;
const POISON_PIECE_CODES = ['POISON', '毒'] as const;
const WATERFALL_PIECE_CODES = ['WATERFALL', '滝', '8CC9287B7E93'] as const;
const WOOD_PIECE_CODES = ['WOOD', 'MOK', '木'] as const;
const LEAF_PIECE_CODES = ['LEAF', 'HAA', '葉'] as const;
const BULL_PIECE_CODES = ['BULL', '犇', '1275B5728D1C'] as const;
const BIGNOISE_PIECE_CODES = ['BIGNOISE', '轟', 'D24741D0EF18'] as const;
const DEMON_PIECE_CODES = ['DEMON', 'MAK', '魔'] as const;
const DARK_PIECE_CODES = ['DARK', 'YAM', '闇'] as const;
const RIDGE_PIECE_CODES = ['RIDGE', 'REI', '嶺', '555D2E24EFB0'] as const;
const ROCK_PIECE_CODES = ['ROCK', '岩', '69D6ECEFF4E1'] as const;
const ORE_PIECE_CODES = ['ORE', '鉱', '1BC740C95315'] as const;
const GRAVE_PIECE_CODES = ['GRAVE', '墓', 'BC8AB84E787B'] as const;
const DEPRESSION_PIECE_CODES = ['DEPRESSION', '鬱', '9E27F89F65C5'] as const;
const ROSE_PIECE_CODES = ['ROSE', '薔', 'A49C1E52B47A'] as const;
const CHRYSANTHEMUM_PIECE_CODES = ['CHRYSANTHEMUM', '菊', '8254C41BA326'] as const;
const RED_ONI_PIECE_CODES = ['REDONI', '赤鬼'] as const;
const BLUE_ONI_PIECE_CODES = ['BLUEONI', '青鬼'] as const;
const BLACK_ONI_PIECE_CODES = ['BLACKONI', '黒鬼'] as const;
const PRISON_FENCE_PIECE_CODES = [
  'PRISON',
  'ROU',
  'FENCE',
  'SAKU',
  'SAKUI',
  '406177108665',
  '95E4E9F3D8E5',
] as const;
const STANDARD_CORE_PIECE_CODES = ['FU', 'KY', 'KE', 'GI', 'KI', 'KA', 'HI', 'OU'] as const;

const STANDARD_DECK_PIECE_CHARS = new Set(['王', '玉', '歩', '香', '桂', '銀', '金', '飛', '角']);
const STANDARD_DECK_PIECE_CODES = new Set<string>(STANDARD_CORE_PIECE_CODES);

/** デッキビルダーの「特殊駒」判定と同系（標準8種以外）。 */
export function isDeckBuilderStyleSpecialBoardPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (STANDARD_DECK_PIECE_CHARS.has(char)) return false;
  const base = toBasePieceCode(piece.pieceCode);
  if (base && STANDARD_DECK_PIECE_CODES.has(base)) return false;
  const code = CHAR_TO_CODE[char];
  if (!code) return true;
  return !STANDARD_DECK_PIECE_CODES.has(code);
}

const MOVER_SPECS: readonly SkillMoverSpec[] = [
  { key: 'isFlameMover', aliases: FLAME_PIECE_CODES },
  { key: 'isFireMover', aliases: FIRE_PIECE_CODES },
  { key: 'isWaterMover', aliases: WATER_PIECE_CODES },
  { key: 'isTreasureMover', aliases: TREASURE_PIECE_CODES },
  { key: 'isIronMover', aliases: IRON_PIECE_CODES },
  { key: 'isWaveMover', aliases: WAVE_PIECE_CODES },
  { key: 'isTinMover', aliases: TIN_PIECE_CODES },
  { key: 'isElectricMover', aliases: ELECTRIC_PIECE_CODES },
  { key: 'isThunderMover', aliases: THUNDER_PIECE_CODES },
  { key: 'isTimeMover', aliases: TIME_PIECE_CODES },
  { key: 'isIceMover', aliases: ICE_PIECE_CODES },
  { key: 'isSnowMover', aliases: SNOW_PIECE_CODES },
  { key: 'isSandMover', aliases: SAND_PIECE_CODES },
  { key: 'isWindMover', aliases: WIND_PIECE_CODES },
  { key: 'isFishMover', aliases: FISH_PIECE_CODES },
  { key: 'isMossMover', aliases: MOSS_PIECE_CODES },
  { key: 'isRainbowMover', aliases: RAINBOW_PIECE_CODES },
  { key: 'isDanceMover', aliases: DANCE_PIECE_CODES },
  { key: 'isSwampMover', aliases: SWAMP_PIECE_CODES },
  { key: 'isPoisonMover', aliases: POISON_PIECE_CODES },
  { key: 'isWaterfallMover', aliases: WATERFALL_PIECE_CODES },
  { key: 'isWoodMover', aliases: WOOD_PIECE_CODES },
  { key: 'isLeafMover', aliases: LEAF_PIECE_CODES },
  { key: 'isBullMover', aliases: BULL_PIECE_CODES },
  { key: 'isBignoiseMover', aliases: BIGNOISE_PIECE_CODES },
  { key: 'isDemonMover', aliases: DEMON_PIECE_CODES },
  { key: 'isDarkMover', aliases: DARK_PIECE_CODES },
  { key: 'isRidgeMover', aliases: RIDGE_PIECE_CODES },
  { key: 'isRockMover', aliases: ROCK_PIECE_CODES },
  { key: 'isOreMover', aliases: ORE_PIECE_CODES },
  { key: 'isGraveMover', aliases: GRAVE_PIECE_CODES },
  { key: 'isDepressionMover', aliases: DEPRESSION_PIECE_CODES },
  { key: 'isRoseMover', aliases: ROSE_PIECE_CODES },
  { key: 'isChrysanthemumMover', aliases: CHRYSANTHEMUM_PIECE_CODES },
  { key: 'isPrisonFenceMover', aliases: PRISON_FENCE_PIECE_CODES },
  { key: 'isBlueOniMover', aliases: BLUE_ONI_PIECE_CODES },
  { key: 'isBlackOniMover', aliases: BLACK_ONI_PIECE_CODES },
  { key: 'isRedOniMover', aliases: RED_ONI_PIECE_CODES },
];

function pieceRawUpper(piece: PieceLike): string {
  return (piece.pieceCode ?? '').toUpperCase();
}

export function normKanjiForEngineRules(ch: string): string {
  try {
    return ch.normalize('NFKC');
  } catch {
    return ch;
  }
}

export function normalizeSkillPieceCode(raw: string | null | undefined): string {
  if (!raw) return '';
  const upper = raw.trim().toUpperCase();
  if (!upper) return '';
  if (upper.startsWith('PIECE_SHOGI_')) return upper.slice('PIECE_SHOGI_'.length);
  if (upper.startsWith('PIECE_')) return upper.slice('PIECE_'.length);
  return upper;
}

export function isOpaquePieceInstanceId(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^piece_[a-z0-9]+$/i.test(value.trim());
}

export function normalizedPieceCodeUpper(piece: PieceLike): string {
  return (toBasePieceCode(piece.pieceCode) ?? piece.pieceCode ?? '').toUpperCase();
}

/** 1文字の canonical（例: `A`）は部分一致させない。`MAI` が `A` に誤マッチするのを防ぐ。 */
function aliasAllowsSubstringMatch(normalizedAlias: string): boolean {
  return normalizedAlias.length >= 4;
}

function pieceMatchesAliases(piece: PieceLike, aliases: readonly string[]): boolean {
  const base = normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode) ?? '');
  const raw = pieceRawUpper(piece);
  const char = normKanjiForEngineRules(piece.char);
  return aliases.some((alias) => {
    const normalizedAlias = normalizeSkillPieceCode(alias);
    if (normalizedAlias === base || normalizedAlias === raw || alias === char) return true;
    if (!aliasAllowsSubstringMatch(normalizedAlias)) return false;
    return raw.includes(normalizedAlias);
  });
}

function codeMatchesAliases(
  rawCode: string | null | undefined,
  aliases: readonly string[],
): boolean {
  const normalized = normalizeSkillPieceCode(rawCode);
  if (!normalized) return false;
  return aliases.some((alias) => {
    const normalizedAlias = normalizeSkillPieceCode(alias);
    if (normalized === normalizedAlias) return true;
    if (!aliasAllowsSubstringMatch(normalizedAlias)) return false;
    return normalized.includes(normalizedAlias);
  });
}

export function isSpiritPiece(piece: PieceLike): boolean {
  return (
    piece.char === '霊' ||
    toBasePieceCode(piece.pieceCode) === 'SPIRIT' ||
    pieceRawUpper(piece).includes('9D7397390E77')
  );
}

export function isDeathPiece(piece: PieceLike): boolean {
  return (
    normKanjiForEngineRules(piece.char) === '死' || toBasePieceCode(piece.pieceCode) === 'DEATH'
  );
}

export function isSoulPiece(piece: PieceLike): boolean {
  return (
    normKanjiForEngineRules(piece.char) === '魂' || toBasePieceCode(piece.pieceCode) === 'SOUL'
  );
}

export function isKbossPiece(piece: PieceLike): boolean {
  const base = toBasePieceCode(piece.pieceCode);
  return base === 'KBOSS' || piece.char === 'K';
}

export function isVanishOnCapturePiece(piece: PieceLike): boolean {
  const base = toBasePieceCode(piece.pieceCode);
  return (
    piece.char === 'K' ||
    piece.char === '実' ||
    piece.char === '異' ||
    base === 'KBOSS' ||
    base === 'EXPERIMENT' ||
    base === 'MUTANT'
  );
}

export function isHolePiece(piece: PieceLike): boolean {
  return (
    normKanjiForEngineRules(piece.char) === '穴' ||
    toBasePieceCode(piece.pieceCode) === 'HOLE' ||
    pieceRawUpper(piece).includes('E381DFA07A3D')
  );
}

export function isOtsuPiece(piece: PieceLike): boolean {
  return (
    normKanjiForEngineRules(piece.char) === '乙' ||
    toBasePieceCode(piece.pieceCode) === 'OTSU' ||
    pieceRawUpper(piece).includes('5A07CA59B158')
  );
}

export function isConvexPiece(piece: PieceLike): boolean {
  const raw = pieceRawUpper(piece);
  return (
    normKanjiForEngineRules(piece.char) === '凸' ||
    toBasePieceCode(piece.pieceCode) === 'CONVEX' ||
    raw.includes('94B641477E72') ||
    raw.includes('CONVEX')
  );
}

export function isReflectivePiece(piece: PieceLike): boolean {
  return toBasePieceCode(piece.pieceCode) === 'HIK' || piece.char === '光';
}

export function isCloudPiece(piece: PieceLike): boolean {
  return toBasePieceCode(piece.pieceCode) === 'CLOUD' || piece.char === '雲';
}

export function isMirrorPiece(piece: PieceLike): boolean {
  const code = toBasePieceCode(piece.pieceCode);
  return (
    piece.char === '映' ||
    piece.char === '鏡' ||
    code === 'EI' ||
    code === 'KAGAMI' ||
    code === 'MIRROR'
  );
}

export function isMachinePiece(piece: PieceLike): boolean {
  return toBasePieceCode(piece.pieceCode) === 'MACHINE' || piece.char === '機';
}

export function isGunPiece(piece: PieceLike): boolean {
  return normKanjiForEngineRules(piece.char) === '銃' || toBasePieceCode(piece.pieceCode) === 'GUN';
}

/** 駒ショップ「走」: 前方に最大2マス（1マス目に駒があると2マス目には進めない）。 */
export function isRunPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '走') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'SO' || base === 'SHOP_SO') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('PIECE_SHOP_SO') || raw.includes('SHOP_SO');
}

/** 駒ショップ「麒」: 敵の歩・金・銀から取られない。 */
export function isKirinPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '麒') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'KIRIN' || base === 'SHOP_KIRIN') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('PIECE_SHOP_KIRIN') || raw.includes('SHOP_KIRIN');
}

/** 麒の取り免疫対象（HTML: 金・銀・歩のみ）。 */
export function isKirinImmuneCapturerPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '歩' || char === '金' || char === '銀' || char === 'と' || char === '成銀') {
    return true;
  }
  const base = toBasePieceCode(piece.pieceCode);
  return base === 'FU' || base === 'KI' || base === 'GI';
}

export function isKirinCaptureBlocked(captor: PieceLike, target: PieceLike): boolean {
  return isKirinPiece(target) && isKirinImmuneCapturerPiece(captor);
}

/** 駒ショップ「種」: 移動時20%で周囲ランダム1マスに「葉」を召喚。 */
export function isTanePiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '種') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'TANE' || base === 'SHOP_TANE') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('PIECE_SHOP_TANE') || raw.includes('SHOP_TANE');
}

/** ガチャ「定」: 前後左右1マス。 */
export function isSadamePiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '定') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'GACHA_SADAME') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('GACHA_SADAME');
}

/** ガチャ「進」: 移動範囲不明（毎ターンランダムな駒の移動範囲で動く）。 */
export function isShinPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '進') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'GACHA_SHIN') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('GACHA_SHIN');
}

/** ガチャ「逸」: 前と斜め4方向1マス。 */
export function isItsuPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '逸') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'GACHA_ITSU') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('GACHA_ITSU');
}

/** ガチャ「辺」: 前と斜め4方向1マス。 */
export function isHenPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '辺') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'GACHA_HEN') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('GACHA_HEN');
}

/** ガチャ「逃」: 全方向1マス。移動時味方の王を同方向に1マス追従。 */
export function isNigePiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '逃') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'GACHA_TOU2') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('GACHA_TOU2');
}

/** ガチャ「灯」: 前後左右・後斜めに各1マス。 */
export function isTouPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '灯') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'GACHA_TOU') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('GACHA_TOU') && !raw.includes('GACHA_TOU2');
}

/** ガチャ「煽」: 前後左右何マスでも。 */
export function isAoriPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '煽') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'GACHA_AORI') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('GACHA_AORI');
}

/** ガチャ「爆」: 前斜め前左右後ろ1マス。 */
export function isBakuPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '爆') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'GACHA_BAKU') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('GACHA_BAKU');
}

/** ガチャ「膠」: 前斜め前斜め後ろ1マス。隣接味方の横移動に追従。 */
export function isKoPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '膠') return true;
  const raw = pieceRawUpper(piece);
  if (
    raw.includes('GACHA_KOU') ||
    raw.includes('GACHA_KO') ||
    raw.includes('PIECE_GACHA_KO') ||
    raw.includes('MOVE_GACHA_KO')
  ) {
    return true;
  }
  const base = toBasePieceCode(piece.pieceCode);
  return normalizeGachaSkillPieceCode(base ?? raw, char) === 'GACHA_KOU';
}

/** ガチャ「閹」: 前後左右1マス（味方王の前1マスへも移動可）。 */
export function isEnPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '閹') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'GACHA_EN') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('GACHA_EN');
}

/** ガチャ「艸」: 前最大2マス左右後ろ1マス。移動時周囲に×マス（pit_cell）。 */
export function isSouPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '艸') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'GACHA_SOU') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('GACHA_SOU');
}

/** ステージ「炒」: 前最大2マス左右後ろ1マス（HTML stirMoves と同一）。 */
export function isSautePiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '炒') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'SAUTE') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('SAUTE') || raw.includes('1732246A37D8');
}

/** ステージ「焼」: 前最大2マス左右後ろ1マス（HTML roastMoves と同一）。 */
export function isSearPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '焼') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'SEAR') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('SEAR') || raw.includes('FDC83CF95746');
}

/** ガチャ「宋」: 前後何マスでも+左右1マス。 */
export function isSoPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '宋') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'GACHA_SO') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('GACHA_SO') && !raw.includes('GACHA_SOU');
}

/** 銅: 桂馬飛び + 前方に何マスでも。 */
export function isCopperPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '銅') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'COPPER') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('COPPER');
}

/** 波: 前後左右に各2マスまで。 */
export function isWavePiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '波') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'NAM' || base === 'WAVE') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('NAM') || raw.includes('WAVE');
}

/** ガチャ「安」: 前後左右1マス+桂馬飛び。 */
export function isAnPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '安') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'GACHA_AN') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('GACHA_AN');
}

/** 幻: 前後左右1マス+桂馬飛び。 */
export function isPhantomPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '幻') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'PHANTOM') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('PHANTOM');
}

/** 影: 斜め2マス + 左右1マス（前方直進なし）。 */
export function isShadowPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '影') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'KAG' || base === 'SHADOW') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('KAG') || raw.includes('SHADOW');
}

/** 山: 斜め4方向に各1マス（嶺スキル召喚駒）。 */
export function isYamaPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '山') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'YAMA') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('YAMA');
}

/** ガチャ「室」: 前後左右斜め前1マス。 */
export function isShitsuPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '室') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'GACHA_SHITSU' || base === 'GACHA_MURO') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('GACHA_SHITSU') || raw.includes('GACHA_MURO');
}

/** 駒ショップ「舞」: 移動時、その時点で周囲8マスの敵の移動を斜め前1マスのみに制限。 */
export function isMaiPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '舞') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'MAI' || base === 'SHOP_MAI') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('PIECE_SHOP_MAI') || raw.includes('SHOP_MAI');
}

/** 駒ショップ「P」: 縦横1マス。移動時同じ行・列の敵を行動不能にする。 */
export function isShopPPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === 'P') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'SHOP_P') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('PIECE_SHOP_P') || raw.includes('SHOP_P');
}

/** 駒ショップ「鳴」: 銀と同じ移動。 */
export function isNakuPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '鳴') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'NAKU' || base === 'SHOP_NAKU') return true;
  const raw = pieceRawUpper(piece);
  return raw.includes('PIECE_SHOP_NAKU') || raw.includes('SHOP_NAKU');
}

/** 鳴のポン取り: 盤上で同一種の敵駒か（canonical / 表示漢字）。 */
export function isSameEnemyPieceTypeForNakuPon(a: PieceLike, b: PieceLike): boolean {
  const baseA = toBasePieceCode(a.pieceCode);
  const baseB = toBasePieceCode(b.pieceCode);
  if (baseA && baseB && baseA === baseB) return true;
  const charA = normKanjiForEngineRules(a.char);
  const charB = normKanjiForEngineRules(b.char);
  return charA.length > 0 && charA === charB;
}

export function isKatanaPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '剣') return false;
  if (char === '刀') return true;
  const base = toBasePieceCode(piece.pieceCode);
  return base === 'KATANA' || base === 'SWORD';
}

export function isKenSwordPiece(piece: PieceLike): boolean {
  if (normKanjiForEngineRules(piece.char) === '剣') return true;
  const base = toBasePieceCode(piece.pieceCode);
  return base === 'HOLY_SWORD' || pieceRawUpper(piece).includes('0F14ABCC6E5E');
}

export function isShieldPiece(piece: PieceLike): boolean {
  return (
    normKanjiForEngineRules(piece.char) === '盾' || toBasePieceCode(piece.pieceCode) === 'SHIELD'
  );
}

export function isOboroPiece(piece: PieceLike): boolean {
  return (
    normKanjiForEngineRules(piece.char) === '朧' || toBasePieceCode(piece.pieceCode) === 'OBORO'
  );
}

export function isArmorPiece(piece: PieceLike): boolean {
  return piece.char === '鎧' || toBasePieceCode(piece.pieceCode) === 'ARMOR';
}

export function isKingPiece(piece: PieceLike): boolean {
  const base = toBasePieceCode(piece.pieceCode);
  return base === 'OU' || piece.char === '王' || piece.char === '玉';
}

export function isReiRitualPiece(piece: PieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  const raw = pieceRawUpper(piece);
  return (
    char === '礼' || raw.includes('4FCDDF14D08D') || toBasePieceCode(piece.pieceCode) === 'RITUAL'
  );
}

export function isCowPiece(piece: PieceLike): boolean {
  return (
    normKanjiForEngineRules(piece.char) === '牛' ||
    toBasePieceCode(piece.pieceCode) === 'COW' ||
    pieceRawUpper(piece).includes('F75D88C48D6D')
  );
}

export function isPigPiece(piece: PieceLike): boolean {
  return (
    normKanjiForEngineRules(piece.char) === '豚' ||
    toBasePieceCode(piece.pieceCode) === 'PIG' ||
    pieceRawUpper(piece).includes('3EFA5702E75B')
  );
}

export function isSenPiece(piece: PieceLike): boolean {
  return (
    normKanjiForEngineRules(piece.char) === '銭' ||
    toBasePieceCode(piece.pieceCode) === 'SEN' ||
    pieceRawUpper(piece).includes('EACC7F540399')
  );
}

export function isZaiPiece(piece: PieceLike): boolean {
  return (
    normKanjiForEngineRules(piece.char) === '財' ||
    toBasePieceCode(piece.pieceCode) === 'ZAI' ||
    pieceRawUpper(piece).includes('7FC715661514')
  );
}

export function isBeastPiece(piece: PieceLike): boolean {
  const raw = pieceRawUpper(piece);
  return (
    normKanjiForEngineRules(piece.char) === '獣' ||
    raw.includes('BEAST') ||
    raw.includes('05E4EFB89DAE') ||
    toBasePieceCode(piece.pieceCode) === 'BEAST'
  );
}

export function isBirdPiece(piece: PieceLike): boolean {
  const raw = pieceRawUpper(piece);
  return (
    normKanjiForEngineRules(piece.char) === '禽' ||
    raw.includes('BIRD') ||
    raw.includes('29ECAB1EF3C3') ||
    toBasePieceCode(piece.pieceCode) === 'BIRD'
  );
}

export function isConcavePiece(piece: PieceLike): boolean {
  const raw = pieceRawUpper(piece);
  return (
    normKanjiForEngineRules(piece.char) === '凹' ||
    raw.includes('CONCAVE') ||
    raw.includes('48204DCCFA56') ||
    toBasePieceCode(piece.pieceCode) === 'CONCAVE'
  );
}

export function isRedOniPiece(piece: PieceLike): boolean {
  return normalizedPieceCodeUpper(piece) === 'REDONI';
}

export function isBlueOniPiece(piece: PieceLike): boolean {
  return normalizedPieceCodeUpper(piece) === 'BLUEONI';
}

export function isBlackOniPiece(piece: PieceLike): boolean {
  return normalizedPieceCodeUpper(piece) === 'BLACKONI';
}

export function isAnyOniVariantPiece(piece: PieceLike): boolean {
  return isRedOniPiece(piece) || isBlueOniPiece(piece) || isBlackOniPiece(piece);
}

export function isAPieceInstance(piece: PieceLike): boolean {
  const normalizedCode = normalizeSkillPieceCode(piece.pieceCode);
  const base = toBasePieceCode(piece.pieceCode);
  return (
    piece.char === 'あ' ||
    base === 'A' ||
    normalizedCode === 'A' ||
    normalizedCode.includes('A9C2AD579732')
  );
}

export function isSpecialTenPlusPiece(piece: PieceLike): boolean {
  const base = toBasePieceCode(piece.pieceCode);
  if (
    base &&
    STANDARD_CORE_PIECE_CODES.includes(base as (typeof STANDARD_CORE_PIECE_CODES)[number])
  ) {
    return false;
  }
  if (piece.char === '王' || piece.char === '玉') return false;
  const strokes = (
    {
      忍: 7,
      影: 15,
      砲: 10,
      竜: 10,
      鳳: 14,
      炎: 8,
      火: 4,
      水: 4,
      波: 8,
      木: 4,
      葉: 12,
      光: 6,
      星: 9,
      闇: 13,
      魔: 21,
      銅: 14,
      鉄: 21,
      錫: 16,
      鉛: 13,
      宝: 20,
      電: 13,
      雷: 13,
      時: 10,
      氷: 5,
      雪: 11,
      砂: 9,
      風: 9,
      苔: 8,
      魚: 11,
      雲: 12,
      虹: 9,
      毒: 8,
      沼: 8,
      あ: 3,
      牢: 7,
      柵: 9,
      嶺: 17,
      峰: 10,
      山: 3,
    } as Record<string, number>
  )[piece.char];
  return strokes != null && strokes >= 10;
}

export function buildSkillMoverFlags(input: {
  movedCode: string;
  movePieceCode: string | null | undefined;
  movedPiece: PieceLike | null;
}): SkillMoverFlags {
  const moveCode = normalizeSkillPieceCode(input.movePieceCode);
  const movedPieceCode = normalizeSkillPieceCode(input.movedPiece?.pieceCode);
  const flags: SkillMoverFlags = {
    isFlameMover: false,
    isFireMover: false,
    isWaterMover: false,
    isTreasureMover: false,
    isIronMover: false,
    isWaveMover: false,
    isTinMover: false,
    isElectricMover: false,
    isThunderMover: false,
    isTimeMover: false,
    isIceMover: false,
    isSnowMover: false,
    isSandMover: false,
    isWindMover: false,
    isFishMover: false,
    isMossMover: false,
    isRainbowMover: false,
    isDanceMover: false,
    isSwampMover: false,
    isPoisonMover: false,
    isWaterfallMover: false,
    isAMover: false,
    isWoodMover: false,
    isLeafMover: false,
    isBullMover: false,
    isBignoiseMover: false,
    isDemonMover: false,
    isDarkMover: false,
    isRidgeMover: false,
    isRockMover: false,
    isOreMover: false,
    isGraveMover: false,
    isDepressionMover: false,
    isRoseMover: false,
    isChrysanthemumMover: false,
    isPrisonFenceMover: false,
    isBlueOniMover: false,
    isBlackOniMover: false,
    isRedOniMover: false,
    isTatsuGodMover: false,
    isExperimentMover: false,
    isKbossMover: false,
    isBoatMover: false,
    isBirdMover: false,
  };

  for (const spec of MOVER_SPECS) {
    flags[spec.key] =
      codeMatchesAliases(input.movedCode, spec.aliases) ||
      codeMatchesAliases(moveCode, spec.aliases) ||
      (input.movedPiece != null && pieceMatchesAliases(input.movedPiece, spec.aliases)) ||
      (movedPieceCode.length > 0 && codeMatchesAliases(movedPieceCode, spec.aliases));
  }

  flags.isAMover =
    (input.movedPiece != null && isAPieceInstance(input.movedPiece)) ||
    normalizeSkillPieceCode(input.movedCode) === 'A' ||
    normalizeSkillPieceCode(moveCode) === 'A';
  flags.isDanceMover =
    flags.isDanceMover ||
    (input.movedPiece != null && isMaiPiece(input.movedPiece)) ||
    normalizeSkillPieceCode(input.movedCode) === 'MAI' ||
    normalizeSkillPieceCode(input.movedCode) === 'SHOP_MAI' ||
    normalizeSkillPieceCode(moveCode) === 'MAI' ||
    normalizeSkillPieceCode(moveCode) === 'SHOP_MAI';
  flags.isBoatMover =
    input.movedCode === 'BOAT' || moveCode === 'BOAT' || input.movedPiece?.char === '舟';
  flags.isBirdMover =
    input.movedCode === 'BIRD' ||
    moveCode === 'BIRD' ||
    input.movedPiece?.char === '禽' ||
    (input.movePieceCode ?? '').toUpperCase().includes('29ECAB1EF3C3') ||
    (input.movedPiece != null && pieceRawUpper(input.movedPiece).includes('29ECAB1EF3C3'));
  flags.isTatsuGodMover =
    input.movedCode === 'TATSU' ||
    moveCode === 'TATSU' ||
    input.movedPiece?.char === '辰' ||
    moveCode.includes('707ED609');
  flags.isExperimentMover =
    input.movedCode === 'EXPERIMENT' ||
    moveCode === 'EXPERIMENT' ||
    input.movedPiece?.char === '実';
  flags.isKbossMover =
    input.movedCode === 'KBOSS' || moveCode === 'KBOSS' || input.movedPiece?.char === 'K';

  return flags;
}
