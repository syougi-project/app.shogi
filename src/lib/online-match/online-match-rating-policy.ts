/** レート変動の対象となる終了理由（BFF / matching_server と同一。意図的切断 disconnect 含む）。 */
const RATED_ONLINE_MATCH_END_REASONS = new Set([
  'king_capture',
  'checkmate',
  'resign',
  'disconnect',
]);

export function isRatedOnlineMatchEndReason(reason: string | null | undefined): boolean {
  const normalized = (reason ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return RATED_ONLINE_MATCH_END_REASONS.has(normalized);
}
