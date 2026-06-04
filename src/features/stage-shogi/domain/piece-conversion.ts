/**
 * piece-conversion.ts
 *
 * 依存方向:
 * master.m_piece_mapping (DB) → backend catalog API → frontend PieceCatalogItem → この変換層
 *
 * SFEN/盤面/持ち駒の変換は DB 由来の mapping を唯一の入力とし、標準駒だけの
 * フロントハードコードへ逆流させない。
 */

import { CHAR_TO_CODE } from '@/features/stage-shogi/domain/char-to-piece-code-map';
import type { HandsState } from '@/features/stage-shogi/domain/game-rules';
import type { PieceCatalogItem } from '@/domain/models/piece';

export { CHAR_TO_CODE };

function createEmptyHandsState(): HandsState {
  return { player: {}, enemy: {} };
}

export type PieceSfenMapping = {
  sfenToCode: {
    unpromoted: Readonly<Record<string, string>>;
    promoted: Readonly<Record<string, string>>;
  };
  codeToSfen: Readonly<Record<string, string>>;
  handOrder: readonly string[];
};

const LEGACY_STANDARD_HAND_ORDER = ['HI', 'KA', 'KI', 'GI', 'KE', 'KY', 'FU'];

/**
 * Shogi-AI（`ai.shogi` の `piece_mapping::MAPPINGS`）は盤・手駒とも
 * 1 駒あたり英字 1 文字（成りは `+` + 1 文字）のみ解釈する。
 * DB の `m_piece_mapping.sfen_code` が 2〜3 文字のとき、ここへ寄せないと
 * `rank width mismatch` / `invalid sfen` になる。
 *
 * 鉱物駒4種はアルファベットの空きが足りないため、鉛のみ記号 `!` を使う
 * （Rust 側では非 ASCII 大文字は後手扱いで、フロントも A–Z 以外は敵と揃える）。
 */
const RUST_ENGINE_ONE_CHAR_SFEN: Readonly<Record<string, string>> = {
  FU: 'P',
  KY: 'L',
  KE: 'N',
  GI: 'S',
  KI: 'G',
  KA: 'B',
  HI: 'R',
  OU: 'K',
  TO: 'P',
  NY: 'L',
  NK: 'N',
  NG: 'S',
  UM: 'B',
  RY: 'R',
  RYU: 'F',
  NIN: 'C',
  KAG: 'D',
  HOU: 'E',
  HOO: 'H',
  ENN: 'I',
  FIR: 'J',
  SUI: 'M',
  NAM: 'Q',
  MOK: 'T',
  HAA: 'U',
  HIK: 'V',
  HOS: 'W',
  YAM: 'X',
  MAK: 'Y',
  COPPER: 'A',
  IRON: 'O',
  TIN: 'Z',
  LEAD: '!',
  TREASURE: '$',
  ELECTRIC: '&',
  THUNDER: '(',
  TIME: '#',
  ICE: '@',
  SNOW: '^',
  SAND: '[',
  WIND: '<',
  MOSS: '{',
  FISH: ':',
  CLOUD: '.',
  RAINBOW: '"',
  POISON: '=',
  SWAMP: '|',
  /** 多字 SFEN（ZPH / ZMI と同系）。アルファベット 1 文字は枯渇のため Z 接頭 */
  MOON: 'ZMO',
  BOAT: 'ZBO',
  MACHINE: 'ZMC',
  GEAR: 'ZGR',
  HOUSE: 'ZIE',
  PEOPLE: 'ZMN',
  FIELD: 'ZTA',
  SPRING: 'ZQN',
  TATSU: 'ZTS',
  /** ステージ30（K研究所）— 玉の `K` と衝突しないよう Z 接頭 */
  EXPERIMENT: 'ZJI',
  MUTANT: 'ZIH',
  KBOSS: 'ZKD',
};

/** カタログに行が無い／sfen が未同期でも、エンジン SFEN 1 文字 → pieceCode を復元する */
const CODES_WITH_ENGINE_SFEN_FALLBACK: ReadonlySet<string> = new Set([
  'COPPER',
  'IRON',
  'TIN',
  'LEAD',
  'TREASURE',
  'ELECTRIC',
  'THUNDER',
  'TIME',
  'ICE',
  'SNOW',
  'SAND',
  'WIND',
  'MOSS',
  'FISH',
  'CLOUD',
  'RAINBOW',
  'POISON',
  'SWAMP',
  'MOON',
  'BOAT',
  'MACHINE',
  'GEAR',
  'HOUSE',
  'PEOPLE',
  'FIELD',
  'SPRING',
  'TATSU',
  'EXPERIMENT',
  'MUTANT',
  'KBOSS',
]);

