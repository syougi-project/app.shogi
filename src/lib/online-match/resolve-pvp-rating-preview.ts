import { getHomeSnapshotState } from '@/hooks/common/home-snapshot-store';
import { getActiveMatchProfile } from '@/lib/matching-server/match-profile-store';
import {
  calculateEloRatingDelta,
  normalizePvpRating,
} from '@/lib/online-match/pvp-rating-constants';

function parseRatingFromLabel(label: string | undefined): number | undefined {
  if (!label) return undefined;
  const match = label.match(/\(R(\d+)\)\s*$/);
  if (!match?.[1]) return undefined;
  return normalizePvpRating(match[1]);
}

export function resolvePvpRatingInputs(input?: {
  playerLabel?: string;
  opponentLabel?: string;
  cached?: { selfRating: number; opponentRating: number } | null;
}): { selfRating: number; opponentRating: number } | null {
  if (input?.cached) {
    return input.cached;
  }

  const profile = getActiveMatchProfile();
  const homeRating = getHomeSnapshotState().snapshot.rating;

  const selfRating =
    profile?.self.rating ??
    parseRatingFromLabel(input?.playerLabel) ??
    (Number.isFinite(homeRating) ? normalizePvpRating(homeRating) : undefined);

  const opponentRating = profile?.opponent.rating ?? parseRatingFromLabel(input?.opponentLabel);

  if (selfRating === undefined || opponentRating === undefined) {
    return null;
  }

  return { selfRating, opponentRating };
}

export function buildPvpRatingPreview(input: {
  won: boolean;
  playerLabel?: string;
  opponentLabel?: string;
  cached?: { selfRating: number; opponentRating: number } | null;
}): { delta: number; ratingAfter: number } | null {
  const ratings = resolvePvpRatingInputs(input);
  if (!ratings) return null;
  const delta = calculateEloRatingDelta(ratings.selfRating, ratings.opponentRating, input.won);
  return {
    delta,
    ratingAfter: normalizePvpRating(ratings.selfRating + delta),
  };
}
