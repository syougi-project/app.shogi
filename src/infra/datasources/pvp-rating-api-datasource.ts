import type { PvpRatingLeaderboardSnapshot } from '@/domain/models/pvp-rating-leaderboard';
import { getJson, postJson } from '@/infra/http/api-client';
import { normalizePvpRating } from '@/lib/online-match/pvp-rating-constants';

export type ApplyPvpRatingResult = {
  rating: number;
  delta: number;
  alreadyApplied: boolean;
};

type LeaderboardApiEntry = {
  rank?: unknown;
  playerId?: unknown;
  player_id?: unknown;
  displayName?: unknown;
  display_name?: unknown;
  rating?: unknown;
  title?: unknown;
};

type LeaderboardApiResponse = {
  entries?: unknown;
  snapshotAt?: unknown;
  snapshot_at?: unknown;
  updatedAt?: unknown;
  updated_at?: unknown;
};

export class PvpRatingApiDataSource {
  async applyAfterMatch(
    token: string,
    input: { matchId: string; won: boolean; opponentRating?: number },
  ): Promise<ApplyPvpRatingResult> {
    return postJson<ApplyPvpRatingResult>('/api/v1/me/pvp-rating/apply', input, { token });
  }

  async fetchLeaderboard(
    token: string,
    input: { limit: number },
  ): Promise<PvpRatingLeaderboardSnapshot> {
    const raw = await getJson<LeaderboardApiResponse>(
      `/api/v1/pvp-rating/leaderboard?limit=${input.limit}`,
      { token },
    );
    const entriesRaw = Array.isArray(raw.entries) ? raw.entries : [];
    const snapshotAt =
      asIsoString(raw.snapshotAt) ??
      asIsoString(raw.snapshot_at) ??
      asIsoString(raw.updatedAt) ??
      asIsoString(raw.updated_at) ??
      new Date().toISOString();

    const entries = entriesRaw
      .map((entry, index) => parseLeaderboardEntry(entry, index))
      .filter((entry): entry is NonNullable<typeof entry> => entry != null)
      .slice(0, input.limit);

    return { entries, snapshotAt };
  }
}

function asIsoString(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function parseLeaderboardEntry(raw: unknown, index: number) {
  if (!raw || typeof raw !== 'object') return null;
  const entry = raw as LeaderboardApiEntry;
  const rank = Number(entry.rank);
  const playerId = String(entry.playerId ?? entry.player_id ?? '').trim();
  const displayName = String(entry.displayName ?? entry.display_name ?? '').trim();
  if (!playerId || !displayName) return null;
  return {
    rank: Number.isInteger(rank) && rank > 0 ? rank : index + 1,
    playerId,
    displayName,
    rating: normalizePvpRating(entry.rating),
    title: entry.title == null ? null : String(entry.title),
  };
}
