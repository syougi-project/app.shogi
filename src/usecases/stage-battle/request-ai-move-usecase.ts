import { normalizeBattleGameStatus, normalizeBattlePosition } from '@/ai/model';
import { computeLocalAiTurnAsync } from '@/ai/local-engine';
import { getLocalBattleGame, updateLocalBattleGame } from '@/ai/local-battle-registry';
import { BattleAiTurn } from '@/usecases/stage-battle/game-move-contract';
import { resolveStageAiConfig, type StageAiConfig } from '@/constants/stage-ai-config';

export type RequestAiMoveInput = {
  gameId: string;
  moveNo?: number;
  stateHash?: string | null;
  engineConfig: Partial<StageAiConfig>;
};

export class RequestAiMoveUseCase {
  async execute(input: RequestAiMoveInput): Promise<BattleAiTurn> {
    const record = getLocalBattleGame(input.gameId);
    if (!record) {
      throw new Error(`local battle game not found: ${input.gameId}`);
    }
    if (input.moveNo != null && record.position.moveCount + 1 !== input.moveNo) {
      throw new Error(`expected moveNo ${record.position.moveCount + 1} but got ${input.moveNo}`);
    }
    if (
      input.stateHash &&
      record.position.stateHash &&
      input.stateHash !== record.position.stateHash
    ) {
      // クライアント sync タイミングで hash が一時的にずれることがある（ローカル対戦）。
      // 着手番号と sideToMove が正しければ registry 側を正とする。
    }

    const turn = await computeLocalAiTurnAsync({
      position: record.position,
      pieceCatalog: record.pieceCatalog,
      config: resolveStageAiConfig(record.stageNo, input.engineConfig),
      recentEnemyMoves: record.aiMoveHistory,
    });

    const normalizedGame = normalizeBattleGameStatus(turn.game);

    updateLocalBattleGame(input.gameId, (current) => ({
      ...current,
      position: normalizeBattlePosition(turn.position),
      game: normalizedGame,
      aiMoveHistory: turn.selectedMove
        ? [...current.aiMoveHistory, turn.selectedMove].slice(-20)
        : current.aiMoveHistory,
    }));

    return {
      ...turn,
      game: normalizedGame,
    };
  }
}