/** `sfenCharToDisplayChar` 用（`a`→`A` と `!` の両方で引けるよう atom をキーにする） */
const ENGINE_SFEN_ATOM_TO_FALLBACK_CODE: Readonly<Record<string, string>> = (() => {
  const rust = RUST_ENGINE_ONE_CHAR_SFEN as Readonly<Record<string, string>>;
  const out: Record<string, string> = {};
  for (const code of CODES_WITH_ENGINE_SFEN_FALLBACK) {
    const atom = rust[code];
    if (atom == null) continue;
    out[atom] = code;
    out[atom.toUpperCase()] = code;
  }
  // 記号 SFEN の先後表現を分けるための別名（enemy 側）。
  out['%'] = 'TREASURE';
  out['?'] = 'LEAD';
  out['*'] = 'ELECTRIC';
  out[')'] = 'THUNDER';
  out['~'] = 'TIME';
  out['`'] = 'ICE';
  out['_'] = 'SNOW';
  out[']'] = 'SAND';
  out['>'] = 'WIND';
  out['}'] = 'MOSS';
  out[';'] = 'FISH';
  out[','] = 'CLOUD';
  out["'"] = 'RAINBOW';
  out['-'] = 'POISON';
  out['\\'] = 'SWAMP';
  return out;
})();

/**
 * 表示駒字（幻・霧・月・舟・実・異・英字 K など）の canonical pieceCode と `char-to-piece-code-map.ts` の CHAR_TO_CODE を同期すること。
 * opaque な `pieceId` 行だけがカタログにあるとき、SFEN 逆引きが opaque のままだと
 * `toSfenBoardPure` で atom 解決に失敗して駒が消えるため、ZMO 等のトークンを canonical へ寄せる。
 */
const KANJI_CHAR_ALIAS_TO_CANONICAL_PIECE_CODE: Readonly<Record<string, string>> = {
  幻: 'PHANTOM',
  霧: 'MIST',
  月: 'MOON',
  舟: 'BOAT',
  機: 'MACHINE',
  歯: 'GEAR',
  家: 'HOUSE',
  民: 'PEOPLE',
  畑: 'FIELD',
  実: 'EXPERIMENT',
  異: 'MUTANT',
  /** K博士（ステージ30）。玉 SFEN の `K` と二重定義しないよう canonical は ZKD。 */
  K: 'KBOSS',
};

function aliasSfenTokensToCanonicalPieceCodesForOpaqueRows(
  items: PieceCatalogItem[],
  codeToSfen: Record<string, string>,
  sfenToCodeUnpromoted: Record<string, string>,
): void {
  for (const item of items) {
    if (item.isPromoted) continue;
    const rawPc = item.pieceCode?.toUpperCase();
    if (!rawPc) continue;
    const canonical = KANJI_CHAR_ALIAS_TO_CANONICAL_PIECE_CODE[item.char];
    if (!canonical || canonical.toUpperCase() === rawPc) continue;

    const sfenFromCatalog = codeToSfen[rawPc];
    if (!sfenFromCatalog) continue;

    const canonicalU = canonical.toUpperCase();
    const forcedMulti = RUST_ENGINE_ONE_CHAR_SFEN[canonicalU];
    const wrongSfen = sfenFromCatalog.toUpperCase();
    let effectiveSfen = wrongSfen;
    if (typeof forcedMulti === 'string' && forcedMulti.length > 1) {
      effectiveSfen = forcedMulti.toUpperCase();
      if (wrongSfen !== effectiveSfen && sfenToCodeUnpromoted[wrongSfen] === rawPc) {
        delete sfenToCodeUnpromoted[wrongSfen];
      }
    }

    const atom = resolveRustSfenAtom(rawPc, effectiveSfen);
    if (!atom) continue;

    sfenToCodeUnpromoted[atom.toUpperCase()] = canonicalU;
    sfenToCodeUnpromoted[effectiveSfen] = canonicalU;
    codeToSfen[canonicalU] = effectiveSfen;
  }
}

