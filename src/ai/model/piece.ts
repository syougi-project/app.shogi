import {
  PIG_MOVE_DESCRIPTION_JA,
  PIG_MOVE_VECTORS,
  YAMA_MOVE_DESCRIPTION_JA,
  YAMA_MOVE_VECTORS,
} from '@/ai/engine/shop-piece-moves';
import {
  DRAGON_HORSE_MOVE_DESCRIPTION_JA,
  DRAGON_HORSE_MOVE_VECTORS,
  DRAGON_KING_MOVE_DESCRIPTION_JA,
  DRAGON_KING_MOVE_VECTORS,
  GOLD_LIKE_PROMOTED_BASE_CODES,
  GOLD_LIKE_PROMOTED_MOVE_DESCRIPTION_JA,
  GOLD_MOVE_VECTORS,
} from '@/ai/engine/ported-app-move-vectors';
import { applyGachaPieceCatalogOverrides } from '@/constants/gacha-piece-metadata';
import { PROMOTED_CODE_TO_CHAR } from '@/features/stage-shogi/domain/piece-conversion';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';
import { normalizePieceCode, toBasePieceCode } from '@/ai/model/move';

const GOLD_LIKE_PROMOTED_CODES = new Set(['FU', 'KY', 'KE', 'GI']);

/** API やフォント由来の互換文字を駒ルール判定用に揃える。 */
function normKanjiForPieceRules(ch: string | null | undefined): string {
  if (!ch) return '';
  try {
    return ch.normalize('NFKC');
  } catch {
    return ch;
  }
}

/**
 * BFF のマスタが未更新でも、クライアント将棋エンジンと駒図鑑の表示を一致させる。
 * （ skill_definitions_v2 の 52/54 は assembleSkillDefinitionsV2ForSession で正典定義に上書き済み前提）
 */
function applyClientEnginePieceCatalogOverrides(item: PieceCatalogItem): PieceCatalogItem {
  const ch = normKanjiForPieceRules(item.char);
  const baseCode = toBasePieceCode(item.pieceCode);
  const moveCode = (item.moveCode ?? '').trim().toLowerCase();

  if (ch === '刀' || moveCode === 'katana') {
    return {
      ...item,
      moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
      move: '前方1マス。',
      skill:
        '前方ちょうど1マスに進んで敵駒を取ったとき、着地点の左右1マスにいる敵駒も同時に取ることができる。',
    };
  }

  if (ch === '銃' || baseCode === 'GUN') {
    return {
      ...item,
      moveVectors: [
        { dx: 0, dy: -1, maxStep: 2 },
        { dx: -1, dy: 1, maxStep: 2 },
        { dx: 1, dy: 1, maxStep: 2 },
      ],
      move: '前方1～2マス、または斜め後ろに2マス進める。',
      skill:
        '前方ちょうど2マスへ進む手について、1マス目と2マス目にいる敵駒を、移動（スキル）として同一の手でまとめて取れる。',
    };
  }

  if (ch === '書' || baseCode === 'BOOK') {
    return {
      ...item,
      skill: '移動範囲が1手前に相手が移動させた駒の移動範囲と同じになる。',
    };
  }

  if (ch === '封' || baseCode === 'SEAL') {
    return {
      ...item,
      skill: 'この駒の斜め4方向に隣接する敵駒は移動できない。',
    };
  }

  if (ch === '牛' || baseCode === 'COW') {
    return {
      ...item,
      moveVectors: [
        { dx: 0, dy: -1, maxStep: 1 },
        { dx: 0, dy: 1, maxStep: 1 },
      ],
      move: '前方1マス、または後方1マスに進める。',
      skill:
        '後ろに動くたびにチャージが1溜まり、前に進める最大マス数がその分だけ増える。通ったマスの敵駒はすべて取れる。前に1回でも進むとチャージは0になる。',
    };
  }

  if (ch === '豚' || baseCode === 'PIG') {
    return {
      ...item,
      moveVectors: PIG_MOVE_VECTORS.map((vector) => ({ ...vector })),
      move: PIG_MOVE_DESCRIPTION_JA,
      skill: '敵駒を取ると、その駒の移動範囲を自分のものとして使える。',
    };
  }

  if (ch === '山' || baseCode === 'YAMA' || (item.pieceCode ?? '').toUpperCase().includes('YAMA')) {
    return {
      ...item,
      moveVectors: YAMA_MOVE_VECTORS.map((vector) => ({ ...vector })),
      move: YAMA_MOVE_DESCRIPTION_JA,
    };
  }

  if (ch === '鶏' || baseCode === 'CHICKEN') {
    return {
      ...item,
      skill: 'なし',
    };
  }

  if (ch === '銭' || baseCode === 'SEN') {
    return {
      ...item,
      skill: '移動するたびに20％の確率で「金」に、10％の確率で「宝」に変化する。',
    };
  }

  if (ch === '財' || baseCode === 'ZAI') {
    return {
      ...item,
      skill: '敵駒を取ったとき、味方の「銭」駒を1体、取った敵駒と同じ駒へ変化させる。',
    };
  }

  if (ch === '巨' || baseCode === 'GIANT') {
    return {
      ...item,
      skill:
        '敵に取られず、あらゆるスキルの特殊効果を受けない。本体が占める4マスには他の駒は入れない。移動先の2×2マス内の敵駒をまとめて取れる。味方駒が1マスでも重なるマスへは進めない。',
      move: '本体は盤上でマス2×2を占める。前後左右に最大2マスまで移動できる（左上基準）。',
    };
  }

  return item;
}

