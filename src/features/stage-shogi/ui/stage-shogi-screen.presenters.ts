import { ApiClientError } from '@/infra/http/api-client';

const LEAF_SKILL_DESCRIPTION = '移動時10％の確率で周囲のランダム1マスに「葉」駒を召喚する。';
const TANE_SKILL_DESCRIPTION =
  '移動時20%の確率で、周囲8マスのランダムな空きマス1マスに「葉」駒を召喚する。';
const KIRIN_SKILL_DESCRIPTION = '「金」「銀」「歩」駒から取られない。';
const KIRIN_MOVE_DESCRIPTION = '前後左右に何マスでも進める。斜め4方向に1マス進める。';
const MAI_SKILL_DESCRIPTION =
  '移動時、その時点で周囲8マスにいる敵駒の移動範囲を斜め前1マスのみに制限する。';
const MAI_MOVE_DESCRIPTION = '前・前斜め左右・左右・後に各1マス進める。';
const ELECTRIC_SKILL_DESCRIPTION =
  '移動時20%の確率で周囲8マスの敵駒（玉除く）を1ターン行動不能にする。';
const ICE_SKILL_DESCRIPTION =
  '移動時30%の確率で周囲8マスの敵駒（玉除く）1体を2ターン行動不能にする。';
const FISH_SKILL_DESCRIPTION = '移動時30%の確率で周囲の敵駒1体を3ターン行動不能にする。';
const MOSS_SKILL_DESCRIPTION =
  '移動時30%の確率で周囲8マスのランダムな空きマス1マスに「苔」駒を1体召喚する。';
const MIST_SKILL_DESCRIPTION = '移動時30%の確率で周囲の敵駒1体を相手の持ち駒に送る。';
const PHANTOM_SKILL_DESCRIPTION =
  '周囲に空きマスがあるとき、敵駒に取られるとき50%の確率で取られるのを回避して空きマスに移動する。';
const BOAT_SKILL_DESCRIPTION =
  '移動時、移動前の真後ろ1マスにいる味方駒（玉除く）を、舟と同じ移動ベクトルで引きずって移動させる。';
const RAINBOW_SKILL_DESCRIPTION =
  '移動時、周囲8マスにいる敵駒の行動範囲を4ターン縦横1マスに制限する。';
const SWAMP_SKILL_DESCRIPTION =
  'この駒の周囲8マスにいる敵駒の移動範囲は上下1マスのみに制限される。';
const POISON_SKILL_DESCRIPTION =
  'この駒が移動したとき移動前のマスは4ターン毒マスになる。毒マスを敵駒が通るとその駒は消滅する。';
const PRISON_FENCE_SKILL_DESCRIPTION =
  '移動時、盤上の敵駒のうちランダムで1体を2ターン行動不能にする。';
const PEAK_SKILL_DESCRIPTION =
  'この駒が盤面にいる間、敵の特殊駒（画数10画以上）のみ移動できなくなる。';
const RIDGE_SKILL_DESCRIPTION = '移動時20%の確率で周囲1マスの空きマスに「山」駒を1体出現させる。';
const ORE_SKILL_DESCRIPTION =
  '移動時20%の確率で味方の「歩」駒1体を「金」「銀」「銅」のいずれかに変化させる。';
const ROCK_SKILL_DESCRIPTION = '移動時に左右1マスへ2ターン持続する岩障害物を召喚する。';
const WATERFALL_SKILL_DESCRIPTION = '移動時20％の確率で周囲の敵駒を全て相手の持ち駒に流す。';
const EXPERIMENT_SKILL_DESCRIPTION =
  '移動後、周囲8マスにいる敵駒（王・玉を除く）を「異」駒に変化させる。';
const MUTANT_SKILL_DESCRIPTION =
  '「実」で異化した駒は、周囲8マスに敵の「実」がいなくなると元の駒に戻る。生来の「異」はこの扱いに含まれない。';
const KBOSS_SKILL_DESCRIPTION =
  '移動・打ちの後40%の確率で周囲8マスの空きマス1つに味方の「実」駒を1体召喚する。2回取られないと消えず、1回目に取られたときは取られる直前の配置に戻り手番が交代する。';
const DEATH_SKILL_DESCRIPTION =
  'この駒を取った敵駒に呪いをかける。呪われた駒は5ターン後に消滅する。';
