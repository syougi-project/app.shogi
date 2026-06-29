import { CHAR_TO_CODE } from '@/features/stage-shogi/domain/char-to-piece-code-map';
import type { MoveVector } from '@/domain/models/piece';
import {
  giantAnchorFootprint,
  isGiantPieceCodeUpper,
  isGiantPieceForEngine,
} from '@/ai/engine/giant-piece';

export type Side = 'player' | 'enemy';
export type Hands = Record<string, number>;
export type HandsState = {
  player: Hands;
  enemy: Hands;
};

export type BoardCell = {
  row: number;
  col: number;
};

export type BoardPiece = {
  side: Side;
  row: number;
  col: number;
  pieceCode: string | null;
  char: string;
  promoted?: boolean;
  imageSignedUrl?: string | null;
  /** K 博士: 2 で初回捕獲を耐える。1 のとき 2 回目の捕獲で消える。 */
  kbossLivesRemaining?: number;
  /** 「実」スキルで異化した駒を元に戻すためのスナップショット（未設定なら生来の「異」） */
  mutantRevertPieceCode?: string | null;
  mutantRevertChar?: string;
  mutantRevertPromoted?: boolean;
  mutantRevertImageSignedUrl?: string | null;
  /** 「牛」: 後ろへ1マス動いた回数。前へ進むと0にリセットされ、前進の最大マス数に加算される。 */
  cowChargeCount?: number;
  /** 「豚」: 直近で取った敵駒の手駒正規コード（移動ベクトルの参照用） */
  pigInheritedPieceCode?: string | null;
  pigInheritedChar?: string;
  pigInheritedPromoted?: boolean;
};

const PROMOTABLE_PIECES = new Set(['FU', 'KY', 'KE', 'GI', 'KA', 'HI']);
const KING_CODES = new Set(['OU']);
const PLAYER_LAST_ROW = 0;
const ENEMY_LAST_ROW = 8;

function isInsideBoard(row: number, col: number, boardSize: number) {
  return row >= 0 && row < boardSize && col >= 0 && col < boardSize;
}

function findPieceAt<T extends BoardPiece>(placements: T[], row: number, col: number) {
  const direct = placements.find((piece) => piece.row === row && piece.col === col) ?? null;
  if (direct) return direct;
  return (
    placements.find((piece) => {
      if (!isGiantPieceForEngine(piece)) return false;
      return giantAnchorFootprint(piece.row, piece.col).some((c) => c.row === row && c.col === col);
    }) ?? null
  );
}

function cellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function isGoldPiece(piece: BoardPiece): boolean {
  if (piece.pieceCode?.toUpperCase() === 'KI') return true;
  return piece.char === '金';
}

function isBackwardDiagonalForSide(
  piece: BoardPiece,
  targetRow: number,
  targetCol: number,
): boolean {
  const rowDelta = targetRow - piece.row;
  const colDelta = targetCol - piece.col;
  if (Math.abs(colDelta) !== 1) return false;
  if (piece.side === 'enemy') {
    // enemy の後ろ方向は -row。金は斜め後ろ不可
    return rowDelta < 0;
  }
  // player の後ろ方向は +row。金は斜め後ろ不可
  return rowDelta > 0;
}

export function sameCell(a: BoardCell, b: BoardCell) {
  return a.row === b.row && a.col === b.col;
}

export function createEmptyHandsState(): HandsState {
  return { player: {}, enemy: {} };
}

function normalizePieceCode(pieceCode: string | null) {
  return pieceCode ?? null;
}

export function isPromotablePieceCode(pieceCode: string | null) {
  if (!pieceCode) return false;
  return PROMOTABLE_PIECES.has(pieceCode);
}

export function inPromotionZone(side: Side, row: number, boardSize = 9) {
  const zoneDepth = 3;
  if (side === 'player') return row < zoneDepth;
  return row >= boardSize - zoneDepth;
}

export function canPromoteByMove(piece: BoardPiece, from: BoardCell, to: BoardCell, boardSize = 9) {
  if (piece.promoted) return false;
  if (!isPromotablePieceCode(piece.pieceCode)) return false;
  return (
    inPromotionZone(piece.side, from.row, boardSize) ||
    inPromotionZone(piece.side, to.row, boardSize)
  );
}

