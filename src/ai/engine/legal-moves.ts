import {
  canDropPiece,
  canPromoteByMove,
  capturedToHandPieceCode,
  getLegalTargetsFromVectors,
  mustPromoteByMove,
  type Side,
} from '@/features/stage-shogi/domain/game-rules';
import type {
  AiBattleMove,
  AiHandsState,
  AiBattlePosition,
  AiBoardPiece,
  AiPieceDefinition,
  AiPieceLookups,
} from '@/ai/model';
import {
  buildPieceLookups,
  normalizeBattlePosition,
  piecesFromBoardState,
  sanitizeHandsBag,
  toBasePieceCode,
} from '@/ai/model';
import { CHAR_TO_CODE, CODE_TO_CHAR } from '@/features/stage-shogi/domain/piece-conversion';
import { createMove, diagonalForwardStepCells, resolvePieceDef } from '@/ai/engine/shared';
import {
  giantAnchorFootprint,
  isGiantPieceForEngine,
  isValidGiantAnchor,
} from '@/ai/engine/giant-piece';
import {
  effectivePieceForRulesAfterSpring,
  isUnpromotedSmallDragonPiece,
  RYU_DRAGON_MOVE_VECTORS,
} from '@/ai/engine/spring-ryu-awakening';
import {
  KIRIN_MOVE_VECTORS,
  MAI_MOVE_VECTORS,
  NAKU_MOVE_VECTORS,
  P_MOVE_VECTORS,
  AN_MOVE_VECTORS,
  PHANTOM_MOVE_VECTORS,
  YAMA_MOVE_VECTORS,
  AORI_MOVE_VECTORS,
  HEN_MOVE_VECTORS,
  ITSU_MOVE_VECTORS,
  TOU_MOVE_VECTORS,
  NIGE_MOVE_VECTORS,
  BAKU_MOVE_VECTORS,
  SO_MOVE_VECTORS,
  SOU_MOVE_VECTORS,
  SAUTE_MOVE_VECTORS,
  SEAR_MOVE_VECTORS,
  SADAME_MOVE_VECTORS,
  EN_MOVE_VECTORS,
  KOU_MOVE_VECTORS,
  SHITSU_MOVE_VECTORS,
  TANE_SILVER_MOVE_VECTORS,
  COPPER_MOVE_VECTORS,
  PIG_MOVE_VECTORS,
  SHADOW_MOVE_VECTORS,
  WAVE_MOVE_VECTORS,
} from '@/ai/engine/shop-piece-moves';
import {
  resolveIntrinsicPortedMoveVectors,
  resolveStandardPromotedPieceMoveVectors,
} from '@/ai/engine/ported-app-move-vectors';
import {
  deckBuilderCostForBoardPiece,
  deckBuilderCostForHandPieceCode,
} from '@/ai/engine/piece-deck-cost';
import { arrowSlideDestination } from '@/ai/engine/arrow-tile';
import {
  activeOpponentTurnMaxPieceCostCap,
  createSkillRuntimeView,
  type SkillRuntimeView,
} from '@/ai/engine/skill-runtime';
import { readFollowupCellForSide } from '@/ai/engine/skill-state-selectors';
import {
  ensureShinTurnMimic,
  readShinTurnMimic,
  type ShinTurnMimicEntry,
} from '@/ai/engine/shin-turn-mimic';
import {
  isAnyOniVariantPiece,
  isBeastPiece as isBeastPieceForLegal,
  isBirdPiece as isBirdPieceForLegal,
  isBlackOniPiece,
  isBlueOniPiece,
  isCloudAlliedCaptureForbidden,
  isCloudPiece,
  isConcavePiece as isConcavePieceForLegal,
  isCowPiece,
  isDeathPiece as isDeathPieceForLegal,
  isGunPiece,
  isKatanaPiece,
  isKingPiece,
  isMachinePiece,
  isMirrorPiece,
  isOpaquePieceInstanceId,
  isRedOniPiece,
  isReflectivePiece,
  isKirinCaptureBlocked,
  isKirinPiece,
  isMaiPiece,
  isNakuPiece,
  isRunPiece,
  isAnPiece,
  isPhantomPiece,
  isShadowPiece,
  isYamaPiece,
  isCopperPiece,
  isWavePiece,
  isAoriPiece,
  isBakuPiece,
  isHenPiece,
  isItsuPiece,
  isShinPiece,
  isTouPiece,
  isNigePiece,
  isSoPiece,
  isSouPiece,
  isSautePiece,
  isSearPiece,
  isSadamePiece,
  isEnPiece,
  isKoPiece,
  isShitsuPiece,
  isShopPPiece,
  isTanePiece,
  isSenPiece,
  isSoulPiece as isSoulPieceForLegal,
  isZaiPiece,
  normKanjiForEngineRules,
} from '@/ai/engine/piece-identifiers';

const pieceLookupsCache = new WeakMap<AiPieceDefinition[], AiPieceLookups>();

function getPieceLookups(pieceCatalog: AiPieceDefinition[]): AiPieceLookups {
  const cached = pieceLookupsCache.get(pieceCatalog);
  if (cached) return cached;
  const lookups = buildPieceLookups(pieceCatalog);
  pieceLookupsCache.set(pieceCatalog, lookups);
  return lookups;
}

/** カタログ欠損時でも銃・刀の合法手を生成するためのプレースホルダー */
const MINIMAL_SPECIAL_PIECE_DEF: AiPieceDefinition = {
  char: '',
  name: '',
  unlock: '',
  desc: '',
  skill: '',
  move: '',
  moveVectors: [],
  isRepeatable: false,
};

/** 銭・財でカタログ moveVectors が空のときの救済（金の1マス移動相当）。 */
const SEN_ZAI_FALLBACK_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: 0, dy: 1, maxStep: 1 },
];

function hasSoulOnBoardForSide(pieces: AiBoardPiece[], side: Side): boolean {
  return pieces.some((p) => p.side === side && isSoulPieceForLegal(p));
}

function pieceRawUpperForLegal(piece: AiBoardPiece): string {
  return (piece.pieceCode ?? '').toUpperCase();
}

const CONCAVE_SLIDE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 9 },
  { dx: 1, dy: -1, maxStep: 9 },
  { dx: -1, dy: 0, maxStep: 9 },
  { dx: 1, dy: 0, maxStep: 9 },
  { dx: 0, dy: 1, maxStep: 9 },
  { dx: -1, dy: 1, maxStep: 9 },
  { dx: 1, dy: 1, maxStep: 9 },
];

/** 貫通: 前方直進以外の各筋で、盤の端マスが空きかつ端までの経路上に敵がいないとき、味方を飛び越えて端へ入れる（取りは発生しない）。 */
const CONCAVE_PIERCE_TEMPLATE_DIRS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
  [-1, 1],
  [1, 1],
];

function generateConcaveEdgePierceTargets(
  occupancy: OccupancyMap,
  piece: AiBoardPiece,
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  const orient = piece.side === 'player' ? 1 : -1;
  for (const [tvx, tvy] of CONCAVE_PIERCE_TEMPLATE_DIRS) {
    const dc = tvx * orient;
    const dr = tvy * orient;
    let er = piece.row;
    let ec = piece.col;
    for (;;) {
      const nr = er + dr;
      const nc = ec + dc;
      if (nr < 0 || nr > 8 || nc < 0 || nc > 8) break;
      er = nr;
      ec = nc;
    }
    if (er === piece.row && ec === piece.col) continue;
    if (findPieceAtFast(occupancy, er, ec)) continue;
    let r = piece.row + dr;
    let c = piece.col + dc;
    let ok = true;
    while (true) {
      const occ = findPieceAtFast(occupancy, r, c);
      if (occ && occ.side !== piece.side) {
        ok = false;
        break;
      }
      if (r === er && c === ec) break;
      r += dr;
      c += dc;
    }
    if (ok) {
      out.push({ row: er, col: ec });
    }
  }
  return out;
}

function isSatoriPieceForLegal(piece: AiBoardPiece): boolean {
  if (normKanjiForEngineRules(piece.char) === '悟') return true;
  const raw = pieceRawUpperForLegal(piece);
  if (raw.includes('SATORI')) return true;
  if (raw.includes('6D4AFA9CDF1C')) return true;
  const b = toBasePieceCode(piece.pieceCode);
  return b === 'SATORI';
}

function isHeartPieceForLegal(piece: AiBoardPiece): boolean {
  if (normKanjiForEngineRules(piece.char) === '心') return true;
  const raw = pieceRawUpperForLegal(piece);
  if (raw.includes('HEART')) return true;
  if (raw.includes('CA16911978FF')) return true;
  const b = toBasePieceCode(piece.pieceCode);
  return b === 'HEART';
}

/** 着手後の盤面を仮定して、心スキルで守れる味方駒（王・玉除く）を列挙する。 */
function simulatedPiecesAfterHeartSkillMove(
  pieces: AiBoardPiece[],
  actorSide: Side,
  move: AiBattleMove,
): AiBoardPiece[] {
  if (move.dropPieceCode) {
    const code = toBasePieceCode(move.dropPieceCode);
    if (!code) return pieces;
    const ch = (CODE_TO_CHAR as Readonly<Partial<Record<string, string>>>)[code] ?? '心';
    return [
      ...pieces.map((p) => ({ ...p })),
      {
        side: actorSide,
        row: move.toRow,
        col: move.toCol,
        pieceCode: code,
        char: ch,
        promoted: false,
        imageSignedUrl: null,
      },
    ];
  }
  if (move.fromRow == null || move.fromCol == null) return pieces;
  const fr = move.fromRow;
  const fc = move.fromCol;
  const tr = move.toRow;
  const tc = move.toCol;
  let next = pieces.map((p) => ({ ...p }));
  const dest = next.find((p) => p.row === tr && p.col === tc);
  if (dest && dest.side !== actorSide) {
    next = next.filter((p) => !(p.row === tr && p.col === tc));
  }
  const mi = next.findIndex((p) => p.side === actorSide && p.row === fr && p.col === fc);
  if (mi < 0) return next;
  const mover = next[mi]!;
  next[mi] = { ...mover, row: tr, col: tc };
  return next;
}

function collectHeartProtectAllyTargets(
  pieces: AiBoardPiece[],
  actorSide: Side,
  move: AiBattleMove,
): { row: number; col: number }[] {
  const after = simulatedPiecesAfterHeartSkillMove(pieces, actorSide, move);
  const out: { row: number; col: number }[] = [];
  const seen = new Set<string>();
  for (const p of after) {
    if (p.side !== actorSide) continue;
    if (isKingPiece(p)) continue;
    if (isGiantPieceForEngine(p)) continue;
    const k = `${p.row}:${p.col}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ row: p.row, col: p.col });
  }
  return out;
}

/** 悟のスキル用: 移動着手時点の盤面上で選択可能な敵駒座標（捕獲で消える敵／王・玉は除外）。 */
function collectSatoriEnemyStunTargets(
  pieces: AiBoardPiece[],
  enemySide: Side,
  move: AiBattleMove,
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  let capturedEnemyAtDest = false;
  const destOcc = pieces.find((p) => p.row === move.toRow && p.col === move.toCol);
  if (
    destOcc &&
    destOcc.side === enemySide &&
    move.dropPieceCode == null &&
    move.fromRow != null &&
    move.fromCol != null
  ) {
    capturedEnemyAtDest = true;
  }
  for (const p of pieces) {
    if (p.side !== enemySide) continue;
    if (isKingPiece(p)) continue;
    if (isGiantPieceForEngine(p)) continue;
    if (capturedEnemyAtDest && p.row === move.toRow && p.col === move.toCol) continue;
    out.push({ row: p.row, col: p.col });
  }
  return out;
}

function expandSatoriSkillMovesForLegalListing(
  moves: AiBattleMove[],
  pieces: AiBoardPiece[],
  sideToMove: Side,
): AiBattleMove[] {
  const enemySide: Side = sideToMove === 'player' ? 'enemy' : 'player';
  const out: AiBattleMove[] = [];

  const isEligibleBaseMove = (m: AiBattleMove): boolean => {
    if (m.dropPieceCode) return toBasePieceCode(m.dropPieceCode) === 'SATORI';
    if (m.fromRow == null || m.fromCol == null) return false;
    const acting = pieces.find(
      (p) => p.side === sideToMove && p.row === m.fromRow && p.col === m.fromCol,
    );
    return Boolean(acting && isSatoriPieceForLegal(acting));
  };

  const isSyntheticHandDropNotation = (m: AiBattleMove): boolean =>
    !!m.dropPieceCode && typeof m.notation === 'string' && m.notation.includes('*');

  for (const m of moves) {
    if (m.notation === 'time_skill_only' || m.notation === 'house_skill_only') {
      out.push(m);
      continue;
    }

    const expandThis =
      isEligibleBaseMove(m) &&
      (m.notation == null ||
        /^satori_stun:\d+:\d+$/i.test(m.notation ?? '') ||
        isSyntheticHandDropNotation(m));

    if (!expandThis) {
      out.push(m);
      continue;
    }

    const targets = collectSatoriEnemyStunTargets(pieces, enemySide, m);
    if (targets.length === 0) {
      const nmFallback =
        m.dropPieceCode && isSyntheticHandDropNotation(m)
          ? m.notation
          : m.dropPieceCode
            ? `${toBasePieceCode(m.dropPieceCode) ?? ''}*${m.toRow}${m.toCol}`
            : null;
      out.push({ ...m, notation: nmFallback ?? null });
      continue;
    }
    const seenPairs = new Set<string>();
    for (const t of targets) {
      const key = `${t.row}:${t.col}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      out.push({ ...m, notation: `satori_stun:${t.row}:${t.col}` });
    }
  }

  return out;
}

