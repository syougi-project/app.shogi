/**
 * オンライン対戦画面で画像を使うのは背景・将棋盤のみ（上部ヘッダーはテキスト／アイコン化して参照負荷を抑える）。
 */
export const onlineBattleHtmlAssets = {
  pageBackground: require('../../assets/bundled/0182-online-battle-5e1406cd34.png'),
  board: require('../../assets/bundled/0185-online-battle-e7deba7e70.png'),
} as const;

export const onlineBattleHtmlPreloadTargets = Object.values(onlineBattleHtmlAssets);
