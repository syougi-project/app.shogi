import { toBasePieceCode } from '@/ai/model/move';
import type { AiPieceDefinition } from '@/ai/model/piece';
import {
  isBirdPiece,
  isBlackOniPiece,
  isCloudPiece,
  isKenSwordPiece,
  isKatanaPiece,
  isReflectivePiece,
  normKanjiForEngineRules,
  normalizeSkillPieceCode,
} from '@/ai/engine/piece-identifiers';

/** HTML / 駒図鑑のスライド移動距離（9x9 盤）。 */
const SLIDE_MAX = 8;

export const ROOK_ORTHOGONAL_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: 0, maxStep: SLIDE_MAX },
  { dx: 1, dy: 0, maxStep: SLIDE_MAX },
  { dx: 0, dy: -1, maxStep: SLIDE_MAX },
  { dx: 0, dy: 1, maxStep: SLIDE_MAX },
];

export const BISHOP_DIAGONAL_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: SLIDE_MAX },
  { dx: 1, dy: -1, maxStep: SLIDE_MAX },
  { dx: -1, dy: 1, maxStep: SLIDE_MAX },
  { dx: 1, dy: 1, maxStep: SLIDE_MAX },
];

export const DIAGONAL_ONE_STEP_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: -1, dy: 1, maxStep: 1 },
  { dx: 1, dy: 1, maxStep: 1 },
];

export const ORTHOGONAL_ONE_STEP_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 0, dy: 1, maxStep: 1 },
];

/** 龍王（成飛）: 縦横何マスでも + 斜め1マス */
export const DRAGON_KING_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  ...ROOK_ORTHOGONAL_MOVE_VECTORS,
  ...DIAGONAL_ONE_STEP_VECTORS,
];

/** 龍馬（成角）: 斜め何マスでも + 縦横1マス */
export const DRAGON_HORSE_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  ...BISHOP_DIAGONAL_MOVE_VECTORS,
  ...ORTHOGONAL_ONE_STEP_VECTORS,
];

export const DRAGON_KING_MOVE_DESCRIPTION_JA =
  '前後左右に何マスでも進める。斜め4方向に1マス進める。';

export const DRAGON_HORSE_MOVE_DESCRIPTION_JA =
  '斜め4方向に何マスでも進める。前後左右に1マス進める。';

/** 金・成歩/成香/成桂/成銀: 前・斜め前・左右・後ろに1マス */
export const GOLD_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: 0, dy: 1, maxStep: 1 },
];

export const GOLD_LIKE_PROMOTED_BASE_CODES = ['FU', 'KY', 'KE', 'GI'] as const;

export const GOLD_LIKE_PROMOTED_MOVE_DESCRIPTION_JA = '前・斜め前・左右・後ろに1マス進める。';

/** 成飛・成角の標準移動（盤上 pieceCode は HI/KA のまま promoted=true）。 */
export function resolveStandardPromotedPieceMoveVectors(piece: {
  promoted?: boolean;
  pieceCode: string | null;
}): AiPieceDefinition['moveVectors'] | null {
  if (!piece.promoted) return null;
  const baseCode = toBasePieceCode(piece.pieceCode);
  if (baseCode === 'HI') return cloneVectors(DRAGON_KING_MOVE_VECTORS);
  if (baseCode === 'KA') return cloneVectors(DRAGON_HORSE_MOVE_VECTORS);
  if (baseCode && (GOLD_LIKE_PROMOTED_BASE_CODES as readonly string[]).includes(baseCode)) {
    return cloneVectors(GOLD_MOVE_VECTORS);
  }
  return null;
}

export const LANCE_FORWARD_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: 0, dy: -1, maxStep: SLIDE_MAX },
];

export const LEAD_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -2, maxStep: 1 },
  { dx: 1, dy: -2, maxStep: 1 },
  { dx: 0, dy: -1, maxStep: SLIDE_MAX },
];

export const WATERFALL_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: 0, dy: -1, maxStep: SLIDE_MAX },
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
];

export const AH_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  ...ROOK_ORTHOGONAL_MOVE_VECTORS,
  ...DIAGONAL_ONE_STEP_VECTORS,
];

export const PRISON_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  ...ROOK_ORTHOGONAL_MOVE_VECTORS,
  ...DIAGONAL_ONE_STEP_VECTORS,
];

export const CLOUD_OMNI_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  ...ROOK_ORTHOGONAL_MOVE_VECTORS,
  ...BISHOP_DIAGONAL_MOVE_VECTORS,
];

type PortedPieceLike = {
  char: string;
  pieceCode: string | null;
  promoted?: boolean;
};

function shouldSkipIntrinsicPortedVectorsForPromotedPiece(piece: PortedPieceLike): boolean {
  if (piece.promoted !== true) return false;
  const baseCode = toBasePieceCode(piece.pieceCode);
  if (!baseCode) return false;
  return (
    (GOLD_LIKE_PROMOTED_BASE_CODES as readonly string[]).includes(baseCode) ||
    baseCode === 'HI' ||
    baseCode === 'KA'
  );
}

function pieceRawUpper(piece: PortedPieceLike): string {
  return (piece.pieceCode ?? '').toUpperCase();
}

function cloneVectors(vectors: AiPieceDefinition['moveVectors']): AiPieceDefinition['moveVectors'] {
  return vectors.map((v) => ({ ...v }));
}