function expandHeartProtectSkillMovesForLegalListing(
  moves: AiBattleMove[],
  pieces: AiBoardPiece[],
  sideToMove: Side,
): AiBattleMove[] {
  const out: AiBattleMove[] = [];

  const isEligibleBaseMove = (m: AiBattleMove): boolean => {
    if (m.dropPieceCode) return toBasePieceCode(m.dropPieceCode) === 'HEART';
    if (m.fromRow == null || m.fromCol == null) return false;
    const acting = pieces.find(
      (p) => p.side === sideToMove && p.row === m.fromRow && p.col === m.fromCol,
    );
    return Boolean(acting && isHeartPieceForLegal(acting));
  };

  const isSyntheticHandDropNotation = (m: AiBattleMove): boolean =>
    !!m.dropPieceCode && typeof m.notation === 'string' && m.notation.includes('*');

  for (const m of moves) {
    if (m.notation === 'time_skill_only' || m.notation === 'house_skill_only') {
      out.push(m);
      continue;
    }

    const expandThis =
      isEligibleBaseMove(m) &&
      (m.notation == null ||
        /^heart_protect:\d+:\d+$/i.test(m.notation ?? '') ||
        isSyntheticHandDropNotation(m));

    if (!expandThis) {
      out.push(m);
      continue;
    }

    const targets = collectHeartProtectAllyTargets(pieces, sideToMove, m);
    if (targets.length === 0) {
      const nmFallback =
        m.dropPieceCode && isSyntheticHandDropNotation(m)
          ? m.notation
          : m.dropPieceCode
            ? `${toBasePieceCode(m.dropPieceCode) ?? ''}*${m.toRow}${m.toCol}`
            : null;
      out.push({ ...m, notation: nmFallback ?? null });
      continue;
    }
    const seenPairs = new Set<string>();
    for (const t of targets) {
      const key = `${t.row}:${t.col}`;
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      out.push({ ...m, notation: `heart_protect:${t.row}:${t.col}` });
    }
  }

  return out;
}

function gunPieceDebugLog(label: string, payload: Record<string, unknown>): void {
  void label;
  void payload;
}

function isBookPiece(piece: AiBoardPiece): boolean {
  const ch = normKanjiForEngineRules(piece.char);
  if (ch === '書') return true;
  const code = toBasePieceCode(piece.pieceCode);
  return code === 'BOOK';
}

function isPigPiece(piece: AiBoardPiece): boolean {
  if (normKanjiForEngineRules(piece.char) === '豚') return true;
  const code = toBasePieceCode(piece.pieceCode);
  if (code === 'PIG') return true;
  return (piece.pieceCode ?? '').toUpperCase().includes('3EFA5702E75B');
}

/** 豚: 直近捕獲の敵駒の code/見た目で移動定義を解決（盤上の座標・先後は豚のまま）。「書」は特殊ループのため除外。 */
function shinMimicMoveOverlay(
  piece: AiBoardPiece,
  position: AiBattlePosition,
): AiBoardPiece | null {
  if (!isShinPiece(piece)) return null;
  const mimic = readShinTurnMimic(position, piece.side);
  if (!mimic) return null;
  return {
    ...piece,
    char: mimic.mimic_char,
    pieceCode: mimic.mimic_piece_code,
  };
}

function pigInheritedMoveOverlay(piece: AiBoardPiece): AiBoardPiece | null {
  if (!isPigPiece(piece)) return null;
  const raw = piece.pigInheritedPieceCode;
  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
  const code = raw.trim().toUpperCase();
  const inheritedChar =
    piece.pigInheritedChar ?? CODE_TO_CHAR[code as keyof typeof CODE_TO_CHAR] ?? piece.char;
  const synthetic: AiBoardPiece = {
    ...piece,
    pieceCode: code,
    char: inheritedChar,
    promoted: piece.pigInheritedPromoted ?? false,
  };
  if (isBookPiece(synthetic)) return null;
  return synthetic;
}

/** 聖者「聖」— 嶺(REI) とは別物 */
function isSaintPieceForLegal(piece: AiBoardPiece): boolean {
  if (normKanjiForEngineRules(piece.char) === '聖') return true;
  const raw = (piece.pieceCode ?? '').toUpperCase();
  if (raw.includes('A3BAB6C13DC7')) return true;
  const code = toBasePieceCode(piece.pieceCode);
  return code === 'SAINT';
}

function isMedicinePieceForLegal(piece: AiBoardPiece): boolean {
  if (normKanjiForEngineRules(piece.char) === '薬') return true;
  const raw = (piece.pieceCode ?? '').toUpperCase();
  // piece-image-registry の piece_3e3ef463eadc（薬）
  if (raw.includes('3E3EF463EADC')) return true;
  const code = toBasePieceCode(piece.pieceCode);
  return code === 'MEDICINE';
}

function isCherryPieceForLegal(piece: AiBoardPiece): boolean {
  if (normKanjiForEngineRules(piece.char) === '桜') return true;
  const raw = (piece.pieceCode ?? '').toUpperCase();
  if (raw.includes('124C31EA5D7A')) return true;
  const code = toBasePieceCode(piece.pieceCode);
  return code === 'CHERRY';
}

/** この駒が前後左右に味方の「聖」と隣接しているとき、移動ベクトル各方向の maxStep を +1 */
function hasOrthogonalAdjacentAllySaint(pieces: AiBoardPiece[], piece: AiBoardPiece): boolean {
  const ortho: readonly { dr: number; dc: number }[] = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];
  for (const { dr, dc } of ortho) {
    const r = piece.row + dr;
    const c = piece.col + dc;
    const ally = pieces.find((p) => p.row === r && p.col === c && p.side === piece.side);
    if (ally && isSaintPieceForLegal(ally)) return true;
  }
  return false;
}

/** この駒が周囲 8 マスに味方の「薬」と隣接しているとき、移動ベクトル各方向の maxStep を +1 */
function hasAdjacentAllyMedicine(pieces: AiBoardPiece[], piece: AiBoardPiece): boolean {
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = piece.row + dr;
      const c = piece.col + dc;
      const ally = pieces.find((p) => p.row === r && p.col === c && p.side === piece.side);
      if (ally && isMedicinePieceForLegal(ally)) return true;
    }
  }
  return false;
}

/** 同じ行に味方の「桜」がいるとき（桜自身を除く）、移動ベクトル各方向の maxStep を +1（桂馬跳びベクトルは除く） */
function hasSameRowAllyCherryBuff(pieces: AiBoardPiece[], piece: AiBoardPiece): boolean {
  if (isCherryPieceForLegal(piece)) return false;
  return pieces.some(
    (ally) => ally.side === piece.side && ally.row === piece.row && isCherryPieceForLegal(ally),
  );
}

/** 桂馬跳び（L字 2+1） */
function isKnightLeapVector(dx: number, dy: number): boolean {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  return (adx === 2 && ady === 1) || (adx === 1 && ady === 2);
}

function applyCherryRowMoveRangeBuff(
  vectors: AiPieceDefinition['moveVectors'],
): AiPieceDefinition['moveVectors'] {
  return vectors.map((v) => {
    if (isKnightLeapVector(v.dx, v.dy)) return v;
    return {
      ...v,
      maxStep: Math.max(1, (Number(v.maxStep) || 1) + 1),
    };
  });
}

function applySaintAdjacentMoveRangeBuff(
  vectors: AiPieceDefinition['moveVectors'],
): AiPieceDefinition['moveVectors'] {
  return vectors.map((v) => ({
    ...v,
    maxStep: Math.max(1, (Number(v.maxStep) || 1) + 1),
  }));
}

