import type { AiPieceDefinition } from '@/ai/model';

/** 種・鳴（HTML: seedMoves / cryMoves）— 前・前斜め左右・後斜め左右に各1マス。 */
export const TANE_SILVER_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: -1, dy: 1, maxStep: 1 },
  { dx: 1, dy: 1, maxStep: 1 },
];

export const TANE_MOVE_DESCRIPTION_JA = '前斜め4方向に1マス移動できる。';

export const KIRIN_SKILL_DESCRIPTION_JA = '「金」「銀」「歩」駒から取られない。';

export const KIRIN_MOVE_DESCRIPTION_JA = '前後左右に何マスでも進める。斜め4方向に1マス進める。';

/** 麒（HTML: kirinMoves）— 前後左右スライド + 斜め4方向1マス。 */
export const KIRIN_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: 0, maxStep: 9 },
  { dx: 1, dy: 0, maxStep: 9 },
  { dx: 0, dy: -1, maxStep: 9 },
  { dx: 0, dy: 1, maxStep: 9 },
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: -1, dy: 1, maxStep: 1 },
  { dx: 1, dy: 1, maxStep: 1 },
];

export const MAI_SKILL_DESCRIPTION_JA =
  '移動時、その時点で周囲8マスにいる敵駒の移動範囲を斜め前1マスのみに制限する。';

export const MAI_MOVE_DESCRIPTION_JA = '前・前斜め左右・左右・後に各1マス進める。';

/** 室（ガチャ）— 前後左右・前斜めに各1マス（金と同形6方向）。 */
export const SHITSU_MOVE_DESCRIPTION_JA = '前後左右斜め前1マス';

/** 爆（ガチャ）— 前斜め・前・左右・後に各1マス（金と同形6方向）。 */
export const BAKU_MOVE_DESCRIPTION_JA = '前斜め前左右後ろ1マス';
export const BAKU_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: 0, dy: 1, maxStep: 1 },
];

export const SHITSU_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: 0, dy: 1, maxStep: 1 },
];

/** 舞（HTML: danceMoves / goldMoves）— 金と同形6方向1マス。 */
export const MAI_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: 0, dy: 1, maxStep: 1 },
];

export const P_SKILL_DESCRIPTION_JA =
  'この駒と同じ行または同じ列にいる敵駒を移動不能にする（「王」「巨」は除く）。';

export const P_MOVE_DESCRIPTION_JA = '前後左右に各1マス進める。';

/** P（HTML: pMoves）— 縦横1マス。 */
export const P_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 0, dy: 1, maxStep: 1 },
];

/** 定（ガチャ）— 前後左右に各1マス（縦横4方向）。 */
export const SADAME_MOVE_DESCRIPTION_JA = '前後左右1マス';
export const SADAME_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [...P_MOVE_VECTORS];

export const EN_SKILL_DESCRIPTION_JA = '味方の「王」駒の前1マスに移動することができる';

/** 閹（ガチャ）— 前後左右に各1マス（王前1マスは合法手生成で追加）。 */
export const EN_MOVE_DESCRIPTION_JA = '前後左右1マス';

/** 閹（ガチャ）— 縦横1マス + 味方王の前1マス（合法手生成で追加）。 */
export const EN_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [...P_MOVE_VECTORS];

export const AN_MOVE_DESCRIPTION_JA = '前後左右1マス+桂馬飛び';

export const AN_SKILL_DESCRIPTION_JA = '移動時10%の確率で、相手の特殊駒を1体「歩」に変える。';

export const COPPER_MOVE_DESCRIPTION_JA = '桂馬飛び＋前方に何マスでも移動できる。';

/** 銅 — 桂馬飛び + 前方に何マスでも（HTML copperMoves 準拠）。 */
export const COPPER_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -2, maxStep: 1 },
  { dx: 1, dy: -2, maxStep: 1 },
  { dx: 0, dy: -1, maxStep: 8 },
];

export const LEAF_MOVE_DESCRIPTION_JA = '斜めに2マスまで移動できる。';

/** 葉 — 斜め4方向に最大2マス（piece_info / BFF カタログ準拠）。 */
export const LEAF_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 2 },
  { dx: 1, dy: -1, maxStep: 2 },
  { dx: -1, dy: 1, maxStep: 2 },
  { dx: 1, dy: 1, maxStep: 2 },
];

