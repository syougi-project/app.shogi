import { toBasePieceCode } from '@/ai/model/move';

function normChar(ch: string): string {
  try {
    return (ch ?? '').normalize('NFKC');
  } catch {
    return ch ?? '';
  }
}

/** 盤上「巨」: 左上基準で 2×2 マスを占有する。 */
export function isGiantPieceForEngine(piece: { char: string; pieceCode?: string | null }): boolean {
  if (normChar(piece.char) === '巨') return true;
  const b = toBasePieceCode(piece.pieceCode);
  if (b === 'GIANT') return true;
  const raw = (piece.pieceCode ?? '').toUpperCase();
  return raw.includes('C4AEB81F3634');
}

export function giantAnchorFootprint(
  anchorRow: number,
  anchorCol: number,
  boardSize = 9,
): { row: number; col: number }[] {
  const cells = [
    { row: anchorRow, col: anchorCol },
    { row: anchorRow + 1, col: anchorCol },
    { row: anchorRow, col: anchorCol + 1 },
    { row: anchorRow + 1, col: anchorCol + 1 },
  ];
  return cells.filter((c) => c.row >= 0 && c.row < boardSize && c.col >= 0 && c.col < boardSize);
}

export function isValidGiantAnchor(anchorRow: number, anchorCol: number, boardSize = 9): boolean {
  return anchorRow >= 0 && anchorCol >= 0 && anchorRow + 1 < boardSize && anchorCol + 1 < boardSize;
}

/** マス (row,col) に駒があるか。巨は左上以外の占有マスも本体とみなす。 */
export function findPieceCoveringCell<
  T extends { char: string; pieceCode?: string | null; row: number; col: number },
>(pieces: readonly T[], row: number, col: number): T | null {
  const direct = pieces.find((p) => p.row === row && p.col === col) ?? null;
  if (direct) return direct;
  return (
    pieces.find((p) => {
      if (!isGiantPieceForEngine(p)) return false;
      return giantAnchorFootprint(p.row, p.col).some((c) => c.row === row && c.col === col);
    }) ?? null
  );
}

export function isGiantPieceCodeUpper(pieceCodeUpper: string): boolean {
  const u = pieceCodeUpper.toUpperCase();
  return u === 'GIANT' || u.includes('C4AEB81F3634');
}

export function pieceTouchesGiantFootprint<
  T extends { char: string; pieceCode?: string | null; row: number; col: number },
>(piece: T, cellRow: number, cellCol: number): boolean {
  if (!isGiantPieceForEngine(piece)) return piece.row === cellRow && piece.col === cellCol;
  return giantAnchorFootprint(piece.row, piece.col).some(
    (c) => c.row === cellRow && c.col === cellCol,
  );
}
