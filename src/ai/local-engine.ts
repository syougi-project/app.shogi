import {
  applyMove as applyMoveCore,
  computeAiMove as computeAiMoveCore,
  computeAiMoveAsync as computeAiMoveAsyncCore,
  generateLegalMoves as generateLegalMovesCore,
  type GenerateLegalMovesOptions,
} from '@/ai/engine';
import { createEmptyHandsState } from '@/features/stage-shogi/domain/game-rules';
import type { BattleCanonicalPosition } from '@/usecases/stage-battle/game-move-contract';

/** ノーマルダンジョン: 王手放置・玉の自取りも合法手として扱う（ガイド制限なし）。 */
export const STAGE_BATTLE_LEGAL_MOVE_OPTIONS: GenerateLegalMovesOptions = {
  enforceKingSafety: false,
};

export function generateLocalLegalMoves(
  input: Parameters<typeof generateLegalMovesCore>[0],
): ReturnType<typeof generateLegalMovesCore> {
  return generateLegalMovesCore({
    ...input,
    options: STAGE_BATTLE_LEGAL_MOVE_OPTIONS,
  });
}

export function applyLocalMove(
  input: Parameters<typeof applyMoveCore>[0],
): ReturnType<typeof applyMoveCore> {
  return applyMoveCore({
    ...input,
    options: {
      ...input.options,
      legalMoveOptions: STAGE_BATTLE_LEGAL_MOVE_OPTIONS,
    },
  });
}

export function computeLocalAiTurn(
  input: Parameters<typeof computeAiMoveCore>[0],
): ReturnType<typeof computeAiMoveCore> {
  return computeAiMoveCore({
    ...input,
    legalMoveOptions: STAGE_BATTLE_LEGAL_MOVE_OPTIONS,
  });
}

export async function computeLocalAiTurnAsync(
  input: Parameters<typeof computeAiMoveAsyncCore>[0],
): Promise<ReturnType<typeof computeAiMoveAsyncCore>> {
  return computeAiMoveAsyncCore({
    ...input,
    legalMoveOptions: STAGE_BATTLE_LEGAL_MOVE_OPTIONS,
  });
}

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