/** 舟などの誤 sfen で `K` 逆引きを消したあと、玉（OU）の `K` を必ず復元する */
function syncOuKingSfenTokenFromCatalog(
  items: PieceCatalogItem[],
  codeToSfen: Record<string, string>,
  sfenToCodeUnpromoted: Record<string, string>,
): void {
  for (const item of items) {
    if (item.isPromoted) continue;
    if (item.pieceCode?.toUpperCase() !== 'OU') continue;
    const sym = (item.sfenCode ?? 'K').toUpperCase();
    sfenToCodeUnpromoted[sym] = 'OU';
    codeToSfen['OU'] = sym;
    return;
  }
}

/**
 * DB カタログに無い駒でも、Rust エンジンと同じ SFEN 原子の逆引きを載せる。
 * （`sfenCharToDisplayChar` が `null` になり盤から駒が消えるのを防ぐ）
 */
function injectEngineSfenFallbackIntoMapping(
  codeToSfen: Record<string, string>,
  sfenToCodeUnpromoted: Record<string, string>,
): void {
  const rust = RUST_ENGINE_ONE_CHAR_SFEN as Readonly<Record<string, string>>;
  for (const code of CODES_WITH_ENGINE_SFEN_FALLBACK) {
    const atom = rust[code];
    if (atom == null) continue;
    if (sfenToCodeUnpromoted[atom] != null) continue;
    sfenToCodeUnpromoted[atom] = code;
    if (codeToSfen[code] == null) {
      codeToSfen[code] = atom;
    }
  }
}

function resolveRustSfenAtom(
  pieceCodeUpper: string,
  rawFromCatalog: string | undefined,
): string | null {
  const raw = rawFromCatalog ?? '';
  const core = raw.startsWith('+') ? raw.slice(1) : raw;
  if (core.length === 1) {
    return core.toUpperCase();
  }
  const rust = RUST_ENGINE_ONE_CHAR_SFEN[pieceCodeUpper];
  if (rust != null) return rust;
  // DB の拡張トークン（例: ZAA）をそのまま盤面 SFEN に載せる（1 文字ずつ解釈すると駒が消える）
  if (core.length > 1) return core.toUpperCase();
  return null;
}

/** DB の多字 sfen をエンジン用 1 文字へ寄せ、逆引き sfenToCode も整合させる */
function normalizeCatalogSfenToRustAtoms(
  items: PieceCatalogItem[],
  codeToSfen: Record<string, string>,
  sfenToCodeUnpromoted: Record<string, string>,
  _sfenToCodePromoted: Record<string, string>,
): void {
  const rust = RUST_ENGINE_ONE_CHAR_SFEN as Readonly<Record<string, string>>;
  for (const item of items) {
    if (item.isPromoted) continue;
    const pieceCode = item.pieceCode?.toUpperCase();
    if (!pieceCode) continue;
    const engineAtom = rust[pieceCode];
    if (engineAtom == null) continue;

    const current = codeToSfen[pieceCode];
    if (!current) continue;

    const withoutPlus = current.startsWith('+') ? current.slice(1) : current;
    const upperCore = withoutPlus.toUpperCase();
    if (upperCore.length === 1 && upperCore === engineAtom.toUpperCase()) continue;

    delete sfenToCodeUnpromoted[current];
    delete sfenToCodeUnpromoted[current.toUpperCase()];
    delete sfenToCodeUnpromoted[withoutPlus];
    delete sfenToCodeUnpromoted[withoutPlus.toUpperCase()];

    codeToSfen[pieceCode] = engineAtom;
    sfenToCodeUnpromoted[engineAtom] = pieceCode;
  }
}