export function mustPromoteByMove(piece: BoardPiece, to: BoardCell, boardSize = 9) {
  const code = normalizePieceCode(piece.pieceCode);
  if (!code) return false;
  if (piece.promoted) return false;
  if (code === 'FU' || code === 'KY') {
    return piece.side === 'player' ? to.row === PLAYER_LAST_ROW : to.row === ENEMY_LAST_ROW;
  }
  if (code === 'KE') {
    if (piece.side === 'player') return to.row <= 1;
    return to.row >= boardSize - 2;
  }
  return false;
}

export function getHandCount(hands: HandsState, side: Side, pieceCode: string) {
  const want = pieceCode.toUpperCase();
  let sum = 0;
  for (const [k, v] of Object.entries(hands[side])) {
    if (k.toUpperCase() === want && typeof v === 'number' && Number.isFinite(v)) {
      sum += Math.max(0, Math.floor(v));
    }
  }
  return sum;
}

/** API／SFEN マージで混在しうる駒コードの大文字小文字をまとめる */
export function normalizeHandsStateKeys(hands: HandsState): HandsState {
  function normBag(bag: Record<string, number>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(bag)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      const n = Math.max(0, Math.floor(v));
      if (n <= 0) continue;
      const u = k.toUpperCase();
      out[u] = (out[u] ?? 0) + n;
    }
    return out;
  }
  return { player: normBag(hands.player), enemy: normBag(hands.enemy) };
}

export function addHandPiece(
  hands: HandsState,
  side: Side,
  pieceCode: string,
  delta = 1,
): HandsState {
  const key = pieceCode.toUpperCase();
  const next: HandsState = {
    player: { ...hands.player },
    enemy: { ...hands.enemy },
  };
  const bag = next[side];
  let current = 0;
  const toDelete: string[] = [];
  for (const k of Object.keys(bag)) {
    if (k.toUpperCase() === key) {
      const v = bag[k];
      if (typeof v === 'number' && Number.isFinite(v)) {
        current += Math.max(0, Math.floor(v));
      }
      toDelete.push(k);
    }
  }
  for (const k of toDelete) {
    delete bag[k];
  }
  const updated = current + delta;
  if (updated <= 0) {
    return next;
  }
  bag[key] = updated;
  return next;
}

/** pieceCode が欠けた盤面でも手駒キーに落とせるよう、漢字から canonical を補う（piece-conversion と値を揃える）。 */
const CAPTURE_CHAR_TO_HAND_CODE: Readonly<Record<string, string>> = {
  刀: 'SWORD',
  /** 名刀「刀」の SWORD と手駒表示を分ける（`piece-conversion` の CODE_TO_CHAR と整合）。 */
  剣: 'HOLY_SWORD',
  銃: 'GUN',
  鎧: 'ARMOR',
  盾: 'SHIELD',
  書: 'BOOK',
  書物: 'BOOK',
  封: 'SEAL',
  轟: 'BIGNOISE',
  犇: 'BULL',
  礼: 'RITUAL',
  聖: 'SAINT',
  病: 'DISEASE',
  薬: 'MEDICINE',
  滝: 'WATERFALL',
  穴: 'HOLE',
  淵: 'ABYSS',
  鬼: 'REDONI',
  赤鬼: 'REDONI',
  青鬼: 'BLUEONI',
  黒鬼: 'BLACKONI',
  獣: 'BEAST',
  禽: 'BIRD',
  悟: 'SATORI',
  心: 'HEART',
  鬱: 'DEPRESSION',
  乙: 'OTSU',
  薔: 'ROSE',
  菊: 'CHRYSANTHEMUM',
  桜: 'CHERRY',
  凹: 'CONCAVE',
  凸: 'CONVEX',
  焼: 'SEAR',
  炒: 'SAUTE',
  煮: 'STEW',
  陽: 'YANG',
  陰: 'YIN',
  牛: 'COW',
  豚: 'PIG',
  鶏: 'CHICKEN',
  銭: 'SEN',
  財: 'ZAI',
  巨: 'GIANT',
  /** ガチャ駒（しんにょう・うかんむり等） */
  進: 'GACHA_SHIN',
  逸: 'GACHA_ITSU',
  辺: 'GACHA_HEN',
  定: 'GACHA_SADAME',
  安: 'GACHA_AN',
  宋: 'GACHA_SO',
  爆: 'GACHA_BAKU',
  煽: 'GACHA_AORI',
  灯: 'GACHA_TOU',
  逃: 'GACHA_TOU2',
  艸: 'GACHA_SOU',
  閹: 'GACHA_EN',
  膠: 'GACHA_KOU',
  室: 'GACHA_SHITSU',
  /** ショップ駒（`piece-image-registry` / 合法手エンジンと整合） */
  鳴: 'NAKU',
  走: 'SO',
  種: 'TANE',
  麒: 'KIRIN',
  舞: 'MAI',
  P: 'SHOP_P',
};

