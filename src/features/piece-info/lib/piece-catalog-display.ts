import type { PieceCatalogItem } from '@/domain/models/piece';
import {
  AN_MOVE_DESCRIPTION_JA,
  AN_MOVE_VECTORS,
  PHANTOM_MOVE_DESCRIPTION_JA,
  PHANTOM_MOVE_VECTORS,
  PEAK_SKILL_DESCRIPTION_JA,
  YAMA_MOVE_DESCRIPTION_JA,
  YAMA_MOVE_VECTORS,
  AORI_MOVE_DESCRIPTION_JA,
  AORI_MOVE_VECTORS,
  BAKU_MOVE_DESCRIPTION_JA,
  BAKU_MOVE_VECTORS,
  SHITSU_MOVE_DESCRIPTION_JA,
  SHITSU_MOVE_VECTORS,
  KIRIN_MOVE_DESCRIPTION_JA,
  KIRIN_MOVE_VECTORS,
  KIRIN_SKILL_DESCRIPTION_JA,
  MAI_MOVE_DESCRIPTION_JA,
  MAI_MOVE_VECTORS,
  MAI_SKILL_DESCRIPTION_JA,
  NAKU_MOVE_DESCRIPTION_JA,
  NAKU_MOVE_VECTORS,
  NAKU_SKILL_DESCRIPTION_JA,
  P_MOVE_DESCRIPTION_JA,
  P_MOVE_VECTORS,
  P_SKILL_DESCRIPTION_JA,
  SADAME_MOVE_DESCRIPTION_JA,
  SADAME_MOVE_VECTORS,
  EN_MOVE_DESCRIPTION_JA,
  EN_MOVE_VECTORS,
  KOU_MOVE_DESCRIPTION_JA,
  KOU_MOVE_VECTORS,
  SO_MOVE_DESCRIPTION_JA,
  SO_MOVE_VECTORS,
  HEN_MOVE_DESCRIPTION_JA,
  HEN_MOVE_VECTORS,
  ITSU_MOVE_DESCRIPTION_JA,
  ITSU_MOVE_VECTORS,
  SHIN_MOVE_DESCRIPTION_JA,
  NIGE_MOVE_DESCRIPTION_JA,
  NIGE_MOVE_VECTORS,
  SOU_MOVE_DESCRIPTION_JA,
  SOU_MOVE_VECTORS,
  TANE_MOVE_DESCRIPTION_JA,
  TANE_SILVER_MOVE_VECTORS,
  WAVE_MOVE_DESCRIPTION_JA,
  WAVE_MOVE_VECTORS,
} from '@/ai/engine/shop-piece-moves';
import { RYU_DRAGON_MOVE_VECTORS, RYU_MOVE_DESCRIPTION_JA } from '@/ai/engine/spring-ryu-awakening';
import {
  applyGachaPieceCatalogOverrides,
  gachaCollectibleMoveText,
  gachaCollectibleSkillText,
  isGachaCollectibleChar,
} from '@/constants/gacha-piece-metadata';
import { resolveIntrinsicPortedMoveVectors } from '@/ai/engine/ported-app-move-vectors';

/** `legal-moves.ts` の CONCAVE_SLIDE_VECTORS と同一（図鑑グリッド用）。 */
const CONCAVE_CATALOG_MOVE_VECTORS: PieceCatalogItem['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 9 },
  { dx: 1, dy: -1, maxStep: 9 },
  { dx: -1, dy: 0, maxStep: 9 },
  { dx: 1, dy: 0, maxStep: 9 },
  { dx: 0, dy: 1, maxStep: 9 },
  { dx: -1, dy: 1, maxStep: 9 },
  { dx: 1, dy: 1, maxStep: 9 },
];

const CONCAVE_CATALOG_MOVE_TEXT =
  '斜め前・左右・後ろ・斜め後の各筋に何マスでも進める。盤の端が空マスで、進路上に敵駒がいないとき、味方駒を飛び越えてその端まで進める（前方への直進の筋を除く）。貫通で端へ入る着手では敵駒を取れない。';

const RUN_CATALOG_MOVE_TEXT = '前方に最大2マス進める。1マス目に駒がある場合は2マス目には進めない。';

const TANE_CATALOG_SKILL_TEXT =
  '移動時20%の確率で、周囲8マスのランダムな空きマス1マスに「葉」駒を召喚する。';

const LEAF_CATALOG_SKILL_TEXT = '移動時10％の確率で周囲のランダム1マスに「葉」駒を召喚する。';

