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
/** PvP 反映直後は snapshot 再取得で古いレートに戻らないよう一時的に固定する */
let pinnedPvpRating: number | null = null;
let pinnedPvpRatingAt = 0;
const PINNED_PVP_RATING_TTL_MS = 5 * 60 * 1000;
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

function mergePinnedPvpRating(next: HomeSnapshot): HomeSnapshot {
  if (pinnedPvpRating == null) return next;
  if (Date.now() - pinnedPvpRatingAt > PINNED_PVP_RATING_TTL_MS) {
    pinnedPvpRating = null;
    return next;
  }
  if (next.rating === pinnedPvpRating) {
    pinnedPvpRating = null;
    return next;
  }
  return { ...next, rating: pinnedPvpRating };
}

/** 対人レート反映後は snapshot 再読込よりピン値を優先する */
export function pinHomeSnapshotRating(rating: number): void {
  pinnedPvpRating = Math.max(0, Math.floor(rating));
  pinnedPvpRatingAt = Date.now();
  patchHomeSnapshotRating(pinnedPvpRating);
}

/** 対人終了後にサーバー snapshot から最新レートを取得する前に呼ぶ */
export function clearPinnedPvpRatingForSync(): void {
  pinnedPvpRating = null;
  pinnedPvpRatingAt = 0;
}

/** 対人レート反映後にホーム HUD の表示を即時更新する（サーバー再取得はピン解除まで行わない） */
export function syncHomeRatingAfterPvpMatch(rating: number): void {
  pinHomeSnapshotRating(rating);
}

export function patchHomeSnapshotStamina(next: {
  stamina: number;
  nextRecoveryAt: string | null;
}): void {
  snapshot = { ...snapshot, stamina: next.stamina, nextRecoveryAt: next.nextRecoveryAt };
  lastLoadedAt = Date.now();
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
  pinnedPvpRating = null;
  pinnedPvpRatingAt = 0;
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
      snapshot = mergePinnedPvpRating(mergeServerHomeStamina(next));
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
