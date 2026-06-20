/**
 * ノーマルダンジョン：ステージ選択のイメージ。
 * `assets/normal-dungeon/stage-previews/{ステージ名}.png` を配置し、下のマップに `require` を追加する。
 * ファイルがないステージはマップに含めない（イメージ非表示）。
 */

const PREVIEW_BY_STAGE_ID: Partial<Record<number, number>> = {
  1: require('../../assets/bundled/0143-normal-dungeon-stage-previews-48300d7d5b.png'),
  2: require('../../assets/bundled/0152-normal-dungeon-stage-previews-29ab84f9fb.png'),
  3: require('../../assets/bundled/0145-normal-dungeon-stage-previews-02bcd5da89.png'),
  4: require('../../assets/bundled/0139-normal-dungeon-stage-previews-4ccd937e33.png'),
  5: require('../../assets/bundled/0163-normal-dungeon-stage-previews-1b290948cf.png'),
  6: require('../../assets/bundled/0159-normal-dungeon-stage-previews-27a3eaa23f.png'),
  7: require('../../assets/bundled/0156-normal-dungeon-stage-previews-1bf9b53e21.png'),
  8: require('../../assets/bundled/0136-normal-dungeon-stage-previews-850c50f82e.png'),
  9: require('../../assets/bundled/0174-normal-dungeon-stage-previews-1882a2bdd1.png'),
  10: require('../../assets/bundled/0140-normal-dungeon-stage-previews-95c19bfc18.png'),
  11: require('../../assets/bundled/0148-normal-dungeon-stage-previews-c906bb81bf.png'),
  12: require('../../assets/bundled/0144-normal-dungeon-stage-previews-94ff67c325.png'),
  13: require('../../assets/bundled/0154-normal-dungeon-stage-previews-ccde46bde9.png'),
  14: require('../../assets/bundled/0160-normal-dungeon-stage-previews-92a40b603c.png'),
  15: require('../../assets/bundled/0164-normal-dungeon-stage-previews-80fdccfa05.png'),
  16: require('../../assets/bundled/0161-normal-dungeon-stage-previews-48fc7b6bdb.png'),
  17: require('../../assets/bundled/0177-normal-dungeon-stage-previews-3d57367345.png'),
  18: require('../../assets/bundled/0158-normal-dungeon-stage-previews-6e1603130e.png'),
  19: require('../../assets/bundled/0172-normal-dungeon-stage-previews-fa66727102.png'),
  20: require('../../assets/bundled/0135-normal-dungeon-stage-previews-36b294a923.png'),
  21: require('../../assets/bundled/0175-normal-dungeon-stage-previews-88bb5d0259.png'),
  22: require('../../assets/bundled/0178-normal-dungeon-stage-previews-8c0dc6be54.png'),
  23: require('../../assets/bundled/0142-normal-dungeon-stage-previews-18043cd4ba.png'),
  24: require('../../assets/bundled/0141-normal-dungeon-stage-previews-ab8057e9b1.png'),
  25: require('../../assets/bundled/0150-normal-dungeon-stage-previews-0bbd44bc7b.png'),
  26: require('../../assets/bundled/0155-normal-dungeon-stage-previews-b9bc744e95.png'),
  27: require('../../assets/bundled/0157-normal-dungeon-stage-previews-e2bc531af9.png'),
  28: require('../../assets/bundled/0167-normal-dungeon-stage-previews-c240bceb5a.png'),
  29: require('../../assets/bundled/0168-normal-dungeon-stage-previews-d69cb9f050.png'),
  30: require('../../assets/bundled/0133-normal-dungeon-stage-previews-3e9efbfbd1.png'),
  31: require('../../assets/bundled/0173-normal-dungeon-stage-previews-25b98addfb.png'),
  32: require('../../assets/bundled/0166-normal-dungeon-stage-previews-d791608d9b.png'),
  34: require('../../assets/bundled/0165-normal-dungeon-stage-previews-ce2ad744f6.png'),
  35: require('../../assets/bundled/0170-normal-dungeon-stage-previews-6a9a2f03dd.png'),
  36: require('../../assets/bundled/0151-normal-dungeon-stage-previews-6d42419289.png'),
  37: require('../../assets/bundled/0171-normal-dungeon-stage-previews-758e6f144d.png'),
  38: require('../../assets/bundled/0147-normal-dungeon-stage-previews-4e0153dbaa.png'),
  39: require('../../assets/bundled/0179-normal-dungeon-stage-previews-656f7d4d44.png'),
  40: require('../../assets/bundled/0137-normal-dungeon-stage-previews-53f4247815.png'),
  41: require('../../assets/bundled/0138-normal-dungeon-stage-previews-5f6e152d6c.png'),
  42: require('../../assets/bundled/0169-normal-dungeon-stage-previews-d6e80be79c.png'),
  44: require('../../assets/bundled/0134-normal-dungeon-stage-previews-824e35703b.png'),
  46: require('../../assets/bundled/0162-normal-dungeon-stage-previews-9f8a5974ac.png'),
  47: require('../../assets/bundled/0146-normal-dungeon-stage-previews-de3855b228.png'),
  48: require('../../assets/bundled/0176-normal-dungeon-stage-previews-79afadf4e4.png'),
  49: require('../../assets/bundled/0153-normal-dungeon-stage-previews-4aaf2db00c.png'),
  50: require('../../assets/bundled/0149-normal-dungeon-stage-previews-12b83f0daa.png'),
};

export function getNormalDungeonStagePreviewSource(stageId: number): number | null {
  const src = PREVIEW_BY_STAGE_ID[stageId];
  return src ?? null;
}

/** プリロード用（バンドルに含まれるプレビュー画像すべて） */
export const normalDungeonStagePreviewPreloadTargets: number[] = Object.values(
  PREVIEW_BY_STAGE_ID,
) as number[];
