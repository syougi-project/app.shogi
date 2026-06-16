import { toBasePieceCode } from '@/ai/model/move';
import { isKenSwordPiece } from '@/ai/engine/piece-identifiers';
import type { MovePayload } from '@/domain/matching-server/protocol';
import type { BoardPiece } from '@/features/stage-shogi/domain/game-rules';
import { lookupWireBoardEncoded } from '@/lib/matching-server/game-bridge';
import { decodeEncodedBoardPiece } from '@/lib/matching-server/wire-piece-code';
import { parseMatchingSquare } from '@/lib/matching-server/square';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';

function isHolySwordPieceCode(code: string): boolean {
  const upper = code.trim().toUpperCase();
  const base = (toBasePieceCode(upper) ?? upper).toUpperCase();
  return base === 'HOLY_SWORD' || upper.includes('0F14ABCC6E5E');
}

function isHolySwordBoardPiece(piece: {
  pieceCode?: string | null;
  char?: string | null;
}): boolean {
  return isKenSwordPiece({
    pieceCode: piece.pieceCode ?? '',
    char: piece.char ?? '',
  });
}

/** 盤面差分から剣の左右回避を検出する（着手前後の BoardPiece 配列） */
export function detectHolySwordCaptureEvadeFromPieces(
  before: BoardPiece[],
  after: BoardPiece[],
  move: Pick<BattleMove, 'fromRow' | 'fromCol' | 'toRow' | 'toCol' | 'dropPieceCode'>,
): boolean {
  if (move.dropPieceCode) return false;
  if (move.fromRow == null || move.fromCol == null) return false;

  const target = before.find((piece) => piece.row === move.toRow && piece.col === move.toCol);
  if (!target || !isHolySwordBoardPiece(target)) return false;

  const stillAtTarget = after.some(
    (piece) =>
      piece.row === move.toRow &&
      piece.col === move.toCol &&
      piece.side === target.side &&
      isHolySwordBoardPiece(piece),
  );
  if (stillAtTarget) return false;

  return after.some(
    (piece) =>
      piece.side === target.side &&
      isHolySwordBoardPiece(piece) &&
      piece.row === target.row &&
      piece.col !== target.col,
  );
}

/** wire 盤面差分から剣の左右回避を検出する（オンライン対戦用） */
export function detectHolySwordCaptureEvadeFromWire(
  beforeBoard: Record<string, string>,
  afterBoard: Record<string, string>,
  lastMove: MovePayload,
): boolean {
  if (lastMove.drop === true || !lastMove.from?.trim()) return false;

  const captureSquare = lastMove.to.trim().toLowerCase();
  const beforeEncoded = lookupWireBoardEncoded(beforeBoard, captureSquare);
  if (!beforeEncoded) return false;

  const beforePiece = decodeEncodedBoardPiece(beforeEncoded);
  if (!isHolySwordPieceCode(beforePiece.code)) return false;

  const capturePos = parseMatchingSquare(captureSquare);
  const afterAtCapture = lookupWireBoardEncoded(afterBoard, captureSquare);
  if (afterAtCapture) {
    const atCapture = decodeEncodedBoardPiece(afterAtCapture);
    if (isHolySwordPieceCode(atCapture.code) && atCapture.serverSide === beforePiece.serverSide) {
      return false;
    }
  }

  for (const [square, encoded] of Object.entries(afterBoard)) {
    const decoded = decodeEncodedBoardPiece(encoded);
    if (decoded.serverSide !== beforePiece.serverSide) continue;
    if (!isHolySwordPieceCode(decoded.code)) continue;
    const pos = parseMatchingSquare(square);
    if (pos.row === capturePos.row && pos.col !== capturePos.col) {
      return true;
    }
  }

  return false;
}