const OPAQUE_CAPTURE_CODE_TO_HAND_CODE: Readonly<Record<string, string>> = {
  /** 聖剣「剣」（lib/piece-image-registry の piece_0f14abcc6e5e と一致） */
  PIECE_0F14ABCC6E5E: 'HOLY_SWORD',
  PIECE_5D848242A136: 'BOOK',
  PIECE_7000FED9D9D4: 'SEAL',
  PIECE_D24741D0EF18: 'BIGNOISE',
  PIECE_1275B5728D1C: 'BULL',
  PIECE_4FCDDF14D08D: 'RITUAL',
  PIECE_A3BAB6C13DC7: 'SAINT',
  PIECE_151646512B2F: 'DISEASE',
  PIECE_3E3EF463EADC: 'MEDICINE',
  PIECE_8CC9287B7E93: 'WATERFALL',
  PIECE_E381DFA07A3D: 'HOLE',
  PIECE_31CB39CC0FA8: 'ABYSS',
  PIECE_533B7FEC5456: 'REDONI',
  PIECE_05E4EFB89DAE: 'BEAST',
  PIECE_29ECAB1EF3C3: 'BIRD',
  PIECE_6D4AFA9CDF1C: 'SATORI',
  PIECE_CA16911978FF: 'HEART',
  PIECE_9E27F89F65C5: 'DEPRESSION',
  PIECE_5A07CA59B158: 'OTSU',
  PIECE_A49C1E52B47A: 'ROSE',
  PIECE_8254C41BA326: 'CHRYSANTHEMUM',
  PIECE_124C31EA5D7A: 'CHERRY',
  PIECE_48204DCCFA56: 'CONCAVE',
  PIECE_94B641477E72: 'CONVEX',
  PIECE_FDC83CF95746: 'SEAR',
  PIECE_1732246A37D8: 'SAUTE',
  PIECE_8DE5676A5E92: 'STEW',
  PIECE_313B9456C8AC: 'YANG',
  PIECE_A67CE76969F7: 'YIN',
  PIECE_F75D88C48D6D: 'COW',
  PIECE_3EFA5702E75B: 'PIG',
  PIECE_F1A6EF3B99DF: 'CHICKEN',
  PIECE_EACC7F540399: 'SEN',
  PIECE_7FC715661514: 'ZAI',
  PIECE_C4AEB81F3634: 'GIANT',
};

