import type { AiBoardPiece } from '@/ai/model';
import { toBasePieceCode } from '@/ai/model/move';
import type { Side } from '@/features/stage-shogi/domain/game-rules';
import { isGiantPieceForEngine } from '@/ai/engine/giant-piece';

export const SPRING_ALLY_IMMUNITY_TURNS = 5;

export function isSpringMoverPiece(piece: { char: string; pieceCode: string | null }): boolean {
  if (piece.char === '泉') return true;
  const code = toBasePieceCode(piece.pieceCode);
  return code === 'SPRING';
}

export function listSpringImmunityAllyCandidates(input: {
  pieces: readonly AiBoardPiece[];
  actorSide: Side;
  movedPiece: AiBoardPiece;
}): AiBoardPiece[] {
  return input.pieces
    .filter(
      (piece) =>
        piece.side === input.actorSide &&
        !(piece.row === input.movedPiece.row && piece.col === input.movedPiece.col) &&
        !isSpringMoverPiece(piece) &&
        piece.char !== 'X' &&
        !isGiantPieceForEngine(piece),
    )
    .sort((a, b) => a.row - b.row || a.col - b.col || String(a.char).localeCompare(String(b.char)));
}

export function upsertCaptureImmunityDefense(
  pieceDefenses: Record<string, unknown>[],
  side: Side,
  row: number,
  col: number,
  remainingTurns: number,
) {
  const existing = pieceDefenses.find(
    (entry) =>
      String(entry.side ?? '') === side &&
      Number(entry.row) === row &&
      Number(entry.col) === col &&
      String(entry.mode ?? '') === 'immunity',
  );
  if (existing) {
    const current = Number(existing.remaining_turns ?? existing.remainingTurns ?? 0);
    existing.remaining_turns = Math.max(current, remainingTurns);
    return;
  }
  pieceDefenses.push({
    row,
    col,
    side,
    mode: 'immunity',
    remaining_turns: remainingTurns,
  });
}