export function createPieceSfenMapping(items: PieceCatalogItem[]): PieceSfenMapping {
  const sfenToCodeUnpromoted: Record<string, string> = {};
  const sfenToCodePromoted: Record<string, string> = {};
  const codeToSfen: Record<string, string> = {};

  for (const item of items) {
    const pieceCode = item.pieceCode?.toUpperCase();
    const sfenCode = item.sfenCode?.toUpperCase();
    if (!pieceCode || !sfenCode) continue;

    codeToSfen[pieceCode] = sfenCode;
    if (item.isPromoted) {
      sfenToCodePromoted[sfenCode] = pieceCode;
    } else {
      sfenToCodeUnpromoted[sfenCode] = pieceCode;
    }
  }

  normalizeCatalogSfenToRustAtoms(items, codeToSfen, sfenToCodeUnpromoted, sfenToCodePromoted);
  injectEngineSfenFallbackIntoMapping(codeToSfen, sfenToCodeUnpromoted);
  aliasSfenTokensToCanonicalPieceCodesForOpaqueRows(items, codeToSfen, sfenToCodeUnpromoted);
  syncOuKingSfenTokenFromCatalog(items, codeToSfen, sfenToCodeUnpromoted);

  if (!codeToSfen.HOLY_SWORD) {
    const fromKen = items.find((i) => {
      try {
        return (i.char ?? '').normalize('NFKC') === '剣';
      } catch {
        return i.char === '剣';
      }
    });
    const peer =
      (fromKen?.pieceCode && codeToSfen[fromKen.pieceCode.toUpperCase()]) ?? codeToSfen.SWORD;
    if (peer) {
      codeToSfen.HOLY_SWORD = peer;
    }
  }

  /** 名刀と同一 SFEN だと parse / merge で手駒が SWORD（刀）に潰れるため聖剣は別トークンにする。 */
  const holySfenToken = 'ZHK';
  if (codeToSfen.HOLY_SWORD) {
    const swordTok = (codeToSfen.SWORD ?? '').replace(/^\+/, '').toUpperCase();
    const holyTok = codeToSfen.HOLY_SWORD.replace(/^\+/, '').toUpperCase();
    if (!swordTok || holyTok === swordTok) {
      codeToSfen.HOLY_SWORD = holySfenToken;
      sfenToCodeUnpromoted[holySfenToken] = 'HOLY_SWORD';
    }
  }

  const customHandCodes = Object.entries(codeToSfen)
    .filter(([code]) => !LEGACY_STANDARD_HAND_ORDER.includes(code))
    .sort((lhs, rhs) => codeToSfen[lhs[0]].localeCompare(codeToSfen[rhs[0]]))
    .map(([code]) => code);

  return {
    sfenToCode: {
      unpromoted: sfenToCodeUnpromoted,
      promoted: sfenToCodePromoted,
    },
    codeToSfen,
    handOrder: [...LEGACY_STANDARD_HAND_ORDER, ...customHandCodes],
  };
}

/**
 * SFEN の1文字と成りフラグから game-logic で使う displayChar を返す。
 * 未登録の場合は null。
 */
export function sfenCharToDisplayChar(
  ch: string,
  isPromoted: boolean,
  mapping: PieceSfenMapping,
): string | null {
  const upper = ch.toUpperCase();
  if (isPromoted) {
    // m_piece_mapping では成り駒の sfen_code が "+R" のように先頭 + 付きで登録されることがある。
    return mapping.sfenToCode.promoted[upper] ?? mapping.sfenToCode.promoted[`+${upper}`] ?? null;
  }
  return (
    mapping.sfenToCode.unpromoted[upper] ??
    mapping.sfenToCode.unpromoted[ch] ??
    ENGINE_SFEN_ATOM_TO_FALLBACK_CODE[upper] ??
    ENGINE_SFEN_ATOM_TO_FALLBACK_CODE[ch] ??
    null
  );
}

// ── kanji 表示文字マップ ──────────────────────────────────────────────────────