function opaqueCapturedCodeToHandCode(rawCode: string | null): string | null {
  if (!rawCode) return null;
  const upper = rawCode.toUpperCase();
  if (OPAQUE_CAPTURE_CODE_TO_HAND_CODE[upper]) {
    return OPAQUE_CAPTURE_CODE_TO_HAND_CODE[upper]!;
  }
  // 文字列揺れ（PIECE_SHOGI_*, 余計な接頭辞など）でも「書」ID なら BOOK に寄せる。
  if (upper.includes('5D848242A136')) return 'BOOK';
  if (upper.includes('7000FED9D9D4')) return 'SEAL';
  if (upper.includes('D24741D0EF18')) return 'BIGNOISE';
  if (upper.includes('1275B5728D1C')) return 'BULL';
  if (upper.includes('4FCDDF14D08D')) return 'RITUAL';
  if (upper.includes('A3BAB6C13DC7')) return 'SAINT';
  if (upper.includes('151646512B2F')) return 'DISEASE';
  if (upper.includes('3E3EF463EADC')) return 'MEDICINE';
  if (upper.includes('8CC9287B7E93')) return 'WATERFALL';
  if (upper.includes('E381DFA07A3D')) return 'HOLE';
  if (upper.includes('31CB39CC0FA8')) return 'ABYSS';
  if (upper.includes('533B7FEC5456')) return 'REDONI';
  if (upper.includes('05E4EFB89DAE')) return 'BEAST';
  if (upper.includes('29ECAB1EF3C3')) return 'BIRD';
  if (upper.includes('6D4AFA9CDF1C')) return 'SATORI';
  if (upper.includes('CA16911978FF')) return 'HEART';
  if (upper.includes('9E27F89F65C5')) return 'DEPRESSION';
  if (upper.includes('5A07CA59B158')) return 'OTSU';
  if (upper.includes('A49C1E52B47A')) return 'ROSE';
  if (upper.includes('8254C41BA326')) return 'CHRYSANTHEMUM';
  if (upper.includes('124C31EA5D7A')) return 'CHERRY';
  if (upper.includes('48204DCCFA56')) return 'CONCAVE';
  if (upper.includes('94B641477E72')) return 'CONVEX';
  if (upper.includes('FDC83CF95746')) return 'SEAR';
  if (upper.includes('1732246A37D8')) return 'SAUTE';
  if (upper.includes('8DE5676A5E92')) return 'STEW';
  if (upper.includes('SEAR')) return 'SEAR';
  if (upper.includes('SAUTE')) return 'SAUTE';
  if (upper.includes('STEW')) return 'STEW';
  if (upper.includes('313B9456C8AC')) return 'YANG';
  if (upper.includes('A67CE76969F7')) return 'YIN';
  if (upper.includes('F75D88C48D6D')) return 'COW';
  if (upper.includes('3EFA5702E75B')) return 'PIG';
  if (upper.includes('F1A6EF3B99DF')) return 'CHICKEN';
  if (upper.includes('EACC7F540399')) return 'SEN';
  if (upper.includes('7FC715661514')) return 'ZAI';
  if (upper.includes('YANG')) return 'YANG';
  if (upper.includes('YIN')) return 'YIN';
  if (upper.includes('COW')) return 'COW';
  if (upper.includes('PIG')) return 'PIG';
  if (upper.includes('CHICKEN')) return 'CHICKEN';
  if (upper.includes('SEN')) return 'SEN';
  if (upper.includes('ZAI')) return 'ZAI';
  if (upper.includes('C4AEB81F3634') || upper.includes('GIANT')) return 'GIANT';
  if (upper.includes('BLUEONI')) return 'BLUEONI';
  if (upper.includes('BLACKONI')) return 'BLACKONI';
  if (upper.includes('REDONI')) return 'REDONI';
  if (upper.includes('BOOK')) return 'BOOK';
  if (upper.includes('SEAL')) return 'SEAL';
  if (upper.includes('BIGNOISE')) return 'BIGNOISE';
  if (upper.includes('BULL')) return 'BULL';
  if (upper.includes('RITUAL')) return 'RITUAL';
  if (upper.includes('SAINT')) return 'SAINT';
  if (upper.includes('DISEASE')) return 'DISEASE';
  if (upper.includes('MEDICINE')) return 'MEDICINE';
  if (upper.includes('WATERFALL')) return 'WATERFALL';
  if (upper.includes('HOLE')) return 'HOLE';
  if (upper.includes('ABYSS')) return 'ABYSS';
  if (upper.includes('BEAST')) return 'BEAST';
  if (upper.includes('BIRD')) return 'BIRD';
  if (upper.includes('SATORI')) return 'SATORI';
  if (upper.includes('HEART')) return 'HEART';
  if (upper.includes('DEPRESSION')) return 'DEPRESSION';
  if (upper.includes('OTSU')) return 'OTSU';
  if (upper.includes('ROSE')) return 'ROSE';
  if (upper.includes('CHRYSANTHEMUM')) return 'CHRYSANTHEMUM';
  if (upper.includes('CHERRY')) return 'CHERRY';
  if (upper.includes('CONCAVE')) return 'CONCAVE';
  if (upper.includes('CONVEX')) return 'CONVEX';
  if (upper.includes('0F14ABCC6E5E')) return 'HOLY_SWORD';
  if (upper.includes('NAKU') || upper.includes('SHOP_NAKU') || upper.includes('E9E01AAC8E')) {
    return 'NAKU';
  }
  if (upper.includes('SHOP_SO')) return 'SO';
  if (upper.includes('SHOP_TANE')) return 'TANE';
  if (upper.includes('SHOP_KIRIN')) return 'KIRIN';
  if (upper.includes('SHOP_MAI')) return 'MAI';
  if (upper.includes('SHOP_P')) return 'SHOP_P';
  for (const [char, code] of Object.entries(CAPTURE_CHAR_TO_HAND_CODE)) {
    if (char.length !== 1) continue;
    if (upper.includes(code)) return code;
  }
  return null;
}

