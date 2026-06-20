/** 対局画面用（`assets/stage-shogi/`） */
export const stageShogiBattleAssets = {
  backButton: require('../../assets/bundled/0210-stage-shogi-0204d9fb32.png'),
  victory: require('../../assets/bundled/0209-stage-shogi-d5461312a9.png'),
  /** 盤上の「敗北」用画像（リポジトリでは `敗北.png` ファイル名） */
  defeat: require('../../assets/bundled/0211-stage-shogi-bf22c383ff.png'),
} as const;

export const stageShogiBattleAssetPreloadTargets = [
  stageShogiBattleAssets.backButton,
  stageShogiBattleAssets.victory,
  stageShogiBattleAssets.defeat,
] as const;
