import type { MatchingGameState, PlayerSide } from '@/domain/matching-server/protocol';
import { decodeEncodedBoardPiece } from '@/lib/matching-server/game-bridge';

const KING_WIRE_CODES = new Set(['OU', 'KING', 'K']);

function isKingWireCode(code: string): boolean {
  const upper = code.trim().toUpperCase();
  if (KING_WIRE_CODES.has(upper)) return true;
  if (upper.endsWith('_OU')) return true;
  return false;
}

export function hasKingOnWireBoard(board: Record<string, string>, side: PlayerSide): boolean {
  for (const encoded of Object.values(board)) {
    const { serverSide, code } = decodeEncodedBoardPiece(encoded);
    if (serverSide === side && isKingWireCode(code)) return true;
  }
  return false;
}

/** 盤面から王の有無を見て、自分視点の勝敗を返す（両方王がいる場合は null） */
export function resolveWinnerSideFromWire(
  wire: MatchingGameState,
  myRole: PlayerSide,
): 'player' | 'enemy' | null {
  const blackHasKing = hasKingOnWireBoard(wire.board, 'black');
  const whiteHasKing = hasKingOnWireBoard(wire.board, 'white');
  if (blackHasKing && whiteHasKing) return null;
  const winnerRole: PlayerSide | null = blackHasKing ? 'black' : whiteHasKing ? 'white' : null;
  if (!winnerRole) return null;
  return winnerRole === myRole ? 'player' : 'enemy';
}
