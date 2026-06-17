import type { BoardPieceView } from '@/lib/matching-server/board-view';
import type { PlayerSide } from '@/domain/matching-server/protocol';

export type OnlineBattleSession = {
  roomId: string;
  matchId: string;
  connectionStatus: string;
  playerLabel: string;
  opponentLabel: string;
  role: PlayerSide | null;
  isMyTurn: boolean;
  turnLabel: string;
  version: number;
  boardPieces: BoardPieceView[];
  playerHandSummary: string;
  opponentHandSummary: string;
  logLines: string[];
  /** 対局終了後、ローカルプレイヤー視点の勝敗（未終了は null） */
  winnerSide?: 'player' | 'enemy' | null;
  /** 対局終了後のレート変動（BFF 反映後。未取得時は null） */
  pvpRatingDelta?: number | null;
  /** 対局終了後の新レート */
  pvpRatingAfter?: number | null;
};

export interface LoadOnlineBattleSessionUseCase {
  execute(input: {
    matchId?: string;
    opponent?: string;
    rating?: string;
  }): Promise<OnlineBattleSession>;
}