function applyMedicineAdjacentMoveRangeBuff(
  vectors: AiPieceDefinition['moveVectors'],
): AiPieceDefinition['moveVectors'] {
  return vectors.map((v) => ({
    ...v,
    maxStep: Math.max(1, (Number(v.maxStep) || 1) + 1),
  }));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function lastMovedPieceForBook(
  position: AiBattlePosition,
  piece: AiBoardPiece,
): AiBoardPiece | null {
  const boardState = asRecord(position.boardState);
  const skillState = asRecord(boardState?.skill_state ?? boardState?.skillState);
  // 「書」は“相手が直前に動かした駒”の移動範囲を継承する。
  const key = piece.side === 'player' ? 'last_enemy_moved_piece' : 'last_player_moved_piece';
  const raw = asRecord(skillState?.[key]);
  if (!raw) return null;
  const pieceCode = typeof raw.pieceCode === 'string' ? raw.pieceCode : null;
  const char = typeof raw.char === 'string' ? raw.char : '';
  const promoted = raw.promoted === true;
  const copiedMoveVectors = Array.isArray(raw.copiedMoveVectors) ? raw.copiedMoveVectors : null;
  if (!pieceCode && !char && !(copiedMoveVectors && copiedMoveVectors.length > 0)) return null;
  const row = typeof raw.row === 'number' ? raw.row : -1;
  const col = typeof raw.col === 'number' ? raw.col : -1;
  return {
    side: piece.side,
    row,
    col,
    pieceCode,
    char,
    promoted,
    ...(copiedMoveVectors ? { copiedMoveVectors } : {}),
    imageSignedUrl: null,
  };
}

/** `CHAR_TO_CODE` に無い幻駒は、カタログの漢字→pieceCode で着手の pieceCode を決める（刀が歩になる不具合の防止）。 */
function resolvePieceCodeForLegalMove(piece: AiBoardPiece, lookups: AiPieceLookups): string {
  const ch = normKanjiForEngineRules(piece.char);
  if (isShinPiece(piece)) {
    const catalog = lookups.pieceDefsByChar[piece.char] ?? lookups.pieceDefsByChar[ch];
    const fromCatalog = toBasePieceCode(catalog?.pieceCode ?? null);
    if (fromCatalog && !isOpaquePieceInstanceId(fromCatalog)) return fromCatalog;
    return 'GACHA_SHIN';
  }
  if (isItsuPiece(piece)) return 'GACHA_ITSU';
  if (isHenPiece(piece)) return 'GACHA_HEN';
  if (isTouPiece(piece)) return 'GACHA_TOU';
  if (isNigePiece(piece)) return 'GACHA_TOU2';
  if (isSadamePiece(piece)) return 'GACHA_SADAME';
  if (isAnPiece(piece)) return 'GACHA_AN';
  if (isSoPiece(piece)) return 'GACHA_SO';
  if (isSouPiece(piece)) return 'GACHA_SOU';
  if (isBakuPiece(piece)) return 'GACHA_BAKU';
  if (isAoriPiece(piece)) return 'GACHA_AORI';
  if (isEnPiece(piece)) return 'GACHA_EN';
  if (isKoPiece(piece)) return 'GACHA_KOU';
  if (isShitsuPiece(piece)) return 'GACHA_SHITSU';
  if (ch === '剣') return 'HOLY_SWORD';
  if (ch === '刀') return 'SWORD';
  const direct = toBasePieceCode(piece.pieceCode);
  if (direct && !isOpaquePieceInstanceId(direct)) return direct;
  const def = lookups.pieceDefsByChar[piece.char] ?? lookups.pieceDefsByChar[ch];
  const fromCatalog = toBasePieceCode(def?.pieceCode ?? null);
  if (fromCatalog && !isOpaquePieceInstanceId(fromCatalog)) return fromCatalog;
  if (ch === '銃') return 'GUN';
  if (ch === '書') return 'BOOK';
  if (ch === '封') return 'SEAL';
  const rawUp = (piece.pieceCode ?? '').toUpperCase();
  if (ch === '獣' || rawUp.includes('05E4EFB89DAE') || rawUp.includes('BEAST')) {
    return 'BEAST';
  }
  if (ch === '禽' || rawUp.includes('29ECAB1EF3C3') || rawUp.includes('BIRD')) {
    return 'BIRD';
  }
  if (ch === '悟' || rawUp.includes('6D4AFA9CDF1C') || rawUp.includes('SATORI')) {
    return 'SATORI';
  }
  if (ch === '心' || rawUp.includes('CA16911978FF') || rawUp.includes('HEART')) {
    return 'HEART';
  }
  if (ch === '鬱' || rawUp.includes('9E27F89F65C5') || rawUp.includes('DEPRESSION')) {
    return 'DEPRESSION';
  }
  if (ch === '乙' || rawUp.includes('5A07CA59B158') || rawUp.includes('OTSU')) {
    return 'OTSU';
  }
  if (ch === '凸' || rawUp.includes('94B641477E72') || rawUp.includes('CONVEX')) {
    return 'CONVEX';
  }
  if (ch === '焼' || rawUp.includes('FDC83CF95746') || rawUp.includes('SEAR')) {
    return 'SEAR';
  }
  if (ch === '炒' || rawUp.includes('1732246A37D8') || rawUp.includes('SAUTE')) {
    return 'SAUTE';
  }
  if (ch === '煮' || rawUp.includes('8DE5676A5E92') || rawUp.includes('STEW')) {
    return 'STEW';
  }
  if (ch === '陽' || rawUp.includes('313B9456C8AC') || rawUp.includes('YANG')) {
    return 'YANG';
  }
  if (ch === '陰' || rawUp.includes('A67CE76969F7') || rawUp.includes('YIN')) {
    return 'YIN';
  }
  if (ch === '牛' || rawUp.includes('F75D88C48D6D') || rawUp.includes('COW')) {
    return 'COW';
  }
  if (ch === '豚' || rawUp.includes('3EFA5702E75B') || rawUp.includes('PIG')) {
    return 'PIG';
  }
  if (ch === '鶏' || rawUp.includes('F1A6EF3B99DF') || rawUp.includes('CHICKEN')) {
    return 'CHICKEN';
  }
  if (ch === '銭' || rawUp.includes('EACC7F540399') || rawUp.includes('SEN')) {
    return 'SEN';
  }
  if (ch === '財' || rawUp.includes('7FC715661514') || rawUp.includes('ZAI')) {
    return 'ZAI';
  }
  if (ch === '巨' || rawUp.includes('C4AEB81F3634')) {
    return 'GIANT';
  }
  if (ch === 'P' || rawUp.includes('SHOP_P') || rawUp.includes('PIECE_SHOP_P')) {
    return 'SHOP_P';
  }
  if (ch === '鳴' || rawUp.includes('NAKU') || rawUp.includes('SHOP_NAKU')) {
    return 'NAKU';
  }
  if (ch === '走' || rawUp.includes('SHOP_SO')) {
    return 'SO';
  }
  if (ch === '種' || rawUp.includes('SHOP_TANE')) {
    return 'TANE';
  }
  if (ch === '舞' || rawUp.includes('SHOP_MAI')) {
    return 'MAI';
  }
  if (ch === '麒' || rawUp.includes('SHOP_KIRIN')) {
    return 'KIRIN';
  }
  const legacy = toBasePieceCode(CHAR_TO_CODE[piece.char]);
  if (legacy) return legacy;
  return 'FU';
}

function resolveCapturedPieceCodeForLegalMove(
  piece: AiBoardPiece | null | undefined,
): string | null {
  if (!piece) return null;
  const ch = normKanjiForEngineRules(piece.char);
  if (ch === '剣') return 'HOLY_SWORD';
  if (ch === '刀') return 'SWORD';
  if (ch === '盾') return 'SHIELD';
  return (
    toBasePieceCode(capturedToHandPieceCode(piece)) ?? toBasePieceCode(piece.pieceCode ?? null)
  );
}

function activeOtsuFollowupForSide(
  position: AiBattlePosition,
): { row: number; col: number } | null {
  return readFollowupCellForSide(
    (position.boardState ?? {}) as Record<string, unknown>,
    position.sideToMove,
    'otsu_followup',
  );
}

function activeConvexFollowupForSide(
  position: AiBattlePosition,
): { row: number; col: number } | null {
  return readFollowupCellForSide(
    (position.boardState ?? {}) as Record<string, unknown>,
    position.sideToMove,
    'convex_followup',
  );
}

function resolvePieceDefForBookCopy(
  piece: AiBoardPiece,
  lookups: AiPieceLookups,
): AiPieceDefinition | null {
  const ch = normKanjiForEngineRules(piece.char);
  const canonicalFromChar = toBasePieceCode(CHAR_TO_CODE[ch] ?? null);
  if (canonicalFromChar) {
    const byCanonical = lookups.pieceDefsByCode[canonicalFromChar];
    if (byCanonical) return byCanonical;
  }
  const direct = resolvePieceDef(piece, lookups);
  if (direct && Array.isArray(direct.moveVectors) && direct.moveVectors.length > 0) {
    return direct;
  }
  const code = resolvePieceCodeForLegalMove(piece, lookups);
  const byCode = lookups.pieceDefsByCode[code];
  if (byCode) return byCode;
  return lookups.pieceDefsByChar[piece.char] ?? lookups.pieceDefsByChar[ch] ?? null;
}

function isKingLikePieceForBook(piece: AiBoardPiece): boolean {
  const ch = normKanjiForEngineRules(piece.char);
  if (ch === '王' || ch === '玉') return true;
  const code = toBasePieceCode(piece.pieceCode);
  return code === 'OU' || code === 'KING';
}

function isArmorPiece(piece: AiBoardPiece): boolean {
  const code = toBasePieceCode(piece.pieceCode);
  return piece.char === '鎧' || code === 'ARMOR';
}

/** 銃: 前方のマス（1マス目）の行。player は盤上で row が小さい方が前。 */
function gunForwardRowDelta(side: 'player' | 'enemy'): number {
  return side === 'player' ? -1 : 1;
}

/** 味方王の「前」1マス（先手は row-1、後手は row+1）。 */
function allyKingForwardCell(
  pieces: AiBoardPiece[],
  side: 'player' | 'enemy',
): { row: number; col: number } | null {
  const king = pieces.find((p) => p.side === side && isKingPiece(p));
  if (!king) return null;
  const row = king.row + gunForwardRowDelta(side);
  const col = king.col;
  if (row < 0 || row > 8 || col < 0 || col > 8) return null;
  return { row, col };
}

/** 閹: 味方王の前1マス（通常の縦横1マスに加えて合法手に含める）。 */
function enAllyKingFrontTarget(
  piece: AiBoardPiece,
  pieces: AiBoardPiece[],
): { row: number; col: number } | null {
  if (!isEnPiece(piece)) return null;
  const cell = allyKingForwardCell(pieces, piece.side);
  if (!cell) return null;
  if (cell.row === piece.row && cell.col === piece.col) return null;
  return cell;
}

function kbossEffectiveLivesForGunFilter(piece: AiBoardPiece): number {
  const v = piece.kbossLivesRemaining;
  if (v === 1 || v === 2) return v;
  return 2;
}

function isKbossPieceForGun(piece: AiBoardPiece): boolean {
  if (piece.char === 'K') return true;
  return toBasePieceCode(piece.pieceCode) === 'KBOSS';
}

/** 中間マスの味方が銃の直進・貫通を完全に塞ぐか（王・鎧・K博士）。それ以外の味方は盤データの side 重複でも貫通可能。 */
function isGunFullyBlockingAllyOnMid(p: AiBoardPiece, gun: AiBoardPiece): boolean {
  if (p.side !== gun.side) return false;
  return isKingPiece(p) || isArmorPiece(p) || isKbossPieceForGun(p);
}

function generateGunForwardTargets(
  occupancy: OccupancyMap,
  piece: AiBoardPiece,
  pieces: AiBoardPiece[],
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  const seen = new Set<string>();
  const d = gunForwardRowDelta(piece.side);
  const fromRow = piece.row;
  const fromCol = piece.col;
  const r1 = fromRow + d;
  const c1 = fromCol;
  const r2 = fromRow + 2 * d;
  const c2 = fromCol;
  const r1Valid = r1 >= 0 && r1 <= 8;
  const r2Valid = r2 >= 0 && r2 <= 8;
  let p1: AiBoardPiece | null = null;
  let p2: AiBoardPiece | null = null;
  const snap = (p: AiBoardPiece | null) =>
    p
      ? {
          side: p.side,
          char: p.char,
          code: p.pieceCode,
          rock: isRockObstacleVirtualPiece(p),
        }
      : null;
  const logBlock = (reason: string, extra: Record<string, unknown> = {}) => {
    if (!isGunPiece(piece)) return;
    gunPieceDebugLog(`前方2マス: ${reason}`, {
      from: [fromRow, fromCol],
      side: piece.side,
      dRow: d,
      r1,
      r2,
      c: fromCol,
      p1: snap(p1),
      p2: snap(p2),
      ...extra,
    });
  };

  if (!r1Valid) {
    logBlock('r1 が盤外', { p1: null, p2: null });
    return out;
  }

  p1 = findPieceAtFast(occupancy, r1, c1);
  p2 = r2Valid ? findPieceAtFast(occupancy, r2, c2) : null;

  if (p1 && isRockObstacleVirtualPiece(p1)) {
    logBlock('1マス目が岩');
    return out;
  }
  if (r2Valid && p2 && isRockObstacleVirtualPiece(p2)) {
    logBlock('2マス目が岩');
    return out;
  }

  if (p1 && isGunFullyBlockingAllyOnMid(p1, piece)) {
    logBlock('1マス目が味方（王・鎧・K でブロック）');
    return out;
  }
  if (r2Valid && p2 && p2.side === piece.side) {
    logBlock('2マス目が味方');
    return out;
  }
  if (p1 && isKingPiece(p1) && hasSoulOnBoardForSide(pieces, p1.side)) {
    logBlock('1マス目が心所持の王/玉');
    return out;
  }
  if (r2Valid && p2 && isKingPiece(p2) && hasSoulOnBoardForSide(pieces, p2.side)) {
    logBlock('2マス目が心所持の王/玉');
    return out;
  }
  if (p1 && isArmorPiece(p1)) {
    logBlock('1マス目が鎧');
    return out;
  }
  if (r2Valid && p2 && isArmorPiece(p2)) {
    logBlock('2マス目が鎧');
    return out;
  }
  if (p1 && isKbossPieceForGun(p1) && kbossEffectiveLivesForGunFilter(p1) > 1) {
    logBlock('1マス目がK博士耐久2');
    return out;
  }
  if (p1 && isGiantPieceForEngine(p1)) {
    logBlock('1マス目が巨');
    return out;
  }
  if (r2Valid && p2 && isGiantPieceForEngine(p2)) {
    logBlock('2マス目が巨');
    return out;
  }

  const push = (row: number, col: number) => {
    const key = `${row}:${col}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ row, col });
  };

  const finishForward = (): { row: number; col: number }[] => {
    if (isGunPiece(piece)) {
      gunPieceDebugLog('前方2マス: 結果', {
        from: [fromRow, fromCol],
        side: piece.side,
        targets: out,
        p1: snap(p1),
        p2: snap(p2),
        r1,
        r2,
      });
    }
    return out;
  };

  if (!p1 && (!r2Valid || !p2)) {
    push(r1, c1);
    if (r2Valid) push(r2, c2);
    return finishForward();
  }
  if (!p1 && r2Valid && p2 && p2.side !== piece.side) {
    push(r2, c2);
    return finishForward();
  }
  if (p1 && (!r2Valid || !p2)) {
    if (r2Valid) push(r2, c2);
    return finishForward();
  }
  if (p1 && r2Valid && p2 && p2.side !== piece.side) {
    push(r2, c2);
    return finishForward();
  }
  return finishForward();
}

/** 走: 前方1マス（移動・取り）。1マス目が空のときのみ前方2マス目へ（HTML runMoves 準拠）。 */
function generateRunForwardTargets(
  occupancy: OccupancyMap,
  piece: AiBoardPiece,
  pieces: AiBoardPiece[],
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  const seen = new Set<string>();
  const d = gunForwardRowDelta(piece.side);
  const fromRow = piece.row;
  const fromCol = piece.col;
  const r1 = fromRow + d;
  const r2 = fromRow + 2 * d;
  const col = fromCol;

  const push = (row: number, c: number) => {
    if (row < 0 || row > 8 || c < 0 || c > 8) return;
    const key = `${row}:${c}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ row, col: c });
  };

  const canLandOn = (target: AiBoardPiece | null): boolean => {
    if (!target) return true;
    if (target.side === piece.side) return false;
    if (isRockObstacleVirtualPiece(target)) return false;
    if (isKingPiece(target) && hasSoulOnBoardForSide(pieces, target.side)) return false;
    if (isArmorPiece(target)) return false;
    if (isGiantPieceForEngine(target)) return false;
    if (isKirinCaptureBlocked(piece, target)) return false;
    return true;
  };

  if (r1 < 0 || r1 > 8) return out;

  const p1 = findPieceAtFast(occupancy, r1, col);
  if (p1 && isRockObstacleVirtualPiece(p1)) return out;
  if (canLandOn(p1)) push(r1, col);

  if (!p1 && r2 >= 0 && r2 <= 8) {
    const p2 = findPieceAtFast(occupancy, r2, col);
    if (p2 && isRockObstacleVirtualPiece(p2)) return out;
    if (canLandOn(p2)) push(r2, col);
  }

  return out;
}