export const CODE_TO_CHAR: Readonly<Record<string, string>> = {
  FU: '歩',
  KY: '香',
  KE: '桂',
  GI: '銀',
  KI: '金',
  KA: '角',
  HI: '飛',
  OU: '王',
  NIN: '忍',
  KAG: '影',
  HOU: '砲',
  /** 小竜。飛の成り表示は `PROMOTED_CODE_TO_CHAR` の HI→「龍」 */
  RYU: '竜',
  HOO: '鳳',
  ENN: '炎',
  FIR: '火',
  SUI: '水',
  NAM: '波',
  MOK: '木',
  HAA: '葉',
  HIK: '光',
  HOS: '星',
  YAM: '闇',
  MAK: '魔',
  COPPER: '銅',
  IRON: '鉄',
  TIN: '錫',
  LEAD: '鉛',
  TREASURE: '宝',
  ELECTRIC: '電',
  THUNDER: '雷',
  TIME: '時',
  ICE: '氷',
  SNOW: '雪',
  SAND: '砂',
  WIND: '風',
  MOSS: '苔',
  FISH: '魚',
  CLOUD: '雲',
  RAINBOW: '虹',
  POISON: '毒',
  SWAMP: '沼',
  PRISON: '牢',
  FENCE: '柵',
  RIDGE: '嶺',
  PEAK: '峰',
  YAMA: '山',
  ROCK: '岩',
  ORE: '鉱',
  GRAVE: '墓',
  SPIRIT: '霊',
  PHANTOM: '幻',
  MIST: '霧',
  MOON: '月',
  BOAT: '舟',
  MACHINE: '機',
  GEAR: '歯',
  HOUSE: '家',
  PEOPLE: '民',
  FIELD: '畑',
  SPRING: '泉',
  TATSU: '辰',
  EXPERIMENT: '実',
  MUTANT: '異',
  KBOSS: 'K',
  BIGNOISE: '轟',
  BULL: '犇',
  RITUAL: '礼',
  SAINT: '聖',
  /** 聖剣「剣」。名刀 SWORD/KATANA とは別手駒キー。 */
  HOLY_SWORD: '剣',
  DISEASE: '病',
  MEDICINE: '薬',
  WATERFALL: '滝',
  HOLE: '穴',
  ABYSS: '淵',
  SATORI: '悟',
  HEART: '心',
  DEPRESSION: '鬱',
  OTSU: '乙',
  ROSE: '薔',
  CHRYSANTHEMUM: '菊',
  CHERRY: '桜',
  CONCAVE: '凹',
  CONVEX: '凸',
  SEAR: '焼',
  SAUTE: '炒',
  STEW: '煮',
  YANG: '陽',
  YIN: '陰',
  COW: '牛',
  PIG: '豚',
  CHICKEN: '鶏',
  SEN: '銭',
  ZAI: '財',
  GIANT: '巨',
  REDONI: '赤鬼',
  BLUEONI: '青鬼',
  BLACKONI: '黒鬼',
};

export const PROMOTED_CODE_TO_CHAR: Readonly<Record<string, string>> = {
  FU: 'と',
  KY: '成香',
  KE: '成桂',
  GI: '成銀',
  KA: '馬',
  HI: '龍',
};

// ── toSfenBoardPure ───────────────────────────────────────────────────────────

const BOARD_SIZE = 9;

type SfenPiece = {
  side: 'player' | 'enemy';
  row: number;
  col: number;
  pieceCode: string | null;
  char: string;
  promoted?: boolean;
};

/**
 * 盤面 placements から SFEN board 部分文字列を生成する純粋関数。
 */
export function toSfenBoardPure(placements: SfenPiece[], mapping: PieceSfenMapping): string {
  const board = Array.from({ length: BOARD_SIZE }, () =>
    Array<string | null>(BOARD_SIZE).fill(null),
  );

  for (const p of placements) {
    if (p.row < 0 || p.row >= BOARD_SIZE || p.col < 0 || p.col >= BOARD_SIZE) continue;
    const code = p.pieceCode ?? CHAR_TO_CODE[p.char];
    if (!code) continue;
    const codeU = code.toUpperCase();
    const atom = resolveRustSfenAtom(codeU, mapping.codeToSfen[codeU]);
    if (!atom) continue;
    const withPromotion = p.promoted ? `+${atom}` : atom;
    if (p.side === 'player') {
      board[p.row][p.col] = withPromotion;
    } else {
      // 記号駒は toLowerCase では先後が表せないため、enemy 専用記号を使う。
      board[p.row][p.col] = withPromotion
        .replaceAll('$', '%')
        .replaceAll('!', '?')
        .replaceAll('&', '*')
        .replaceAll('(', ')')
        .replaceAll('#', '~')
        .replaceAll('@', '`')
        .replaceAll('^', '_')
        .replaceAll('[', ']')
        .replaceAll('<', '>')
        .replaceAll('{', '}')
        .replaceAll(':', ';')
        .replaceAll('.', ',')
        .replaceAll('"', "'")
        .replaceAll('=', '-')
        .replaceAll('|', '\\')
        .toLowerCase();
    }
  }

  return board
    .map((row) => {
      let out = '';
      let empty = 0;
      for (const cell of row) {
        if (!cell) {
          empty += 1;
        } else {
          if (empty > 0) {
            out += String(empty);
            empty = 0;
          }
          out += cell;
        }
      }
      if (empty > 0) out += String(empty);
      return out;
    })
    .join('/');
}

