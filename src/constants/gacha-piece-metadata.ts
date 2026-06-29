import { skillDefinitionsV2ForGachaChar } from '@/ai/engine/gacha-piece-skill-definitions';
import {
  AN_MOVE_DESCRIPTION_JA,
  AN_MOVE_VECTORS,
  AN_SKILL_DESCRIPTION_JA,
  AORI_MOVE_DESCRIPTION_JA,
  AORI_MOVE_VECTORS,
  BAKU_MOVE_DESCRIPTION_JA,
  BAKU_MOVE_VECTORS,
  SO_MOVE_DESCRIPTION_JA,
  SO_MOVE_VECTORS,
  SOU_MOVE_DESCRIPTION_JA,
  SOU_MOVE_VECTORS,
  SOU_SKILL_DESCRIPTION_JA,
  SADAME_MOVE_DESCRIPTION_JA,
  SADAME_MOVE_VECTORS,
  EN_MOVE_DESCRIPTION_JA,
  EN_MOVE_VECTORS,
  EN_SKILL_DESCRIPTION_JA,
  KOU_MOVE_DESCRIPTION_JA,
  KOU_MOVE_VECTORS,
  KOU_SKILL_DESCRIPTION_JA,
  SHITSU_MOVE_DESCRIPTION_JA,
  SHITSU_MOVE_VECTORS,
  HEN_MOVE_DESCRIPTION_JA,
  HEN_MOVE_VECTORS,
  ITSU_MOVE_DESCRIPTION_JA,
  ITSU_MOVE_VECTORS,
  SHIN_MOVE_DESCRIPTION_JA,
  SHIN_SKILL_DESCRIPTION_JA,
  NIGE_MOVE_DESCRIPTION_JA,
  NIGE_MOVE_VECTORS,
  TOU_MOVE_DESCRIPTION_JA,
  TOU_MOVE_VECTORS,
} from '@/ai/engine/shop-piece-moves';
import type { PieceCatalogItem } from '@/domain/models/piece';
import type { OwnedPiece } from '@/domain/models/deck-builder';

/** ガチャで獲得するコレクション駒（歩・金の通貨枠を除く） */
export const GACHA_COLLECTIBLE_CHARS = [
  '室',
  '定',
  '安',
  '宋',
  '爆',
  '煽',
  '灯',
  '辺',
  '逸',
  '進',
  '逃',
  '艸',
  '閹',
  '膠',
] as const;

export type GachaCollectibleChar = (typeof GACHA_COLLECTIBLE_CHARS)[number];

type GachaPieceMeta = {
  pieceId: number;
  pieceCode: string;
  /** master.m_skill.skill_code（BFF seed 想定） */
  skillCode: string;
  char: GachaCollectibleChar;
  name: string;
  rarity: string;
  unlock: string;
  desc: string;
  skill: string;
  move: string;
};

