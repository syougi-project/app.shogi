import type { AiBoardPiece, AiPieceDefinition, AiPieceLookups } from '@/ai/model';
import { toBasePieceCode } from '@/ai/model';

/** 小竜（HTML: dragonMoves）— 斜め何マスでも + 前後左右1マス。 */
export const RYU_DRAGON_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 8 },
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 8 },
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: -1, dy: 1, maxStep: 8 },
  { dx: 0, dy: 1, maxStep: 1 },
  { dx: 1, dy: 1, maxStep: 8 },
];

export const RYU_MOVE_DESCRIPTION_JA = '斜めに何マスでも進める。前後左右に1マス進める。';

export function hasAllySpringPieceOnBoard(
  pieces: readonly { side: string; char: string; [key: string]: unknown }[],
  side: 'player' | 'enemy',
): boolean {
  return pieces.some((p) => p.side === side && p.char === '泉');
}

export function isUnpromotedSmallDragonPiece(piece: {
  char: string;
  pieceCode: string | null;
  promoted?: boolean | null;
}): boolean {
  if (piece.promoted) return false;
  if (piece.char === '竜') return true;
  const base = toBasePieceCode(piece.pieceCode);
  if (base === 'RYU') return true;
  const raw = (piece.pieceCode ?? '').toUpperCase();
  if (raw.includes('SHOGI_RYU')) return true;
  return false;
}

/** 合法手・移動ベクトル解決用: 味方に「泉」がある間だけ、小竜を「辰」マスタとして扱う。 */
export function effectivePieceForRulesAfterSpring(
  piece: AiBoardPiece,
  allPieces: readonly AiBoardPiece[],
  lookups: AiPieceLookups,
): AiBoardPiece {
  if (!hasAllySpringPieceOnBoard(allPieces, piece.side)) return piece;
  if (!isUnpromotedSmallDragonPiece(piece)) return piece;
  const tatsu = lookups.pieceDefsByChar['辰'];
  if (!tatsu?.pieceCode) return piece;
  return { ...piece, char: '辰', pieceCode: tatsu.pieceCode };
}

export type SpringDragonAwakeningPieceLike = {
  side: string;
  char: string;
  pieceCode: string | null;
  promoted?: boolean;
  imageSignedUrl?: string | null;
};

/** 盤面表示: 泉が味方にいる間、小竜を辰の見た目に寄せる（`getLocalPieceImageSource` が pieceCode 優先のため、辰の pieceCode も載せる）。 */
export function mapPiecesForSpringDragonAwakeningDisplay<T extends SpringDragonAwakeningPieceLike>(
  pieces: T[],
  pieceDefsByChar: Partial<
    Record<string, { imageSignedUrl?: string | null; pieceCode?: string | null }>
  >,
): T[] {
  const sidesWithSpring = new Set<'player' | 'enemy'>();
  for (const p of pieces) {
    if (p.char === '泉') sidesWithSpring.add(p.side as 'player' | 'enemy');
  }
  if (sidesWithSpring.size === 0) return pieces;
  return pieces.map((p) => {
    if (!sidesWithSpring.has(p.side as 'player' | 'enemy')) return p;
    if (!isUnpromotedSmallDragonPiece(p)) return p;
    const t = pieceDefsByChar['辰'];
    const tatsuCode = (t?.pieceCode ?? 'TATSU') as T['pieceCode'];
    return {
      ...p,
      char: '辰',
      pieceCode: tatsuCode,
      imageSignedUrl: (t?.imageSignedUrl ?? p.imageSignedUrl) as T['imageSignedUrl'],
    };
  });
}