function pieceMatchesAliases(piece: PortedPieceLike, aliases: readonly string[]): boolean {
  const base = normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode) ?? '');
  const raw = pieceRawUpper(piece);
  const char = normKanjiForEngineRules(piece.char);
  return aliases.some((alias) => {
    const normalizedAlias = normalizeSkillPieceCode(alias);
    if (normalizedAlias === base || normalizedAlias === raw || alias === char) return true;
    if (normalizedAlias.length < 4) return false;
    return raw.includes(normalizedAlias);
  });
}

function isFlamePiece(piece: PortedPieceLike): boolean {
  return pieceMatchesAliases(piece, ['ENN', 'FLAME', '炎']);
}

function isFirePiece(piece: PortedPieceLike): boolean {
  return pieceMatchesAliases(piece, ['FIRE', 'FIR', '火']);
}

function isPrisonPiece(piece: PortedPieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '牢') return true;
  if (char === '柵') return false;
  return pieceMatchesAliases(piece, ['PRISON', 'ROU', '406177108665']);
}

function isFencePiece(piece: PortedPieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === '柵') return true;
  return pieceMatchesAliases(piece, ['FENCE', 'SAKU', 'SAKUI', '95E4E9F3D8E5']);
}

function isLeadPiece(piece: PortedPieceLike): boolean {
  return pieceMatchesAliases(piece, ['LEAD', '鉛', '!']);
}

function isGunPieceForPorted(piece: PortedPieceLike): boolean {
  return pieceMatchesAliases(piece, ['GUN', '銃']);
}

function isAPieceForPorted(piece: PortedPieceLike): boolean {
  const char = normKanjiForEngineRules(piece.char);
  if (char === 'あ') return true;
  const base = normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode) ?? '');
  return base === 'A' || pieceRawUpper(piece).includes('A9C2AD579732');
}

/** BFF カタログが金相当1マスのままでも、駒図鑑どおりのスライド移動にする。 */
export function resolveIntrinsicPortedMoveVectors(
  piece: PortedPieceLike,
): AiPieceDefinition['moveVectors'] | null {
  if (shouldSkipIntrinsicPortedVectorsForPromotedPiece(piece)) {
    return null;
  }
  if (isKatanaPiece(piece)) return null;
  if (isBirdPiece(piece) || isBlackOniPiece(piece)) return null;
  if (isFencePiece(piece)) return null;

  if (isCloudPiece(piece)) {
    return cloneVectors(CLOUD_OMNI_MOVE_VECTORS);
  }
  if (isReflectivePiece(piece)) {
    return cloneVectors(BISHOP_DIAGONAL_MOVE_VECTORS);
  }
  if (isPrisonPiece(piece)) {
    return cloneVectors(PRISON_MOVE_VECTORS);
  }
  if (isAPieceForPorted(piece)) {
    return cloneVectors(AH_MOVE_VECTORS);
  }
  if (isLeadPiece(piece)) {
    return cloneVectors(LEAD_MOVE_VECTORS);
  }
  if (pieceMatchesAliases(piece, ['WATERFALL', '滝', '8CC9287B7E93'])) {
    return cloneVectors(WATERFALL_MOVE_VECTORS);
  }
  if (pieceMatchesAliases(piece, ['THUNDER', '雷'])) {
    return cloneVectors(BISHOP_DIAGONAL_MOVE_VECTORS);
  }
  if (pieceMatchesAliases(piece, ['RIDGE', 'REI', '嶺', '555D2E24EFB0'])) {
    return cloneVectors(BISHOP_DIAGONAL_MOVE_VECTORS);
  }
  if (pieceMatchesAliases(piece, ['ROSE', '薔', 'A49C1E52B47A'])) {
    return cloneVectors(BISHOP_DIAGONAL_MOVE_VECTORS);
  }
  if (isKenSwordPiece(piece)) {
    return cloneVectors(ROOK_ORTHOGONAL_MOVE_VECTORS);
  }
  if (isGunPieceForPorted(piece)) {
    return cloneVectors(ROOK_ORTHOGONAL_MOVE_VECTORS);
  }
  if (isFirePiece(piece) && !isFlamePiece(piece)) {
    return cloneVectors(ROOK_ORTHOGONAL_MOVE_VECTORS);
  }
  if (
    pieceMatchesAliases(piece, [
      'HOS',
      '星',
      'DEMON',
      'MAK',
      '魔',
      'ELECTRIC',
      '電',
      'SNOW',
      '雪',
      'WIND',
      '風',
      'BOAT',
      '舟',
      'BIGNOISE',
      '轟',
      'D24741D0EF18',
      'ABYSS',
      '淵',
      '31CB39CC0FA8',
    ])
  ) {
    return cloneVectors(ROOK_ORTHOGONAL_MOVE_VECTORS);
  }
  if (pieceMatchesAliases(piece, ['KY', '香'])) {
    return cloneVectors(LANCE_FORWARD_MOVE_VECTORS);
  }
  if (pieceMatchesAliases(piece, ['HI', '飛'])) {
    return cloneVectors(ROOK_ORTHOGONAL_MOVE_VECTORS);
  }
  if (
    pieceMatchesAliases(piece, [
      'HOO',
      '鳳',
      'phoenix',
      'PHOENIX',
      '4C5084DE2FAD',
      'PIECE_SHOGI_HOO',
    ])
  ) {
    return cloneVectors(DRAGON_KING_MOVE_VECTORS);
  }
  if (pieceMatchesAliases(piece, ['KA', '角'])) {
    return cloneVectors(BISHOP_DIAGONAL_MOVE_VECTORS);
  }
  if (normKanjiForEngineRules(piece.char) === '山' || pieceMatchesAliases(piece, ['YAMA'])) {
    return cloneVectors(DIAGONAL_ONE_STEP_VECTORS);
  }

  return null;
}
