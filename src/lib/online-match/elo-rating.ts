/** BFF / matching_server と同じ Elo 計算（K=32）。 */
export const ELO_K_FACTOR = 32;

export function normalizePvpRating(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function calculateEloRatingDelta(
  playerRating: number,
  opponentRating: number,
  won: boolean,
): number {
  const player = normalizePvpRating(playerRating);
  const opponent = normalizePvpRating(opponentRating);
  const expected = 1 / (1 + 10 ** ((opponent - player) / 400));
  const actual = won ? 1 : 0;
  return Math.round(ELO_K_FACTOR * (actual - expected));
}

export function applyEloRatingDelta(currentRating: number, delta: number): number {
  return Math.max(0, normalizePvpRating(currentRating) + Math.round(delta));
}

export function formatPvpRatingDelta(delta: number): string {
  const rounded = Math.round(delta);
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}