/** 銃: 斜め後ろ最大2マス（中間に味方・王・鎧・K耐久2はブロック）。前方2マス貫通と同じルールで2マス目着地を生成。 */
function generateGunBackDiagonalTargets(
  occupancy: OccupancyMap,
  piece: AiBoardPiece,
  pieces: AiBoardPiece[],
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  const seen = new Set<string>();
  const push = (row: number, col: number) => {
    const key = `${row}:${col}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ row, col });
  };

  const dirs =
    piece.side === 'player'
      ? ([
          [1, -1],
          [1, 1],
        ] as const)
      : ([
          [-1, -1],
          [-1, 1],
        ] as const);

  for (const [ud, vd] of dirs) {
    const r1 = piece.row + ud;
    const c1 = piece.col + vd;
    const r2 = piece.row + 2 * ud;
    const c2 = piece.col + 2 * vd;
    const r1Valid = r1 >= 0 && r1 <= 8 && c1 >= 0 && c1 <= 8;
    const r2Valid = r2 >= 0 && r2 <= 8 && c2 >= 0 && c2 <= 8;
    if (!r1Valid) continue;

    const p1 = findPieceAtFast(occupancy, r1, c1);
    const p2 = r2Valid ? findPieceAtFast(occupancy, r2, c2) : null;

    if (p1 && isRockObstacleVirtualPiece(p1)) continue;
    if (r2Valid && p2 && isRockObstacleVirtualPiece(p2)) continue;

    if (p1 && isGunFullyBlockingAllyOnMid(p1, piece)) continue;
    if (r2Valid && p2 && p2.side === piece.side) continue;
    if (p1 && isKingPiece(p1) && hasSoulOnBoardForSide(pieces, p1.side)) continue;
    if (r2Valid && p2 && isKingPiece(p2) && hasSoulOnBoardForSide(pieces, p2.side)) continue;
    if (p1 && isArmorPiece(p1)) continue;
    if (r2Valid && p2 && isArmorPiece(p2)) continue;
    if (p1 && isKbossPieceForGun(p1) && kbossEffectiveLivesForGunFilter(p1) > 1) continue;
    if (p1 && isGiantPieceForEngine(p1)) continue;
    if (r2Valid && p2 && isGiantPieceForEngine(p2)) continue;

    if (!p1 && (!r2Valid || !p2)) {
      push(r1, c1);
      if (r2Valid) push(r2, c2);
      continue;
    }
    if (!p1 && r2Valid && p2 && p2.side !== piece.side) {
      push(r2, c2);
      continue;
    }
    if (p1 && (!r2Valid || !p2)) {
      if (r2Valid) push(r2, c2);
      continue;
    }
    if (p1 && r2Valid && p2 && p2.side !== piece.side) {
      push(r2, c2);
    }
  }
  return out;
}

/** 機: 同一行の左隣の味方を優先し、いなければ右隣の味方の移動ベクトルを借用する */
function pickMachineDonorAlly(pieces: AiBoardPiece[], machine: AiBoardPiece): AiBoardPiece | null {
  const row = machine.row;
  const col = machine.col;
  const left = pieces.find((p) => p.side === machine.side && p.row === row && p.col === col - 1);
  const right = pieces.find((p) => p.side === machine.side && p.row === row && p.col === col + 1);
  if (left) return left;
  if (right) return right;
  return null;
}

function isKingBlockedByPoisonCell(
  skillView: SkillRuntimeView,
  piece: AiBoardPiece,
  row: number,
  col: number,
): boolean {
  if (!isKingPiece(piece)) return false;
  return skillView.kingPoisonBlockedCells.has(`${piece.side}:${row}:${col}`);
}

function isBlockedByRockObstacle(skillView: SkillRuntimeView, row: number, col: number): boolean {
  return skillView.rockObstacleCells.has(`${row}:${col}`);
}

function arrowSlideTargetForCell(
  skillView: SkillRuntimeView,
  row: number,
  col: number,
): { row: number; col: number } | null {
  const direction = skillView.arrowTileByCell.get(`${row}:${col}`);
  if (!direction) return null;
  return arrowSlideDestination(row, col, direction);
}

function occupantForArrowAwareTarget(
  skillView: SkillRuntimeView,
  occupancy: OccupancyMap,
  target: { row: number; col: number },
  mover: AiBoardPiece,
): AiBoardPiece | null {
  const slide = arrowSlideTargetForCell(skillView, target.row, target.col);
  if (slide) {
    const slideOcc = findPieceAtFast(occupancy, slide.row, slide.col);
    if (!slideOcc) return null;
    if (slideOcc.side !== mover.side) return slideOcc;
    return null;
  }
  return findPieceAtFast(occupancy, target.row, target.col);
}

function isArrowTileTargetAllowed(
  skillView: SkillRuntimeView,
  mover: AiBoardPiece,
  target: { row: number; col: number },
  occupancy: OccupancyMap,
): boolean {
  const slide = arrowSlideTargetForCell(skillView, target.row, target.col);
  if (!slide) return true;
  if (findPieceAtFast(occupancy, target.row, target.col)) return false;
  const slideOcc = findPieceAtFast(occupancy, slide.row, slide.col);
  if (!slideOcc) return true;
  if (slideOcc.side !== mover.side) return true;
  // スライド先が着手駒の現在位置（例: 左隣→矢印→左隣へ戻る）のときは通過として許可
  return slideOcc.row === mover.row && slideOcc.col === mover.col;
}

function isATransformedPawn(skillView: SkillRuntimeView, piece: AiBoardPiece): boolean {
  const baseCode = toBasePieceCode(piece.pieceCode);
  if (!(baseCode === 'FU' || piece.char === '歩')) return false;
  return skillView.aTransformCells.has(`${piece.side}:${piece.row}:${piece.col}`);
}

type OccupancyMap = Map<string, AiBoardPiece>;

function occupancyKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function buildOccupancyMap(pieces: AiBoardPiece[]): OccupancyMap {
  const map = new Map<string, AiBoardPiece>();
  const giants: AiBoardPiece[] = [];
  for (const piece of pieces) {
    if (isGiantPieceForEngine(piece)) {
      giants.push(piece);
    } else {
      map.set(occupancyKey(piece.row, piece.col), piece);
    }
  }
  for (const piece of giants) {
    for (const c of giantAnchorFootprint(piece.row, piece.col)) {
      map.set(occupancyKey(c.row, c.col), piece);
    }
  }
  return map;
}

function isRockObstacleVirtualPiece(piece: AiBoardPiece): boolean {
  return piece.pieceCode === 'ROCK_OBSTACLE' || piece.char === '岩障';
}

/** 岩仮想駒は実駒のいないマスのみ。従来は配列末尾に岩を足して Map が後勝ちし、同座標の敵を「味方の岩」に潰していた。 */
function buildPathPiecesWithRockObstaclesOnEmptyCells(
  pieces: AiBoardPiece[],
  skillView: SkillRuntimeView,
  rockSide: Side,
): AiBoardPiece[] {
  const baseOcc = buildOccupancyMap(pieces);
  const out: AiBoardPiece[] = [...pieces];
  for (const key of skillView.rockObstacleCells) {
    if (baseOcc.has(key)) continue;
    const [rowRaw, colRaw] = key.split(':');
    const row = Number(rowRaw);
    const col = Number(colRaw);
    if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
    out.push({
      side: rockSide,
      row,
      col,
      pieceCode: 'ROCK_OBSTACLE',
      char: '岩障',
      promoted: false,
      imageSignedUrl: null,
    });
  }
  return out;
}

function findPieceAtFast(occupancy: OccupancyMap, row: number, col: number): AiBoardPiece | null {
  return occupancy.get(occupancyKey(row, col)) ?? null;
}

/** 牛: チャージ分だけ前方の直線に延び、道の敵マスをすべて通過して着く。 */
function generateCowForwardChargedTargets(input: {
  occupancy: OccupancyMap;
  piece: AiBoardPiece;
  skillView: SkillRuntimeView;
  pieces: AiBoardPiece[];
}): { row: number; col: number }[] {
  const { occupancy, piece, skillView, pieces } = input;
  const charge = Math.min(8, Math.max(0, Math.floor(piece.cowChargeCount ?? 0)));
  const maxDist = Math.min(8, 1 + charge);
  const d = gunForwardRowDelta(piece.side);
  const fromRow = piece.row;
  const fromCol = piece.col;
  const out: { row: number; col: number }[] = [];
  const seen = new Set<string>();

  for (let dist = 1; dist <= maxDist; dist += 1) {
    let ok = true;
    for (let s = 1; s <= dist; s += 1) {
      const r = fromRow + d * s;
      const c = fromCol;
      if (r < 0 || r > 8 || c < 0 || c > 8) {
        ok = false;
        break;
      }
      if (isBlockedByRockObstacle(skillView, r, c)) {
        ok = false;
        break;
      }
      const p = findPieceAtFast(occupancy, r, c);
      if (p && isRockObstacleVirtualPiece(p)) {
        ok = false;
        break;
      }
      if (p && p.side === piece.side) {
        ok = false;
        break;
      }
      if (p && p.side !== piece.side) {
        if (isArmorPiece(p)) {
          ok = false;
          break;
        }
        if (isKingPiece(p) && hasSoulOnBoardForSide(pieces, p.side)) {
          ok = false;
          break;
        }
        if (skillView.captureImmunityCells.has(`${p.side}:${p.row}:${p.col}`)) {
          ok = false;
          break;
        }
        if (skillView.darkBlindCells.has(`${p.side}:${p.row}:${p.col}`)) {
          ok = false;
          break;
        }
        if (isKbossPieceForGun(p) && kbossEffectiveLivesForGunFilter(p) > 1) {
          ok = false;
          break;
        }
        if (isGiantPieceForEngine(p)) {
          ok = false;
          break;
        }
        if (isKirinCaptureBlocked(piece, p)) {
          ok = false;
          break;
        }
      }
    }
    if (!ok) continue;
    const landR = fromRow + d * dist;
    const landC = fromCol;
    const key = `${landR}:${landC}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ row: landR, col: landC });
  }
  return out;
}

