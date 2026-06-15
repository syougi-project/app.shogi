import { useEffect, useRef, useState } from 'react';

import type { MatchingSnapshot } from '@/domain/models/online-match';
import type { WebSocketServerMessage } from '@/domain/matching-server/protocol';
import { useAuthSession } from '@/hooks/common/auth-session-context';
import { getHomeSnapshotState, loadHomeSnapshot } from '@/hooks/common/home-snapshot-store';
import { getMatchingServerClient } from '@/infra/matching-server/matching-server-client';
import { OnlineMatchApiDataSource } from '@/infra/datasources/online-match-datasource';
import {
  loadCurrentBattleSetupId,
  clearCurrentBattleSetupId,
} from '@/lib/online-match/current-battle-setup';
import { normalizePvpRating } from '@/lib/online-match/pvp-rating-constants';

const emptySnapshot: MatchingSnapshot = {
  title: 'オンライン対戦',
  status: '読み込み中',
  progress: 0,
};

export function useMatchingScreen() {
  const { accessToken, isReady, userId } = useAuthSession();
  const [snapshot, setSnapshot] = useState<MatchingSnapshot>(emptySnapshot);
  const [isLoading, setIsLoading] = useState(true);
  const [startedMatchId, setStartedMatchId] = useState<string | null>(null);
  const startedMatchIdRef = useRef<string | null>(null);
  const client = getMatchingServerClient();

  useEffect(() => {
    startedMatchIdRef.current = startedMatchId;
  }, [startedMatchId]);

  useEffect(() => {
    let active = true;
    if (!isReady) {
      setIsLoading(true);
      return () => {
        active = false;
      };
    }

    const start = async () => {
      const battleSetupId = await loadCurrentBattleSetupId();

      if (!active) return;

      if (!battleSetupId) {
        setSnapshot({
          title: 'オンライン対戦',
          status: '対戦準備が未保存です',
          progress: 0,
        });
        setIsLoading(false);
        return;
      }

      if (!userId || !accessToken) {
        setSnapshot({
          title: 'オンライン対戦',
          status: 'ログインが必要です',
          progress: 0,
        });
        setIsLoading(false);
        return;
      }

      await loadHomeSnapshot(true).catch(() => undefined);
      const home = getHomeSnapshotState().snapshot;
      const selfName = home.playerName.trim() || 'プレイヤー';
      const selfRating = normalizePvpRating(home.rating);

      if (!active) return;

      setSnapshot({
        title: 'オンライン対戦',
        status: '対戦相手を探しています',
        progress: 20,
        self: { displayName: selfName, rating: selfRating },
      });
      setIsLoading(false);

      const handleMessage = (payload: WebSocketServerMessage) => {
        if (!active) return;

        switch (payload.type) {
          case 'queue_entered':
            setSnapshot((current) => ({
              ...current,
              title: 'オンライン対戦',
              status: '対戦相手を探しています',
              progress: 35,
              self: current.self ?? { displayName: selfName, rating: selfRating },
            }));
            setIsLoading(false);
            return;
          case 'match_found':
            setSnapshot({
              title: 'オンライン対戦',
              status: `対戦相手が見つかりました（${payload.role === 'black' ? '先手' : '後手'}）`,
              progress: 85,
              self: {
                displayName: payload.self.displayName,
                rating: normalizePvpRating(payload.self.rating),
              },
              opponent: {
                displayName: payload.opponent.displayName,
                rating: normalizePvpRating(payload.opponent.rating),
              },
            });
            return;
          case 'game_started':
            startedMatchIdRef.current = payload.matchId;
            setSnapshot((current) => ({
              ...current,
              title: 'オンライン対戦',
              status: '対局を開始します',
              progress: 100,
            }));
            setIsLoading(false);
            setStartedMatchId(payload.matchId);
            return;
          case 'opponent_disconnected':
            setSnapshot((current) => ({
              ...current,
              status: '相手の再接続を待っています',
            }));
            return;
          case 'error':
            if (payload.message.includes('Battle setup not found')) {
              void clearCurrentBattleSetupId();
              setSnapshot({
                title: 'オンライン対戦',
                status: '対戦準備が無効です。作り直してから再試行してください',
                progress: 0,
                self: { displayName: selfName, rating: selfRating },
              });
            } else {
              setSnapshot({
                title: 'オンライン対戦',
                status: payload.message,
                progress: 0,
              });
            }
            setIsLoading(false);
            return;
        }
      };

      const unsubscribe = client.subscribe(handleMessage);

      try {
        const ticket = await new OnlineMatchApiDataSource(accessToken).issueMatchmakingTicket();
        await client.connect(userId, { ticket: ticket.ticket });
        if (!active) return;
        client.enterQueue({
          userId,
          rating: ticket.user.rating || selfRating,
          displayName: ticket.user.displayName || selfName,
          battleSetupId,
        });
      } catch {
        if (!active) return;
        setSnapshot({
          title: 'オンライン対戦',
          status: client.getLastError() ?? '接続先が未設定です',
          progress: 0,
          self: { displayName: selfName, rating: selfRating },
        });
        setIsLoading(false);
      }

      return () => {
        unsubscribe();
      };
    };

    let cleanupMessage: (() => void) | undefined;
    void start().then((cleanup) => {
      cleanupMessage = cleanup;
    });

    return () => {
      active = false;
      cleanupMessage?.();
      if (userId && !startedMatchIdRef.current) {
        client.cancelQueue(userId);
      }
    };
  }, [accessToken, client, isReady, userId]);

  async function cancel() {
    if (userId) {
      client.cancelQueue(userId);
    } else {
      client.disconnect();
    }
  }

  return { snapshot, isLoading, cancel, startedMatchId };
}
