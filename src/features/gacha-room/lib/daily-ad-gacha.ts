import { resolveGachaBannerKey } from '@/constants/gacha-room-assets';
import type { DailyAdGachaStatus } from '@/domain/models/gacha';

/** 広告無償ガチャの対象（漢検1級は含まない） */
export const DAILY_AD_GACHA_CODES = ['ukanmuri', 'hihen', 'shinnyo'] as const;

export type DailyAdGachaCode = (typeof DAILY_AD_GACHA_CODES)[number];

export type { DailyAdGachaStatus };

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function jstDayKey(nowMs: number = Date.now()): string {
  const jst = new Date(nowMs + JST_OFFSET_MS);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function hashDayKey(dayKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dayKey.length; i += 1) {
    h ^= dayKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function featuredAdGachaCodeForDay(dayKey: string): DailyAdGachaCode {
  const index = hashDayKey(dayKey) % DAILY_AD_GACHA_CODES.length;
  return DAILY_AD_GACHA_CODES[index]!;
}

export function normalizeAdGachaCode(code: string): DailyAdGachaCode | null {
  const introKey = resolveGachaBannerKey(code.trim());
  const normalized =
    introKey === 'hiHen'
      ? 'hihen'
      : introKey === 'ukanmuri' || introKey === 'shinnyo'
        ? introKey
        : null;
  if (normalized && (DAILY_AD_GACHA_CODES as readonly string[]).includes(normalized)) {
    return normalized;
  }
  const lower = code.trim().toLowerCase();
  if ((DAILY_AD_GACHA_CODES as readonly string[]).includes(lower)) {
    return lower as DailyAdGachaCode;
  }
  return null;
}

export function buildDailyAdGachaStatus(input: {
  dayKey: string;
  usedDayKey: string | null;
  used: boolean;
}): DailyAdGachaStatus {
  const dayKey = input.dayKey;
  const featuredGachaKey = featuredAdGachaCodeForDay(dayKey);
  const used = input.usedDayKey === dayKey && input.used;
  return { dayKey, featuredGachaKey, used };
}

export function canRollGachaWithAd(gachaKey: string, status: DailyAdGachaStatus): boolean {
  if (status.used) return false;
  const code = normalizeAdGachaCode(gachaKey);
  return code != null && code === status.featuredGachaKey;
}

export function isDailyFeaturedAdGachaBanner(
  gachaKey: string,
  status: DailyAdGachaStatus,
): boolean {
  const code = normalizeAdGachaCode(gachaKey);
  return code != null && code === status.featuredGachaKey;
}

export function featuredAdGachaDisplayName(code: string): string {
  const normalized = normalizeAdGachaCode(code);
  if (normalized == null) return code;
  switch (normalized) {
    case 'ukanmuri':
      return 'うかんむりガチャ';
    case 'hihen':
      return 'ひへんガチャ';
    case 'shinnyo':
      return 'しんにょうガチャ';
    default:
      return normalized;
  }
}

/** BFF/DB 未適用で広告ガチャテーブルが無いときの API エラー判定 */
export function isMissingDailyAdGachaTableMessage(message: string): boolean {
  if (!message.includes('player_daily_ad_gacha')) return false;
  return message.includes('schema cache') || message.includes('does not exist');
}