const SOUL_SKILL_DESCRIPTION = 'この駒が盤面に残っている間、相手は「王」を攻撃できない。';
const BEAST_SKILL_DESCRIPTION = 'この駒の前後左右1マスの敵駒を行動不能にする。';
const BIRD_SKILL_DESCRIPTION = '移動時、ランダムな味方駒を後ろ1マスに運ぶ。';
const SATORI_SKILL_DESCRIPTION = '移動時、敵駒から1つ選択し2ターン行動不能にする。';
const HEART_SKILL_DESCRIPTION = '移動時、味方駒から1つ選択し2ターン無敵状態にする。';
const DEPRESSION_SKILL_DESCRIPTION = '移動後、左右1マスの空きマスを2ターン侵入禁止の×マスにする。';

const CONCAVE_SKILL_INSPECT = 'なし。';

const COOKING_SEAR_SKILL_INSPECT =
  '敵駒を取ったとき、盤上のランダムな空きマスに味方の「炎」駒を1体召喚する。';

const COOKING_STEW_SKILL_INSPECT =
  '敵駒を取ったとき、盤上のランダムな空きマスに味方の「火」駒を1体召喚する。';

const COOKING_SAUTE_SKILL_INSPECT =
  '敵駒を取ったとき、盤上のランダムな空きマスに味方の「炎」駒または「火」駒のどちらかをランダムに1体召喚する。';

const CONCAVE_MOVE_INSPECT =
  '斜め前・左右・後ろ・斜め後の各筋に何マスでも進める（前方への直進は不可）。盤の端マスが空で、その筋の進路上に敵がいないとき、味方駒を飛び越えてその端まで進める（前方への直進の筋を除く）。貫通で端へ入る着手では敵駒を取れない。';

export type InspectingPieceState = {
  char: string;
  pieceCode?: string | null;
  name: string;
  skill: string;
  move: string;
  imageSignedUrl: string | null;
} | null;

export function normalizeSkillName(skill: string | undefined): string | null {
  if (!skill) return null;
  const normalized = skill.trim();
  if (!normalized || normalized === '-' || normalized === 'なし' || normalized === '準備中') {
    return null;
  }
  return normalized;
}

const KATANA_SKILL_INSPECT =
  '前方ちょうど1マスに進んで敵駒を取ったとき、着地点の左右1マスにいる敵駒も同時に取ることができる。';

const GUN_SKILL_INSPECT =
  '前方ちょうど2マス、または斜め後ろ2マスへの移動で、進路上の敵駒を貫いて取る（中間の味方はルールに従い除去される場合がある）。';
const BOOK_SKILL_INSPECT = 'なし';
const SEAL_SKILL_INSPECT = 'この駒の斜め4方向に隣接する敵駒は移動できない。';
const BIGNOISE_SKILL_INSPECT = '轟音で移動時両隣の敵駒を吹き飛ばす。';
const RITUAL_SKILL_INSPECT = '他の味方駒が取られた時に身代わりとなる。';
const SAINT_SKILL_INSPECT = '周囲8マスにいる全ての駒のスキルと移動を無効化する。';
const RED_ONI_SKILL_INSPECT =
  '移動時、左右の敵駒を1マス遠ざける。さらに周囲のランダムな1マスを2ターンのバツマスにする。';
const BLUE_ONI_SKILL_INSPECT = 'この駒の周囲8マスにいる敵駒の移動範囲を前後1マスに制限する。';
const BLACK_ONI_SKILL_INSPECT = '移動時、相手側の盤面3行からランダムな3マスを2ターン毒マスにする。';

function inspectPieceFlagsByCode(pieceCode?: string | null): {
  book: boolean;
  seal: boolean;
  bignoise: boolean;
  ritual: boolean;
  saint: boolean;
  redOni: boolean;
  blueOni: boolean;
  blackOni: boolean;
} {
  const code = (pieceCode ?? '').toUpperCase();
  const lower = (pieceCode ?? '').toLowerCase();
  return {
    book: code === 'BOOK',
    seal: code === 'SEAL',
    bignoise: code === 'BIGNOISE',
    ritual: code === 'RITUAL' || code.includes('4FCDDF14D08D'),
    saint: code === 'SAINT' || code.includes('A3BAB6C13DC7'),
    redOni: code === 'REDONI' || lower === 'redoni' || code.includes('533B7FEC5456'),
    blueOni: code === 'BLUEONI' || lower === 'blueoni',
    blackOni: code === 'BLACKONI' || lower === 'blackoni',
  };
}