export const WATER_MOVE_DESCRIPTION_JA = '斜めに2マスまで移動できる。';

/** 水 — 斜め4方向に最大2マス（BFF カタログ / piece_info 準拠）。 */
export const WATER_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [...LEAF_MOVE_VECTORS];

export const MIST_MOVE_DESCRIPTION_JA = '斜め1マス＋左右1マスに移動できる。';

/** 霧 — 斜め4方向 + 左右1マス（HTML mistMoves / BFF カタログ準拠）。 */
export const MIST_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: -1, dy: 1, maxStep: 1 },
  { dx: 1, dy: 1, maxStep: 1 },
];

export const FIXED_PIECE_MOVE_DESCRIPTION_JA = '固定駒のため移動できない。';

export const KATANA_MOVE_DESCRIPTION_JA = '前方1マス。';

/** 刀 — 前方1マスのみ（legal-moves / katana パターン準拠）。 */
export const KATANA_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: 0, dy: -1, maxStep: 1 },
];

export const BIRD_MOVE_DESCRIPTION_JA = '前後左右に何マスでも移動できる。';

/** 禽 — 前後左右レイ（legal-moves normalizeVectorsForBird 準拠）。 */
export const BIRD_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: 0, dy: -1, maxStep: 8 },
  { dx: -1, dy: 0, maxStep: 8 },
  { dx: 1, dy: 0, maxStep: 8 },
  { dx: 0, dy: 1, maxStep: 8 },
];

export const CHICKEN_MOVE_DESCRIPTION_JA = '前後左右に桂馬飛びできる。';

/** 鶏 — 8方向桂馬飛び（BFF chicken パターン / HTML chickenMoves 準拠）。 */
export const CHICKEN_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -2, maxStep: 1 },
  { dx: 1, dy: -2, maxStep: 1 },
  { dx: -2, dy: -1, maxStep: 1 },
  { dx: 2, dy: -1, maxStep: 1 },
  { dx: -2, dy: 1, maxStep: 1 },
  { dx: 2, dy: 1, maxStep: 1 },
  { dx: -1, dy: 2, maxStep: 1 },
  { dx: 1, dy: 2, maxStep: 1 },
];

export const WAVE_MOVE_DESCRIPTION_JA = '前後左右に各2マスまで移動できる。';

/** 波（HTML: waveMoves）— 前後左右に各2マスまで。 */
export const WAVE_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: 0, dy: -1, maxStep: 2 },
  { dx: 0, dy: 1, maxStep: 2 },
  { dx: -1, dy: 0, maxStep: 2 },
  { dx: 1, dy: 0, maxStep: 2 },
];

export const PIG_MOVE_DESCRIPTION_JA = '前後左右2マスに移動できる。';

/** 豚（HTML: pigMoves）— 継承前は前後左右に各2マスまで。 */
export const PIG_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: 0, dy: -1, maxStep: 2 },
  { dx: 0, dy: 1, maxStep: 2 },
  { dx: -1, dy: 0, maxStep: 2 },
  { dx: 1, dy: 0, maxStep: 2 },
];

/** 安（ガチャ）— 縦横1マス + 桂馬跳び。 */
export const AN_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  ...P_MOVE_VECTORS,
  { dx: -1, dy: -2, maxStep: 1 },
  { dx: 1, dy: -2, maxStep: 1 },
];

export const PHANTOM_MOVE_DESCRIPTION_JA = '前後左右1マス＋桂馬飛び';

/** 幻（HTML: phantomMoves）— 前後左右1マス + 桂馬飛び。 */
export const PHANTOM_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [...AN_MOVE_VECTORS];

export const PEAK_SKILL_DESCRIPTION_JA = '画数10画以上の敵特殊駒を無効化する。';

export const YAMA_MOVE_DESCRIPTION_JA = '斜め4方向に1マス移動できる。';

/** 山（HTML: mountainMoves）— 斜め4方向に各1マス。 */
export const YAMA_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: -1, dy: 1, maxStep: 1 },
  { dx: 1, dy: 1, maxStep: 1 },
];

export const SO_MOVE_DESCRIPTION_JA = '前後何マスでも+左右1マス';

export const SOU_MOVE_DESCRIPTION_JA = '前最大2マス左右後ろ1マス';

/** 艸（ガチャ）— 前2 + 左右後1。 */
export const SOU_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: 0, dy: -1, maxStep: 2 },
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: 0, dy: 1, maxStep: 1 },
];