function isKingLikePiece(piece: BoardPiece): boolean {
  const code = (piece.pieceCode ?? '').toUpperCase();
  return piece.char === '王' || piece.char === '玉' || code === 'OU';
}

function isSealCode(pieceCode: string): boolean {
  const code = pieceCode.toUpperCase();
  return code === 'SEAL';
}

function hasAdjacentEnemyKing(
  placements: BoardPiece[],
  side: Side,
  row: number,
  col: number,
  boardSize: number,
): boolean {
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (!isInsideBoard(r, c, boardSize)) continue;
      const piece = findPieceAt(placements, r, c);
      if (!piece) continue;
      if (piece.side === side) continue;
      if (isKingLikePiece(piece)) return true;
    }
  }
  return false;
}

export function capturedToHandPieceCode(piece: BoardPiece) {
  const normalizedChar = (() => {
    try {
      return piece.char?.normalize('NFKC') ?? '';
    } catch {
      return piece.char ?? '';
    }
  })();
  if (normalizedChar === '剣') {
    return 'HOLY_SWORD';
  }
  const codeFromChar =
    normalizedChar === '牢'
      ? 'PRISON'
      : normalizedChar === '柵'
        ? 'FENCE'
        : normalizedChar === '岩'
          ? 'ROCK'
          : normalizedChar === '鉱'
            ? 'ORE'
            : normalizedChar === '墓'
              ? 'GRAVE'
              : normalizedChar === '霊'
                ? 'SPIRIT'
                : (CAPTURE_CHAR_TO_HAND_CODE[normalizedChar] ?? null);
  const rawCode = normalizePieceCode(piece.pieceCode);
  const isOpaque = Boolean(rawCode && /^PIECE_[A-Z0-9_]+$/i.test(rawCode));
  const mappedOpaque = opaqueCapturedCodeToHandCode(rawCode);
  const fromStandardChar =
    normalizedChar.length > 0 ? (CHAR_TO_CODE[normalizedChar] ?? null) : null;
  const code = rawCode && !isOpaque ? rawCode : (codeFromChar ?? mappedOpaque ?? fromStandardChar);
  if (!code) return null;
  const upper = code.toUpperCase();
  if (
    normalizedChar === '鬼' ||
    upper === 'REDONI' ||
    upper === 'BLUEONI' ||
    upper === 'BLACKONI'
  ) {
    return null;
  }
  if (KING_CODES.has(code)) return null;
  if ((code === 'SWORD' || code === 'KATANA') && normalizedChar !== '刀') {
    const rawUp = (piece.pieceCode ?? '').toUpperCase();
    if (rawUp.includes('0F14ABCC6E5E')) return 'HOLY_SWORD';
  }
  return code;
}

export function hasUnpromotedPawnInFile(placements: BoardPiece[], side: Side, fileCol: number) {
  return placements.some(
    (piece) =>
      piece.side === side &&
      piece.col === fileCol &&
      piece.pieceCode === 'FU' &&
      piece.promoted !== true,
  );
}

export function isDropDeadEnd(pieceCode: string, side: Side, toRow: number, boardSize = 9) {
  if (pieceCode === 'FU' || pieceCode === 'KY') {
    return side === 'player' ? toRow === PLAYER_LAST_ROW : toRow === ENEMY_LAST_ROW;
  }
  if (pieceCode === 'KE') {
    if (side === 'player') return toRow <= 1;
    return toRow >= boardSize - 2;
  }
  return false;
}

export function canDropPiece(
  placements: BoardPiece[],
  hands: HandsState,
  side: Side,
  pieceCode: string,
  to: BoardCell,
  boardSize = 9,
) {
  if (!isInsideBoard(to.row, to.col, boardSize)) return false;
  if (isGiantPieceCodeUpper(pieceCode)) {
    if (to.row > boardSize - 2 || to.col > boardSize - 2) return false;
    for (const c of giantAnchorFootprint(to.row, to.col, boardSize)) {
      if (findPieceAt(placements, c.row, c.col)) return false;
    }
  } else if (findPieceAt(placements, to.row, to.col)) {
    return false;
  }
  if (getHandCount(hands, side, pieceCode) <= 0) return false;
  if (isDropDeadEnd(pieceCode, side, to.row, boardSize)) return false;
  if (pieceCode === 'FU' && hasUnpromotedPawnInFile(placements, side, to.col)) return false;
  if (isSealCode(pieceCode) && hasAdjacentEnemyKing(placements, side, to.row, to.col, boardSize)) {
    return false;
  }
  return true;
}

