import { useCallback, useSyncExternalStore } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { HomeSnapshot } from '@/domain/models/home';
import {
  getHomeSnapshotState,
  loadHomeSnapshotOnScreenFocus,
  subscribeHomeSnapshot,
} from '@/hooks/common/home-snapshot-store';

export type HomeScreenVM = {
  snapshot: HomeSnapshot;
  isLoading: boolean;
};

export function useHomeScreen(): HomeScreenVM {
  const state = useSyncExternalStore(subscribeHomeSnapshot, getHomeSnapshotState);

  useFocusEffect(
    useCallback(() => {
      void loadHomeSnapshotOnScreenFocus();
    }, []),
  );

  return {
    snapshot: state.snapshot,
    isLoading: state.isLoading && state.snapshot.playerName.length === 0,
  };
}