export function resolveInspectSkillDescription(
  char: string,
  desc: string | undefined,
  pieceCode?: string | null,
): string {
  const byCode = inspectPieceFlagsByCode(pieceCode);
  if (char === '刀') return KATANA_SKILL_INSPECT;
  if (char === '銃') return GUN_SKILL_INSPECT;
  if (char === '書' || byCode.book) return BOOK_SKILL_INSPECT;
  if (char === '封' || byCode.seal) return SEAL_SKILL_INSPECT;
  if (char === '轟' || byCode.bignoise) return BIGNOISE_SKILL_INSPECT;
  if (char === '礼' || byCode.ritual) return RITUAL_SKILL_INSPECT;
  if (char === '聖' || byCode.saint) return SAINT_SKILL_INSPECT;
  if (char === '赤鬼' || byCode.redOni) return RED_ONI_SKILL_INSPECT;
  if (char === '青鬼' || byCode.blueOni) return BLUE_ONI_SKILL_INSPECT;
  if (char === '黒鬼' || byCode.blackOni) return BLACK_ONI_SKILL_INSPECT;
  if (char === '葉') return LEAF_SKILL_DESCRIPTION;
  if (char === '種') return TANE_SKILL_DESCRIPTION;
  if (char === '麒') return KIRIN_SKILL_DESCRIPTION;
  if (char === '舞') return MAI_SKILL_DESCRIPTION;
  const code = (pieceCode ?? '').toUpperCase();
  if (code.includes('PIECE_SHOP_TANE') || code === 'TANE' || code === 'SHOP_TANE') {
    return TANE_SKILL_DESCRIPTION;
  }
  if (code.includes('PIECE_SHOP_KIRIN') || code === 'KIRIN' || code === 'SHOP_KIRIN') {
    return KIRIN_SKILL_DESCRIPTION;
  }
  if (char === '電') return ELECTRIC_SKILL_DESCRIPTION;
  if (char === '氷') return ICE_SKILL_DESCRIPTION;
  if (char === '魚') return FISH_SKILL_DESCRIPTION;
  if (char === '苔') return MOSS_SKILL_DESCRIPTION;
  if (char === '霧') return MIST_SKILL_DESCRIPTION;
  if (char === '幻') return PHANTOM_SKILL_DESCRIPTION;
  if (char === '舟') return BOAT_SKILL_DESCRIPTION;
  if (char === '虹') return RAINBOW_SKILL_DESCRIPTION;
  if (char === '沼') return SWAMP_SKILL_DESCRIPTION;
  if (char === '毒') return POISON_SKILL_DESCRIPTION;
  if (char === '牢' || char === '柵') return PRISON_FENCE_SKILL_DESCRIPTION;
  if (char === '峰') return PEAK_SKILL_DESCRIPTION;
  if (char === '嶺') return RIDGE_SKILL_DESCRIPTION;
  if (char === '鉱') return ORE_SKILL_DESCRIPTION;
  if (char === '岩') return ROCK_SKILL_DESCRIPTION;
  if (char === '滝') return WATERFALL_SKILL_DESCRIPTION;
  if (char === '実') return EXPERIMENT_SKILL_DESCRIPTION;
  if (char === '異') return MUTANT_SKILL_DESCRIPTION;
  if (char === 'K') return KBOSS_SKILL_DESCRIPTION;
  if (char === '死') return DEATH_SKILL_DESCRIPTION;
  if (char === '魂') return SOUL_SKILL_DESCRIPTION;
  if (char === '獣' || code.includes('BEAST') || code.includes('05E4EFB89DAE')) {
    return BEAST_SKILL_DESCRIPTION;
  }
  if (char === '禽' || code.includes('BIRD') || code.includes('29ECAB1EF3C3')) {
    return BIRD_SKILL_DESCRIPTION;
  }
  if (
    char === '悟' ||
    (pieceCode && pieceCode.toUpperCase().includes('SATORI')) ||
    (pieceCode && pieceCode.toUpperCase().includes('6D4AFA9CDF1C'))
  ) {
    return SATORI_SKILL_DESCRIPTION;
  }
  if (
    char === '心' ||
    (pieceCode && pieceCode.toUpperCase().includes('HEART')) ||
    (pieceCode && pieceCode.toUpperCase().includes('CA16911978FF'))
  ) {
    return HEART_SKILL_DESCRIPTION;
  }
  if (
    char === '鬱' ||
    (pieceCode && pieceCode.toUpperCase().includes('DEPRESSION')) ||
    (pieceCode && pieceCode.toUpperCase().includes('9E27F89F65C5'))
  ) {
    return DEPRESSION_SKILL_DESCRIPTION;
  }
  if (
    char === '凹' ||
    (pieceCode && pieceCode.toUpperCase().includes('CONCAVE')) ||
    (pieceCode && pieceCode.toUpperCase().includes('48204DCCFA56'))
  ) {
    return CONCAVE_SKILL_INSPECT;
  }
  if (
    char === '焼' ||
    (pieceCode && pieceCode.toUpperCase().includes('SEAR')) ||
    (pieceCode && pieceCode.toUpperCase().includes('FDC83CF95746'))
  ) {
    return COOKING_SEAR_SKILL_INSPECT;
  }
  if (
    char === '煮' ||
    (pieceCode && pieceCode.toUpperCase().includes('STEW')) ||
    (pieceCode && pieceCode.toUpperCase().includes('8DE5676A5E92'))
  ) {
    return COOKING_STEW_SKILL_INSPECT;
  }
  if (
    char === '炒' ||
    (pieceCode && pieceCode.toUpperCase().includes('SAUTE')) ||
    (pieceCode && pieceCode.toUpperCase().includes('1732246A37D8'))
  ) {
    return COOKING_SAUTE_SKILL_INSPECT;
  }
  if (char === '山') return '嶺のスキルで召喚される補助駒。';
  if (
    char === '銭' ||
    (pieceCode &&
      (pieceCode.toUpperCase().includes('SEN') || pieceCode.toUpperCase().includes('EACC7F540399')))
  ) {
    return '移動するたびに20％の確率で「金」に、10％の確率で「宝」に変化する。';
  }
  if (
    char === '財' ||
    (pieceCode &&
      (pieceCode.toUpperCase().includes('ZAI') || pieceCode.toUpperCase().includes('7FC715661514')))
  ) {
    return '敵駒を取ったとき、味方の「銭」駒を1体、取った敵駒と同じ駒へ変化させる。';
  }
  if (
    char === '巨' ||
    (pieceCode &&
      (pieceCode.toUpperCase().includes('GIANT') ||
        pieceCode.toUpperCase().includes('C4AEB81F3634')))
  ) {
    return '敵に取られず、あらゆるスキルの特殊効果を受けない。本体が占める4マスには他の駒は入れない。移動先の2×2マス内の敵駒をまとめて取れる。味方駒が1マスでも重なるマスへは進めない。';
  }
  if (
    char === '鶏' ||
    (pieceCode &&
      (pieceCode.toUpperCase().includes('CHICKEN') ||
        pieceCode.toUpperCase().includes('F1A6EF3B99DF')))
  ) {
    return 'なし';
  }
  const normalized = (desc ?? '').trim();
  return normalized.length > 0 ? normalized : '詳細は準備中です。';
}