// ── toSfenHandsPure ───────────────────────────────────────────────────────────

/**
 * 持ち駒 HandsState から SFEN hands 部分文字列を生成する純粋関数。
 */
export function toSfenHandsPure(hands: HandsState, mapping: PieceSfenMapping): string {
  const playerByAtom: Record<string, number> = {};
  const enemyByAtom: Record<string, number> = {};

  for (const code of mapping.handOrder) {
    const codeU = code.toUpperCase();
    const atom = resolveRustSfenAtom(codeU, mapping.codeToSfen[codeU]);
    if (!atom) continue;
    const playerCount = hands.player[code] ?? 0;
    const enemyCount = hands.enemy[code] ?? 0;
    if (playerCount > 0) playerByAtom[atom] = (playerByAtom[atom] ?? 0) + playerCount;
    if (enemyCount > 0) enemyByAtom[atom] = (enemyByAtom[atom] ?? 0) + enemyCount;
  }

  const chunks: string[] = [];
  const atomOrder: string[] = [];
  for (const code of mapping.handOrder) {
    const codeU = code.toUpperCase();
    const atom = resolveRustSfenAtom(codeU, mapping.codeToSfen[codeU]);
    if (!atom) continue;
    if (!atomOrder.includes(atom)) atomOrder.push(atom);
  }
  for (const atom of atomOrder) {
    const playerCount = playerByAtom[atom] ?? 0;
    const enemyCount = enemyByAtom[atom] ?? 0;
    if (playerCount > 0) chunks.push(`${playerCount > 1 ? String(playerCount) : ''}${atom}`);
    if (enemyCount > 0) {
      const enemyAtom = atom
        .replaceAll('$', '%')
        .replaceAll('!', '?')
        .replaceAll('&', '*')
        .replaceAll('(', ')')
        .replaceAll('#', '~')
        .replaceAll('@', '`')
        .replaceAll('^', '_')
        .replaceAll('[', ']')
        .replaceAll('<', '>')
        .replaceAll('{', '}')
        .replaceAll(':', ';')
        .replaceAll('.', ',')
        .replaceAll('"', "'")
        .replaceAll('=', '-')
        .replaceAll('|', '\\')
        .toLowerCase();
      chunks.push(`${enemyCount > 1 ? String(enemyCount) : ''}${enemyAtom}`);
    }
  }
  return chunks.length > 0 ? chunks.join('') : '-';
}

// ── parseSfenHandsPart / handsFromCanonicalSfen ───────────────────────────────

function handTokenSideIsPlayer(token: string): boolean {
  let i = 0;
  while (i < token.length && /\d/.test(token[i]!)) i += 1;
  const c = token[i];
  if (c == null) return true;
  if (c === '$' || c === '!') return true;
  if (
    c === '&' ||
    c === '(' ||
    c === '#' ||
    c === '@' ||
    c === '^' ||
    c === '[' ||
    c === '<' ||
    c === '{' ||
    c === ':' ||
    c === '.' ||
    c === '"' ||
    c === '=' ||
    c === '|'
  )
    return true;
  if (
    c === '%' ||
    c === '?' ||
    c === '*' ||
    c === ')' ||
    c === '~' ||
    c === '`' ||
    c === '_' ||
    c === ']' ||
    c === '>' ||
    c === '}' ||
    c === ';' ||
    c === ',' ||
    c === "'" ||
    c === '-' ||
    c === '\\'
  )
    return false;
  if (c >= 'A' && c <= 'Z') return true;
  if (c >= 'a' && c <= 'z') return false;
  return false;
}

type HandsPattern = { code: string; upper: string; len: number };