const GACHA_PIECE_META: Record<GachaCollectibleChar, GachaPieceMeta> = {
  室: {
    pieceId: 116,
    pieceCode: 'piece_gacha_muro',
    skillCode: 'skill_gacha_muro',
    char: '室',
    name: '室',
    rarity: 'SR',
    unlock: 'うかんむりガチャ',
    desc: '移動時30%の確率で2ターン、味方の王がいるマスをセーフルームにする。',
    skill:
      '移動時30%の確率で2ターン、味方の王がいるマスをセーフルームにする。王は移動できないが敵に取られない。',
    move: SHITSU_MOVE_DESCRIPTION_JA,
  },
  定: {
    pieceId: 117,
    pieceCode: 'piece_gacha_sadame',
    skillCode: 'skill_gacha_sadame',
    char: '定',
    name: '定',
    rarity: 'R',
    unlock: 'うかんむりガチャ',
    desc: '移動後、次の相手番のみコスト5以下の駒しか動かせない。',
    skill: '移動後、次の相手番のみコスト5以下の駒しか動かせない。',
    move: SADAME_MOVE_DESCRIPTION_JA,
  },
  安: {
    pieceId: 118,
    pieceCode: 'piece_gacha_an',
    skillCode: 'skill_gacha_an',
    char: '安',
    name: '安',
    rarity: 'R',
    unlock: 'うかんむりガチャ',
    desc: AN_SKILL_DESCRIPTION_JA,
    skill: AN_SKILL_DESCRIPTION_JA,
    move: AN_MOVE_DESCRIPTION_JA,
  },
  宋: {
    pieceId: 119,
    pieceCode: 'piece_gacha_so',
    skillCode: 'skill_gacha_so',
    char: '宋',
    name: '宋',
    rarity: 'UR',
    unlock: 'うかんむりガチャ',
    desc: '移動時20%の確率で、周囲8マスのランダムな空きマス1マスに「金」を召喚する。',
    skill: '移動時20%の確率で、周囲8マスのランダムな空きマス1マスに「金」を召喚する。',
    move: SO_MOVE_DESCRIPTION_JA,
  },
  爆: {
    pieceId: 114,
    pieceCode: 'piece_gacha_baku',
    skillCode: 'skill_gacha_baku',
    char: '爆',
    name: '爆',
    rarity: 'UR',
    unlock: 'ひへんガチャ',
    desc: '移動時爆発を起こし、周囲8マスのすべての駒（味方・敵）を外側へ1マス遠ざける。',
    skill: '移動時爆発を起こし、周囲8マスのすべての駒（味方・敵）を外側へ1マス遠ざける。',
    move: BAKU_MOVE_DESCRIPTION_JA,
  },
  煽: {
    pieceId: 115,
    pieceCode: 'piece_gacha_aori',
    skillCode: 'skill_gacha_aori',
    char: '煽',
    name: '煽',
    rarity: 'SR',
    unlock: 'ひへんガチャ',
    desc: '前後左右に何マスでも進める。',
    skill: '相手を煽る',
    move: AORI_MOVE_DESCRIPTION_JA,
  },
  灯: {
    pieceId: 120,
    pieceCode: 'piece_gacha_tou',
    skillCode: 'skill_gacha_tou',
    char: '灯',
    name: '灯',
    rarity: 'R',
    unlock: 'ひへんガチャ',
    desc: '移動時20%の確率で、味方の「歩」をランダムに1体「火」駒に変化させる。',
    skill: '移動時20%の確率で、味方の「歩」をランダムに1体「火」駒に変化させる。',
    move: TOU_MOVE_DESCRIPTION_JA,
  },
  辺: {
    pieceId: 121,
    pieceCode: 'piece_gacha_hen',
    skillCode: 'skill_gacha_hen',
    char: '辺',
    name: '辺',
    rarity: 'SR',
    unlock: 'しんにょうガチャ',
    desc: '移動時、ランダムに選んだ1辺上のすべての駒を2ターン移動不能にする。',
    skill: '移動時、ランダムに選んだ1辺上のすべての駒を2ターン移動不能にする。',
    move: HEN_MOVE_DESCRIPTION_JA,
  },
  逸: {
    pieceId: 122,
    pieceCode: 'piece_gacha_itsu',
    skillCode: 'skill_gacha_itsu',
    char: '逸',
    name: '逸',
    rarity: 'R',
    unlock: 'しんにょうガチャ',
    desc: '移動時30%の確率で、相手の駒（王を除く）を1体ランダムに相手の手持ち駒に送る。',
    skill: '移動時30%の確率で、相手の駒（王を除く）を1体ランダムに相手の手持ち駒に送る。',
    move: ITSU_MOVE_DESCRIPTION_JA,
  },
  進: {
    pieceId: 123,
    pieceCode: 'piece_gacha_shin',
    skillCode: 'skill_gacha_shin',
    char: '進',
    name: '進',
    rarity: 'R',
    unlock: 'しんにょうガチャ',
    desc: SHIN_SKILL_DESCRIPTION_JA,
    skill: SHIN_SKILL_DESCRIPTION_JA,
    move: SHIN_MOVE_DESCRIPTION_JA,
  },
  逃: {
    pieceId: 124,
    pieceCode: 'piece_gacha_to',
    skillCode: 'skill_gacha_to',
    char: '逃',
    name: '逃',
    rarity: 'UR',
    unlock: 'しんにょうガチャ',
    desc: '移動すると、移動した方向へ1マス、味方の王も追従する（空マスのみ）。',
    skill: '移動すると、移動した方向へ1マス、味方の王も追従する（空マスのみ）。',
    move: NIGE_MOVE_DESCRIPTION_JA,
  },
  艸: {
    pieceId: 125,
    pieceCode: 'piece_gacha_sou',
    skillCode: 'skill_gacha_sou',
    char: '艸',
    name: '艸',
    rarity: 'UR',
    unlock: '漢検１級ガチャ',
    desc: SOU_SKILL_DESCRIPTION_JA,
    skill: SOU_SKILL_DESCRIPTION_JA,
    move: SOU_MOVE_DESCRIPTION_JA,
  },
  閹: {
    pieceId: 126,
    pieceCode: 'piece_gacha_en',
    skillCode: 'skill_gacha_en',
    char: '閹',
    name: '閹',
    rarity: 'UR',
    unlock: '漢検１級ガチャ',
    desc: EN_SKILL_DESCRIPTION_JA,
    skill: EN_SKILL_DESCRIPTION_JA,
    move: EN_MOVE_DESCRIPTION_JA,
  },
  膠: {
    pieceId: 127,
    pieceCode: 'piece_gacha_ko',
    skillCode: 'skill_gacha_ko',
    char: '膠',
    name: '膠',
    rarity: 'SSR',
    unlock: '漢検１級ガチャ',
    desc: KOU_SKILL_DESCRIPTION_JA,
    skill: KOU_SKILL_DESCRIPTION_JA,
    move: KOU_MOVE_DESCRIPTION_JA,
  },
};

