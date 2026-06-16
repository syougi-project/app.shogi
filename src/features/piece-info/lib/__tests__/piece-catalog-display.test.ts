import {
  normalizeCatalogSkillText,
  normalizePieceCatalogItemForDisplay,
} from '@/features/piece-info/lib/piece-catalog-display';
import type { PieceCatalogItem } from '@/domain/models/piece';

function catalogItem(overrides: Partial<PieceCatalogItem>): PieceCatalogItem {
  return {
    char: '歩',
    name: '歩兵',
    unlock: '初期',
    desc: '',
    skill: 'なし',
    move: '前方1マス',
    moveVectors: [],
    isRepeatable: false,
    ...overrides,
  };
}

describe('piece-catalog-display', () => {
  it('岩はカタログのスキル文言をそのまま使う', () => {
    const piece = catalogItem({
      char: '岩',
      name: '岩山',
      skill: '移動時左右に岩の障害物を配置する。',
      move: '前後左右に1マスずつ移動できる。',
    });
    expect(normalizeCatalogSkillText(piece)).toBe('移動時左右に岩の障害物を配置する。');
    expect(normalizePieceCatalogItemForDisplay(piece).move).toBe('前後左右に1マスずつ移動できる。');
  });

  it('麒は取られ免疫をスキル欄に、移動のみを移動欄に差し替える', () => {
    const piece = catalogItem({
      char: '麒',
      pieceCode: 'piece_shop_kirin',
      skill: '旧スキル',
      move: '左右前後何マスでも移動 + 斜め1マス。金・銀・歩から取られない。',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.skill).toBe('「金」「銀」「歩」駒から取られない。');
    expect(display.move).toBe('前後左右に何マスでも進める。斜め4方向に1マス進める。');
    expect(display.move).not.toContain('取られない');
  });

  it('種は前斜め4方向の移動説明と銀相当のベクトルに差し替える', () => {
    const piece = catalogItem({
      char: '種',
      pieceCode: 'piece_shop_tane',
      move: '歩と同じ',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.move).toBe('前斜め4方向に1マス移動できる。');
    expect(display.moveVectors).toEqual([
      { dx: -1, dy: -1, maxStep: 1 },
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: 1, dy: -1, maxStep: 1 },
      { dx: -1, dy: 1, maxStep: 1 },
      { dx: 1, dy: 1, maxStep: 1 },
    ]);
  });

  it('Pは同行・同列の移動不能スキル説明に差し替える', () => {
    const piece = catalogItem({
      char: 'P',
      pieceCode: 'piece_shop_p',
      skill: '旧スキル',
    });
    expect(normalizeCatalogSkillText(piece)).toBe(
      'この駒と同じ行または同じ列にいる敵駒を移動不能にする（「王」「巨」は除く）。',
    );
  });

  it('鳴はポン取りのスキル説明に差し替える', () => {
    const piece = catalogItem({
      char: '鳴',
      pieceCode: 'piece_shop_naku',
      skill: '旧スキル',
    });
    expect(normalizeCatalogSkillText(piece)).toBe(
      '敵駒を取ったとき、それと同じ敵駒が盤面にあと2体以上いる場合、合計3体までまとめて取る。',
    );
  });

  it('種は20%で葉召喚のスキル説明に差し替える', () => {
    const piece = catalogItem({
      char: '種',
      pieceCode: 'piece_shop_tane',
      skill: '移動時30%で周囲に「葉」を召喚する。',
    });
    expect(normalizeCatalogSkillText(piece)).toBe(
      '移動時20%の確率で、周囲8マスのランダムな空きマス1マスに「葉」駒を召喚する。',
    );
    expect(normalizePieceCatalogItemForDisplay(piece).skill).toBe(
      '移動時20%の確率で、周囲8マスのランダムな空きマス1マスに「葉」駒を召喚する。',
    );
  });

  it('葉は10%で周囲ランダム1マスに葉召喚のスキル説明に差し替える', () => {
    const piece = catalogItem({
      char: '葉',
      pieceCode: 'HAA',
      skill: '各敵駒ごとに10%の確率で、ランダムな方向に1マス移動させる。',
    });
    expect(normalizeCatalogSkillText(piece)).toBe(
      '移動時10％の確率で周囲のランダム1マスに「葉」駒を召喚する。',
    );
    expect(normalizePieceCatalogItemForDisplay(piece).skill).toBe(
      '移動時10％の確率で周囲のランダム1マスに「葉」駒を召喚する。',
    );
  });

  it('氷は30%凍結のスキル説明に差し替える', () => {
    const piece = catalogItem({
      char: '氷',
      pieceCode: 'ICE',
      skill: '周囲の敵を凍らせ2ターン動けなくする。',
    });
    expect(normalizeCatalogSkillText(piece)).toBe(
      '移動時30%の確率で周囲8マスの敵駒（玉除く）1体を2ターン行動不能にする。',
    );
    expect(normalizePieceCatalogItemForDisplay(piece).skill).toBe(
      '移動時30%の確率で周囲8マスの敵駒（玉除く）1体を2ターン行動不能にする。',
    );
  });

  it('苔は30%召喚のスキル説明に差し替える', () => {
    const piece = catalogItem({
      char: '苔',
      pieceCode: 'MOSS',
      skill: '移動時増殖する。',
    });
    expect(normalizeCatalogSkillText(piece)).toBe(
      '移動時30%の確率で周囲8マスのランダムな空きマス1マスに「苔」駒を1体召喚する。',
    );
    expect(normalizePieceCatalogItemForDisplay(piece).skill).toBe(
      '移動時30%の確率で周囲8マスのランダムな空きマス1マスに「苔」駒を1体召喚する。',
    );
  });

  it('走は前方最大2マスの移動説明に差し替える', () => {
    const piece = catalogItem({
      char: '走',
      pieceCode: 'piece_shop_so',
      move: '縦横1マス',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.move).toBe(
      '前方に最大2マス進める。1マス目に駒がある場合は2マス目には進めない。',
    );
    expect(display.moveVectors).toEqual([
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: 0, dy: -2, maxStep: 1 },
    ]);
  });

  it('艸は移動説明を「前最大2マス左右後ろ1マス」に差し替え、スキル説明をクライアント定義に揃える', () => {
    const piece = catalogItem({
      char: '艸',
      pieceCode: 'piece_gacha_sou',
      skill: '草の力を操り盤面を支配する自然の駒。',
      move: '草原の主の移動ルール',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.skill).toBe(
      '移動時周囲のランダムで最大3マスを×マスにする。この×マスは2ターンで消滅する。',
    );
    expect(display.move).toBe('前最大2マス左右後ろ1マス');
    expect(display.moveVectors).toHaveLength(4);
  });

  it('逃は移動説明を「全方向1マス」に差し替える', () => {
    const piece = catalogItem({
      char: '逃',
      pieceCode: 'piece_gacha_tou2',
      move: '逃亡者の移動ルール',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.move).toBe('全方向1マス');
    expect(display.moveVectors).toHaveLength(8);
  });

  it('進は移動説明を「移動範囲不明」に差し替える', () => {
    const piece = catalogItem({
      char: '進',
      pieceCode: 'piece_gacha_shin',
      move: '毎ターン変化する',
      skill: '1ターンごとに移動範囲が変わる。',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.move).toBe('移動範囲不明');
    expect(display.moveVectors).toEqual([]);
  });

  it('逸は移動説明を「前と斜め4方向1マス」に差し替える', () => {
    const piece = catalogItem({
      char: '逸',
      pieceCode: 'piece_gacha_itsu',
      move: '逸脱の移動ルール',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.move).toBe('前と斜め4方向1マス');
    expect(display.moveVectors).toHaveLength(5);
  });

  it('辺は移動説明を「前と斜め4方向1マス」に差し替える', () => {
    const piece = catalogItem({
      char: '辺',
      pieceCode: 'piece_gacha_hen',
      move: '辺の神の移動ルール',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.move).toBe('前と斜め4方向1マス');
    expect(display.moveVectors).toHaveLength(5);
  });

  it('辺はDBの銀将ベクトル・isRepeatable=trueでも図鑑は前1+斜め4の5マス', () => {
    const piece = catalogItem({
      char: '辺',
      pieceCode: 'piece_gacha_hen',
      moveCode: 'move_gacha_hen',
      isRepeatable: true,
      moveVectors: [
        { dx: -1, dy: -1, maxStep: 1 },
        { dx: 0, dy: -1, maxStep: 1 },
        { dx: 1, dy: -1, maxStep: 1 },
        { dx: -1, dy: 1, maxStep: 1 },
        { dx: 1, dy: 1, maxStep: 1 },
      ],
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.moveVectors).toEqual([
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: -1, dy: -1, maxStep: 1 },
      { dx: 1, dy: -1, maxStep: 1 },
      { dx: -1, dy: 1, maxStep: 1 },
      { dx: 1, dy: 1, maxStep: 1 },
    ]);
    expect(display.isRepeatable).toBe(false);
  });

  it('宋は移動説明を「前後何マスでも+左右1マス」に差し替える', () => {
    const piece = catalogItem({
      char: '宋',
      pieceCode: 'piece_gacha_so',
      move: '宋えるの移動ルール',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.move).toBe('前後何マスでも+左右1マス');
    expect(display.moveVectors).toHaveLength(4);
  });

  it('安は移動説明を「前後左右1マス+桂馬飛び」に差し替える', () => {
    const piece = catalogItem({
      char: '安',
      pieceCode: 'piece_gacha_an',
      move: '安いの移動ルール',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.move).toBe('前後左右1マス+桂馬飛び');
    expect(display.moveVectors).toHaveLength(6);
  });

  it('定は移動説明を「前後左右1マス」に差し替える', () => {
    const piece = catalogItem({
      char: '定',
      pieceCode: 'piece_gacha_sadame',
      move: '固定人の移動ルール',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.move).toBe('前後左右1マス');
    expect(display.moveVectors).toHaveLength(4);
  });

  it('閹は移動説明を「前後左右1マス」に差し替え、スキル説明をクライアント定義に揃える', () => {
    const piece = catalogItem({
      char: '閹',
      pieceCode: 'piece_gacha_en',
      skill: '敵の動きを封じる封印の駒。',
      move: '前後左右に各1マス進める。味方の「王」の前1マスへも移動できる。',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.skill).toBe('味方の「王」駒の前1マスに移動することができる');
    expect(display.move).toBe('前後左右1マス');
    expect(display.moveVectors).toHaveLength(4);
  });

  it('膠は移動説明を「前斜め前斜め後ろ1マス」に差し替える', () => {
    const piece = catalogItem({
      char: '膠',
      pieceCode: 'piece_gacha_kou',
      move: '前斜め左右・後ろに各1マス進める。',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.move).toBe('前斜め前斜め後ろ1マス');
    expect(display.moveVectors).toHaveLength(3);
  });

  it('室は移動説明を「前後左右斜め前1マス」に差し替える', () => {
    const piece = catalogItem({
      char: '室',
      pieceCode: 'piece_gacha_shitsu',
      move: '室主の移動ルール',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.move).toBe('前後左右斜め前1マス');
    expect(display.moveVectors).toHaveLength(6);
  });

  it('煽は移動説明を「前後左右何マスでも」に差し替える', () => {
    const piece = catalogItem({
      char: '煽',
      pieceCode: 'piece_gacha_aori',
      move: '煽り厨の移動ルール',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.move).toBe('前後左右何マスでも');
    expect(display.moveVectors).toHaveLength(4);
  });

  it('爆は移動説明を「前斜め前左右後ろ1マス」に差し替える', () => {
    const piece = catalogItem({
      char: '爆',
      pieceCode: 'piece_gacha_baku',
      move: '爆破魔の移動ルール',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.move).toBe('前斜め前左右後ろ1マス');
    expect(display.moveVectors).toHaveLength(6);
  });

  it('舞は移動制限スキルをスキル欄に、金相当の移動のみを移動欄に差し替える', () => {
    const piece = catalogItem({
      char: '舞',
      pieceCode: 'piece_shop_mai',
      skill: '旧スキル',
      move: '金と同じ移動範囲。周囲8マスの敵駒の移動範囲を斜め前1マスのみに制限する。',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.skill).toBe(
      '移動時、その時点で周囲8マスにいる敵駒の移動範囲を斜め前1マスのみに制限する。',
    );
    expect(display.move).toBe('前・前斜め左右・左右・後に各1マス進める。');
    expect(display.move).not.toContain('制限');
    expect(display.moveVectors).toHaveLength(6);
  });

  it('安はAPIの古いスキル文言よりクライアント定義を優先する', () => {
    const piece = catalogItem({
      char: '安',
      skill: '敵の駒を安くする。',
    });
    expect(normalizeCatalogSkillText(piece)).toBe(
      '移動時10%の確率で、相手の特殊駒を1体「歩」に変える。',
    );
  });

  it('煽はスキルなしの説明に差し替える', () => {
    const piece = catalogItem({
      char: '煽',
      skill: '相手を煽りたい人の為に。',
    });
    expect(normalizeCatalogSkillText(piece)).toBe('スキルなし。');
  });

  it('凹は図鑑用の移動説明に差し替える', () => {
    const piece = catalogItem({
      char: '凹',
      skill: '旧説明',
      move: '旧移動',
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.skill).toBe('なし。');
    expect(display.move).toContain('斜め前・左右・後ろ');
    expect(display.moveVectors.length).toBeGreaterThan(0);
  });

  it('峰は特殊駒無効化のスキル説明に差し替える', () => {
    const piece = catalogItem({
      char: '峰',
      pieceCode: 'PEAK',
      skill: '画数が10画以上の敵駒を無効化する。',
    });
    expect(normalizeCatalogSkillText(piece)).toBe('画数10画以上の敵特殊駒を無効化する。');
  });

  it('山は斜め4方向1マスの移動説明とベクトルに差し替える', () => {
    const piece = catalogItem({
      char: '山',
      pieceCode: 'YAMA',
      move: '前方1マス',
      moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
    });
    const display = normalizePieceCatalogItemForDisplay(piece);
    expect(display.move).toBe('斜め4方向に1マス移動できる。');
    expect(display.moveVectors).toEqual([
      { dx: -1, dy: -1, maxStep: 1 },
      { dx: 1, dy: -1, maxStep: 1 },
      { dx: -1, dy: 1, maxStep: 1 },
      { dx: 1, dy: 1, maxStep: 1 },
    ]);
  });
});
