import { findPieceCoveringCell } from '@/ai/engine/giant-piece';
import { generateLegalMoves, type GenerateLegalMovesOptions } from '@/ai/engine/legal-moves';
import { isHenPiece, isItsuPiece, isShinPiece } from '@/ai/engine/piece-identifiers';
import { moveEquals } from '@/ai/engine/shared';
import type { AiBattleMove, AiBattlePosition, AiPieceDefinition } from '@/ai/model';
import { normalizeBattleMove, piecesFromBoardState } from '@/ai/model';

export function assertMoveAllowedBySessionCatalog(input: {
  position: AiBattlePosition;
  pieceCatalog: AiPieceDefinition[];
  move: AiBattleMove;
  actor: 'player' | 'enemy';
  legalMoveOptions?: GenerateLegalMovesOptions;
}) {
  const move = normalizeBattleMove(input.move);
  const moveForMatch =
    move.notation === 'time_normal'
      ? {
          ...move,
          notation: null,
        }
      : move;
  const legal = generateLegalMoves({
    position: input.position,
    pieceCatalog: input.pieceCatalog,
    options: input.legalMoveOptions,
  });

  if (legal.sideToMove !== input.actor) {
    throw new Error(
      `guardrail rejected move: expected ${legal.sideToMove} turn but got ${input.actor}`,
    );
  }

  const matched =
    legal.legalMoves.find((candidate) => moveEquals(candidate, moveForMatch)) ??
    findCoordinateLegalMoveFallback(legal.legalMoves, moveForMatch, input.position);
  if (!matched) {
    throw new Error('guardrail rejected move: move is outside session catalog legal range');
  }

  const requestedSkillNotation =
    move.notation === 'time_skill' ||
    move.notation === 'time_skill_only' ||
    move.notation === 'house_skill_only'
      ? move.notation
      : typeof move.notation === 'string' && move.notation.startsWith('satori_stun:')
        ? move.notation
        : typeof move.notation === 'string' && move.notation.startsWith('heart_protect:')
          ? move.notation
          : null;
  const legalSkillNotation =
    matched.notation === 'time_skill' ||
    matched.notation === 'time_skill_only' ||
    matched.notation === 'house_skill_only'
      ? matched.notation
      : typeof matched.notation === 'string' && matched.notation.startsWith('satori_stun:')
        ? matched.notation
        : typeof matched.notation === 'string' && matched.notation.startsWith('heart_protect:')
          ? matched.notation
          : null;

  if (requestedSkillNotation !== legalSkillNotation) {
    throw new Error('guardrail rejected move: skill annotation does not match legal move');
  }

  return matched;
}

function boardCellMatchesForGuardrail(
  candidateRow: number | null,
  candidateCol: number | null,
  moveRow: number | null,
  moveCol: number | null,
): boolean {
  if (candidateRow == null || candidateCol == null || moveRow == null || moveCol == null) {
    return false;
  }
  if (candidateRow === moveRow && candidateCol === moveCol) return true;
  return (
    (candidateRow === moveRow + 1 && candidateCol === moveCol + 1) ||
    (candidateRow + 1 === moveRow && candidateCol + 1 === moveCol)
  );
}

function moveCoordinatesMatchForGuardrail(candidate: AiBattleMove, move: AiBattleMove): boolean {
  return (
    boardCellMatchesForGuardrail(
      candidate.fromRow,
      candidate.fromCol,
      move.fromRow,
      move.fromCol,
    ) && boardCellMatchesForGuardrail(candidate.toRow, candidate.toCol, move.toRow, move.toCol)
  );
}

function moveMetaMatchesForGuardrail(candidate: AiBattleMove, move: AiBattleMove): boolean {
  return (
    candidate.promote === move.promote &&
    (candidate.dropPieceCode ?? null) === (move.dropPieceCode ?? null) &&
    (candidate.notation ?? null) === (move.notation ?? null)
  );
}

function isGachaPieceForCoordinateGuardrail(
  piece: NonNullable<ReturnType<typeof findPieceCoveringCell>>,
): boolean {
  const pieceLike = {
    ...piece,
    pieceCode: piece.pieceCode ?? null,
  };
  return isShinPiece(pieceLike) || isItsuPiece(pieceLike) || isHenPiece(pieceLike);
}

/**
 * opaque 駒 ID や 1/0 始まり座標のずれで pieceCode・座標が食い違うとき、
 * 着手元の駒種と座標・成り・スキル表記で合法手と突き合わせる。
 */
function findCoordinateLegalMoveFallback(
  legalMoves: AiBattleMove[],
  move: AiBattleMove,
  position: AiBattlePosition,
): AiBattleMove | undefined {
  if (move.fromRow == null || move.fromCol == null) return undefined;
  const pieces = piecesFromBoardState(position);
  const fromPiece =
    findPieceCoveringCell(pieces, move.fromRow, move.fromCol) ??
    pieces.find((piece) =>
      boardCellMatchesForGuardrail(piece.row, piece.col, move.fromRow, move.fromCol),
    );
  if (!fromPiece || move.dropPieceCode != null) {
    return undefined;
  }
  const coordinateMatcher = isGachaPieceForCoordinateGuardrail(fromPiece)
    ? moveCoordinatesMatchForGuardrail
    : (candidate: AiBattleMove, requested: AiBattleMove) =>
        candidate.fromRow === requested.fromRow &&
        candidate.fromCol === requested.fromCol &&
        candidate.toRow === requested.toRow &&
        candidate.toCol === requested.toCol;
  return legalMoves.find(
    (candidate) =>
      coordinateMatcher(candidate, move) && moveMetaMatchesForGuardrail(candidate, move),
  );
}
