import type { MatchingGameState, PlayerSide } from '@/domain/matching-server/protocol';
import { decodeEncodedBoardPiece } from '@/lib/matching-server/wire-piece-code';
import { parseMatchingSquare } from '@/lib/matching-server/square';

export type BoardPieceView = {
  row: number;
  col: number;
  side: PlayerSide;
  pieceCode: string;
};

export function boardPiecesFromState(state: MatchingGameState): BoardPieceView[] {
  const pieces: BoardPieceView[] = [];
  for (const [square, encoded] of Object.entries(state.board)) {
    const { serverSide, code } = decodeEncodedBoardPiece(encoded);
    const { row, col } = parseMatchingSquare(square);
    pieces.push({ row, col, side: serverSide, pieceCode: code });
  }
  return pieces.sort((a, b) => a.row - b.row || a.col - b.col);
}

export function handSummary(
  hands: Record<PlayerSide, Record<string, number>>,
  side: PlayerSide,
): string {
  const entries = Object.entries(hands[side] ?? {}).filter(([, count]) => count > 0);
  if (entries.length === 0) return 'なし';
  return entries.map(([code, count]) => `${code}×${count}`).join(', ');
}
