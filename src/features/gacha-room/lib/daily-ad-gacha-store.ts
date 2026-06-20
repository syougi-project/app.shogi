import * as SecureStore from 'expo-secure-store';

import {
  buildDailyAdGachaStatus,
  jstDayKey,
  type DailyAdGachaStatus,
} from '@/features/gacha-room/lib/daily-ad-gacha';

const STORAGE_KEY = 'gacha_daily_ad_roll_v1';

type StoredDailyAdRoll = {
  dayKey: string;
  used: boolean;
};

let memoryStore: StoredDailyAdRoll | null = null;

async function readStored(): Promise<StoredDailyAdRoll | null> {
  if (memoryStore) return memoryStore;
  try {
    const raw = await SecureStore.getItemAsync(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDailyAdRoll;
    if (typeof parsed.dayKey !== 'string' || typeof parsed.used !== 'boolean') return null;
    memoryStore = parsed;
    return parsed;
  } catch {
    return null;
  }
}

async function writeStored(next: StoredDailyAdRoll): Promise<void> {
  memoryStore = next;
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
}

export async function getDailyAdGachaStatus(
  nowMs: number = Date.now(),
): Promise<DailyAdGachaStatus> {
  const dayKey = jstDayKey(nowMs);
  const stored = await readStored();
  return buildDailyAdGachaStatus({
    dayKey,
    usedDayKey: stored?.dayKey ?? null,
    used: stored?.used === true,
  });
}

export async function markDailyAdGachaUsed(
  nowMs: number = Date.now(),
): Promise<DailyAdGachaStatus> {
  const dayKey = jstDayKey(nowMs);
  await writeStored({ dayKey, used: true });
  return buildDailyAdGachaStatus({
    dayKey,
    usedDayKey: dayKey,
    used: true,
  });
}

/** テスト用 */
export async function resetDailyAdGachaStore(): Promise<void> {
  memoryStore = null;
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}
