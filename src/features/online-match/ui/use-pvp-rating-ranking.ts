import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';

import type { PvpRatingLeaderboardEntry } from '@/domain/models/pvp-rating-leaderboard';
import { createLoadPvpRatingLeaderboardUseCase } from '@/usecases/pvp-rating/create-pvp-rating-usecases';

export function usePvpRatingRanking() {
  const loadUseCase = useMemo(() => createLoadPvpRatingLeaderboardUseCase(), []);
  const [entries, setEntries] = useState<PvpRatingLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [nextRefreshAt, setNextRefreshAt] = useState<number | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback(
    async (forceRefresh: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const result = await loadUseCase.execute({ forceRefresh });
        setEntries(result.entries);
        setFetchedAt(result.fetchedAt);
        setNextRefreshAt(result.nextRefreshAt);
        setFromCache(result.fromCache);
      } catch (cause) {
        setEntries([]);
        setError(cause instanceof Error ? cause.message : 'ランキングの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    },
    [loadUseCase],
  );

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  return {
    entries,
    loading,
    error,
    fetchedAt,
    nextRefreshAt,
    fromCache,
    refresh,
  };
}
