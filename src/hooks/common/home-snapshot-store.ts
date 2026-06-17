import type { HomeSnapshot } from '@/domain/models/home';
import { isApiDataSource } from '@/lib/config/data-source';
import {
  mergeServerHomeStamina,
  resetClientStaminaStateForAccountChange,
  syncMockStaminaFromSnapshot,
  trySpendNormalStageStamina,
  type ApplyHomeSnapshotStamina,
} from '@/lib/stamina/spend-stage-stamina';
import { DEFAULT_PLAYER_MAX_STAMINA } from '@/lib/stamina/stamina-rules';
import { createLoadHomeSnapshotUseCase } from '@/usecases/home/create-home-usecases';

const emptySnapshot: HomeSnapshot = {
  playerName: '',
  rating: 0,
  pawnCurrency: 0,
  goldCurrency: 0,
  playerRank: 1,
  playerExp: 0,
  stamina: DEFAULT_PLAYER_MAX_STAMINA,
  maxStamina: DEFAULT_PLAYER_MAX_STAMINA,
  nextRecoveryAt: null,
};

type Listener = () => void;
type HomeSnapshotStoreState = {
  snapshot: HomeSnapshot;
  isLoading: boolean;
  error: Error | null;
};

const FRESH_MS = 30_000;
const listeners = new Set<Listener>();
let loadUseCase: ReturnType<typeof createLoadHomeSnapshotUseCase> | null = null;

function getLoadHomeSnapshotUseCase() {
  loadUseCase ??= createLoadHomeSnapshotUseCase();
  return loadUseCase;
}

let snapshot: HomeSnapshot = emptySnapshot;
let lastLoadedAt = 0;
let inFlight: Promise<HomeSnapshot> | null = null;
let error: Error | null = null;
let state: HomeSnapshotStoreState = {
  snapshot,
  isLoading: false,
  error,
};

function syncState() {
  state = {
    snapshot,
    isLoading: inFlight !== null,
    error,
  };
}

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeHomeSnapshot(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getHomeSnapshotState() {
  return state;
}

export function patchHomeSnapshotRating(rating: number): void {
  snapshot = { ...snapshot, rating };
  syncState();
  notify();
}

/** 対人レート反映後にホーム HUD の表示を即時更新し、サーバー snapshot とも同期する。 */
export function syncHomeRatingAfterPvpMatch(rating: number): void {
  patchHomeSnapshotRating(rating);
  void loadHomeSnapshot(true).catch(() => undefined);
}

export function patchHomeSnapshotStamina(next: {
  stamina: number;
  nextRecoveryAt: string | null;
}): void {
  snapshot = { ...snapshot, stamina: next.stamina, nextRecoveryAt: next.nextRecoveryAt };
  syncState();
  notify();
}

export function patchHomeSnapshotCurrency(next: {
  pawnCurrency: number;
  goldCurrency: number;
}): void {
  snapshot = {
    ...snapshot,
    pawnCurrency: next.pawnCurrency,
    goldCurrency: next.goldCurrency,
  };
  syncState();
  notify();
}

export const applyHomeSnapshotStamina: ApplyHomeSnapshotStamina = (next) => {
  patchHomeSnapshotStamina(next);
};

export function spendMockStageStamina() {
  return trySpendNormalStageStamina(applyHomeSnapshotStamina);
}

/** アカウント削除・再サインイン後に前ユーザーの HUD / スタミナ状態を引き継がない。 */
export function resetHomeSnapshotForAccountChange(): void {
  snapshot = { ...emptySnapshot };
  lastLoadedAt = 0;
  inFlight = null;
  error = null;
  resetClientStaminaStateForAccountChange();
  syncState();
  notify();
}

export function loadHomeSnapshot(force = false): Promise<HomeSnapshot> {
  const now = Date.now();
  if (!force && now - lastLoadedAt < FRESH_MS) {
    return Promise.resolve(snapshot);
  }
  if (inFlight) return inFlight;

  inFlight = getLoadHomeSnapshotUseCase()
    .execute()
    .then((next) => {
      snapshot = mergeServerHomeStamina(next);
      lastLoadedAt = Date.now();
      error = null;
      if (!isApiDataSource()) {
        syncMockStaminaFromSnapshot(snapshot.stamina, snapshot.maxStamina);
      }
      return snapshot;
    })
    .catch((caught: unknown) => {
      error = caught instanceof Error ? caught : new Error(String(caught));
      throw error;
    })
    .finally(() => {
      inFlight = null;
      syncState();
      notify();
    });

  syncState();
  notify();
  return inFlight;
}