export const SOU_SKILL_DESCRIPTION_JA =
  '移動時周囲のランダムで最大3マスを×マスにする。この×マスは2ターンで消滅する。';

export const SAUTE_MOVE_DESCRIPTION_JA = SOU_MOVE_DESCRIPTION_JA;

/** 炒（ステージ46）— 前2 + 左右後1（HTML stirMoves / 艸と同形）。 */
export const SAUTE_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [...SOU_MOVE_VECTORS];

export const SEAR_MOVE_DESCRIPTION_JA = SOU_MOVE_DESCRIPTION_JA;

/** 焼（ステージ46）— 前2 + 左右後1（HTML roastMoves / 炒と同形）。 */
export const SEAR_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [...SOU_MOVE_VECTORS];

export const KOU_SKILL_DESCRIPTION_JA =
  '隣接する味方が横移動したとき、同じ向きに追従する（空マスのみ）。';

/** 辺・逸（ガチャ）— 前1 + 斜め4方向各1マス。 */
export const HEN_ITSU_MOVE_DESCRIPTION_JA = '前と斜め4方向1マス';

export const HEN_ITSU_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: -1, dy: 1, maxStep: 1 },
  { dx: 1, dy: 1, maxStep: 1 },
];

export const HEN_MOVE_DESCRIPTION_JA = HEN_ITSU_MOVE_DESCRIPTION_JA;
export const ITSU_MOVE_DESCRIPTION_JA = HEN_ITSU_MOVE_DESCRIPTION_JA;

export const HEN_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [...HEN_ITSU_MOVE_VECTORS];
export const ITSU_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [...HEN_ITSU_MOVE_VECTORS];

/** 膠（ガチャ）— 前斜め2 + 後1（横移動追従は合法手生成・スキル側）。 */
export const GACHA_FORWARD_DIAG_BACK_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: 0, dy: 1, maxStep: 1 },
];

export const KOU_MOVE_DESCRIPTION_JA = '前斜め前斜め後ろ1マス';
export const KOU_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  ...GACHA_FORWARD_DIAG_BACK_MOVE_VECTORS,
];

export const TOU_MOVE_DESCRIPTION_JA = '前・後・左右・後斜めに各1マス進める。';

/** 灯（ガチャ）— 前後左右1マス + 後斜め2方向（死駒と同形）。 */
export const TOU_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 0, dy: 1, maxStep: 1 },
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: -1, dy: 1, maxStep: 1 },
  { dx: 1, dy: 1, maxStep: 1 },
];

export const NIGE_MOVE_DESCRIPTION_JA = '全方向1マス';

/** 逃（ガチャ）— 王と同形の全方向1マス。 */
export const NIGE_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: -1, dy: 1, maxStep: 1 },
  { dx: 0, dy: 1, maxStep: 1 },
  { dx: 1, dy: 1, maxStep: 1 },
];

export const SHIN_SKILL_DESCRIPTION_JA =
  '毎ターン、盤上にいない駒も含む全駒からランダムに1種を選び、その駒と同じ移動範囲で動く。';

/** 進（ガチャ）— 毎ターン移動範囲が変わるため図鑑では固定表示しない。 */
export const SHIN_MOVE_DESCRIPTION_JA = '移動範囲不明';

export const AORI_MOVE_DESCRIPTION_JA = '前後左右何マスでも';

/** 煽（ガチャ）— 縦横スライド（飛車の縦横のみ）。 */
export const AORI_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: 0, maxStep: 9 },
  { dx: 1, dy: 0, maxStep: 9 },
  { dx: 0, dy: -1, maxStep: 9 },
  { dx: 0, dy: 1, maxStep: 9 },
];

/** 宋（ガチャ）— 前後スライド + 左右1マス。 */
export const SO_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: 0, dy: -1, maxStep: 9 },
  { dx: 0, dy: 1, maxStep: 9 },
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
];

export const NAKU_SKILL_DESCRIPTION_JA =
  '敵駒を取ったとき、それと同じ敵駒が盤面にあと2体以上いる場合、合計3体までまとめて取る。';

export const NAKU_MOVE_DESCRIPTION_JA = '前斜め4方向に1マス移動できる。';

/** 鳴（HTML: cryMoves）— 銀と同形。 */
export const NAKU_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = TANE_SILVER_MOVE_VECTORS;