function generateReflectiveTargets(
  occupancy: OccupancyMap,
  piece: AiBoardPiece,
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  const seen = new Set<string>();
  const starts: [number, number][] = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ];
  for (const [startDr, startDc] of starts) {
    let r = piece.row;
    let c = piece.col;
    let dr = startDr;
    let dc = startDc;
    const seenState = new Set<string>();
    for (let step = 0; step < 256; step += 1) {
      const stateKey = `${r}:${c}:${dr}:${dc}`;
      if (seenState.has(stateKey)) break;
      seenState.add(stateKey);
      let nr = r + dr;
      let nc = c + dc;
      if (nr < 0 || nr > 8) {
        dr *= -1;
        nr = r + dr;
      }
      if (nc < 0 || nc > 8) {
        dc *= -1;
        nc = c + dc;
      }
      if (nr < 0 || nr > 8 || nc < 0 || nc > 8) break;
      const target = findPieceAtFast(occupancy, nr, nc);
      if (target) {
        if (target.side !== piece.side && !isGiantPieceForEngine(target)) {
          const key = `${nr}:${nc}`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push({ row: nr, col: nc });
          }
        }
        break;
      }
      const key = `${nr}:${nc}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ row: nr, col: nc });
      }
      r = nr;
      c = nc;
    }
  }
  return out;
}

function isLeapOverOneMode(mode: string | null | undefined): boolean {
  if (!mode) return false;
  const normalized = mode.trim().toLowerCase();
  return (
    normalized === 'leapoverone' || normalized === 'leap_over_one' || normalized === 'leap-over-one'
  );
}

function normalizeVectorsForBishop(piece: AiBoardPiece, vectors: AiPieceDefinition['moveVectors']) {
  const baseCode = toBasePieceCode(piece.pieceCode);
  if (baseCode !== 'KA') return vectors;
  // 角は常に斜め方向へ盤端まで移動可能にする。
  return vectors.map((v) =>
    Math.abs(v.dx) === 1 && Math.abs(v.dy) === 1
      ? {
          ...v,
          maxStep: 9,
        }
      : v,
  );
}

function normalizeVectorsForGold(piece: AiBoardPiece, vectors: AiPieceDefinition['moveVectors']) {
  const baseCode = toBasePieceCode(piece.pieceCode);
  if (baseCode !== 'KI') return vectors;
  // 金: 前・斜め前・左右・後ろに1マス
  return [
    { dx: -1, dy: -1, maxStep: 1 },
    { dx: 0, dy: -1, maxStep: 1 },
    { dx: 1, dy: -1, maxStep: 1 },
    { dx: -1, dy: 0, maxStep: 1 },
    { dx: 1, dy: 0, maxStep: 1 },
    { dx: 0, dy: 1, maxStep: 1 },
  ];
}

/** 家・畑: 固定駒（移動不可） */
function normalizeVectorsForFixedHouseField(
  piece: AiBoardPiece,
  vectors: AiPieceDefinition['moveVectors'],
): AiPieceDefinition['moveVectors'] {
  const baseCode = toBasePieceCode(piece.pieceCode);
  const mappedCode = CHAR_TO_CODE[piece.char];
  if (
    baseCode === 'HOUSE' ||
    baseCode === 'FIELD' ||
    piece.char === '家' ||
    piece.char === '畑' ||
    mappedCode === 'HOUSE' ||
    mappedCode === 'FIELD' ||
    piece.pieceCode?.trim().toUpperCase() === 'ZIE' ||
    piece.pieceCode?.trim().toUpperCase() === 'ZTA'
  ) {
    return [];
  }
  return vectors;
}

function isFieldPieceForPeopleBuff(piece: AiBoardPiece): boolean {
  const code = toBasePieceCode(piece.pieceCode);
  if (code === 'FIELD') return true;
  if (piece.char === '畑') return true;
  return CHAR_TO_CODE[piece.char] === 'FIELD';
}

function isPeoplePieceForFieldBuff(piece: AiBoardPiece): boolean {
  const code = toBasePieceCode(piece.pieceCode);
  if (code === 'PEOPLE') return true;
  if (piece.char === '民') return true;
  return CHAR_TO_CODE[piece.char] === 'PEOPLE';
}

/** 畑が味方にいるとき、民は斜め4方向にも1マス進める（ベクトル定義座標。先手後手は getLegalTargetsFromVectors の orient で反映） */
function hasPeopleFieldBuffOnBoard(piece: AiBoardPiece, allPieces: AiBoardPiece[]): boolean {
  if (!isPeoplePieceForFieldBuff(piece)) return false;
  return allPieces.some((p) => p.side === piece.side && isFieldPieceForPeopleBuff(p));
}

function normalizeVectorsForPeopleWithAllyField(
  piece: AiBoardPiece,
  vectors: AiPieceDefinition['moveVectors'],
  allPieces: AiBoardPiece[],
): AiPieceDefinition['moveVectors'] {
  if (!isPeoplePieceForFieldBuff(piece)) return vectors;
  const base: AiPieceDefinition['moveVectors'] = [
    { dx: -1, dy: 0, maxStep: 1 },
    { dx: 1, dy: 0, maxStep: 1 },
    { dx: 0, dy: -1, maxStep: 1 },
    { dx: 0, dy: 1, maxStep: 1 },
  ];
  if (!hasPeopleFieldBuffOnBoard(piece, allPieces)) return base;
  const diagonals: AiPieceDefinition['moveVectors'] = [
    { dx: -1, dy: -1, maxStep: 1 },
    { dx: 1, dy: -1, maxStep: 1 },
    { dx: -1, dy: 1, maxStep: 1 },
    { dx: 1, dy: 1, maxStep: 1 },
  ];
  return [...base, ...diagonals];
}

function normalizeVectorsForTime(piece: AiBoardPiece, vectors: AiPieceDefinition['moveVectors']) {
  const baseCode = toBasePieceCode(piece.pieceCode);
  if (baseCode !== 'TIME' && piece.char !== '時') return vectors;
  // 時: 全方位1マス
  return [
    { dx: -1, dy: -1, maxStep: 1 },
    { dx: 0, dy: -1, maxStep: 1 },
    { dx: 1, dy: -1, maxStep: 1 },
    { dx: -1, dy: 0, maxStep: 1 },
    { dx: 1, dy: 0, maxStep: 1 },
    { dx: -1, dy: 1, maxStep: 1 },
    { dx: 0, dy: 1, maxStep: 1 },
    { dx: 1, dy: 1, maxStep: 1 },
  ];
}

function normalizeVectorsForOniVariants(
  piece: AiBoardPiece,
  vectors: AiPieceDefinition['moveVectors'],
): AiPieceDefinition['moveVectors'] {
  if (isRedOniPiece(piece)) {
    return [
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: -1, dy: 0, maxStep: 1 },
      { dx: 1, dy: 0, maxStep: 1 },
      { dx: 0, dy: 1, maxStep: 1 },
    ];
  }
  if (isBlueOniPiece(piece)) {
    return [
      { dx: -1, dy: -1, maxStep: 1 },
      { dx: 0, dy: -1, maxStep: 1 },
      { dx: 1, dy: -1, maxStep: 1 },
      { dx: -1, dy: 0, maxStep: 1 },
      { dx: 1, dy: 0, maxStep: 1 },
      { dx: -1, dy: 1, maxStep: 1 },
      { dx: 0, dy: 1, maxStep: 1 },
      { dx: 1, dy: 1, maxStep: 1 },
    ];
  }
  if (isBlackOniPiece(piece)) {
    return [
      { dx: 0, dy: -1, maxStep: 8 },
      { dx: -1, dy: 0, maxStep: 8 },
      { dx: 1, dy: 0, maxStep: 8 },
      { dx: 0, dy: 1, maxStep: 8 },
    ];
  }
  return vectors;
}

function normalizeVectorsForDeath(
  piece: AiBoardPiece,
  vectors: AiPieceDefinition['moveVectors'],
): AiPieceDefinition['moveVectors'] {
  if (!isDeathPieceForLegal(piece)) return vectors;
  return [
    { dx: 0, dy: -1, maxStep: 1 },
    { dx: 0, dy: 1, maxStep: 1 },
    { dx: -1, dy: 1, maxStep: 1 },
    { dx: 1, dy: 1, maxStep: 1 },
  ];
}

/** 獣: 桂馬跳び＋その他1マス（m_piece_pattern_vector の beast と整合） */
function normalizeVectorsForBeast(
  piece: AiBoardPiece,
  vectors: AiPieceDefinition['moveVectors'],
): AiPieceDefinition['moveVectors'] {
  if (!isBeastPieceForLegal(piece)) return vectors;
  return [
    { dx: -1, dy: -2, maxStep: 1 },
    { dx: 1, dy: -2, maxStep: 1 },
    { dx: -1, dy: -1, maxStep: 1 },
    { dx: 1, dy: -1, maxStep: 1 },
    { dx: -1, dy: 0, maxStep: 1 },
    { dx: 1, dy: 0, maxStep: 1 },
    { dx: -1, dy: 1, maxStep: 1 },
    { dx: 1, dy: 1, maxStep: 1 },
  ];
}

/** 禽: 前後左右レイ（m_piece_pattern_vector の bird と整合） */
function normalizeVectorsForBird(
  piece: AiBoardPiece,
  vectors: AiPieceDefinition['moveVectors'],
): AiPieceDefinition['moveVectors'] {
  if (!isBirdPieceForLegal(piece)) return vectors;
  return [
    { dx: 0, dy: -1, maxStep: 8 },
    { dx: -1, dy: 0, maxStep: 8 },
    { dx: 1, dy: 0, maxStep: 8 },
    { dx: 0, dy: 1, maxStep: 8 },
  ];
}

function normalizeVectorsForSoul(
  piece: AiBoardPiece,
  vectors: AiPieceDefinition['moveVectors'],
): AiPieceDefinition['moveVectors'] {
  if (!isSoulPieceForLegal(piece)) return vectors;
  return [
    { dx: 0, dy: -1, maxStep: 1 },
    { dx: -1, dy: 0, maxStep: 1 },
    { dx: 1, dy: 0, maxStep: 1 },
    { dx: -1, dy: 1, maxStep: 1 },
    { dx: 1, dy: 1, maxStep: 1 },
  ];
}

/** 月: TURN（turnNumber）を 4 で割った余りが 0 または 1 のとき全方位 1 マス、2 または 3 のとき全方位 2 マス */
function moonOmnidirectionalMaxStep(position: AiBattlePosition): number {
  const t = Math.max(1, Math.floor(position.turnNumber));
  const r = ((t % 4) + 4) % 4;
  return r === 2 || r === 3 ? 2 : 1;
}

function normalizeVectorsForMoon(
  piece: AiBoardPiece,
  vectors: AiPieceDefinition['moveVectors'],
  position: AiBattlePosition,
): AiPieceDefinition['moveVectors'] {
  const baseCode = toBasePieceCode(piece.pieceCode);
  if (baseCode !== 'MOON' && piece.char !== '月') return vectors;
  const maxStep = moonOmnidirectionalMaxStep(position);
  return [
    { dx: -1, dy: -1, maxStep },
    { dx: 0, dy: -1, maxStep },
    { dx: 1, dy: -1, maxStep },
    { dx: -1, dy: 0, maxStep },
    { dx: 1, dy: 0, maxStep },
    { dx: -1, dy: 1, maxStep },
    { dx: 0, dy: 1, maxStep },
    { dx: 1, dy: 1, maxStep },
  ];
}

function backRowDeltaForBoatTowLegal(side: Side): number {
  return side === 'player' ? 1 : -1;
}

function isKingLikeForBoatTowLegal(piece: AiBoardPiece | null | undefined): boolean {
  if (!piece) return false;
  const base = toBasePieceCode(piece.pieceCode);
  return base === 'OU' || piece.char === '王' || piece.char === '玉';
}

/** 舟: 真後ろの味方を連れて行けるときのみ合法（玉は連れ不可、連れ先は空または舟の出発マス） */
function boatTowTargetCellAllowed(
  piece: AiBoardPiece,
  from: { row: number; col: number },
  to: { row: number; col: number },
  occupancy: OccupancyMap,
): boolean {
  const code = toBasePieceCode(piece.pieceCode);
  if (code !== 'BOAT' && piece.char !== '舟') return true;
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  const allyRow = from.row + backRowDeltaForBoatTowLegal(piece.side);
  const allyCol = from.col;
  const ally = findPieceAtFast(occupancy, allyRow, allyCol);
  if (!ally || ally.side !== piece.side) return true;
  if (isKingLikeForBoatTowLegal(ally)) return false;
  const destRow = allyRow + dr;
  const destCol = allyCol + dc;
  if (destRow < 0 || destRow > 8 || destCol < 0 || destCol > 8) return false;
  const occ = findPieceAtFast(occupancy, destRow, destCol);
  if (!occ) return true;
  return occ.row === from.row && occ.col === from.col;
}

function resolveEffectiveVectorsForPiece(
  piece: AiBoardPiece,
  pieceDef: AiPieceDefinition,
  position: AiBattlePosition,
  allPieces: AiBoardPiece[],
  lookups: AiPieceLookups,
  depth = 0,
): AiPieceDefinition['moveVectors'] {
  const asBookMovementOnlyVectors = (vectors: AiPieceDefinition['moveVectors']) =>
    vectors.map((v) => ({ dx: v.dx, dy: v.dy, maxStep: v.maxStep }));

  let didResolveBookCopiedVectors = false;
  if (depth <= 0 && isBookPiece(piece)) {
    const boardState = asRecord(position.boardState);
    const customMoveVectors = asRecord(boardState?.custom_move_vectors);
    const marker = lastMovedPieceForBook(position, piece);
    const markerVectorsRaw = marker?.copiedMoveVectors;
    if (Array.isArray(markerVectorsRaw) && markerVectorsRaw.length > 0) {
      const markerVectors = markerVectorsRaw
        .map((v) => asRecord(v))
        .filter((v): v is Record<string, unknown> => Boolean(v))
        .map((v) => {
          const dx = Number(v.dx);
          const dy = Number(v.dy);
          const maxStep = Number(v.maxStep);
          const captureMode = typeof v.captureMode === 'string' ? v.captureMode : undefined;
          return Number.isFinite(dx) && Number.isFinite(dy) && Number.isFinite(maxStep)
            ? {
                dx,
                dy,
                maxStep,
                ...(captureMode ? { captureMode } : {}),
              }
            : null;
        })
        .filter(
          (v): v is { dx: number; dy: number; maxStep: number; captureMode?: string } => v != null,
        );
      if (markerVectors.length > 0) {
        didResolveBookCopiedVectors = true;
        return asBookMovementOnlyVectors(markerVectors);
      }
    }
    const copied = marker
      ? // skill_state の side / code が壊れていても、盤上の同座標実体を最優先で使う。
        (allPieces.find((p) => p.row === marker.row && p.col === marker.col) ??
        allPieces.find(
          (p) => p.side === marker.side && p.row === marker.row && p.col === marker.col,
        ) ??
        marker)
      : null;
    if (copied && !isBookPiece(copied)) {
      const customVectorsRaw =
        customMoveVectors?.[String(copied.pieceCode ?? marker?.pieceCode ?? '').toUpperCase()];
      if (Array.isArray(customVectorsRaw) && customVectorsRaw.length > 0) {
        const customVectors = customVectorsRaw
          .map((v) => asRecord(v))
          .filter((v): v is Record<string, unknown> => Boolean(v))
          .map((v) => {
            const dc = Number(v.dc);
            const dr = Number(v.dr);
            const slide = v.slide === true;
            const captureMode = typeof v.capture_mode === 'string' ? v.capture_mode : undefined;
            if (!Number.isFinite(dc) || !Number.isFinite(dr)) return null;
            return {
              dx: dc,
              dy: dr,
              maxStep: slide ? 9 : 1,
              ...(captureMode ? { captureMode } : {}),
            };
          })
          .filter(
            (v): v is { dx: number; dy: number; maxStep: number; captureMode?: string } =>
              v != null,
          );
        if (customVectors.length > 0) {
          didResolveBookCopiedVectors = true;
          return asBookMovementOnlyVectors(customVectors);
        }
      }
      const copiedDef = resolvePieceDefForBookCopy(copied, lookups);
      if (copiedDef) {
        didResolveBookCopiedVectors = true;
        // 「書」はコピー元のベクトルをそのまま使い、向きは最終的に「書」自身の side で解決する。
        // ここで copy 元 side で正規化すると向きが逆転して合法手が空になるケースがある。
        return asBookMovementOnlyVectors(copiedDef.moveVectors);
      }
      if (isKingLikePieceForBook(copied)) {
        const kingDef = lookups.pieceDefsByCode.OU ?? lookups.pieceDefsByChar['王'] ?? null;
        if (kingDef) {
          didResolveBookCopiedVectors = true;
          return kingDef.moveVectors;
        }
      }
    }
    // 「書」は相手の直前着手を模倣。参照できないターンは前後左右1マス。
    if (!didResolveBookCopiedVectors) {
      return [
        { dx: 0, dy: -1, maxStep: 1 },
        { dx: 0, dy: 1, maxStep: 1 },
        { dx: -1, dy: 0, maxStep: 1 },
        { dx: 1, dy: 0, maxStep: 1 },
      ];
    }
  }
  if (depth <= 0 && isShinPiece(piece)) {
    const mimic = readShinTurnMimic(position, piece.side);
    if (!mimic) return [];
    const synthetic: AiBoardPiece = {
      ...piece,
      char: mimic.mimic_char,
      pieceCode: mimic.mimic_piece_code,
    };
    if (isShinPiece(synthetic)) return [];
    const mimicDef = resolvePieceDefForBookCopy(synthetic, lookups);
    if (!mimicDef) return [];
    return resolveEffectiveVectorsForPiece(
      synthetic,
      mimicDef,
      position,
      allPieces,
      lookups,
      isShinPiece(synthetic) ? 2 : 0,
    );
  }
  // 名刀「刀」: 前方ちょうど1マスのみ（テンプレは「上」基準、先手後手は getLegalTargetsFromVectors の orient で反映）
  if (isKatanaPiece(piece)) {
    return [{ dx: 0, dy: -1, maxStep: 1 }];
  }
  if (isRunPiece(piece)) {
    return [];
  }
  if (isTanePiece(piece)) {
    return TANE_SILVER_MOVE_VECTORS;
  }
  if (isKirinPiece(piece)) {
    return KIRIN_MOVE_VECTORS;
  }
  if (isMaiPiece(piece)) {
    return MAI_MOVE_VECTORS;
  }
  if (isShitsuPiece(piece)) {
    return SHITSU_MOVE_VECTORS;
  }
  if (isBakuPiece(piece)) {
    return BAKU_MOVE_VECTORS;
  }
  if (isAoriPiece(piece)) {
    return AORI_MOVE_VECTORS;
  }
  if (isTouPiece(piece)) {
    return TOU_MOVE_VECTORS;
  }
  if (isNigePiece(piece)) {
    return NIGE_MOVE_VECTORS;
  }
  if (isHenPiece(piece)) {
    return HEN_MOVE_VECTORS;
  }
  if (isItsuPiece(piece)) {
    return ITSU_MOVE_VECTORS;
  }
  if (isSadamePiece(piece)) {
    return SADAME_MOVE_VECTORS;
  }
  if (isEnPiece(piece)) {
    return EN_MOVE_VECTORS;
  }
  if (isKoPiece(piece)) {
    return KOU_MOVE_VECTORS;
  }
  if (isAnPiece(piece)) {
    return AN_MOVE_VECTORS;
  }
  if (isPhantomPiece(piece)) {
    return PHANTOM_MOVE_VECTORS;
  }
  if (isYamaPiece(piece)) {
    return YAMA_MOVE_VECTORS;
  }
  if (isShadowPiece(piece)) {
    return SHADOW_MOVE_VECTORS;
  }
  if (isCopperPiece(piece)) {
    return COPPER_MOVE_VECTORS;
  }
  if (isWavePiece(piece)) {
    return WAVE_MOVE_VECTORS;
  }
  if (isPigPiece(piece)) {
    return PIG_MOVE_VECTORS;
  }
  if (isUnpromotedSmallDragonPiece(piece)) {
    return RYU_DRAGON_MOVE_VECTORS;
  }
  const standardPromotedVectors = resolveStandardPromotedPieceMoveVectors(piece);
  if (standardPromotedVectors) {
    return standardPromotedVectors;
  }
  if (isSoPiece(piece)) {
    return SO_MOVE_VECTORS;
  }
  if (isSouPiece(piece)) {
    return SOU_MOVE_VECTORS;
  }
  if (isSearPiece(piece)) {
    return SEAR_MOVE_VECTORS;
  }
  if (isSautePiece(piece)) {
    return SAUTE_MOVE_VECTORS;
  }
  if (isShopPPiece(piece)) {
    return P_MOVE_VECTORS;
  }
  if (isNakuPiece(piece)) {
    return NAKU_MOVE_VECTORS;
  }
  if (isConcavePieceForLegal(piece)) {
    return CONCAVE_SLIDE_VECTORS;
  }
  const portedVectors = resolveIntrinsicPortedMoveVectors({
    char: piece.char,
    pieceCode: piece.pieceCode,
    promoted: piece.promoted,
  });
  if (portedVectors) {
    return portedVectors;
  }
  const baseMoveVectors =
    pieceDef.moveVectors.length === 0 && (isSenPiece(piece) || isZaiPiece(piece))
      ? SEN_ZAI_FALLBACK_MOVE_VECTORS
      : pieceDef.moveVectors;
  const bishopNormalized = normalizeVectorsForBishop(piece, baseMoveVectors);
  const goldNormalized = normalizeVectorsForGold(piece, bishopNormalized);
  const fixedHouseField = normalizeVectorsForFixedHouseField(piece, goldNormalized);
  const timeNormalized = normalizeVectorsForTime(piece, fixedHouseField);
  const peopleField = normalizeVectorsForPeopleWithAllyField(piece, timeNormalized, allPieces);
  const moonNormalized = normalizeVectorsForMoon(piece, peopleField, position);
  const oniNormalized = normalizeVectorsForOniVariants(piece, moonNormalized);
  const deathNormalized = normalizeVectorsForDeath(piece, oniNormalized);
  const beastBird = normalizeVectorsForBird(
    piece,
    normalizeVectorsForBeast(piece, deathNormalized),
  );
  return normalizeVectorsForSoul(piece, beastBird);
}

type ShinMimicPoolEntry = {
  char: string;
  pieceCode: string;
  name: string;
};

function boardPieceNeedsMinimalCatalogDef(piece: AiBoardPiece): boolean {
  return (
    isGunPiece(piece) ||
    isKatanaPiece(piece) ||
    isRunPiece(piece) ||
    isTanePiece(piece) ||
    isKirinPiece(piece) ||
    isMaiPiece(piece) ||
    isShitsuPiece(piece) ||
    isBakuPiece(piece) ||
    isAoriPiece(piece) ||
    isTouPiece(piece) ||
    isNigePiece(piece) ||
    isHenPiece(piece) ||
    isItsuPiece(piece) ||
    isSadamePiece(piece) ||
    isEnPiece(piece) ||
    isKoPiece(piece) ||
    isAnPiece(piece) ||
    isPhantomPiece(piece) ||
    isYamaPiece(piece) ||
    isSoPiece(piece) ||
    isSouPiece(piece) ||
    isShopPPiece(piece) ||
    isNakuPiece(piece) ||
    isBookPiece(piece) ||
    isAnyOniVariantPiece(piece) ||
    isBeastPieceForLegal(piece) ||
    isBirdPieceForLegal(piece) ||
    isConcavePieceForLegal(piece) ||
    isCowPiece(piece) ||
    isSenPiece(piece) ||
    isZaiPiece(piece)
  );
}

function buildShinMimicPool(
  pieceCatalog: AiPieceDefinition[],
  lookups: AiPieceLookups,
  position: AiBattlePosition,
  allPieces: AiBoardPiece[],
): ShinMimicPoolEntry[] {
  const seen = new Set<string>();
  const pool: ShinMimicPoolEntry[] = [];
  const probeRow = 4;
  const probeCol = 4;
  for (const def of pieceCatalog) {
    const ch = normKanjiForEngineRules(def.char);
    if (!ch || ch === '進' || seen.has(ch)) continue;
    seen.add(ch);
    const synthetic: AiBoardPiece = {
      side: 'player',
      row: probeRow,
      col: probeCol,
      char: def.char,
      pieceCode: def.pieceCode ?? CHAR_TO_CODE[ch as keyof typeof CHAR_TO_CODE] ?? def.char,
      promoted: false,
    };
    let pieceDef = resolvePieceDef(synthetic, lookups);
    if (!pieceDef && boardPieceNeedsMinimalCatalogDef(synthetic)) {
      pieceDef = { ...MINIMAL_SPECIAL_PIECE_DEF, char: def.char, name: def.name };
    }
    if (!pieceDef) continue;
    const vectors = resolveEffectiveVectorsForPiece(
      synthetic,
      pieceDef,
      position,
      allPieces,
      lookups,
      0,
    );
    if (vectors.length === 0) continue;
    pool.push({
      char: def.char,
      pieceCode: synthetic.pieceCode ?? def.pieceCode ?? '',
      name: def.name,
    });
  }
  return pool;
}

/** 手番開始時に「進」の模倣先を1種だけ確定し skill_state に保存する。 */
export function ensureShinTurnMimicForBattle(
  position: AiBattlePosition,
  pieceCatalog: AiPieceDefinition[],
): ShinTurnMimicEntry | null {
  const pieces = piecesFromBoardState(position);
  const side = position.sideToMove;
  if (!pieces.some((p) => p.side === side && isShinPiece(p))) {
    return readShinTurnMimic(position, side);
  }
  const lookups = getPieceLookups(pieceCatalog);
  return ensureShinTurnMimic(position, side, () => {
    const pool = buildShinMimicPool(pieceCatalog, lookups, position, pieces);
    if (pool.length === 0) return null;
    const seed = `${position.stateHash ?? ''}:${position.turnNumber}:${side}:${position.moveCount}`;
    const idx = stableHash(seed) % pool.length;
    const pick = pool[idx]!;
    return {
      mimic_char: pick.char,
      mimic_piece_code: pick.pieceCode,
      mimic_name: pick.name,
    };
  });
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const MIRROR_ORTHOGONAL_MOVE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 0, dy: 1, maxStep: 1 },
];

function findMirrorFrontFacingEnemy(
  pieces: AiBoardPiece[],
  mover: AiBoardPiece,
): AiBoardPiece | null {
  const forwardRowDelta = mover.side === 'player' ? -1 : 1;
  for (let i = 1; i < 9; i += 1) {
    const row = mover.row + forwardRowDelta * i;
    const col = mover.col;
    if (row < 0 || row > 8) break;
    const occupied = pieces.find((piece) => piece.row === row && piece.col === col) ?? null;
    if (!occupied) continue;
    if (occupied.side !== mover.side) return occupied;
    return null;
  }
  return null;
}

function isHousePieceForSkill(piece: AiBoardPiece): boolean {
  const code = toBasePieceCode(piece.pieceCode);
  if (code === 'HOUSE') return true;
  if (piece.char === '家') return true;
  return CHAR_TO_CODE[piece.char] === 'HOUSE';
}

function countPeoplePiecesOnBoard(pieces: AiBoardPiece[]): number {
  return pieces.filter((p) => {
    const c = toBasePieceCode(p.pieceCode);
    if (c === 'PEOPLE') return true;
    if (p.char === '民') return true;
    return CHAR_TO_CODE[p.char] === 'PEOPLE';
  }).length;
}

function hasAdjacentEnemyPiece(occupancy: OccupancyMap, piece: AiBoardPiece): boolean {
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const row = piece.row + dr;
      const col = piece.col + dc;
      if (row < 0 || row > 8 || col < 0 || col > 8) continue;
      const target = findPieceAtFast(occupancy, row, col);
      if (target && target.side !== piece.side) return true;
    }
  }
  return false;
}

function generateLeapOverOneTargets(
  occupancy: OccupancyMap,
  piece: AiBoardPiece,
  vectors: { dx: number; dy: number }[],
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  const seen = new Set<string>();
  for (const vector of vectors) {
    let r = piece.row + vector.dy;
    let c = piece.col + vector.dx;
    let platformFound = false;
    while (r >= 0 && r <= 8 && c >= 0 && c <= 8) {
      const target = findPieceAtFast(occupancy, r, c);
      if (target) {
        platformFound = true;
        r += vector.dy;
        c += vector.dx;
        break;
      }
      const key = `${r}:${c}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ row: r, col: c });
      }
      r += vector.dy;
      c += vector.dx;
    }
    if (!platformFound) continue;
    while (r >= 0 && r <= 8 && c >= 0 && c <= 8) {
      const target = findPieceAtFast(occupancy, r, c);
      if (!target) {
        r += vector.dy;
        c += vector.dx;
        continue;
      }
      if (target.side !== piece.side) {
        if (!isGiantPieceForEngine(target)) {
          const key = `${r}:${c}`;
          if (!seen.has(key)) {
            seen.add(key);
            out.push({ row: r, col: c });
          }
        }
      }
      break;
    }
  }
  return out;
}