export function resolveInspectMoveDescription(
  char: string,
  move: string | undefined,
  pieceCode?: string | null,
): string {
  const byCode = inspectPieceFlagsByCode(pieceCode);
  if (char === '麒') return KIRIN_MOVE_DESCRIPTION;
  if (char === '舞') return MAI_MOVE_DESCRIPTION;
  const inspectCode = (pieceCode ?? '').toUpperCase();
  if (
    inspectCode.includes('PIECE_SHOP_KIRIN') ||
    inspectCode === 'KIRIN' ||
    inspectCode === 'SHOP_KIRIN'
  ) {
    return KIRIN_MOVE_DESCRIPTION;
  }
  if (
    inspectCode.includes('PIECE_SHOP_MAI') ||
    inspectCode === 'MAI' ||
    inspectCode === 'SHOP_MAI'
  ) {
    return MAI_MOVE_DESCRIPTION;
  }
  if (char === '刀') return '前方1マス。';
  if (char === '銃') return '前1～2マス、または斜め後ろ2マス。';
  if (
    char === '凹' ||
    (pieceCode && pieceCode.toUpperCase().includes('CONCAVE')) ||
    (pieceCode && pieceCode.toUpperCase().includes('48204DCCFA56'))
  ) {
    return CONCAVE_MOVE_INSPECT;
  }
  if (char === '山' || inspectCode === 'YAMA' || inspectCode.includes('YAMA')) {
    return '斜め4方向に1マス移動できる。';
  }
  if (char === '書' || byCode.book)
    return '1手前に相手が移動させた駒と同じ移動範囲。記録がない場合は前後左右1マス。';
  if (char === '封' || byCode.seal) return '通常移動 + 斜め4方向に移動不能オーラ。';
  if (char === '聖' || byCode.saint) return '全方向に1マス。';
  if (byCode.redOni) return '前後左右に1マス。';
  if (byCode.blueOni) return '全方向に1マス。';
  if (byCode.blackOni) return '前後左右に何マスでも。';
  if (char === '死') return '前後と後ろ斜めに1マス。';
  if (char === '魂') return '前・左・右・後ろ斜めに1マス。';
  if (char === '獣') return '桂馬跳びおよび前後・左右・四斜めへの1マス移動ができる。';
  if (char === '禽') return '前後左右に何マスでも進める。';
  if (
    char === '悟' ||
    (pieceCode && pieceCode.toUpperCase().includes('SATORI')) ||
    (pieceCode && pieceCode.toUpperCase().includes('6D4AFA9CDF1C'))
  ) {
    const normalized = (move ?? '').trim();
    return normalized.length > 0 ? normalized : 'カタログの駒情報に記載された通りに動ける。';
  }
  if (
    char === '心' ||
    (pieceCode && pieceCode.toUpperCase().includes('HEART')) ||
    (pieceCode && pieceCode.toUpperCase().includes('CA16911978FF'))
  ) {
    const normalized = (move ?? '').trim();
    return normalized.length > 0 ? normalized : 'カタログの駒情報に記載された通りに動ける。';
  }
  if (char === '闇') return '全方向に1マス';
  if (char === '月') {
    return 'TURN数を4で割った余りが0または1のときは全方位に1マス、余りが2または3のときは全方位に2マスまで移動できる。';
  }
  if (char === '異') return '移動しない。';
  if (
    char === '銭' ||
    (pieceCode && pieceCode.toUpperCase().includes('SEN')) ||
    (pieceCode && pieceCode.toUpperCase().includes('EACC7F540399'))
  ) {
    const normalized = (move ?? '').trim();
    return normalized.length > 0 ? normalized : 'カタログの駒情報に記載された通りに動ける。';
  }
  if (
    char === '財' ||
    (pieceCode && pieceCode.toUpperCase().includes('ZAI')) ||
    (pieceCode && pieceCode.toUpperCase().includes('7FC715661514'))
  ) {
    const normalized = (move ?? '').trim();
    return normalized.length > 0 ? normalized : 'カタログの駒情報に記載された通りに動ける。';
  }
  if (
    char === '巨' ||
    (pieceCode && pieceCode.toUpperCase().includes('GIANT')) ||
    (pieceCode && pieceCode.toUpperCase().includes('C4AEB81F3634'))
  ) {
    return '本体は盤上でマス2×2を占める。前後左右に最大2マスまで移動できる（左上基準）。';
  }
  const normalized = (move ?? '').trim();
  return normalized.length > 0 ? normalized : '準備中';
}