function toEnemySfenAlias(atom: string): string {
  return atom
    .replaceAll('$', '%')
    .replaceAll('!', '?')
    .replaceAll('&', '*')
    .replaceAll('(', ')')
    .replaceAll('#', '~')
    .replaceAll('@', '`')
    .replaceAll('^', '_')
    .replaceAll('[', ']')
    .replaceAll('<', '>')
    .replaceAll('{', '}')
    .replaceAll(':', ';')
    .replaceAll('.', ',')
    .replaceAll('"', "'");
}

function buildHandsPatterns(mapping: PieceSfenMapping): HandsPattern[] {
  const patterns: HandsPattern[] = [];
  for (const [code, sfen] of Object.entries(mapping.codeToSfen)) {
    if (!sfen) continue;
    const upper = sfen.toUpperCase();
    patterns.push({ code, upper, len: upper.length });
    const enemyUpper = toEnemySfenAlias(upper);
    if (enemyUpper !== upper) {
      patterns.push({ code, upper: enemyUpper, len: enemyUpper.length });
    } else if (upper.length > 1) {
      const lowerAll = upper.toLowerCase();
      if (lowerAll !== upper) {
        patterns.push({ code, upper: lowerAll, len: lowerAll.length });
      }
    }
  }
  for (const [sfenLetter, code] of Object.entries(mapping.sfenToCode.promoted)) {
    const upper = `+${sfenLetter.toUpperCase()}`;
    patterns.push({ code, upper, len: upper.length });
  }
  patterns.sort((a, b) => b.len - a.len || a.upper.localeCompare(b.upper));
  return patterns;
}

/**
 * SFEN の持ち駒部分（例: 2PCe, -）を HandsState に戻す。toSfenHandsPure の逆。
 * USI 慣例どおり、先手側は大文字・後手側は小文字の駒字で区別する。
 */
export function parseSfenHandsPart(handsPart: string, mapping: PieceSfenMapping): HandsState {
  const empty = createEmptyHandsState();
  if (!handsPart || handsPart === '-') return empty;

  const patterns = buildHandsPatterns(mapping);
  const player: Record<string, number> = {};
  const enemy: Record<string, number> = {};

  let i = 0;
  while (i < handsPart.length) {
    let count = 1;
    if (/\d/.test(handsPart[i]!)) {
      let num = '';
      while (i < handsPart.length && /\d/.test(handsPart[i]!)) {
        num += handsPart[i]!;
        i++;
      }
      count = Math.max(1, parseInt(num, 10) || 1);
    }
    if (i >= handsPart.length) break;

    const rest = handsPart.slice(i);
    let matched: { code: string; len: number; isPlayer: boolean } | null = null;
    for (const { code, upper, len } of patterns) {
      if (rest.length < len) continue;
      const slice = rest.slice(0, len);
      if (slice.toUpperCase() !== upper) continue;
      matched = {
        code,
        len,
        isPlayer: handTokenSideIsPlayer(slice),
      };
      break;
    }

    if (!matched) {
      i += 1;
      continue;
    }

    const bag = matched.isPlayer ? player : enemy;
    bag[matched.code] = (bag[matched.code] ?? 0) + count;
    i += matched.len;
  }

  return { player, enemy };
}

/**
 * canonical position の SFEN 第3フィールドを持ち駒の真実とする。パース不能時は null。
 */
export function tryHandsStateFromCanonicalSfen(
  sfen: string,
  mapping: PieceSfenMapping,
): HandsState | null {
  if (!mapping.codeToSfen || Object.keys(mapping.codeToSfen).length === 0) return null;
  const parts = sfen.trim().split(/\s+/);
  const handsPart = parts[2];
  if (handsPart === undefined) return null;
  return parseSfenHandsPart(handsPart, mapping);
}

function totalHandPieceCount(h: HandsState): number {
  let n = 0;
  for (const v of Object.values(h.player)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) n += Math.floor(v);
  }
  for (const v of Object.values(h.enemy)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) n += Math.floor(v);
  }
  return n;
}

/** 持ち駒の「基本 8 種」（stage-shogi の reconcile と揃える） */
const STANDARD_HAND_PIECE_CODES = new Set(['FU', 'KY', 'KE', 'GI', 'KI', 'KA', 'HI', 'OU']);

function normalizedHandBagCounts(bag: Record<string, number>): Map<string, number> {
  const m = new Map<string, number>();
  for (const [k, v] of Object.entries(bag)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const u = k.toUpperCase();
    const n = Math.max(0, Math.floor(v));
    m.set(u, (m.get(u) ?? 0) + n);
  }
  return m;
}

