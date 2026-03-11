import { useEffect, useMemo, useState } from 'react';

import { GachaBanner } from '@/usecases/gacha-room/load-gacha-lobby-usecase';
import {
  createLoadGachaLobbyUseCase,
  createRollGachaUseCase,
} from '@/usecases/gacha-room/create-gacha-room-usecases';
import { RollGachaResult } from '@/usecases/gacha-room/roll-gacha-usecase';

export type GachaPhase = 'idle' | 'video' | 'pieceOverlay' | 'done';

export type GachaRoomVM = {
  isLoading: boolean;
  selectedKey: GachaBanner['key'];
  setSelectedKey: (key: GachaBanner['key']) => void;
  banners: GachaBanner[];
  pawnCurrency: number;
  goldCurrency: number;
  phase: GachaPhase;
  lastResult: RollGachaResult | null;
  roll: () => Promise<void>;
  onVideoEnd: () => void;
  onPieceOverlayDismiss: () => void;
};

export function useGachaRoomScreen(): GachaRoomVM {
  const [isLoading, setIsLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<GachaBanner['key']>('ukanmuri');
  const [banners, setBanners] = useState<GachaBanner[]>([]);
  const [pawnCurrency, setPawnCurrency] = useState(0);
  const [goldCurrency, setGoldCurrency] = useState(0);
  const [phase, setPhase] = useState<GachaPhase>('idle');
  const [lastResult, setLastResult] = useState<RollGachaResult | null>(null);

  const loadUseCase = useMemo(() => createLoadGachaLobbyUseCase(), []);
  const rollUseCase = useMemo(() => createRollGachaUseCase(), []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    loadUseCase
      .execute()
      .then((snapshot) => {
        if (!active) return;
        setBanners(snapshot.banners);
        if (snapshot.banners.length > 0) {
          setSelectedKey(snapshot.banners[0].key);
        }
        setPawnCurrency(snapshot.pawnCurrency);
        setGoldCurrency(snapshot.goldCurrency);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('[gacha-room] failed to load lobby', error);
        setBanners([]);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadUseCase]);

  async function roll() {
    if (phase !== 'idle') return;
    setPhase('video');
    try {
      const result = await rollUseCase.execute({ gachaId: selectedKey });
      setLastResult(result);
      setPawnCurrency(result.pawnCurrency);
      setGoldCurrency(result.goldCurrency);
    } catch (error: unknown) {
      console.error('[gacha-room] failed to roll gacha', error);
      setPhase('idle');
    }
  }

  function onVideoEnd() {
    if (lastResult?.type === 'hit') {
      setPhase('pieceOverlay');
    } else {
      setPhase('done');
    }
  }

  function onPieceOverlayDismiss() {
    setPhase('done');
  }

  return {
    isLoading,
    selectedKey,
    setSelectedKey,
    banners,
    pawnCurrency,
    goldCurrency,
    phase,
    lastResult,
    roll,
    onVideoEnd,
    onPieceOverlayDismiss,
  };
}
