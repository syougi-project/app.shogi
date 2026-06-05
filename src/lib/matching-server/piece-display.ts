import { toBasePieceCode } from '@/ai/model/move';
import { getGachaPieceMeta } from '@/constants/gacha-piece-metadata';
import {
  CODE_TO_CHAR,
  PROMOTED_CODE_TO_CHAR,
} from '@/features/stage-shogi/domain/piece-conversion';
import type { Side } from '@/features/stage-shogi/domain/game-rules';
import { getDisplayCharFromPieceCode } from '@/lib/piece-image-registry';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

/** 旧クライアントが保存した battle-setup の pieceCode → BFF マスタの別名 */
const WIRE_PIECE_CODE_ALIASES: Readonly<Record<string, string>> = {
  PIECE_GACHA_SHITSU: 'PIECE_GACHA_MURO',
  PIECE_GACHA_KOU: 'PIECE_GACHA_KO',
  PIECE_GACHA_TOU2: 'PIECE_GACHA_TO',
};

export function normalizeWirePieceCode(pieceCode: string): string {
  const upper = pieceCode.trim().toUpperCase();
  return WIRE_PIECE_CODE_ALIASES[upper] ?? upper;
}

function lookupCatalogDef(
  pieceCode: string,
  defsByCode: Record<string, PieceCatalogItem>,
): PieceCatalogItem | undefined {
  const upper = normalizeWirePieceCode(pieceCode);
  if (defsByCode[upper]) return defsByCode[upper];
  const base = toBasePieceCode(upper);
  if (base && defsByCode[base]) return defsByCode[base];
  for (const item of Object.values(defsByCode)) {
    const itemCode = item.pieceCode?.trim().toUpperCase();
    if (itemCode === upper) return item;
    const canonical = item.canonicalCode?.trim().toUpperCase();
    if (canonical === upper) return item;
    if (base && toBasePieceCode(item.pieceCode)?.toUpperCase() === base) return item;
  }
  return undefined;
}

/** マッチングサーバー wire の pieceCode から盤面表示漢字を決める（カタログ優先）。 */
export function resolveWirePieceChar(
  pieceCode: string,
  side: Side,
  promoted: boolean,
  defsByCode: Record<string, PieceCatalogItem>,
): string {
  const upper = normalizeWirePieceCode(pieceCode);
  const fromCatalog = lookupCatalogDef(upper, defsByCode)?.char?.trim();
  if (fromCatalog) return fromCatalog;

  if (promoted && PROMOTED_CODE_TO_CHAR[upper]) {
    return PROMOTED_CODE_TO_CHAR[upper];
  }
  if (upper === 'OU') {
    return side === 'enemy' ? '玉' : '王';
  }

  const fromRegistry = getDisplayCharFromPieceCode(upper);
  if (fromRegistry) return fromRegistry;

  const base = toBasePieceCode(upper);
  if (base && CODE_TO_CHAR[base]) return CODE_TO_CHAR[base];

  for (const char of [
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
  ] as const) {
    const meta = getGachaPieceMeta(char);
    if (!meta) continue;
    const metaUpper = meta.pieceCode.trim().toUpperCase();
    if (metaUpper === upper || normalizeWirePieceCode(metaUpper) === upper) return char;
    if (base && metaUpper.replace(/^PIECE_/, '') === base) return char;
  }

  return CODE_TO_CHAR[upper] ?? '?';
}