/**
 * 総枚数が一致するとき: 歩香桂銀金角飛玉は JSON（取り駒が先に JSON に載るが SFEN が遅れるのを防ぐ）、
 * それ以外の駒は SFEN（特殊駒の幽霊手持ちの是正）。
 */
function mergeStandardFromJsonExtendedFromSfen(
  jsonHands: HandsState,
  sfenHands: HandsState,
): HandsState {
  const jp = normalizedHandBagCounts(jsonHands.player);
  const je = normalizedHandBagCounts(jsonHands.enemy);
  const sp = normalizedHandBagCounts(sfenHands.player);
  const se = normalizedHandBagCounts(sfenHands.enemy);

  const player: Record<string, number> = {};
  const enemy: Record<string, number> = {};

  const playerCodes = new Set<string>([...jp.keys(), ...sp.keys()]);
  const enemyCodes = new Set<string>([...je.keys(), ...se.keys()]);

  for (const code of playerCodes) {
    if (STANDARD_HAND_PIECE_CODES.has(code)) {
      const c = jp.get(code) ?? 0;
      if (c > 0) player[code] = c;
    } else if (code === 'HOLY_SWORD') {
      const c = jp.get(code) ?? sp.get(code) ?? 0;
      if (c > 0) player[code] = c;
    } else {
      let c = sp.get(code) ?? 0;
      if (
        (code === 'SWORD' || code === 'KATANA') &&
        c > 0 &&
        (jp.get('HOLY_SWORD') ?? 0) > 0 &&
        (jp.get('SWORD') ?? 0) === 0 &&
        (jp.get('KATANA') ?? 0) === 0 &&
        c === (jp.get('HOLY_SWORD') ?? 0)
      ) {
        c = 0;
      }
      if (c > 0) player[code] = c;
    }
  }
  for (const code of enemyCodes) {
    if (STANDARD_HAND_PIECE_CODES.has(code)) {
      const c = je.get(code) ?? 0;
      if (c > 0) enemy[code] = c;
    } else if (code === 'HOLY_SWORD') {
      const c = je.get(code) ?? se.get(code) ?? 0;
      if (c > 0) enemy[code] = c;
    } else {
      let c = se.get(code) ?? 0;
      if (
        (code === 'SWORD' || code === 'KATANA') &&
        c > 0 &&
        (je.get('HOLY_SWORD') ?? 0) > 0 &&
        (je.get('SWORD') ?? 0) === 0 &&
        (je.get('KATANA') ?? 0) === 0 &&
        c === (je.get('HOLY_SWORD') ?? 0)
      ) {
        c = 0;
      }
      if (c > 0) enemy[code] = c;
    }
  }

  return { player, enemy };
}

/**
 * SFEN の持ち駒と API の hands を統合する。
 * - 持ち駒が `-` や空なら JSON のみ。
 * - JSON の総枚数が SFEN より多いときは JSON のみ（SFEN が取り駒より遅れている場合）。
 * - JSON の方が少ないときは SFEN のみ（JSON が未更新のとき）。
 * - 同数のときは標準駒は JSON、拡張駒は SFEN でマージ（幽霊の特殊駒を落としつつ歩などは JSON を信じる）。
 */
export function resolveHandsStateFromCanonicalSfenAndJson(
  sfen: string,
  mapping: PieceSfenMapping,
  jsonHands: HandsState,
): HandsState {
  if (!mapping.codeToSfen || Object.keys(mapping.codeToSfen).length === 0) {
    return jsonHands;
  }
  const parts = sfen.trim().split(/\s+/);
  const handsPart = parts[2];
  if (handsPart === undefined || handsPart === '' || handsPart === '-') {
    return jsonHands;
  }
  const fromSfen = parseSfenHandsPart(handsPart, mapping);
  const tj = totalHandPieceCount(jsonHands);
  const ts = totalHandPieceCount(fromSfen);

  if (ts === 0 && tj > 0) {
    return jsonHands;
  }
  if (tj > ts) {
    return jsonHands;
  }
  if (tj < ts) {
    return fromSfen;
  }
  return mergeStandardFromJsonExtendedFromSfen(jsonHands, fromSfen);
}
