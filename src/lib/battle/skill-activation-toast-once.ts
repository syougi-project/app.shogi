import { toBasePieceCode } from '@/ai/model/move';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';

/**
 * 1対戦中、各スキル（駒種）の発動説明トーストを最初の1回だけ出すためのキー。
 * 同じ駒コードならプレイヤー／相手を問わず同一スキルとみなす。
 */
export function skillActivationToastOnceKey(move: BattleMove): string | null {
  const raw = move.pieceCode ?? move.dropPieceCode;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const base = toBasePieceCode(trimmed) ?? trimmed.toUpperCase();
  return base.toUpperCase();
}

export type SkillActivationToastOnceTracker = {
  reset: () => void;
  /** まだ未表示なら true を返し、同時に表示済みへ登録する。 */
  consume: (key: string | null | undefined) => boolean;
};

export function createSkillActivationToastOnceTracker(): SkillActivationToastOnceTracker {
  const shown = new Set<string>();
  return {
    reset() {
      shown.clear();
    },
    consume(key) {
      if (!key) {
        // キーが取れない稀なケースは毎回表示するより、まとめキーで1回に抑える
        const fallback = '__unknown__';
        if (shown.has(fallback)) return false;
        shown.add(fallback);
        return true;
      }
      if (shown.has(key)) return false;
      shown.add(key);
      return true;
    },
  };
}
