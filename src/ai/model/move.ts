import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';
import { decodeWirePieceCodePart } from '@/lib/matching-server/wire-piece-code';

export type AiBattleMove = BattleMove;

export function normalizePieceCode(value: string | null | undefined): string | null {
  return value ? value.toUpperCase() : null;
}

/** DB の `piece_<hex>` を `PIECE_` 付きで正規化したもの。PIECE_ を剥がすと SFEN/カタログキーが壊れるためそのまま返す。 */
function shouldPreservePrefixedPieceInstanceId(normalized: string): boolean {
  for (const prefix of ['PIECE_SHOGI_', 'PIECE_'] as const) {
    if (!normalized.startsWith(prefix)) continue;
    const rest = normalized.slice(prefix.length);
    if (rest.length < 8) continue;
    if (/^[0-9A-F]+$/i.test(rest)) return true;
  }
  return false;
}

export function toBasePieceCode(pieceCode: string | null | undefined): string | null {
  const normalized = normalizePieceCode(pieceCode);
  if (!normalized) return null;
  if (normalized.includes('>') || normalized.includes('@')) {
    return toBasePieceCode(decodeWirePieceCodePart(normalized).code);
  }
  if (shouldPreservePrefixedPieceInstanceId(normalized)) {
    return normalized;
  }
  let code = normalized;
  if (code.startsWith('PIECE_SHOGI_')) {
    code = code.slice('PIECE_SHOGI_'.length);
  } else if (code.startsWith('PIECE_')) {
    code = code.slice('PIECE_'.length);
  }
  if (code === 'TO') return 'FU';
  if (code === 'NY') return 'KY';
  if (code === 'NK') return 'KE';
  if (code === 'NG') return 'GI';
  if (code === 'UM') return 'KA';
  // `RY` は飛の成り（+R）。`RYU` は本ゲームで小竜の canonical のため HI に落とさない。
  if (code === 'RY') return 'HI';
  return code;
}

export function normalizeBattleMove(move: BattleMove): AiBattleMove {
  const rawPiece = normalizePieceCode(move.pieceCode);
  const rawDrop = normalizePieceCode(move.dropPieceCode);
  const rawCaptured = normalizePieceCode(move.capturedPieceCode);
  return {
    ...move,
    pieceCode: toBasePieceCode(rawPiece) ?? rawPiece ?? 'FU',
    dropPieceCode: rawDrop == null ? null : (toBasePieceCode(rawDrop) ?? rawDrop),
    capturedPieceCode: rawCaptured == null ? null : (toBasePieceCode(rawCaptured) ?? rawCaptured),
    notation: move.notation ?? null,
  };
}
