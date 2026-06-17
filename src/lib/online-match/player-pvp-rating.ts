import { isApiDataSource } from '@/lib/config/data-source';
import { PvpRatingApiDataSource } from '@/infra/datasources/pvp-rating-api-datasource';
import { supabase } from '@/lib/supabase/supabase-client';
import { normalizePvpRating } from '@/lib/online-match/pvp-rating-constants';

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
}): Promise<{ rating: number; delta: number }> {
  if (!isApiDataSource()) {
    return { rating: 0, delta: 0 };
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
  });

  return {
    rating: normalizePvpRating(result.rating),
    delta: Number(result.delta ?? 0),
  };
}