const ICE_CATALOG_SKILL_TEXT =
  '移動時30%の確率で周囲8マスの敵駒（玉除く）1体を2ターン行動不能にする。';

const MOSS_CATALOG_SKILL_TEXT =
  '移動時30%の確率で周囲8マスのランダムな空きマス1マスに「苔」駒を1体召喚する。';

const RAINBOW_CATALOG_SKILL_TEXT =
  '移動時、周囲8マスにいる敵駒の行動範囲を4ターン縦横1マスに制限する。';

const RUN_CATALOG_MOVE_VECTORS: PieceCatalogItem['moveVectors'] = [
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 0, dy: -2, maxStep: 1 },
];

function isConcaveCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '凹' || code.includes('CONCAVE') || code.includes('48204DCCFA56');
}

function isSearCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '焼' || code.includes('SEAR') || code.includes('FDC83CF95746');
}

function isStewCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '煮' || code.includes('STEW') || code.includes('8DE5676A5E92');
}

function isSauteCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '炒' || code.includes('SAUTE') || code.includes('1732246A37D8');
}

function isRunCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return (
    piece.char === '走' ||
    code === 'SO' ||
    code.includes('PIECE_SHOP_SO') ||
    code.includes('SHOP_SO')
  );
}

function isKirinCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return (
    piece.char === '麒' ||
    code === 'KIRIN' ||
    code.includes('PIECE_SHOP_KIRIN') ||
    code.includes('SHOP_KIRIN')
  );
}

function isTaneCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return (
    piece.char === '種' ||
    code === 'TANE' ||
    code.includes('PIECE_SHOP_TANE') ||
    code.includes('SHOP_TANE')
  );
}

function isLeafCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '葉' || code === 'HAA' || code === 'LEAF' || code.includes('HAA');
}

function isMaiCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return (
    piece.char === '舞' ||
    code === 'MAI' ||
    code.includes('PIECE_SHOP_MAI') ||
    code.includes('SHOP_MAI')
  );
}

function isBakuCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '爆' || code.includes('GACHA_BAKU') || code.includes('PIECE_GACHA_BAKU');
}

function isAoriCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '煽' || code.includes('GACHA_AORI') || code.includes('PIECE_GACHA_AORI');
}

function isShitsuCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return (
    piece.char === '室' ||
    code.includes('GACHA_SHITSU') ||
    code.includes('GACHA_MURO') ||
    code.includes('PIECE_GACHA_MURO')
  );
}

function isSadameCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return (
    piece.char === '定' || code.includes('GACHA_SADAME') || code.includes('PIECE_GACHA_SADAME')
  );
}

function isAnCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '安' || code.includes('GACHA_AN') || code.includes('PIECE_GACHA_AN');
}

function isPhantomCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '幻' || code === 'PHANTOM' || code.includes('PHANTOM');
}

function isYamaCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '山' || code === 'YAMA' || code.includes('YAMA');
}

function isPeakCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '峰' || code === 'PEAK' || code.includes('PEAK');
}

function isSoCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  if (code.includes('GACHA_SOU')) return false;
  return piece.char === '宋' || code === 'PIECE_GACHA_SO' || code.endsWith('_GACHA_SO');
}

function isHenCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  const moveCode = (piece.moveCode ?? '').toLowerCase();
  return (
    piece.char === '辺' ||
    moveCode === 'move_gacha_hen' ||
    code.includes('GACHA_HEN') ||
    code.includes('PIECE_GACHA_HEN')
  );
}

function isItsuCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  const moveCode = (piece.moveCode ?? '').toLowerCase();
  return (
    piece.char === '逸' ||
    moveCode === 'move_gacha_itsu' ||
    code.includes('GACHA_ITSU') ||
    code.includes('PIECE_GACHA_ITSU')
  );
}

function isGachaForwardDiagBackCatalogPiece(piece: PieceCatalogItem): boolean {
  return isHenCatalogPiece(piece) || isItsuCatalogPiece(piece) || isKouCatalogPiece(piece);
}

function isShinCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '進' || code.includes('GACHA_SHIN') || code.includes('PIECE_GACHA_SHIN');
}

function isNigeCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return (
    piece.char === '逃' ||
    code.includes('GACHA_TO') ||
    code.includes('GACHA_NIGE') ||
    code.includes('PIECE_GACHA_TO')
  );
}

function isSouCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '艸' || code.includes('GACHA_SOU') || code.includes('PIECE_GACHA_SOU');
}

function isEnCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '閹' || code.includes('GACHA_EN') || code.includes('PIECE_GACHA_EN');
}

function isKouCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '膠' || code.includes('GACHA_KOU') || code.includes('PIECE_GACHA_KOU');
}

function isShopPCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === 'P' || code.includes('PIECE_SHOP_P') || code.includes('SHOP_P');
}

function isNakuCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return (
    piece.char === '鳴' ||
    code === 'NAKU' ||
    code.includes('PIECE_SHOP_NAKU') ||
    code.includes('SHOP_NAKU')
  );
}

function isWaveCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '波' || code === 'NAM' || code === 'WAVE' || code.includes('NAM');
}

function isRyuCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '竜' || code === 'RYU' || code.includes('RYU');
}

function isIceCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '氷' || code === 'ICE' || code.includes('ICE');
}

function isMossCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '苔' || code === 'MOSS' || code.includes('MOSS');
}

function isRainbowCatalogPiece(piece: PieceCatalogItem): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '虹' || code === 'RAINBOW';
}

/** API カタログを図鑑表示・ローカル対戦の合法手生成向けに正規化する。 */
export function preparePieceCatalogForBattleAndDisplay(
  items: readonly PieceCatalogItem[],
): PieceCatalogItem[] {
  return items.map((item) =>
    normalizePieceCatalogItemForDisplay(applyGachaPieceCatalogOverrides(item)),
  );
}

export function normalizeCatalogSkillText(piece: PieceCatalogItem): string {
  if (isGachaCollectibleChar(piece.char)) {
    const gachaSkill = gachaCollectibleSkillText(piece.char);
    if (gachaSkill) return gachaSkill;
  }
  if (isKirinCatalogPiece(piece)) {
    return KIRIN_SKILL_DESCRIPTION_JA;
  }
  if (isMaiCatalogPiece(piece)) {
    return MAI_SKILL_DESCRIPTION_JA;
  }
  if (isTaneCatalogPiece(piece)) {
    return TANE_CATALOG_SKILL_TEXT;
  }
  if (isLeafCatalogPiece(piece)) {
    return LEAF_CATALOG_SKILL_TEXT;
  }
  if (isIceCatalogPiece(piece)) {
    return ICE_CATALOG_SKILL_TEXT;
  }
  if (isMossCatalogPiece(piece)) {
    return MOSS_CATALOG_SKILL_TEXT;
  }
  if (isNakuCatalogPiece(piece)) {
    return NAKU_SKILL_DESCRIPTION_JA;
  }
  if (isRainbowCatalogPiece(piece)) {
    return RAINBOW_CATALOG_SKILL_TEXT;
  }
  if (isPeakCatalogPiece(piece)) {
    return PEAK_SKILL_DESCRIPTION_JA;
  }
  if (isShopPCatalogPiece(piece)) {
    return P_SKILL_DESCRIPTION_JA;
  }
  const code = (piece.pieceCode ?? '').toUpperCase();
  const isDepressionPiece =
    piece.char === '鬱' || code.includes('DEPRESSION') || code.includes('9E27F89F65C5');
  if (isDepressionPiece) {
    return '移動後、左右1マスの空きマスを2ターン侵入禁止の×マスにする。';
  }
  const isChrysanthemumPiece =
    piece.char === '菊' || code.includes('CHRYSANTHEMUM') || code.includes('8254C41BA326');
  if (isChrysanthemumPiece) {
    return '移動後、周囲8マスにいる味方駒1体（玉除く）に2ターンの復活効果を付与する。復活中は敵に取られても元の陣営の手駒に戻る。';
  }
  if (isConcaveCatalogPiece(piece)) {
    return 'なし。';
  }
  if (isSearCatalogPiece(piece)) {
    return '敵駒を取ったとき、盤上のランダムな空きマスに味方の「炎」駒を1体召喚する。';
  }
  if (isStewCatalogPiece(piece)) {
    return '敵駒を取ったとき、盤上のランダムな空きマスに味方の「火」駒を1体召喚する。';
  }
  if (isSauteCatalogPiece(piece)) {
    return '敵駒を取ったとき、盤上のランダムな空きマスに味方の「炎」駒または「火」駒のどちらかをランダムに1体召喚する。';
  }
  const pc = (piece.pieceCode ?? '').toUpperCase();
  if (piece.char === '銭' || pc.includes('SEN') || pc.includes('EACC7F540399')) {
    return '移動するたびに20％の確率で「金」に、10％の確率で「宝」に変化する。';
  }
  if (piece.char === '財' || pc.includes('ZAI') || pc.includes('7FC715661514')) {
    return '敵駒を取ったとき、味方の「銭」駒を1体、取った敵駒と同じ駒へ変化させる。';
  }
  if (piece.char === '巨' || pc.includes('GIANT') || pc.includes('C4AEB81F3634')) {
    return '敵に取られず、あらゆるスキルの特殊効果を受けない。本体が占める4マスには他の駒は入れない。移動先の2×2マス内の敵駒をまとめて取れる。味方駒が1マスでも重なるマスへは進めない。';
  }
  if (piece.char === '鶏' || pc.includes('CHICKEN') || pc.includes('F1A6EF3B99DF')) {
    return 'なし';
  }
  const skill = (piece.skill ?? '').trim();
  if (skill.length > 0 && skill !== '-' && skill !== '準備中') {
    return skill;
  }
  const desc = (piece.desc ?? '').trim();
  if (desc.length > 0 && desc !== '-' && desc !== '準備中') {
    return desc;
  }
  return '詳細は準備中です。';
}

