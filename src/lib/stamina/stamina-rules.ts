/** ノーマルダンジョン1回のスタミナ消費（BFF と同期） */
export const NORMAL_STAGE_STAMINA_COST = 5;

/** プレイヤーのスタミナ上限（新規アカウント・削除後再開の初期値） */
export const DEFAULT_PLAYER_MAX_STAMINA = 50;

/** スタミナ1回復までの時間（ミリ秒） */
export const STAMINA_RECOVERY_MS = 5 * 60 * 1000;

export function calculateStaminaWithRecovery(input: {
  stored: number;
  max: number;
  updatedAtMs: number;
  nowMs?: number;
}): { stamina: number; nextRecoveryAt: string | null } {
  const now = input.nowMs ?? Date.now();
  const elapsed = Math.max(0, now - input.updatedAtMs);
  const ticksPassed = Math.floor(elapsed / STAMINA_RECOVERY_MS);
  const stamina = Math.min(input.max, input.stored + ticksPassed);
  const nextRecoveryAt =
    stamina < input.max
      ? new Date(input.updatedAtMs + (ticksPassed + 1) * STAMINA_RECOVERY_MS).toISOString()
      : null;
  return { stamina, nextRecoveryAt };
}
