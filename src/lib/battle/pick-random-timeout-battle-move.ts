import { filterActionableMoves, isPhysicalBattleMove } from '@/lib/battle/battle-skill-interaction';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';

function pickRandom<T>(items: readonly T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

/** 時間切れ時にサーバーへ送るランダム合法手を1手選ぶ */
export function pickRandomTimeoutBattleMove(legalMoves: readonly BattleMove[]): BattleMove | null {
  const actionable = filterActionableMoves([...legalMoves]);
  const physical = actionable.filter(isPhysicalBattleMove);
  if (physical.length > 0) {
    return pickRandom(physical);
  }

  const skillOnly = legalMoves.filter(
    (move) => move.notation === 'house_skill_only' || move.notation === 'time_skill_only',
  );
  return pickRandom(skillOnly);
}