export function normalizeCatalogMoveText(piece: PieceCatalogItem): string {
  if (isGachaCollectibleChar(piece.char)) {
    const gachaMove = gachaCollectibleMoveText(piece.char);
    if (gachaMove) return gachaMove;
  }
  if (isKirinCatalogPiece(piece)) {
    return KIRIN_MOVE_DESCRIPTION_JA;
  }
  if (isTaneCatalogPiece(piece)) {
    return TANE_MOVE_DESCRIPTION_JA;
  }
  if (isMaiCatalogPiece(piece)) {
    return MAI_MOVE_DESCRIPTION_JA;
  }
  if (isBakuCatalogPiece(piece)) {
    return BAKU_MOVE_DESCRIPTION_JA;
  }
  if (isAoriCatalogPiece(piece)) {
    return AORI_MOVE_DESCRIPTION_JA;
  }
  if (isShitsuCatalogPiece(piece)) {
    return SHITSU_MOVE_DESCRIPTION_JA;
  }
  if (isSadameCatalogPiece(piece)) {
    return SADAME_MOVE_DESCRIPTION_JA;
  }
  if (isAnCatalogPiece(piece)) {
    return AN_MOVE_DESCRIPTION_JA;
  }
  if (isPhantomCatalogPiece(piece)) {
    return PHANTOM_MOVE_DESCRIPTION_JA;
  }
  if (isYamaCatalogPiece(piece)) {
    return YAMA_MOVE_DESCRIPTION_JA;
  }
  if (isSouCatalogPiece(piece)) {
    return SOU_MOVE_DESCRIPTION_JA;
  }
  if (isEnCatalogPiece(piece)) {
    return EN_MOVE_DESCRIPTION_JA;
  }
  if (isKouCatalogPiece(piece)) {
    return KOU_MOVE_DESCRIPTION_JA;
  }
  if (isSoCatalogPiece(piece)) {
    return SO_MOVE_DESCRIPTION_JA;
  }
  if (isHenCatalogPiece(piece)) {
    return HEN_MOVE_DESCRIPTION_JA;
  }
  if (isItsuCatalogPiece(piece)) {
    return ITSU_MOVE_DESCRIPTION_JA;
  }
  if (isShinCatalogPiece(piece)) {
    return SHIN_MOVE_DESCRIPTION_JA;
  }
  if (isNigeCatalogPiece(piece)) {
    return NIGE_MOVE_DESCRIPTION_JA;
  }
  if (isShopPCatalogPiece(piece)) {
    return P_MOVE_DESCRIPTION_JA;
  }
  if (isNakuCatalogPiece(piece)) {
    return NAKU_MOVE_DESCRIPTION_JA;
  }
  if (isWaveCatalogPiece(piece)) {
    return WAVE_MOVE_DESCRIPTION_JA;
  }
  if (isRyuCatalogPiece(piece)) {
    return RYU_MOVE_DESCRIPTION_JA;
  }
  if (isRunCatalogPiece(piece)) {
    return RUN_CATALOG_MOVE_TEXT;
  }
  if (isConcaveCatalogPiece(piece)) {
    return CONCAVE_CATALOG_MOVE_TEXT;
  }
  const move = (piece.move ?? '').trim();
  return move.length > 0 && move !== '-' && move !== '準備中' ? move : '準備中';
}

