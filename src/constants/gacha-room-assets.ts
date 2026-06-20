import type { ImageSourcePropType } from 'react-native';

/** HTML 版 gacha_room と同種の画像・演出動画 */
export const gachaRoomAssets = {
  background: require('../../assets/gacha/background.png'),
  backButton: require('../../assets/bundled/0125-gacha-43132c47da.png'),
  draw1: require('../../assets/gacha/draw-1.png'),
  draw0: require('../../assets/gacha/draw-0.png'),
  drawGold: require('../../assets/gacha/draw-gold.png'),
  /** ガチャ選択画面: うかんむり・ひへん・しんにょうの「ガチャを引く」 */
  drawWalk: require('../../assets/gacha/draw-walk.png'),
  /** 本日の広告無償ガチャ用「ガチャを引く」 */
  drawAdv: require('../../assets/gacha/draw-adv.png'),
  videos: {
    /** 外れ */
    miss: require('../../assets/bundled/0123-gacha-ab229e7b93.mp4'),
    /** 当たり駒 */
    hit: require('../../assets/bundled/0124-gacha-1e2eff38ad.mp4'),
  },
  /**
   * バナー画像は `assets/gacha/` 直下に配置（ASCII ファイル名でバンドル互換性を確保）
   * うかんむり／ひへん／しんにょう／漢検1級の見た目は各 PNG の内容で差し替え
   */
  bannerByKey: {
    ukanmuri: require('../../assets/gacha/banner-ukanmuri.png'),
    hiHen: require('../../assets/gacha/banner-hihen.png'),
    shinnyo: require('../../assets/gacha/banner-shinnyo.png'),
    kanken1: require('../../assets/gacha/banner-kanken1.png'),
  } as Record<string, ImageSourcePropType>,
} as const;

/** API と過去モックの表記ゆれを正規化（UI・モック用） */
const BANNER_KEY_ALIASES: Record<string, string> = {
  hihen: 'hiHen',
};

/** BFF / master.m_gacha.gacha_code（roll API 用） */
const ROLL_CODE_ALIASES: Record<string, string> = {
  hiHen: 'hihen',
};

export function resolveGachaBannerKey(key: string): string {
  return BANNER_KEY_ALIASES[key] ?? key;
}

/** ガチャ抽選 API に送る gacha_code */
export function toGachaRollCode(key: string): string {
  const intro = resolveGachaBannerKey(key);
  return ROLL_CODE_ALIASES[intro] ?? ROLL_CODE_ALIASES[key] ?? key;
}

/**
 * ロビー API が返したバナーの key を優先し、無い場合は API 一覧が空のときだけフォールバック変換。
 * API 一覧があるのに該当ガチャが無いときは null（DB 未登録・非公開）。
 */
export function resolveGachaRollCode(
  displayKey: string,
  apiBanners: readonly { key: string }[],
): string | null {
  const intro = resolveGachaBannerKey(displayKey);
  const fromApi = apiBanners.find((b) => resolveGachaBannerKey(b.key) === intro);
  if (fromApi) return fromApi.key;
  if (apiBanners.length > 0) return null;
  return toGachaRollCode(displayKey);
}

/** バンドル済みバナーがあるか（このキーならリモートURLよりローカルを優先する） */
export function hasBundledGachaBanner(key: string): boolean {
  const k = resolveGachaBannerKey(key);
  return Object.prototype.hasOwnProperty.call(gachaRoomAssets.bannerByKey, k);
}

/**
 * ガチャ一覧・背景用。assets にバナーがある場合は常にバンドル画像を優先する。
 * （API の imageSignedUrl が期限切れ・未設定でもローカル画像が表示される）
 */
export function bannerImageSource(
  key: string,
  imageSignedUrl?: string | null,
): ImageSourcePropType | { uri: string } {
  const resolved = resolveGachaBannerKey(key);
  const local = gachaRoomAssets.bannerByKey[resolved];
  if (local != null) {
    return local;
  }
  if (imageSignedUrl && imageSignedUrl.length > 0) {
    return { uri: imageSignedUrl };
  }
  return gachaRoomAssets.draw1;
}
