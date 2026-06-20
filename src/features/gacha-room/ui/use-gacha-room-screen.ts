import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { enrichGachaBanner } from '@/constants/gacha-lineup-catalog';
import { resolveGachaRollCode } from '@/constants/gacha-room-assets';
import {
  canRollGachaWithAd,
  featuredAdGachaDisplayName,
  isDailyFeaturedAdGachaBanner,
  type DailyAdGachaStatus,
} from '@/features/gacha-room/lib/daily-ad-gacha';
import { gachaBallColorIndexForCurrentPeriod } from '@/features/home/lib/gacha-ball-schedule';
import { showRewardedAd } from '@/lib/ads/show-rewarded-ad';
import { ApiClientError } from '@/infra/http/api-client';
import { GachaBanner } from '@/usecases/gacha-room/load-gacha-lobby-usecase';
import {
  createLoadGachaLobbyUseCase,
  createRollGachaUseCase,
} from '@/usecases/gacha-room/create-gacha-room-usecases';
import { RollGachaResult } from '@/usecases/gacha-room/roll-gacha-usecase';

export type GachaPhase = 'idle' | 'rolling' | 'video' | 'pieceOverlay' | 'done';

export type GachaRoomVM = {
  isLoading: boolean;
  /** ロビー取得失敗時のみ */
  loadError: string | null;
  reloadLobby: () => void;
  selectedKey: GachaBanner['key'];
  setSelectedKey: (key: GachaBanner['key']) => void;
  banners: GachaBanner[];
  dailyAdGacha: DailyAdGachaStatus | null;
  canRollWithAd: (gachaKey: GachaBanner['key']) => boolean;
  isFeaturedAdGacha: (gachaKey: GachaBanner['key']) => boolean;
  featuredAdGachaLabel: string | null;
  pawnCurrency: number;
  goldCurrency: number;
  noticeMessage: string | null;
  phase: GachaPhase;
  lastResult: RollGachaResult | null;
  roll: (gachaKey?: GachaBanner['key']) => Promise<void>;
  rollWithAd: (gachaKey?: GachaBanner['key']) => Promise<void>;
  onVideoEnd: () => void;
  onPieceOverlayDismiss: () => void;
};