function generateCloudTargetsFromVectors(
  occupancy: OccupancyMap,
  piece: AiBoardPiece,
  vectors: AiPieceDefinition['moveVectors'],
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  const seen = new Set<string>();
  const orient = piece.side === 'player' ? 1 : -1;
  for (const vector of vectors) {
    const maxStep = Math.max(1, vector.maxStep);
    const dx = vector.dx * orient;
    const dy = vector.dy * orient;
    for (let step = 1; step <= maxStep; step += 1) {
      const row = piece.row + dy * step;
      const col = piece.col + dx * step;
      if (row < 0 || row > 8 || col < 0 || col > 8) break;
      const occupied = findPieceAtFast(occupancy, row, col);
      if (occupied && occupied.side !== piece.side) {
        // 雲は敵駒を取れないため、敵駒マスは移動不可。
        break;
      }
      if (occupied && isCloudAlliedCaptureForbidden(occupied)) {
        // 雲でも味方の王/玉・ボス駒は取れない。
        break;
      }
      const key = `${row}:${col}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ row, col });
      }
      if (occupied) {
        // 味方駒を取った地点で停止。
        break;
      }
    }
  }
  return out;
}

const GIANT_BOARD_MOVE_NOTATION = 'giant_2x2_ortho';

function generateGiantOrthogonalBoardMoves(input: {
  pieces: AiBoardPiece[];
  piece: AiBoardPiece;
  position: AiBattlePosition;
  lookups: AiPieceLookups;
  occupancy: OccupancyMap;
  skillView: SkillRuntimeView;
  mover: AiBoardPiece;
  noCaptureOnly?: boolean;
}): AiBattleMove[] {
  const { mover, pieces, occupancy, skillView, lookups, noCaptureOnly } = input;
  const fr = mover.row;
  const fc = mover.col;
  if (!isValidGiantAnchor(fr, fc)) return [];
  const from = { row: fr, col: fc };
  const pieceCode = resolvePieceCodeForLegalMove(mover, lookups);
  const deltas = [-2, -1, 1, 2];
  const candidateAnchors: { row: number; col: number }[] = [];
  for (const d of deltas) {
    candidateAnchors.push({ row: fr + d, col: fc });
    candidateAnchors.push({ row: fr, col: fc + d });
  }
  const seen = new Set<string>();
  const moves: AiBattleMove[] = [];
  for (const to of candidateAnchors) {
    if (!isValidGiantAnchor(to.row, to.col)) continue;
    const tr = to.row;
    const tc = to.col;
    if (tr === fr && tc === fc) continue;
    const step = Math.abs(tr - fr) + Math.abs(tc - fc);
    if (step === 0 || step > 2) continue;
    if (tr !== fr && tc !== fc) continue;
    const key = `${tr}:${tc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const destCells = giantAnchorFootprint(tr, tc);
    let blocked = false;
    for (const c of destCells) {
      if (skillView.rockObstacleCells.has(`${c.row}:${c.col}`)) {
        blocked = true;
        break;
      }
      if (isBlockedByRockObstacle(skillView, c.row, c.col)) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    for (const c of destCells) {
      const occ = findPieceAtFast(occupancy, c.row, c.col);
      if (!occ) continue;
      if (occ.side === mover.side) {
        const isSelf = occ.row === mover.row && occ.col === mover.col && occ.side === mover.side;
        if (!isSelf) {
          blocked = true;
          break;
        }
      }
    }
    if (blocked) continue;
    if (noCaptureOnly) {
      const anyEnemy = destCells.some((c) => {
        const occ = findPieceAtFast(occupancy, c.row, c.col);
        return occ && occ.side !== mover.side;
      });
      if (anyEnemy) continue;
    }
    for (const c of destCells) {
      const occ = findPieceAtFast(occupancy, c.row, c.col);
      if (!occ || occ.side === mover.side) continue;
      if (isArmorPiece(occ)) {
        blocked = true;
        break;
      }
      if (isKingPiece(occ) && hasSoulOnBoardForSide(pieces, occ.side)) {
        blocked = true;
        break;
      }
      if (skillView.captureImmunityCells.has(`${occ.side}:${c.row}:${c.col}`)) {
        blocked = true;
        break;
      }
      if (skillView.darkBlindCells.has(`${occ.side}:${c.row}:${c.col}`)) {
        blocked = true;
        break;
      }
      if (isGiantPieceForEngine(occ)) {
        blocked = true;
        break;
      }
    }
    if (blocked) continue;
    const firstEnemyInDest = destCells
      .map((c) => findPieceAtFast(occupancy, c.row, c.col))
      .find((occ) => occ && occ.side !== mover.side);
    const capturedPieceCode =
      noCaptureOnly === true
        ? null
        : resolveCapturedPieceCodeForLegalMove(firstEnemyInDest ?? null);
    moves.push(
      createMove({
        from,
        to,
        pieceCode,
        promote: false,
        capturedPieceCode,
        notation: GIANT_BOARD_MOVE_NOTATION,
      }),
    );
  }
  return moves;
}

function generateBoardPieceMoves(input: {
  pieces: AiBoardPiece[];
  piece: AiBoardPiece;
  position: AiBattlePosition;
  lookups: AiPieceLookups;
  occupancy: OccupancyMap;
  skillView: SkillRuntimeView;
  noCaptureOnly?: boolean;
}): AiBattleMove[] {
  const pieceAfterSpring = effectivePieceForRulesAfterSpring(
    input.piece,
    input.pieces,
    input.lookups,
  );
  const mover =
    shinMimicMoveOverlay(pieceAfterSpring, input.position) ??
    pigInheritedMoveOverlay(pieceAfterSpring) ??
    pieceAfterSpring;
  if (isGiantPieceForEngine(mover)) {
    return generateGiantOrthogonalBoardMoves({
      ...input,
      mover,
    });
  }
  let pieceDef = resolvePieceDef(mover, input.lookups);
  if (isMachinePiece(mover)) {
    const donor = pickMachineDonorAlly(input.pieces, input.piece);
    if (donor) {
      const donorDef = resolvePieceDef(donor, input.lookups);
      if (donorDef && donorDef.moveVectors.length > 0) {
        pieceDef = donorDef;
      }
    }
  }
  if (
    !pieceDef &&
    (isGunPiece(mover) ||
      isKatanaPiece(mover) ||
      isRunPiece(mover) ||
      isTanePiece(mover) ||
      isKirinPiece(mover) ||
      isMaiPiece(mover) ||
      isShitsuPiece(mover) ||
      isBakuPiece(mover) ||
      isAoriPiece(mover) ||
      isTouPiece(mover) ||
      isNigePiece(mover) ||
      isHenPiece(mover) ||
      isItsuPiece(mover) ||
      isShinPiece(mover) ||
      isSadamePiece(mover) ||
      isEnPiece(mover) ||
      isKoPiece(mover) ||
      isAnPiece(mover) ||
      isPhantomPiece(mover) ||
      isYamaPiece(mover) ||
      isSoPiece(mover) ||
      isSouPiece(mover) ||
      isShopPPiece(mover) ||
      isNakuPiece(mover) ||
      isBookPiece(mover) ||
      isAnyOniVariantPiece(mover) ||
      isBeastPieceForLegal(mover) ||
      isBirdPieceForLegal(mover) ||
      isConcavePieceForLegal(mover) ||
      isCowPiece(mover) ||
      isSenPiece(mover) ||
      isZaiPiece(mover))
  ) {
    pieceDef = { ...MINIMAL_SPECIAL_PIECE_DEF, char: mover.char };
  }
  const bookCopiedPieceDef = isBookPiece(mover)
    ? (() => {
        const copied = lastMovedPieceForBook(input.position, mover);
        return copied ? resolvePieceDefForBookCopy(copied, input.lookups) : null;
      })()
    : null;
  if (bookCopiedPieceDef) {
    pieceDef = { ...bookCopiedPieceDef };
  }
  if (!pieceDef) return [];
  // 銃・刀はエンジン側でベクトルを上書きするため、カタログの moveVectors が空でも合法手を生成する。
  if (
    pieceDef.moveVectors.length === 0 &&
    !isBookPiece(mover) &&
    !isGunPiece(mover) &&
    !isKatanaPiece(mover) &&
    !isRunPiece(mover) &&
    !isTanePiece(mover) &&
    !isKirinPiece(mover) &&
    !isMaiPiece(mover) &&
    !isShitsuPiece(mover) &&
    !isBakuPiece(mover) &&
    !isAoriPiece(mover) &&
    !isTouPiece(mover) &&
    !isNigePiece(mover) &&
    !isHenPiece(mover) &&
    !isItsuPiece(mover) &&
    !isShinPiece(mover) &&
    !isSadamePiece(mover) &&
    !isEnPiece(mover) &&
    !isKoPiece(mover) &&
    !isAnPiece(mover) &&
    !isPhantomPiece(mover) &&
    !isYamaPiece(mover) &&
    !isSoPiece(mover) &&
    !isSouPiece(mover) &&
    !isShopPPiece(mover) &&
    !isNakuPiece(mover) &&
    !isAnyOniVariantPiece(mover) &&
    !isBeastPieceForLegal(mover) &&
    !isBirdPieceForLegal(mover) &&
    !isConcavePieceForLegal(mover) &&
    !isCowPiece(mover) &&
    !isSenPiece(mover) &&
    !isZaiPiece(mover)
  ) {
    return [];
  }
  let effectiveVectors = resolveEffectiveVectorsForPiece(
    mover,
    pieceDef,
    input.position,
    input.pieces,
    input.lookups,
  );
  if (isGunPiece(mover)) {
    effectiveVectors = [
      { dx: 0, dy: -1, maxStep: 2 },
      { dx: -1, dy: 1, maxStep: 2 },
      { dx: 1, dy: 1, maxStep: 2 },
    ];
  }
  let effectiveCanJump = pieceDef.canJump === true || bookCopiedPieceDef?.canJump === true;
  if (isBookPiece(mover)) {
    const copied = lastMovedPieceForBook(input.position, mover);
    const copiedDef = copied ? resolvePieceDefForBookCopy(copied, input.lookups) : null;
    if (copiedDef?.canJump === true) {
      effectiveCanJump = true;
    }
  }

  if (isMirrorPiece(mover)) {
    const frontEnemy = findMirrorFrontFacingEnemy(input.pieces, mover);
    if (frontEnemy) {
      const selectedDef = resolvePieceDef(frontEnemy, input.lookups);
      if (selectedDef && selectedDef.moveVectors.length > 0) {
        effectiveVectors = resolveEffectiveVectorsForPiece(
          frontEnemy,
          selectedDef,
          input.position,
          input.pieces,
          input.lookups,
        );
        effectiveCanJump = selectedDef.canJump === true;
      }
    } else {
      effectiveVectors = MIRROR_ORTHOGONAL_MOVE_VECTORS;
    }
  }

  if (hasOrthogonalAdjacentAllySaint(input.pieces, input.piece)) {
    effectiveVectors = applySaintAdjacentMoveRangeBuff(effectiveVectors);
  }
  if (hasAdjacentAllyMedicine(input.pieces, input.piece)) {
    effectiveVectors = applyMedicineAdjacentMoveRangeBuff(effectiveVectors);
  }
  if (hasSameRowAllyCherryBuff(input.pieces, input.piece)) {
    effectiveVectors = applyCherryRowMoveRangeBuff(effectiveVectors);
  }

  const leapVectors = effectiveVectors.filter((v) => isLeapOverOneMode(v.captureMode));
  const normalVectors = effectiveVectors.filter((v) => {
    if (isLeapOverOneMode(v.captureMode)) return false;
    // 銃の前方ちょうど2マス（1マス目に敵がいても2マス目へ）: generateGunForwardTargets が担当する。
    // テンプレ (0,-1) maxStep 2 を getLegalTargetsFromVectors に渡すと、1マス目の敵で打ち切られ 2マス目が出ない。
    if (isGunPiece(mover) && v.dx === 0 && v.dy === -1) return false;
    if (isRunPiece(mover) && v.dx === 0 && v.dy === -1) return false;
    // 牛の前方チャージ直進は generateCowForwardChargedTargets が担当（道中の敵を通過）。
    if (isCowPiece(mover) && v.dx === 0 && v.dy === -1) return false;
    return true;
  });
  const pathPieces = buildPathPiecesWithRockObstaclesOnEmptyCells(
    input.pieces,
    input.skillView,
    input.piece.side,
  );
  const pathOccupancy = buildOccupancyMap(pathPieces);
  let normalTargets = isCloudPiece(mover)
    ? generateCloudTargetsFromVectors(pathOccupancy, input.piece, normalVectors)
    : getLegalTargetsFromVectors(pathPieces, input.piece, normalVectors, 9, {
        canJump: effectiveCanJump,
      });
  if (isConcavePieceForLegal(mover)) {
    const pierce = generateConcaveEdgePierceTargets(pathOccupancy, input.piece);
    const seenN = new Set(normalTargets.map((t) => `${t.row}:${t.col}`));
    for (const t of pierce) {
      const k = `${t.row}:${t.col}`;
      if (seenN.has(k)) continue;
      seenN.add(k);
      normalTargets = [...normalTargets, t];
    }
  }
  const gunLineTargets =
    isGunPiece(mover) && !isMirrorPiece(mover)
      ? [
          ...generateGunForwardTargets(pathOccupancy, input.piece, input.pieces),
          ...generateGunBackDiagonalTargets(pathOccupancy, input.piece, input.pieces),
        ]
      : [];
  const gunLineKeySet =
    gunLineTargets.length > 0 ? new Set(gunLineTargets.map((t) => `${t.row}:${t.col}`)) : null;
  const cowForwardTargets =
    isCowPiece(mover) && !isMirrorPiece(mover)
      ? generateCowForwardChargedTargets({
          occupancy: pathOccupancy,
          piece: input.piece,
          skillView: input.skillView,
          pieces: input.pieces,
        })
      : [];
  const cowForwardKeySet =
    cowForwardTargets.length > 0
      ? new Set(cowForwardTargets.map((t) => `${t.row}:${t.col}`))
      : null;
  const runForwardTargets =
    isRunPiece(mover) && !isMirrorPiece(mover)
      ? generateRunForwardTargets(pathOccupancy, input.piece, input.pieces)
      : [];
  const runForwardKeySet =
    runForwardTargets.length > 0
      ? new Set(runForwardTargets.map((t) => `${t.row}:${t.col}`))
      : null;
  const leapTargets = generateLeapOverOneTargets(pathOccupancy, input.piece, leapVectors);
  const reflectiveTargets = isReflectivePiece(mover)
    ? generateReflectiveTargets(pathOccupancy, input.piece)
    : [];
  const enKingFrontTarget = enAllyKingFrontTarget(input.piece, input.pieces);
  const targetsRaw = [
    ...normalTargets,
    ...gunLineTargets,
    ...cowForwardTargets,
    ...runForwardTargets,
    ...leapTargets,
    ...reflectiveTargets,
    ...(enKingFrontTarget ? [enKingFrontTarget] : []),
  ];
  const seenTargetKeys = new Set<string>();
  const targets = targetsRaw.filter((t) => {
    const k = `${t.row}:${t.col}`;
    if (seenTargetKeys.has(k)) return false;
    seenTargetKeys.add(k);
    return true;
  });
  // 「書」はコピー元の移動レンジをそのまま使うため、セル制約ルールの上書きは適用しない。
  const movementRule = isBookPiece(input.piece)
    ? null
    : (input.skillView.movementRulesByCell.get(
        `${input.piece.side}:${input.piece.row}:${input.piece.col}`,
      ) ?? null);
  const peopleFieldBuff = hasPeopleFieldBuffOnBoard(input.piece, input.pieces);
  let filteredTargets =
    movementRule === 'vertical_step_only'
      ? targets.filter(
          (target) =>
            target.col === input.piece.col && Math.abs(target.row - input.piece.row) === 1,
        )
      : movementRule === 'orthogonal_step_only'
        ? targets.filter((target) => {
            const adr = Math.abs(target.row - input.piece.row);
            const adc = Math.abs(target.col - input.piece.col);
            if (adr + adc === 1) return true;
            // 畑バフの斜め1マスは orthogonal 制限から除外（合法手・ハイライトと一致させる）
            if (peopleFieldBuff && adr === 1 && adc === 1) return true;
            return false;
          })
        : movementRule === 'diagonal_forward_step_only'
          ? diagonalForwardStepCells(input.piece.side, input.piece.row, input.piece.col)
          : targets;

  // 銃の前方2マス貫通・斜め後ろ2マス／牛の前方チャージは 2 マス以上のため、縦1マス／直交1マス制限だけだと誤って除外される。復元する。
  if (
    !isMirrorPiece(input.piece) &&
    (movementRule === 'vertical_step_only' || movementRule === 'orthogonal_step_only')
  ) {
    const seenF = new Set(filteredTargets.map((t) => `${t.row}:${t.col}`));
    if (gunLineKeySet && isGunPiece(mover)) {
      for (const t of targets) {
        const k = `${t.row}:${t.col}`;
        if (!gunLineKeySet.has(k) || seenF.has(k)) continue;
        seenF.add(k);
        filteredTargets.push(t);
      }
    }
    if (cowForwardKeySet && isCowPiece(mover)) {
      for (const t of targets) {
        const k = `${t.row}:${t.col}`;
        if (!cowForwardKeySet.has(k) || seenF.has(k)) continue;
        seenF.add(k);
        filteredTargets.push(t);
      }
    }
    if (runForwardKeySet && isRunPiece(mover)) {
      for (const t of targets) {
        const k = `${t.row}:${t.col}`;
        if (!runForwardKeySet.has(k) || seenF.has(k)) continue;
        seenF.add(k);
        filteredTargets.push(t);
      }
    }
  }

  const arrowFilteredTargets = filteredTargets.filter((target) =>
    isArrowTileTargetAllowed(input.skillView, input.piece, target, input.occupancy),
  );

  const captureFilteredTargets = arrowFilteredTargets.filter((target) => {
    const captured = occupantForArrowAwareTarget(
      input.skillView,
      input.occupancy,
      target,
      input.piece,
    );
    if (!captured) return true;
    if (input.noCaptureOnly === true) return false;
    if (isCloudPiece(mover)) {
      // 雲: 敵は取れず、味方のみ取れる（ただし味方王/玉・ボス駒は不可）。
      return captured.side === input.piece.side && !isCloudAlliedCaptureForbidden(captured);
    }
    if (captured.side === input.piece.side) return false;
    if (isKingPiece(captured) && hasSoulOnBoardForSide(input.pieces, captured.side)) {
      return false;
    }
    if (isArmorPiece(captured)) return false;
    if (isKirinCaptureBlocked(mover, captured)) return false;
    if (captured.side !== input.piece.side && isArmorPiece(mover)) return false;
    if (
      input.skillView.captureImmunityCells.has(`${captured.side}:${captured.row}:${captured.col}`)
    ) {
      return false;
    }
    return !input.skillView.darkBlindCells.has(`${captured.side}:${captured.row}:${captured.col}`);
  });

  const hazardFilteredTargets = captureFilteredTargets.filter(
    (target) =>
      !isKingBlockedByPoisonCell(input.skillView, input.piece, target.row, target.col) &&
      !isBlockedByRockObstacle(input.skillView, target.row, target.col),
  );

  const from = { row: input.piece.row, col: input.piece.col };
  const boatFilteredTargets = hazardFilteredTargets.filter((target) =>
    boatTowTargetCellAllowed(input.piece, from, target, input.occupancy),
  );
  const pieceCode = resolvePieceCodeForLegalMove(input.piece, input.lookups);

  if (isGunPiece(mover)) {
    gunPieceDebugLog('合法手パイプライン', {
      at: [input.piece.row, input.piece.col],
      side: input.piece.side,
      char: input.piece.char,
      resolvedPieceCode: pieceCode,
      movementRule,
      gunLineTargets,
      countTargets: targets.length,
      countAfterMoveRule: filteredTargets.length,
      countAfterCapture: captureFilteredTargets.length,
      countAfterHazard: hazardFilteredTargets.length,
      countAfterBoat: boatFilteredTargets.length,
      cellsAfterBoat: boatFilteredTargets.map((t) => ({ row: t.row, col: t.col })),
    });
  }

  const moves = boatFilteredTargets.flatMap((target) => {
    const captured = occupantForArrowAwareTarget(
      input.skillView,
      input.occupancy,
      target,
      input.piece,
    );
    const capturedPieceCode =
      input.noCaptureOnly === true ? null : resolveCapturedPieceCodeForLegalMove(captured);
    const transformedByA = isATransformedPawn(input.skillView, input.piece);
    const promote = transformedByA ? false : canPromoteByMove(input.piece, from, target, 9);
    const mustPromote = transformedByA ? false : mustPromoteByMove(input.piece, target, 9);
    if (!promote) {
      return [createMove({ from, to: target, pieceCode, promote: false, capturedPieceCode })];
    }
    if (mustPromote) {
      return [createMove({ from, to: target, pieceCode, promote: true, capturedPieceCode })];
    }
    return [
      createMove({ from, to: target, pieceCode, promote: false, capturedPieceCode }),
      createMove({ from, to: target, pieceCode, promote: true, capturedPieceCode }),
    ];
  });
  return moves;
}

function generateDropMoves(input: {
  pieces: AiBoardPiece[];
  position: AiBattlePosition;
  skillView: SkillRuntimeView;
  maxPieceCostCap?: number | null;
}): AiBattleMove[] {
  const bag = input.position.hands[input.position.sideToMove] ?? {};
  const moves: AiBattleMove[] = [];

  for (const [pieceCodeRaw, count] of Object.entries(bag)) {
    const pieceCode = toBasePieceCode(pieceCodeRaw);
    if (!pieceCode || typeof count !== 'number' || count <= 0) continue;
    if (
      input.maxPieceCostCap != null &&
      deckBuilderCostForHandPieceCode(pieceCode) > input.maxPieceCostCap
    ) {
      continue;
    }

    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        if (input.skillView.rockObstacleCells.has(`${row}:${col}`)) {
          continue;
        }
        if (
          input.skillView.thornDropBlockedCells.has(`${input.position.sideToMove}:${row}:${col}`)
        ) {
          continue;
        }
        if (
          !canDropPiece(
            input.pieces,
            input.position.hands,
            input.position.sideToMove,
            pieceCode,
            { row, col },
            9,
          )
        ) {
          continue;
        }
        moves.push(
          createMove({
            from: null,
            to: { row, col },
            pieceCode,
            promote: false,
            dropPieceCode: pieceCode,
            notation: `${pieceCode}*${row}${col}`,
          }),
        );
      }
    }
  }

  return moves;
}

function sideOpponent(side: Side): Side {
  return side === 'player' ? 'enemy' : 'player';
}

function simulatePiecesAfterMove(input: {
  pieces: AiBoardPiece[];
  move: AiBattleMove;
  actorSide: Side;
  skillView: SkillRuntimeView;
}): AiBoardPiece[] {
  const { pieces, move, actorSide, skillView } = input;
  const next = pieces.map((piece) => ({ ...piece }));

  if (move.notation === 'time_skill_only' || move.notation === 'house_skill_only') {
    return next;
  }

  if (move.dropPieceCode) {
    const pieceCode = toBasePieceCode(move.dropPieceCode);
    if (!pieceCode) return next;
    const drop: AiBoardPiece = {
      side: actorSide,
      row: move.toRow,
      col: move.toCol,
      pieceCode,
      char: CODE_TO_CHAR[pieceCode as keyof typeof CODE_TO_CHAR] ?? pieceCode,
      promoted: false,
      imageSignedUrl: null,
    };
    const slide = arrowSlideTargetForCell(skillView, move.toRow, move.toCol);
    if (!slide) {
      next.push(drop);
      return next;
    }
    return [
      ...next.filter(
        (piece) =>
          !(piece.side !== actorSide && piece.row === slide.row && piece.col === slide.col),
      ),
      { ...drop, row: slide.row, col: slide.col },
    ];
  }

  if (move.fromRow == null || move.fromCol == null) return next;
  const moving = next.find(
    (piece) => piece.side === actorSide && piece.row === move.fromRow && piece.col === move.fromCol,
  );
  if (!moving) return next;

  if (isGiantPieceForEngine(moving)) {
    const destCells = giantAnchorFootprint(move.toRow, move.toCol);
    return [
      ...next.filter((piece) => {
        if (piece === moving) return false;
        if (piece.side === actorSide) return true;
        return !destCells.some((cell) => cell.row === piece.row && cell.col === piece.col);
      }),
      {
        ...moving,
        row: move.toRow,
        col: move.toCol,
        promoted: move.promote ? true : (moving.promoted ?? false),
      },
    ];
  }

  let withoutCaptured = next.filter((piece) => {
    if (piece === moving) return false;
    if (piece.side === actorSide) return true;
    return !(piece.row === move.toRow && piece.col === move.toCol);
  });
  let moved: AiBoardPiece = {
    ...moving,
    row: move.toRow,
    col: move.toCol,
    promoted: move.promote ? true : (moving.promoted ?? false),
  };
  const slide = arrowSlideTargetForCell(skillView, move.toRow, move.toCol);
  if (slide) {
    withoutCaptured = withoutCaptured.filter(
      (piece) => !(piece.side !== actorSide && piece.row === slide.row && piece.col === slide.col),
    );
    moved = { ...moved, row: slide.row, col: slide.col };
  }
  return [...withoutCaptured, moved];
}

function isKingInCheck(input: {
  pieces: AiBoardPiece[];
  side: Side;
  position: AiBattlePosition;
  lookups: AiPieceLookups;
}): boolean {
  const king = input.pieces.find((piece) => piece.side === input.side && isKingPiece(piece));
  if (!king) return false;

  const opponent = sideOpponent(input.side);
  const attackPosition: AiBattlePosition = {
    ...input.position,
    sideToMove: opponent,
    boardState: {
      ...(input.position.boardState ?? {}),
      pieces: input.pieces,
    },
  };
  const skillView = createSkillRuntimeView(attackPosition);
  const occupancy = buildOccupancyMap(input.pieces);
  const attackers = input.pieces.filter((piece) => piece.side === opponent);

  return attackers
    .filter(
      (piece) =>
        isKingPiece(piece) ||
        isGiantPieceForEngine(piece) ||
        !skillView.immobilizedCells.has(`${piece.side}:${piece.row}:${piece.col}`),
    )
    .some((piece) =>
      generateBoardPieceMoves({
        pieces: input.pieces,
        piece,
        position: attackPosition,
        lookups: input.lookups,
        occupancy,
        skillView,
      }).some((move) => move.toRow === king.row && move.toCol === king.col),
    );
}

function filterMovesLeavingOwnKingSafe(input: {
  moves: AiBattleMove[];
  pieces: AiBoardPiece[];
  position: AiBattlePosition;
  lookups: AiPieceLookups;
  skillView: SkillRuntimeView;
}): AiBattleMove[] {
  return input.moves.filter((move) => {
    const nextPieces = simulatePiecesAfterMove({
      pieces: input.pieces,
      move,
      actorSide: input.position.sideToMove,
      skillView: input.skillView,
    });
    return !isKingInCheck({
      pieces: nextPieces,
      side: input.position.sideToMove,
      position: input.position,
      lookups: input.lookups,
    });
  });
}

export type GenerateLegalMovesOptions = {
  /** false のとき王手放置・玉の自取りも含めて合法手とする（オンライン対戦向け） */
  enforceKingSafety?: boolean;
};

export function generateLegalMoves(input: {
  position: AiBattlePosition;
  pieceCatalog: AiPieceDefinition[];
  options?: GenerateLegalMovesOptions;
}) {
  const position = normalizeBattlePosition(input.position);
  position.hands = {
    player: sanitizeHandsBag(position.hands.player),
    enemy: sanitizeHandsBag(position.hands.enemy),
  } satisfies AiHandsState;
  ensureShinTurnMimicForBattle(position, input.pieceCatalog);
  const pieces = piecesFromBoardState(position);
  const occupancy = buildOccupancyMap(pieces);
  const lookups = getPieceLookups(input.pieceCatalog);
  const skillView = createSkillRuntimeView(position);
  const sadameCostCap = activeOpponentTurnMaxPieceCostCap(position, position.sideToMove);
  const activePiecesRaw = pieces.filter((piece) => piece.side === position.sideToMove);
  const convexFollowup = activeConvexFollowupForSide(position);
  const otsuFollowup = activeOtsuFollowupForSide(position);
  const lockedFollowup = convexFollowup ?? otsuFollowup;
  const activePieces =
    lockedFollowup == null
      ? activePiecesRaw
      : activePiecesRaw.filter(
          (piece) => piece.row === lockedFollowup.row && piece.col === lockedFollowup.col,
        );

  const sadameEligiblePieces =
    sadameCostCap == null
      ? activePieces
      : activePieces.filter((piece) => {
          if (isKingPiece(piece)) return true;
          if (isGiantPieceForEngine(piece)) {
            return deckBuilderCostForBoardPiece(piece) <= sadameCostCap;
          }
          return deckBuilderCostForBoardPiece(piece) <= sadameCostCap;
        });

  const boardMoves = sadameEligiblePieces
    .filter(
      (piece) =>
        isKingPiece(piece) ||
        isGiantPieceForEngine(piece) ||
        !skillView.immobilizedCells.has(`${piece.side}:${piece.row}:${piece.col}`),
    )
    .flatMap((piece) =>
      generateBoardPieceMoves({
        pieces,
        piece,
        position,
        lookups,
        occupancy,
        skillView,
        noCaptureOnly: otsuFollowup != null,
      }),
    );
  const timeSkillOnlyMoves = (lockedFollowup == null ? sadameEligiblePieces : [])
    .filter((piece) => {
      const code = toBasePieceCode(piece.pieceCode);
      return code === 'TIME' || piece.char === '時';
    })
    .filter((piece) => hasAdjacentEnemyPiece(occupancy, piece))
    .map((piece) =>
      createMove({
        from: { row: piece.row, col: piece.col },
        to: { row: piece.row, col: piece.col },
        pieceCode: toBasePieceCode(piece.pieceCode) ?? 'TIME',
        promote: false,
        notation: 'time_skill_only',
      }),
    );
  const peopleCount = countPeoplePiecesOnBoard(pieces);
  const houseSkillOnlyMoves =
    lockedFollowup != null
      ? []
      : peopleCount < 5
        ? sadameEligiblePieces
            .filter((piece) => isHousePieceForSkill(piece))
            .map((piece) =>
              createMove({
                from: { row: piece.row, col: piece.col },
                to: { row: piece.row, col: piece.col },
                pieceCode: toBasePieceCode(piece.pieceCode) ?? 'HOUSE',
                promote: false,
                notation: 'house_skill_only',
              }),
            )
        : [];
  const dropMoves =
    lockedFollowup != null
      ? []
      : generateDropMoves({ pieces, position, skillView, maxPieceCostCap: sadameCostCap });

  const combined = [...boardMoves, ...timeSkillOnlyMoves, ...houseSkillOnlyMoves, ...dropMoves];
  const legalMoves = expandHeartProtectSkillMovesForLegalListing(
    expandSatoriSkillMovesForLegalListing(combined, pieces, position.sideToMove),
    pieces,
    position.sideToMove,
  );
  const enforceKingSafety = input.options?.enforceKingSafety !== false;
  const resolvedLegalMoves = enforceKingSafety
    ? filterMovesLeavingOwnKingSafe({
        moves: legalMoves,
        pieces,
        position,
        lookups,
        skillView,
      })
    : legalMoves;

  return {
    sideToMove: position.sideToMove,
    moveNo: position.moveCount + 1,
    stateHash: position.stateHash,
    legalMoves: resolvedLegalMoves,
  };
}