export function toUserFacingBattleError(error: unknown): string {
  if (error instanceof ApiClientError) {
    const rawApiMessage = error.message ?? '';
    const trimmedApiMessage = rawApiMessage.trim();
    if (trimmedApiMessage.startsWith('{') && trimmedApiMessage.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmedApiMessage) as { code?: string; message?: string };
        if (parsed.code === 'ILLEGAL_MOVE') {
          return '通信中に局面がずれました。合法手を再取得するため、もう一度操作してください。';
        }
        if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
          return parsed.message.trim();
        }
      } catch {
        // no-op
      }
    }
    if (error.status === 502 || error.status === 503 || error.status === 504) {
      return 'サーバーが一時的に混み合っています。少し待ってから再試行してください。';
    }
    if (error.code === 'INVALID_JSON_RESPONSE') {
      return 'サーバー応答の解析に失敗しました。通信環境を確認して再試行してください。';
    }
    return error.message;
  }
  if (error instanceof Error) {
    const raw = error.message ?? '';
    const trimmed = raw.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed) as { code?: string; message?: string };
        if (parsed.code === 'ILLEGAL_MOVE') {
          return '通信中に局面がずれました。合法手を再取得するため、もう一度操作してください。';
        }
        if (typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
          return parsed.message.trim();
        }
      } catch {
        // no-op
      }
    }
    if (/^\s*</.test(raw) || /<!DOCTYPE html>/i.test(raw)) {
      return 'サーバーエラーが発生しました。時間をおいて再試行してください。';
    }
    const compact = raw.replace(/\s+/g, ' ').trim();
    return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
  }
  return String(error);
}

export function isIllegalMoveError(error: unknown): boolean {
  if (error instanceof ApiClientError) {
    if (error.code === 'ILLEGAL_MOVE') return true;
    const raw = (error.message ?? '').trim();
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const parsed = JSON.parse(raw) as { code?: string };
        return parsed.code === 'ILLEGAL_MOVE';
      } catch {
        return false;
      }
    }
    return false;
  }
  if (error instanceof Error) {
    const raw = (error.message ?? '').trim();
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const parsed = JSON.parse(raw) as { code?: string };
        return parsed.code === 'ILLEGAL_MOVE';
      } catch {
        return false;
      }
    }
  }
  return false;
}
