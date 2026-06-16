import { normalizeSkillPieceCode } from '@/ai/engine/piece-identifiers';
import type { AiBoardPiece } from '@/ai/model';
import { toBasePieceCode } from '@/ai/model/move';
import type { Side } from '@/features/stage-shogi/domain/game-rules';

/** 味方の陣営における「後ろ」は盤面 row の増減で表す（player: +row, enemy: -row） */
export function backRowDeltaBehindMover(side: Side): number {
  return side === 'player' ? 1 : -1;
}

function isKingExcludedFromBirdTow(piece: AiBoardPiece): boolean {
  const base = toBasePieceCode(piece.pieceCode);
  return base === 'OU' || piece.char === '王' || piece.char === '玉';
}

function isBirdExcludedFromBirdTow(piece: AiBoardPiece): boolean {
  const base = normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode) ?? '');
  return base === 'BIRD' || base.includes('29ECAB1EF3C3') || piece.char === '禽';
}

function isCellEmpty(pieces: AiBoardPiece[], row: number, col: number): boolean {
  return !pieces.some((piece) => piece.row === row && piece.col === col);
}

/** 禽: 移動後の真後ろ1マスが空いていればランダムな味方駒（王・玉・禽除く）をそのマスへ移す */
export function moveRandomAllyToCellBehindBird(input: {
  pieces: AiBoardPiece[];
  actorSide: Side;
  movedBird: { row: number; col: number };
  random?: () => number;
}): boolean {
  const dBack = backRowDeltaBehindMover(input.actorSide);
  const backRow = input.movedBird.row + dBack;
  const backCol = input.movedBird.col;
  if (backRow < 0 || backRow > 8 || backCol < 0 || backCol > 8) return false;
  if (!isCellEmpty(input.pieces, backRow, backCol)) return false;

  const candidates = input.pieces.filter((piece) => {
    if (piece.side !== input.actorSide) return false;
    if (piece.row === input.movedBird.row && piece.col === input.movedBird.col) return false;
    if (isKingExcludedFromBirdTow(piece)) return false;
    if (isBirdExcludedFromBirdTow(piece)) return false;
    return true;
  });
  if (candidates.length === 0) return false;

  const roll = input.random ?? Math.random;
  const pick = candidates[Math.floor(roll() * candidates.length)]!;
  const idx = input.pieces.findIndex(
    (piece) => piece.side === pick.side && piece.row === pick.row && piece.col === pick.col,
  );
  if (idx < 0) return false;
  input.pieces[idx] = { ...pick, row: backRow, col: backCol };
  return true;
}
