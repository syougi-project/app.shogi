import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import {
  getHomeSnapshotState,
  loadHomeSnapshotOnScreenFocus,
  subscribeHomeSnapshot,
} from '@/hooks/common/home-snapshot-store';
import { refreshDisplayedStaminaRecovery } from '@/lib/stamina/refresh-displayed-stamina';

export function useHomeHudSnapshot() {
  const state = useSyncExternalStore(subscribeHomeSnapshot, getHomeSnapshotState);

  useFocusEffect(
    useCallback(() => {
      void loadHomeSnapshotOnScreenFocus();
    }, []),
  );

  useEffect(() => {
    const id = setInterval(refreshDisplayedStaminaRecovery, 1000);
    return () => clearInterval(id);
  }, []);

  return state.snapshot;
}
