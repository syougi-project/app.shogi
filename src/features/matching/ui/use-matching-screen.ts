import { useEffect, useMemo, useRef, useState } from 'react';

import type { MatchingSnapshot } from '@/domain/models/online-match';
import type { WebSocketServerMessage } from '@/domain/matching-server/protocol';
import { useAuthSession } from '@/hooks/common/auth-session-context';
import { getHomeSnapshotState, loadHomeSnapshot } from '@/hooks/common/home-snapshot-store';
import {
  createCancelMatchingUseCase,
  createStartMatchingUseCase,
} from '@/usecases/matching/create-matching-usecases';
import {
  loadCurrentBattleSetupId,
  clearCurrentBattleSetupId,
} from '@/lib/online-match/current-battle-setup';
import { normalizePvpRating } from '@/lib/online-match/pvp-rating-constants';
import type { StartMatchingInput } from '@/usecases/matching/start-matching-usecase';

const emptySnapshot: MatchingSnapshot = {
  title: 'オンライン対戦',
  status: '接続準備中',
  progress: 5,
};

type PreparedMatchingContext = StartMatchingInput;

export function useMatchingScreen(screenReady: boolean) {
  const { accessToken, isReady, userId } = useAuthSession();
  const [snapshot, setSnapshot] = useState<MatchingSnapshot>(emptySnapshot);
  const [isPreparing, setIsPreparing] = useState(true);
  const [preparedContext, setPreparedContext] = useState<PreparedMatchingContext | null>(null);
  const [startedMatchId, setStartedMatchId] = useState<string | null>(null);
  const startedMatchIdRef = useRef<string | null>(null);
  const matchingSessionRef = useRef(0);
  const matchingStartedRef = useRef(false);
  const startMatchingUseCase = useMemo(
    () => createStartMatchingUseCase(accessToken ?? undefined),
    [accessToken],
  );
  const cancelMatchingUseCase = useMemo(() => createCancelMatchingUseCase(), []);

  useEffect(() => {
    startedMatchIdRef.current = startedMatchId;
  }, [startedMatchId]);

  useEffect(() => {
    let active = true;

    const prepare = async () => {
      if (!isReady) {
        setIsPreparing(true);
        return;
      }

      setIsPreparing(true);
      setSnapshot(emptySnapshot);

      const battleSetupId = await loadCurrentBattleSetupId();
      if (!active) return;

      if (!battleSetupId) {
        setSnapshot({
          title: 'オンライン対戦',
          status: '対戦準備が未保存です',
          progress: 0,
        });
        setPreparedContext(null);
        setIsPreparing(false);
        return;
      }

      if (!userId || !accessToken) {
        setSnapshot({
          title: 'オンライン対戦',
          status: 'ログインが必要です',
          progress: 0,
        });
        setPreparedContext(null);
        setIsPreparing(false);
        return;
      }

      await loadHomeSnapshot(true).catch(() => undefined);
      if (!active) return;

      const home = getHomeSnapshotState().snapshot;
      const selfName = home.playerName.trim() || 'プレイヤー';
      const selfRating = normalizePvpRating(home.rating);

      setPreparedContext({
        userId,
        battleSetupId,
        selfName,
        selfRating,
      });
      setSnapshot({
        title: 'オンライン対戦',
        status: 'マッチングを開始します…',
        progress: 12,
        self: { displayName: selfName, rating: selfRating },
      });
      setIsPreparing(false);
    };

    void prepare();

    return () => {
      active = false;
    };
  }, [accessToken, isReady, userId]);

  useEffect(() => {
    if (!screenReady || isPreparing || !preparedContext || matchingStartedRef.current) {
      return;
    }

    let active = true;
    const sessionId = ++matchingSessionRef.current;
    matchingStartedRef.current = true;

    const { userId: matchUserId, battleSetupId, selfName, selfRating } = preparedContext;

    setSnapshot((current) => ({
      ...current,
      title: 'オンライン対戦',
      status: 'マッチングサーバーに接続しています…',
      progress: 20,
      self: current.self ?? { displayName: selfName, rating: selfRating },
    }));

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
          return;
      }
    };

    const unsubscribe = startMatchingUseCase.subscribe(handleMessage);

    void startMatchingUseCase
      .execute({
        userId: matchUserId,
        battleSetupId,
        selfName,
        selfRating,
      })
      .then((next) => {
        if (!active) return;
        setSnapshot((current) => ({
          ...current,
          ...next,
          self: next.self ?? current.self,
        }));
      })
      .catch((error: unknown) => {
        if (!active) return;
        const fallback = startMatchingUseCase.getLastError() ?? '接続先が未設定です';
        const message =
          error instanceof Error && error.message.includes('EXPO_PUBLIC_MATCHING_SERVER_WS_URL')
            ? 'マッチングサーバー URL が未設定です'
            : fallback.includes('WebSocket')
              ? 'マッチングサーバーに接続できません。matching_server が起動しているか確認してください'
              : fallback;
        setSnapshot({
          title: 'オンライン対戦',
          status: message,
          progress: 0,
          self: { displayName: selfName, rating: selfRating },
        });
      });

    return () => {
      active = false;
      unsubscribe();
      if (matchingSessionRef.current !== sessionId) return;
      matchingStartedRef.current = false;
      if (matchUserId && !startedMatchIdRef.current) {
        void cancelMatchingUseCase.execute({ userId: matchUserId });
      }
    };
  }, [cancelMatchingUseCase, isPreparing, preparedContext, screenReady, startMatchingUseCase]);

  async function cancel() {
    await cancelMatchingUseCase.execute({ userId });
  }

  return { snapshot, isPreparing, cancel, startedMatchId };
}