export function normalizeCatalogMoveVectors(
  piece: PieceCatalogItem,
): PieceCatalogItem['moveVectors'] {
  const code = (piece.pieceCode ?? '').toUpperCase();
  const isDepressionPiece =
    piece.char === '鬱' || code.includes('DEPRESSION') || code.includes('9E27F89F65C5');
  if (isDepressionPiece) {
    return [
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: -1, dy: -1, maxStep: 1 },
      { dx: 1, dy: -1, maxStep: 1 },
      { dx: -1, dy: 1, maxStep: 1 },
      { dx: 1, dy: 1, maxStep: 1 },
    ];
  }
  if (isConcaveCatalogPiece(piece)) {
    return CONCAVE_CATALOG_MOVE_VECTORS;
  }
  if (isRunCatalogPiece(piece)) {
    return RUN_CATALOG_MOVE_VECTORS;
  }
  if (isTaneCatalogPiece(piece)) {
    return TANE_SILVER_MOVE_VECTORS;
  }
  if (isKirinCatalogPiece(piece)) {
    return KIRIN_MOVE_VECTORS;
  }
  if (isMaiCatalogPiece(piece)) {
    return MAI_MOVE_VECTORS;
  }
  if (isBakuCatalogPiece(piece)) {
    return BAKU_MOVE_VECTORS;
  }
  if (isAoriCatalogPiece(piece)) {
    return AORI_MOVE_VECTORS;
  }
  if (isShitsuCatalogPiece(piece)) {
    return SHITSU_MOVE_VECTORS;
  }
  if (isSadameCatalogPiece(piece)) {
    return SADAME_MOVE_VECTORS;
  }
  if (isAnCatalogPiece(piece)) {
    return AN_MOVE_VECTORS;
  }
  if (isPhantomCatalogPiece(piece)) {
    return PHANTOM_MOVE_VECTORS;
  }
  if (isYamaCatalogPiece(piece)) {
    return YAMA_MOVE_VECTORS;
  }
  if (isSouCatalogPiece(piece)) {
    return SOU_MOVE_VECTORS;
  }
  if (isEnCatalogPiece(piece)) {
    return EN_MOVE_VECTORS;
  }
  if (isKouCatalogPiece(piece)) {
    return KOU_MOVE_VECTORS;
  }
  if (isSoCatalogPiece(piece)) {
    return SO_MOVE_VECTORS;
  }
  if (isHenCatalogPiece(piece)) {
    return HEN_MOVE_VECTORS;
  }
  if (isItsuCatalogPiece(piece)) {
    return ITSU_MOVE_VECTORS;
  }
  if (isShinCatalogPiece(piece)) {
    return [];
  }
  if (isNigeCatalogPiece(piece)) {
    return NIGE_MOVE_VECTORS;
  }
  if (isShopPCatalogPiece(piece)) {
    return P_MOVE_VECTORS;
  }
  if (isNakuCatalogPiece(piece)) {
    return NAKU_MOVE_VECTORS;
  }
  if (isWaveCatalogPiece(piece)) {
    return WAVE_MOVE_VECTORS;
  }
  if (isRyuCatalogPiece(piece)) {
    return RYU_DRAGON_MOVE_VECTORS;
  }
  const portedVectors = resolveIntrinsicPortedMoveVectors({
    char: piece.char,
    pieceCode: piece.pieceCode ?? null,
  });
  if (portedVectors) {
    return portedVectors;
  }
  return piece.moveVectors;
}

/** 駒図鑑画面と同じスキル・移動・移動ベクトル表記に揃える。 */
export function normalizePieceCatalogItemForDisplay<T extends PieceCatalogItem>(piece: T): T {
  return {
    ...piece,
    skill: normalizeCatalogSkillText(piece),
    move: normalizeCatalogMoveText(piece),
    moveVectors: normalizeCatalogMoveVectors(piece),
    isRepeatable: isGachaForwardDiagBackCatalogPiece(piece) ? false : piece.isRepeatable,
  };
}

export function buildPieceCatalogByCharMap(
  items: readonly PieceCatalogItem[],
): Map<string, PieceCatalogItem> {
  const map = new Map<string, PieceCatalogItem>();
  for (const item of items) {
    const normalized = normalizePieceCatalogItemForDisplay(item);
    map.set(normalized.char, normalized);
  }
  return map;
}

export function lookupCatalogPieceByChar(
  catalogByChar: Map<string, PieceCatalogItem>,
  char: string,
): PieceCatalogItem | undefined {
  return catalogByChar.get(char);
}