export function hasKing(placements: BoardPiece[], side: Side) {
  return placements.some(
    (piece) => piece.side === side && (piece.char === '王' || piece.char === '玉'),
  );
}

export function applyBoardMove<T extends BoardPiece>(
  placements: T[],
  side: Side,
  from: BoardCell,
  to: BoardCell,
  promote = false,
): T[] {
  const captured = findPieceAt(placements, to.row, to.col);
  const next = placements.filter((piece) => {
    if (!captured) return true;
    if (isGiantPieceForEngine(captured)) {
      return !(
        piece.side === captured.side &&
        piece.row === captured.row &&
        piece.col === captured.col &&
        isGiantPieceForEngine(piece)
      );
    }
    return !(piece.row === to.row && piece.col === to.col);
  });
  const movingIndex = next.findIndex(
    (piece) => piece.side === side && piece.row === from.row && piece.col === from.col,
  );
  if (movingIndex < 0) return placements;

  const moving = next[movingIndex];
  const shouldPromote = promote || moving.promoted === true;
  next[movingIndex] = {
    ...moving,
    row: to.row,
    col: to.col,
    promoted: shouldPromote,
  };
  if (captured && KING_CODES.has(captured.pieceCode ?? '')) {
    return next;
  }
  return next;
}

export function applyPlayerMove<T extends BoardPiece>(
  placements: T[],
  from: BoardCell,
  to: BoardCell,
  promote = false,
): T[] {
  return applyBoardMove(placements, 'player', from, to, promote);
}

export function getLegalTargetsFromVectors<T extends BoardPiece>(
  placements: T[],
  piece: T,
  vectors: MoveVector[],
  boardSize = 9,
  options?: {
    canJump?: boolean;
    minStepByVectorKey?: Record<string, number>;
    maxStepByVectorKey?: Record<string, number>;
  },
) {
  const results: BoardCell[] = [];
  const seen = new Set<string>();
  const orient = piece.side === 'player' ? 1 : -1;
  const canJump = options?.canJump === true;
  const minStepByVectorKey = options?.minStepByVectorKey ?? {};
  const maxStepByVectorKey = options?.maxStepByVectorKey ?? {};

  for (const vector of vectors) {
    const vectorKey = `${vector.dx}:${vector.dy}`;
    const maxStep = Math.max(1, vector.maxStep);
    const minStep = Math.max(1, minStepByVectorKey[vectorKey] ?? 1);
    const cappedMaxStep = Math.max(
      minStep,
      Math.min(maxStep, maxStepByVectorKey[vectorKey] ?? maxStep),
    );
    const dx = vector.dx * orient;
    const dy = vector.dy * orient;

    for (let step = 1; step <= cappedMaxStep; step += 1) {
      const targetRow = piece.row + dy * step;
      const targetCol = piece.col + dx * step;
      if (!isInsideBoard(targetRow, targetCol, boardSize)) break;

      const occupied = findPieceAt(placements, targetRow, targetCol);
      if (occupied && isGiantPieceForEngine(occupied)) {
        if (occupied.side === piece.side) {
          if (canJump) continue;
          break;
        }
        // 敵の「巨」は取れず、貫通もしない（味方巨は上でブロック）。
        break;
      }
      if (occupied && occupied.side === piece.side) {
        if (canJump) continue;
        break;
      }

      if (step < minStep) {
        if (occupied && !canJump) break;
        continue;
      }

      // ベクトル定義の取り違えがあっても、金の「斜め後ろ」は必ず禁止する。
      if (isGoldPiece(piece) && isBackwardDiagonalForSide(piece, targetRow, targetCol)) {
        if (occupied && !canJump) break;
        continue;
      }

      const key = cellKey(targetRow, targetCol);
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ row: targetRow, col: targetCol });
      }

      if (occupied && !canJump) break;
    }
  }

  return results;
}
