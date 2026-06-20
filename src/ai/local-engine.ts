import { createEmptyHandsState } from '@/features/stage-shogi/domain/game-rules';
import type { BattleCanonicalPosition } from '@/usecases/stage-battle/game-move-contract';
export {
  applyMove as applyLocalMove,
  computeAiMove as computeLocalAiTurn,
  computeAiMoveAsync as computeLocalAiTurnAsync,
  generateLegalMoves as generateLocalLegalMoves,
} from '@/ai/engine';

export function emptyPosition(): BattleCanonicalPosition {
  return {
    sideToMove: 'player',
    turnNumber: 1,
    moveCount: 0,
    sfen: '9/9/9/9/9/9/9/9/9 b - 1',
    stateHash: null,
    boardState: { pieces: [] },
    hands: createEmptyHandsState(),
  };
}
