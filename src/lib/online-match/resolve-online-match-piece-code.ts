import { getGachaPieceMeta } from '@/constants/gacha-piece-metadata';
import { CHAR_TO_CODE } from '@/features/stage-shogi/domain/piece-conversion';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

/** オンライン対戦の battle-setup / 盤面配置用 pieceCode（BFF カタログキーと一致させる） */
export function resolveOnlineMatchPieceCode(char: string): string {
  const trimmed = char.trim();
  if (!trimmed) return '';
  const gacha = getGachaPieceMeta(trimmed);
  if (gacha?.pieceCode) return gacha.pieceCode.trim().toUpperCase();
  const mapped = CHAR_TO_CODE[trimmed];
  if (mapped) return mapped.toUpperCase();
  return trimmed.toUpperCase();
}

/** デッキ配置: カタログの pieceId を優先し、漢字だけの推測を避ける */
export function resolveOnlineMatchPieceCodeFromPlacement(
  piece: { pieceId?: number; char: string },
  catalogByPieceId: ReadonlyMap<number, PieceCatalogItem>,
): string {
  if (typeof piece.pieceId === 'number') {
    const item = catalogByPieceId.get(piece.pieceId);
    const code = item?.pieceCode?.trim();
    if (code) return code.toUpperCase();
  }
  return resolveOnlineMatchPieceCode(piece.char);
}