export type AiPieceDefinition = PieceCatalogItem;

export type AiPieceLookups = {
  pieceDefsByCode: Record<string, AiPieceDefinition>;
  promotedPieceDefsByCode: Record<string, AiPieceDefinition>;
  pieceDefsByChar: Record<string, AiPieceDefinition>;
};

export function normalizePieceDefinition(item: PieceCatalogItem): AiPieceDefinition {
  const overridden = applyClientEnginePieceCatalogOverrides(applyGachaPieceCatalogOverrides(item));
  return {
    ...overridden,
    pieceCode: normalizePieceCode(overridden.pieceCode),
    canonicalCode: normalizePieceCode(overridden.canonicalCode),
    sfenCode: overridden.sfenCode?.toUpperCase() ?? null,
    moveVectors: overridden.moveVectors.map((vector) => ({ ...vector })),
    moveRules: overridden.moveRules?.map((rule) => ({ ...rule, params: { ...rule.params } })) ?? [],
    moveConstraints: overridden.moveConstraints ? { ...overridden.moveConstraints } : null,
  };
}

export function normalizePieceCatalog(items: PieceCatalogItem[]): AiPieceDefinition[] {
  return items.map(normalizePieceDefinition);
}

export function buildPieceLookups(pieceCatalog: AiPieceDefinition[]): AiPieceLookups {
  const pieceDefsByCode: Record<string, AiPieceDefinition> = {};
  const pieceDefsByChar: Record<string, AiPieceDefinition> = {};
  const promotedPieceDefsByCode: Record<string, AiPieceDefinition> = {};

  for (const item of pieceCatalog) {
    if (item.char) {
      pieceDefsByChar[item.char] = item;
    }
    const pieceCode = normalizePieceCode(item.pieceCode);
    if (pieceCode) {
      pieceDefsByCode[pieceCode] = item;
      if (item.isPromoted) {
        promotedPieceDefsByCode[pieceCode] = item;
      }
    }
    const canonicalCode = normalizePieceCode(item.canonicalCode);
    if (canonicalCode) {
      pieceDefsByCode[canonicalCode] = item;
      if (item.isPromoted) {
        promotedPieceDefsByCode[canonicalCode] = item;
      }
    }
  }

  // 王/玉は同一駒として扱う。同期揺れで文字が入れ替わっても定義解決できるようにする。
  if (pieceDefsByChar['王'] && !pieceDefsByChar['玉']) {
    pieceDefsByChar['玉'] = pieceDefsByChar['王']!;
  }
  if (pieceDefsByChar['玉'] && !pieceDefsByChar['王']) {
    pieceDefsByChar['王'] = pieceDefsByChar['玉']!;
  }

  const goldDef = pieceDefsByCode.KI;
  for (const [baseCode, promotedChar] of Object.entries(PROMOTED_CODE_TO_CHAR)) {
    if (GOLD_LIKE_PROMOTED_CODES.has(baseCode) || baseCode === 'HI' || baseCode === 'KA') {
      continue;
    }
    if (promotedPieceDefsByCode[baseCode]) continue;
    const fromChar = pieceDefsByChar[promotedChar];
    if (fromChar) {
      promotedPieceDefsByCode[baseCode] = fromChar;
    }
  }

  if (goldDef) {
    for (const baseCode of GOLD_LIKE_PROMOTED_BASE_CODES) {
      promotedPieceDefsByCode[baseCode] = {
        ...goldDef,
        pieceCode: baseCode,
        canonicalCode: baseCode,
        char: PROMOTED_CODE_TO_CHAR[baseCode],
        isPromoted: true,
        moveVectors: GOLD_MOVE_VECTORS.map((vector) => ({ ...vector })),
        move: GOLD_LIKE_PROMOTED_MOVE_DESCRIPTION_JA,
      };
    }
  }

  const hiDef = pieceDefsByCode.HI;
  if (hiDef) {
    promotedPieceDefsByCode.HI = {
      ...hiDef,
      pieceCode: 'HI',
      canonicalCode: 'HI',
      char: PROMOTED_CODE_TO_CHAR.HI,
      isPromoted: true,
      moveVectors: DRAGON_KING_MOVE_VECTORS.map((vector) => ({ ...vector })),
      move: DRAGON_KING_MOVE_DESCRIPTION_JA,
    };
  }
  const kaDef = pieceDefsByCode.KA;
  if (kaDef) {
    promotedPieceDefsByCode.KA = {
      ...kaDef,
      pieceCode: 'KA',
      canonicalCode: 'KA',
      char: PROMOTED_CODE_TO_CHAR.KA,
      isPromoted: true,
      moveVectors: DRAGON_HORSE_MOVE_VECTORS.map((vector) => ({ ...vector })),
      move: DRAGON_HORSE_MOVE_DESCRIPTION_JA,
    };
  }

  return {
    pieceDefsByCode,
    promotedPieceDefsByCode,
    pieceDefsByChar,
  };
}