export function useGachaRoomScreen(): GachaRoomVM {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<GachaBanner['key']>('ukanmuri');
  const [banners, setBanners] = useState<GachaBanner[]>([]);
  const [dailyAdGacha, setDailyAdGacha] = useState<DailyAdGachaStatus | null>(null);
  const [pawnCurrency, setPawnCurrency] = useState(0);
  const [goldCurrency, setGoldCurrency] = useState(0);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<GachaPhase>('idle');
  const [lastResult, setLastResult] = useState<RollGachaResult | null>(null);
  const isRollingRef = useRef(false);
  /** 演出動画終了時に参照する抽選結果（動画と同一ロールを保証） */
  const pendingResultRef = useRef<RollGachaResult | null>(null);

  const loadUseCase = useMemo(() => createLoadGachaLobbyUseCase(), []);
  const rollUseCase = useMemo(() => createRollGachaUseCase(), []);

  const reloadLobby = useCallback(() => {
    setIsLoading(true);
    setLoadError(null);
    loadUseCase
      .execute()
      .then((snapshot) => {
        setBanners(snapshot.banners.map(enrichGachaBanner));
        if (snapshot.banners.length > 0) {
          setSelectedKey(snapshot.banners[0].key);
        }
        setPawnCurrency(snapshot.pawnCurrency);
        setGoldCurrency(snapshot.goldCurrency);
        setDailyAdGacha(snapshot.dailyAdGacha ?? null);
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'ガチャ一覧の取得に失敗しました';
        setLoadError(msg);
        setBanners([]);
        setDailyAdGacha(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [loadUseCase]);

  useEffect(() => {
    reloadLobby();
  }, [reloadLobby]);

  const canRollWithAd = useCallback(
    (gachaKey: GachaBanner['key']) =>
      dailyAdGacha != null && canRollGachaWithAd(gachaKey, dailyAdGacha),
    [dailyAdGacha],
  );

  const isFeaturedAdGacha = useCallback(
    (gachaKey: GachaBanner['key']) => {
      if (!dailyAdGacha) return false;
      return isDailyFeaturedAdGachaBanner(gachaKey, dailyAdGacha);
    },
    [dailyAdGacha],
  );

  const featuredAdGachaLabel = useMemo(() => {
    if (!dailyAdGacha) return null;
    return featuredAdGachaDisplayName(dailyAdGacha.featuredGachaKey);
  }, [dailyAdGacha]);

  async function executeRoll(gachaKey: GachaBanner['key'], adFreeRoll: boolean) {
    if (isRollingRef.current) return;
    if (phase !== 'idle' && phase !== 'done') return;
    isRollingRef.current = true;
    setSelectedKey(gachaKey);
    setNoticeMessage(null);
    setLastResult(null);
    pendingResultRef.current = null;
    setPhase(adFreeRoll ? 'video' : 'rolling');
    try {
      const rollCode = resolveGachaRollCode(gachaKey, banners);
      if (rollCode == null) {
        setNoticeMessage(
          banners.length === 0
            ? 'ガチャは現在公開されていません。しばらくしてからお試しください'
            : 'このガチャは現在利用できません（サーバーに未登録の可能性があります）',
        );
        setPhase('idle');
        return;
      }
      const result = await rollUseCase.execute({
        gachaId: rollCode,
        gachaBallColorIndex: gachaBallColorIndexForCurrentPeriod(),
        adFreeRoll,
      });
      pendingResultRef.current = result;
      setLastResult(result);
      setPawnCurrency(result.pawnCurrency);
      setGoldCurrency(result.goldCurrency);
      if (adFreeRoll) {
        setDailyAdGacha((current) => (current ? { ...current, used: true } : current));
      } else {
        setPhase('video');
      }
    } catch (error: unknown) {
      if (error instanceof ApiClientError && error.code === 'INSUFFICIENT_CURRENCY') {
        setNoticeMessage('通貨が足りません');
        setPhase('idle');
        return;
      }
      if (error instanceof ApiClientError && error.code === 'AD_GACHA_UNAVAILABLE') {
        setNoticeMessage(error.message || '本日の広告無償ガチャは利用できません');
        setPhase('idle');
        return;
      }
      if (error instanceof ApiClientError && error.code === 'NOT_FOUND') {
        setNoticeMessage('このガチャは現在利用できません');
        setPhase('idle');
        return;
      }
      console.error('[gacha-room] failed to roll gacha', error);
      setNoticeMessage('ガチャの実行に失敗しました。しばらくしてからお試しください');
      setPhase('idle');
    } finally {
      isRollingRef.current = false;
    }
  }

  async function roll(gachaKey?: GachaBanner['key']) {
    await executeRoll(gachaKey ?? selectedKey, false);
  }

  async function rollWithAd(gachaKey?: GachaBanner['key']) {
    const targetKey = gachaKey ?? selectedKey;
    if (!canRollWithAd(targetKey)) {
      setNoticeMessage('本日の広告無償ガチャは利用できません');
      return;
    }
    const ad = await showRewardedAd();
    if (!ad.ok) {
      if (!ad.cancelled) {
        setNoticeMessage('広告の視聴に失敗しました');
      }
      return;
    }
    await executeRoll(targetKey, true);
  }

  const onVideoEnd = useCallback(() => {
    const result = pendingResultRef.current;
    if (!result) {
      setPhase('idle');
      return;
    }

    if (result.type === 'hit') {
      setPhase('pieceOverlay');
    } else {
      setPhase('done');
    }
  }, []);

  function onPieceOverlayDismiss() {
    setPhase('done');
  }

  return {
    isLoading,
    loadError,
    reloadLobby,
    selectedKey,
    setSelectedKey,
    banners,
    dailyAdGacha,
    canRollWithAd,
    isFeaturedAdGacha,
    featuredAdGachaLabel,
    pawnCurrency,
    goldCurrency,
    noticeMessage,
    phase,
    lastResult,
    roll,
    rollWithAd,
    onVideoEnd,
    onPieceOverlayDismiss,
  };
}
