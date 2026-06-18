import { isApiDataSource } from '@/lib/config/data-source';
import { PvpRatingApiDataSource } from '@/infra/datasources/pvp-rating-api-datasource';
import { supabase } from '@/lib/supabase/supabase-client';
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

const api = new PvpRatingApiDataSource();

/** 対人対戦終了後に BFF へレートを反映（冪等: 同一 matchId は二重加算しない） */
export async function applyPvpRatingAfterMatch(input: {
  matchId: string;
  won: boolean;
  opponentRating?: number;
  recordMatch?: {
    playerBlackUserId: string;
    playerWhiteUserId: string;
    winnerUserId: string;
    reason: string;
    startedAt?: string;
    finishedAt?: string;
  };
}): Promise<{ rating: number; delta: number }> {
  if (!isApiDataSource()) {
    if (input.opponentRating == null) {
      return { rating: 0, delta: 0 };
    }
    const delta = calculateEloRatingDelta(
      normalizePvpRating(0),
      normalizePvpRating(input.opponentRating),
      input.won,
    );
    return { rating: Math.max(0, delta), delta };
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;
  if (!session?.access_token) {
    throw new Error('No active session');
  }

  const result = await api.applyAfterMatch(session.access_token, {
    matchId: input.matchId,
    won: input.won,
    opponentRating: input.opponentRating,
    recordMatch: input.recordMatch,
  });

  return {
    rating: normalizePvpRating(result.rating),
    delta: Number(result.delta ?? 0),
  };
}