export function isGachaCollectibleChar(char: string): char is GachaCollectibleChar {
  return (GACHA_COLLECTIBLE_CHARS as readonly string[]).includes(char);
}

export function getGachaPieceMeta(char: string): GachaPieceMeta | null {
  if (!isGachaCollectibleChar(char)) return null;
  return GACHA_PIECE_META[char];
}

/** API / DB の古い rarity よりクライアント正典を優先する */
export function resolveGachaPieceDisplayRarity(char: string, apiRarity: string): string {
  return getGachaPieceMeta(char)?.rarity ?? apiRarity;
}

/** 図鑑・デッキビルダー表示用（API の古い skill 文言より優先） */
export function gachaCollectibleSkillText(char: string): string | null {
  return getGachaPieceMeta(char)?.skill ?? null;
}

/** 図鑑・バトル用（API の移動ベクトルより優先） */
export function gachaCollectibleMoveText(char: string): string | null {
  return getGachaPieceMeta(char)?.move ?? null;
}

/** BFF カタログの移動定義をガチャ駒マスタで上書きする。 */
export function applyGachaPieceCatalogOverrides<T extends PieceCatalogItem>(item: T): T {
  if (!isGachaCollectibleChar(item.char)) return item;
  const meta = getGachaPieceMeta(item.char)!;
  return {
    ...item,
    pieceCode: item.pieceCode?.trim() ? item.pieceCode : meta.pieceCode,
    desc: meta.desc,
    skill: meta.skill,
    move: meta.move,
    moveVectors: moveVectorsForGachaChar(item.char),
    isRepeatable: false,
  };
}

function moveVectorsForGachaChar(char: GachaCollectibleChar): PieceCatalogItem['moveVectors'] {
  if (char === '室') return [...SHITSU_MOVE_VECTORS];
  if (char === '定') return [...SADAME_MOVE_VECTORS];
  if (char === '安') return [...AN_MOVE_VECTORS];
  if (char === '宋') return [...SO_MOVE_VECTORS];
  if (char === '爆') return [...BAKU_MOVE_VECTORS];
  if (char === '煽') return [...AORI_MOVE_VECTORS];
  if (char === '灯') return [...TOU_MOVE_VECTORS];
  if (char === '辺') return [...HEN_MOVE_VECTORS];
  if (char === '逸') return [...ITSU_MOVE_VECTORS];
  if (char === '逃') return [...NIGE_MOVE_VECTORS];
  if (char === '艸') return [...SOU_MOVE_VECTORS];
  if (char === '閹') return [...EN_MOVE_VECTORS];
  if (char === '膠') return [...KOU_MOVE_VECTORS];
  return [];
}

export function buildCatalogItemFromGachaChar(char: string): PieceCatalogItem | null {
  if (!isGachaCollectibleChar(char)) return null;
  const meta = GACHA_PIECE_META[char];
  const skillDefinitionsV2 = skillDefinitionsV2ForGachaChar(char);
  return {
    pieceId: meta.pieceId,
    pieceCode: meta.pieceCode,
    char: meta.char,
    name: meta.name,
    unlock: meta.unlock,
    desc: meta.desc,
    skill: meta.skill,
    move: meta.move,
    moveVectors: moveVectorsForGachaChar(char),
    isRepeatable: false,
    canJump: false,
    moveConstraints: null,
    moveRules: [],
    imageSignedUrl: null,
    ...(skillDefinitionsV2 ? { skillDefinitionsV2 } : {}),
  };
}

export function buildGachaPieceCatalogItems(): PieceCatalogItem[] {
  return GACHA_COLLECTIBLE_CHARS.map((char) => buildCatalogItemFromGachaChar(char)!);
}

export function buildGachaOwnedPiecesForDeckBuilder(ownedChars: Iterable<string>): OwnedPiece[] {
  const pieces: OwnedPiece[] = [];
  for (const char of ownedChars) {
    const meta = getGachaPieceMeta(char);
    if (!meta) continue;
    pieces.push({
      pieceId: meta.pieceId,
      char: meta.char,
      name: meta.name,
      source: 'gacha',
      acquiredAt: new Date().toISOString(),
      desc: meta.desc,
      skill: meta.skill,
      move: meta.move,
      quantity: 1,
    });
  }
  return pieces;
}
