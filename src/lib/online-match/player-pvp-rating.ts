import { isApiDataSource } from '@/lib/config/data-source';
import {
  getHomeSnapshotState,
  loadHomeSnapshot,
  pinHomeSnapshotRating,
} from '@/hooks/common/home-snapshot-store';
import {
  calculateEloRatingDelta,
  normalizePvpRating,
} from '@/lib/online-match/pvp-rating-constants';

export {
  PVP_RATING_INITIAL,
  normalizePvpRating,
  calculateEloRatingDelta,
  formatPvpRatingDelta,
} from '@/lib/online-match/pvp-rating-constants';

const DEFAULT_MAX_ATTEMPTS = 10;
const DEFAULT_RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 対人対戦終了後、BFF の snapshot からサーバー反映済みレートを取得する */
export async function syncPvpRatingAfterMatch(input: {
  ratingBefore: number;
  won: boolean;
  opponentRating?: number;
  fallbackRating?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
}): Promise<{ rating: number; delta: number }> {
  const ratingBefore = normalizePvpRating(input.ratingBefore);

  if (!isApiDataSource()) {
    if (input.opponentRating == null) {
      return { rating: ratingBefore, delta: 0 };
    }
    const delta = calculateEloRatingDelta(
      ratingBefore,
      normalizePvpRating(input.opponentRating),
      input.won,
    );
    const rating = normalizePvpRating(ratingBefore + delta);
    pinHomeSnapshotRating(rating);
    return { rating, delta };
  }

  const maxAttempts = input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const retryDelayMs = input.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(retryDelayMs);
    }
    const snapshot = await loadHomeSnapshot(true);
    const rating = normalizePvpRating(snapshot.rating);
    if (rating !== ratingBefore) {
      const delta = rating - ratingBefore;
      pinHomeSnapshotRating(rating);
      return { rating, delta };
    }
  }

  const fallbackCandidates = [input.fallbackRating, getHomeSnapshotState().snapshot.rating]
    .filter((value): value is number => value != null && Number.isFinite(value))
    .map((value) => normalizePvpRating(value))
    .filter((value) => value !== ratingBefore);

  if (fallbackCandidates.length > 0) {
    const rating = fallbackCandidates[0]!;
    const delta = rating - ratingBefore;
    pinHomeSnapshotRating(rating);
    return { rating, delta };
  }

  const rating = normalizePvpRating((await loadHomeSnapshot(true)).rating);
  const delta = rating - ratingBefore;
  if (delta !== 0) {
    pinHomeSnapshotRating(rating);
  }
  return { rating, delta };
}

/** @deprecated matching_server 側でレート反映するため syncPvpRatingAfterMatch を使用 */
export async function applyPvpRatingAfterMatch(input: {
  matchId: string;
  won: boolean;
  opponentRating?: number;
  ratingBefore?: number;
  recordMatch?: {
    playerBlackUserId: string;
    playerWhiteUserId: string;
    winnerUserId: string;
    reason: string;
    startedAt?: string;
    finishedAt?: string;
  };
}): Promise<{ rating: number; delta: number }> {
  return syncPvpRatingAfterMatch({
    ratingBefore: input.ratingBefore ?? 0,
    won: input.won,
    opponentRating: input.opponentRating,
  });
}
