import {
  addHandPiece,
  capturedToHandPieceCode,
  hasKing,
  normalizeHandsStateKeys,
} from '@/features/stage-shogi/domain/game-rules';
import type {
  AiBattleMove,
  AiBattlePosition,
  AiBoardPiece,
  AiPieceDefinition,
  Side,
} from '@/ai/model';
import type { SkillVisualEffect } from '@/domain/battle/skill-visual-effect';
import { boardSkillFxPlacement, createSkillVisualEffect } from '@/domain/battle/skill-visual-fx';
import type {
  BattleCanonicalPosition,
  BattleCommittedMove,
  BattleGameStatus,
  BattleMove,
} from '@/usecases/stage-battle/game-move-contract';
import {
  normalizeBattleMove,
  normalizeBattlePosition,
  piecesFromBoardState,
  sanitizeHandsBag,
  toBasePieceCode,
} from '@/ai/model';
import { assertMoveAllowedBySessionCatalog } from '@/ai/engine/guardrails';
import {
  giantAnchorFootprint,
  isGiantPieceForEngine,
  isValidGiantAnchor,
} from '@/ai/engine/giant-piece';
import { arrowDirectionAt, arrowSlideDestination } from '@/ai/engine/arrow-tile';
import { createPosition, findPieceAt, notationForMove, pieceChar } from '@/ai/engine/shared';
import { ensureShinTurnMimicForBattle, generateLegalMoves } from '@/ai/engine/legal-moves';
import {
  createSkillRuntimeView,
  applyBoardHazardsOnLanding,
  applyMoveSkillEffects,
  applyCookingCaptureSummonEffects,
  tickSkillStateDurations,
  resolveEvadeCaptureProcChanceForPiece,
  pieceHasActiveCaptureImmunityFromBoardState,
  type SkillRuntimeView,
} from '@/ai/engine/skill-runtime';
import {
  isArmorPiece as isArmorPieceForApply,
  isConvexPiece as isConvexPieceForApply,
  isCowPiece as isCowPieceForApply,
  isDeathPiece as isDeathPieceForApply,
  isGunPiece as isGunPieceForApply,
  isKirinCaptureBlocked,
  isHolePiece as isHolePieceForApply,
  isKatanaPiece as isKatanaPieceForApply,
  isNakuPiece as isNakuPieceForApply,
  isSameEnemyPieceTypeForNakuPon,
  isKbossPiece,
  isKenSwordPiece as isKenSwordPieceForApply,
  isKingPiece as isKingPieceForApply,
  isOboroPiece as isOboroPieceForApply,
  isOtsuPiece as isOtsuPieceForApply,
  isPigPiece as isPigPieceForApply,
  isReiRitualPiece,
  isSenPiece as isSenPieceForApply,
  isShieldPiece as isShieldPieceForApply,
  isSoulPiece as isSoulPieceForApply,
  isSpiritPiece,
  isVanishOnCapturePiece,
  isZaiPiece as isZaiPieceForApply,
} from '@/ai/engine/piece-identifiers';
import {
  hasActiveCellStatus,
  readFollowupCellForSide,
  removeCellStatus,
} from '@/ai/engine/skill-state-selectors';

function createGameStatus(winnerSide: Side | null): BattleGameStatus {
  if (winnerSide === 'player') {
    return { status: 'finished', result: 'player_win', winnerSide: 'player' };
  }
  if (winnerSide === 'enemy') {
    return { status: 'finished', result: 'enemy_win', winnerSide: 'enemy' };
  }
  return { status: 'in_progress', result: null, winnerSide: null };
}

const CHRYSANTHEMUM_REVIVAL_STATUS = 'chrysanthemum_revival';

function hasActiveChrysanthemumRevival(
  boardState: Record<string, unknown> | undefined,
  side: Side,
  row: number,
  col: number,
): boolean {
  return hasActiveCellStatus(boardState, side, CHRYSANTHEMUM_REVIVAL_STATUS, row, col);
}

/** 盤上の復活マーカーを除去（着手後の座標追従前に呼ぶ想定でも可） */
function removeChrysanthemumRevivalAtCell(
  boardState: Record<string, unknown> | undefined,
  side: Side,
  row: number,
  col: number,
): void {
  removeCellStatus(boardState, side, CHRYSANTHEMUM_REVIVAL_STATUS, row, col);
}

function resolveCapturedHandCode(
  captured: AiBoardPiece,
  fallbackCapturedCode: string | null,
): string | null {
  const rawCapturedCode = (captured.pieceCode ?? '').toUpperCase();
  const capturedChar = (() => {
    try {
      return (captured.char ?? '').normalize('NFKC');
    } catch {
      return captured.char ?? '';
    }
  })();
  if (
    capturedChar === '書' ||
    capturedChar === '書物' ||
    rawCapturedCode.includes('5D848242A136')
  ) {
    return 'BOOK';
  }
  if (capturedChar === '封' || rawCapturedCode.includes('7000FED9D9D4')) {
    return 'SEAL';
  }
  if (capturedChar === '轟' || rawCapturedCode.includes('D24741D0EF18')) {
    return 'BIGNOISE';
  }
  if (capturedChar === '犇' || rawCapturedCode.includes('1275B5728D1C')) {
    return 'BULL';
  }
  if (rawCapturedCode.includes('BOOK')) {
    return 'BOOK';
  }
  if (rawCapturedCode.includes('SEAL')) {
    return 'SEAL';
  }
  if (rawCapturedCode.includes('BIGNOISE')) {
    return 'BIGNOISE';
  }
  if (rawCapturedCode.includes('BULL')) {
    return 'BULL';
  }
  if (capturedChar === '礼' || rawCapturedCode.includes('4FCDDF14D08D')) {
    return 'RITUAL';
  }
  if (capturedChar === '聖' || rawCapturedCode.includes('A3BAB6C13DC7')) {
    return 'SAINT';
  }
  if (rawCapturedCode.includes('RITUAL')) {
    return 'RITUAL';
  }
  if (rawCapturedCode.includes('SAINT')) {
    return 'SAINT';
  }
  if (capturedChar === '穴' || rawCapturedCode.includes('E381DFA07A3D')) {
    return 'HOLE';
  }
  if (capturedChar === '淵' || rawCapturedCode.includes('31CB39CC0FA8')) {
    return 'ABYSS';
  }
  if (rawCapturedCode.includes('HOLE')) {
    return 'HOLE';
  }
  if (rawCapturedCode.includes('ABYSS')) {
    return 'ABYSS';
  }
  if (capturedChar === '獣' || rawCapturedCode.includes('05E4EFB89DAE')) {
    return 'BEAST';
  }
  if (capturedChar === '禽' || rawCapturedCode.includes('29ECAB1EF3C3')) {
    return 'BIRD';
  }
  if (rawCapturedCode.includes('BEAST')) {
    return 'BEAST';
  }
  if (rawCapturedCode.includes('BIRD')) {
    return 'BIRD';
  }
  if (capturedChar === '悟' || rawCapturedCode.includes('6D4AFA9CDF1C')) {
    return 'SATORI';
  }
  if (capturedChar === '心' || rawCapturedCode.includes('CA16911978FF')) {
    return 'HEART';
  }
  if (capturedChar === '鬱' || rawCapturedCode.includes('9E27F89F65C5')) {
    return 'DEPRESSION';
  }
  if (capturedChar === '乙' || rawCapturedCode.includes('5A07CA59B158')) {
    return 'OTSU';
  }
  if (capturedChar === '薔' || rawCapturedCode.includes('A49C1E52B47A')) {
    return 'ROSE';
  }
  if (capturedChar === '菊' || rawCapturedCode.includes('8254C41BA326')) {
    return 'CHRYSANTHEMUM';
  }
  if (capturedChar === '桜' || rawCapturedCode.includes('124C31EA5D7A')) {
    return 'CHERRY';
  }
  if (capturedChar === '凹' || rawCapturedCode.includes('48204DCCFA56')) {
    return 'CONCAVE';
  }
  if (capturedChar === '凸' || rawCapturedCode.includes('94B641477E72')) {
    return 'CONVEX';
  }
  if (capturedChar === '焼' || rawCapturedCode.includes('FDC83CF95746')) {
    return 'SEAR';
  }
  if (capturedChar === '炒' || rawCapturedCode.includes('1732246A37D8')) {
    return 'SAUTE';
  }
  if (capturedChar === '煮' || rawCapturedCode.includes('8DE5676A5E92')) {
    return 'STEW';
  }
  if (capturedChar === '陽' || rawCapturedCode.includes('313B9456C8AC')) {
    return 'YANG';
  }
  if (capturedChar === '陰' || rawCapturedCode.includes('A67CE76969F7')) {
    return 'YIN';
  }
  if (capturedChar === '牛' || rawCapturedCode.includes('F75D88C48D6D')) {
    return 'COW';
  }
  if (capturedChar === '豚' || rawCapturedCode.includes('3EFA5702E75B')) {
    return 'PIG';
  }
  if (capturedChar === '鶏' || rawCapturedCode.includes('F1A6EF3B99DF')) {
    return 'CHICKEN';
  }
  if (capturedChar === '銭' || rawCapturedCode.includes('EACC7F540399')) {
    return 'SEN';
  }
  if (capturedChar === '財' || rawCapturedCode.includes('7FC715661514')) {
    return 'ZAI';
  }
  if (rawCapturedCode.includes('SATORI')) {
    return 'SATORI';
  }
  if (rawCapturedCode.includes('HEART')) {
    return 'HEART';
  }
  if (rawCapturedCode.includes('DEPRESSION')) {
    return 'DEPRESSION';
  }
  if (rawCapturedCode.includes('OTSU')) {
    return 'OTSU';
  }
  if (rawCapturedCode.includes('ROSE')) {
    return 'ROSE';
  }
  if (rawCapturedCode.includes('CHRYSANTHEMUM')) {
    return 'CHRYSANTHEMUM';
  }
  if (rawCapturedCode.includes('CHERRY')) {
    return 'CHERRY';
  }
  if (rawCapturedCode.includes('CONCAVE')) {
    return 'CONCAVE';
  }
  if (rawCapturedCode.includes('CONVEX')) {
    return 'CONVEX';
  }
  if (rawCapturedCode.includes('SEAR')) {
    return 'SEAR';
  }
  if (rawCapturedCode.includes('SAUTE')) {
    return 'SAUTE';
  }
  if (rawCapturedCode.includes('STEW')) {
    return 'STEW';
  }
  if (rawCapturedCode.includes('YANG')) {
    return 'YANG';
  }
  if (rawCapturedCode.includes('YIN')) {
    return 'YIN';
  }
  if (rawCapturedCode.includes('COW')) {
    return 'COW';
  }
  if (rawCapturedCode.includes('PIG')) {
    return 'PIG';
  }
  if (rawCapturedCode.includes('CHICKEN')) {
    return 'CHICKEN';
  }
  if (rawCapturedCode.includes('SEN')) {
    return 'SEN';
  }
  if (rawCapturedCode.includes('ZAI')) {
    return 'ZAI';
  }
  if (
    capturedChar === '巨' ||
    rawCapturedCode.includes('C4AEB81F3634') ||
    rawCapturedCode.includes('GIANT')
  ) {
    return 'GIANT';
  }
  if (capturedChar === '進' || rawCapturedCode.includes('GACHA_SHIN')) {
    return 'GACHA_SHIN';
  }
  if (rawCapturedCode.includes('GACHA_')) {
    const fromRules = toBasePieceCode(capturedToHandPieceCode(captured));
    if (fromRules) return fromRules;
  }
  const fromCaptured = toBasePieceCode(capturedToHandPieceCode(captured));
  if (fromCaptured) return fromCaptured;
  const fb = toBasePieceCode(fallbackCapturedCode);
  if (!fb) return null;
  if (fb.includes('BOOK') || fb.includes('5D848242A136')) return 'BOOK';
  if (fb.includes('SEAL') || fb.includes('7000FED9D9D4')) return 'SEAL';
  if (fb.includes('RITUAL') || fb.includes('4FCDDF14D08D')) return 'RITUAL';
  if (fb.includes('SAINT') || fb.includes('A3BAB6C13DC7')) return 'SAINT';
  if (fb.includes('HOLE') || fb.includes('E381DFA07A3D')) return 'HOLE';
  if (fb.includes('ABYSS') || fb.includes('31CB39CC0FA8')) return 'ABYSS';
  if (fb.includes('BEAST') || fb.includes('05E4EFB89DAE')) return 'BEAST';
  if (fb.includes('BIRD') || fb.includes('29ECAB1EF3C3')) return 'BIRD';
  if (fb.includes('SATORI') || fb.includes('6D4AFA9CDF1C')) return 'SATORI';
  if (fb.includes('HEART') || fb.includes('CA16911978FF')) return 'HEART';
  if (fb.includes('DEPRESSION') || fb.includes('9E27F89F65C5')) return 'DEPRESSION';
  if (fb.includes('OTSU') || fb.includes('5A07CA59B158')) return 'OTSU';
  if (fb.includes('ROSE') || fb.includes('A49C1E52B47A')) return 'ROSE';
  if (fb.includes('CHRYSANTHEMUM') || fb.includes('8254C41BA326')) return 'CHRYSANTHEMUM';
  if (fb.includes('CHERRY') || fb.includes('124C31EA5D7A')) return 'CHERRY';
  if (fb.includes('CONCAVE') || fb.includes('48204DCCFA56')) return 'CONCAVE';
  if (fb.includes('CONVEX') || fb.includes('94B641477E72')) return 'CONVEX';
  if (fb.includes('SEAR') || fb.includes('FDC83CF95746')) return 'SEAR';
  if (fb.includes('SAUTE') || fb.includes('1732246A37D8')) return 'SAUTE';
  if (fb.includes('STEW') || fb.includes('8DE5676A5E92')) return 'STEW';
  if (fb.includes('YANG') || fb.includes('313B9456C8AC')) return 'YANG';
  if (fb.includes('YIN') || fb.includes('A67CE76969F7')) return 'YIN';
  if (fb.includes('COW') || fb.includes('F75D88C48D6D')) return 'COW';
  if (fb.includes('PIG') || fb.includes('3EFA5702E75B')) return 'PIG';
  if (fb.includes('CHICKEN') || fb.includes('F1A6EF3B99DF')) return 'CHICKEN';
  if (fb.includes('SEN') || fb.includes('EACC7F540399')) return 'SEN';
  if (fb.includes('ZAI') || fb.includes('7FC715661514')) return 'ZAI';
  if (fb.includes('GIANT') || fb.includes('C4AEB81F3634')) return 'GIANT';
  // opaque id をそのまま手駒キーにしない（手駒表示不能の原因）。
  if (/^PIECE_[A-Z0-9_]+$/i.test(fb)) return null;
  return fb;
}

function debugLogBookCaptureToHand(input: {
  actorSide: Side;
  captured: AiBoardPiece;
  resolvedCode: string | null;
  fallbackCapturedCode: string | null;
  hands: HandsBag;
}): void {
  const ch = (() => {
    try {
      return (input.captured.char ?? '').normalize('NFKC');
    } catch {
      return input.captured.char ?? '';
    }
  })();
  const rawCode = (input.captured.pieceCode ?? '').toUpperCase();
  const isBook =
    ch === '書' || ch === '書物' || rawCode.includes('BOOK') || rawCode.includes('5D848242A136');
  if (!isBook) return;
  console.info('[book-capture-debug] add-to-hand', {
    actorSide: input.actorSide,
    capturedAt: [input.captured.row, input.captured.col],
    capturedChar: input.captured.char,
    capturedCode: input.captured.pieceCode,
    fallbackCapturedCode: input.fallbackCapturedCode,
    resolvedCode: input.resolvedCode,
    actorHands: input.hands[input.actorSide],
  });
}

function kbossEffectiveLives(piece: { kbossLivesRemaining?: number }): number {
  const v = piece.kbossLivesRemaining;
  if (v === 1 || v === 2) return v;
  return 2;
}

function gunApplyDebugLog(payload: Record<string, unknown>): void {
  void payload;
}

function isDeathOrSoulPieceForOboroTrigger(piece: {
  pieceCode: string | null;
  char: string;
}): boolean {
  return isDeathPieceForApply(piece) || isSoulPieceForApply(piece);
}

function collectAllEmptyCells(
  pieces: { row: number; col: number }[],
): { row: number; col: number }[] {
  const occupied = new Set(pieces.map((p) => `${p.row}:${p.col}`));
  const out: { row: number; col: number }[] = [];
  for (let row = 0; row <= 8; row += 1) {
    for (let col = 0; col <= 8; col += 1) {
      if (occupied.has(`${row}:${col}`)) continue;
      out.push({ row, col });
    }
  }
  return out;
}

function resolveOboroEvadeWarpCell(input: {
  captured: AiBoardPiece;
  pieces: AiBoardPiece[];
  captureRow: number;
  captureCol: number;
}): { row: number; col: number } | null {
  if (!isOboroPieceForApply(input.captured)) return null;
  const hasTriggerPiece = input.pieces.some(
    (p) =>
      isDeathOrSoulPieceForOboroTrigger(p) &&
      !(p.row === input.captureRow && p.col === input.captureCol && p.side === input.captured.side),
  );
  if (!hasTriggerPiece) return null;
  const empties = collectAllEmptyCells(input.pieces);
  if (empties.length === 0) return null;
  return empties[Math.floor(Math.random() * empties.length)] ?? null;
}

/**
 * 同一段の左右（筋の ±1）の空きマス。剣の捕獲回避専用。
 */
function collectHorizontalAdjacentEmptyCells(
  pieces: { row: number; col: number }[],
  row: number,
  col: number,
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (const dc of [-1, 1]) {
    const c = col + dc;
    if (c < 0 || c > 8) continue;
    if (pieces.some((p) => p.row === row && p.col === c)) continue;
    out.push({ row, col: c });
  }
  return out;
}

/**
 * 味方「盾」の前方以外に隣接した味方がこの手で敵に取られるとき、50% で着手全体を無効化する。
 * （盤・手駒を着手前に戻し、手番も進めない）
 */
function tryShieldIntrinsicAbortHostileCapture(
  actorSide: Side,
  victim: AiBoardPiece,
  piecesOnBoard: AiBoardPiece[],
): boolean {
  if (victim.side === actorSide) return false;
  let hasQualifyingShield = false;
  for (const p of piecesOnBoard) {
    if (!isShieldPieceForApply(p)) continue;
    if (p.side !== victim.side) continue;
    const dr = victim.row - p.row;
    const dc = victim.col - p.col;
    if (Math.abs(dr) > 1 || Math.abs(dc) > 1 || (dr === 0 && dc === 0)) continue;
    const fwdR = p.row + katanaForwardOneDeltaRow(p.side);
    const fwdC = p.col;
    if (victim.row === fwdR && victim.col === fwdC) continue;
    hasQualifyingShield = true;
    break;
  }
  if (!hasQualifyingShield) return false;
  return Math.random() < 0.5;
}

/** 着地点から見た「前方」1マスの dRow（game-rules の orient と整合）。 */
function katanaForwardOneDeltaRow(actorSide: Side): number {
  const orient = actorSide === 'player' ? 1 : -1;
  return -1 * orient;
}

/** 前方ちょうど1マスへ進む着手（名刀の唯一の移動）か。打ちは対象外。 */
function isKatanaForwardCaptureMove(
  actorSide: Side,
  move: Pick<BattleMove, 'fromRow' | 'fromCol' | 'toRow' | 'toCol' | 'dropPieceCode'>,
): boolean {
  if (move.dropPieceCode) return false;
  if (move.fromRow == null || move.fromCol == null) return false;
  const dForward = katanaForwardOneDeltaRow(actorSide);
  return move.fromCol === move.toCol && move.toRow === move.fromRow + dForward;
}

/** skill_definitions_v2 に依存せず、名刀「刀」は前方1マスで敵を取ったとき、着地点の左右1マスにいる敵駒をまとめて処理する（鎧は斬撃で取れない）。 */
function applyIntrinsicKatanaSideCaptures(input: {
  boardState: Record<string, unknown> | undefined;
  nextPieces: AiBoardPiece[];
  hands: HandsBag;
  actorSide: Side;
  didCapture: boolean;
  movedPiece: AiBoardPiece | null;
  move: Pick<BattleMove, 'fromRow' | 'fromCol' | 'toRow' | 'toCol' | 'dropPieceCode'>;
}): {
  nextPieces: AiBoardPiece[];
  hands: HandsBag;
  starReturnProcTriggered: boolean;
  didSideSweep: boolean;
} {
  let { nextPieces, hands } = input;
  let starReturnProcTriggered = false;
  if (!input.movedPiece || !isKatanaPieceForApply(input.movedPiece)) {
    return { nextPieces, hands, starReturnProcTriggered, didSideSweep: false };
  }
  if (!input.didCapture) {
    return { nextPieces, hands, starReturnProcTriggered, didSideSweep: false };
  }
  if (!isKatanaForwardCaptureMove(input.actorSide, input.move)) {
    return { nextPieces, hands, starReturnProcTriggered, didSideSweep: false };
  }
  let didSideSweep = false;
  const r0 = input.movedPiece.row;
  const c0 = input.movedPiece.col;
  const extraTargets: [number, number][] = [
    [r0, c0 - 1],
    [r0, c0 + 1],
  ];
  for (const [row, col] of extraTargets) {
    if (row < 0 || row > 8 || col < 0 || col > 8) continue;
    const sweepTarget = findPieceAt(nextPieces, row, col);
    if (!sweepTarget || sweepTarget.side === input.actorSide) continue;
    if (isArmorPieceForApply(sweepTarget)) continue;
    const res = applyHostileCaptureAtCell({
      boardState: input.boardState,
      nextPieces,
      hands,
      actorSide: input.actorSide,
      row,
      col,
      fallbackCapturedCode: null,
      capturer: input.movedPiece,
    });
    nextPieces = res.nextPieces;
    hands = res.hands;
    if (res.didCapture) didSideSweep = true;
    if (res.starReturnProcTriggered) starReturnProcTriggered = true;
  }
  return { nextPieces, hands, starReturnProcTriggered, didSideSweep };
}

const NAKU_PON_CAPTURE_MAX = 3;

function canApplyHostileCaptureAtCellForNakuPon(input: {
  boardState: Record<string, unknown> | undefined;
  nextPieces: AiBoardPiece[];
  actorSide: Side;
  row: number;
  col: number;
  capturer: AiBoardPiece;
}): boolean {
  const captured = findPieceAt(input.nextPieces, input.row, input.col);
  if (!captured || captured.side === input.actorSide) return false;
  if (isGiantPieceForEngine(captured)) return false;
  if (isArmorPieceForApply(captured)) return false;
  if (isKirinCaptureBlocked(input.capturer, captured)) return false;
  if (
    pieceHasActiveCaptureImmunityFromBoardState(
      input.boardState,
      captured.side,
      input.row,
      input.col,
      input.nextPieces,
    )
  ) {
    return false;
  }
  return true;
}

/** 鳴: 敵を取ったとき、同種の敵駒が盤面に2体以上あれば合計3体までまとめて取る。 */
function applyIntrinsicNakuPonCaptures(input: {
  boardState: Record<string, unknown> | undefined;
  boardBeforeMove: AiBoardPiece[];
  nextPieces: AiBoardPiece[];
  hands: HandsBag;
  actorSide: Side;
  didCapture: boolean;
  movedPiece: AiBoardPiece | null;
  move: Pick<BattleMove, 'fromRow' | 'fromCol' | 'toRow' | 'toCol' | 'dropPieceCode'>;
}): {
  nextPieces: AiBoardPiece[];
  hands: HandsBag;
  starReturnProcTriggered: boolean;
  didPonSweep: boolean;
} {
  let { nextPieces, hands } = input;
  let starReturnProcTriggered = false;
  if (!input.movedPiece || !isNakuPieceForApply(input.movedPiece)) {
    return { nextPieces, hands, starReturnProcTriggered, didPonSweep: false };
  }
  if (!input.didCapture || input.move.dropPieceCode) {
    return { nextPieces, hands, starReturnProcTriggered, didPonSweep: false };
  }
  const primaryVictim = findPieceAt(input.boardBeforeMove, input.move.toRow, input.move.toCol);
  if (!primaryVictim || primaryVictim.side === input.actorSide) {
    return { nextPieces, hands, starReturnProcTriggered, didPonSweep: false };
  }
  const enemySide: Side = input.actorSide === 'player' ? 'enemy' : 'player';
  const sameTypeOnBoardBefore = input.boardBeforeMove.filter(
    (p) => p.side === enemySide && isSameEnemyPieceTypeForNakuPon(p, primaryVictim),
  );
  if (sameTypeOnBoardBefore.length < 2) {
    return { nextPieces, hands, starReturnProcTriggered, didPonSweep: false };
  }
  const targetTotal = Math.min(sameTypeOnBoardBefore.length, NAKU_PON_CAPTURE_MAX);
  const extraCells = sameTypeOnBoardBefore
    .filter((p) => !(p.row === input.move.toRow && p.col === input.move.toCol))
    .sort((a, b) => a.row - b.row || a.col - b.col)
    .slice(0, targetTotal - 1);
  let didPonSweep = false;
  for (const cell of extraCells) {
    if (
      !canApplyHostileCaptureAtCellForNakuPon({
        boardState: input.boardState,
        nextPieces,
        actorSide: input.actorSide,
        row: cell.row,
        col: cell.col,
        capturer: input.movedPiece,
      })
    ) {
      continue;
    }
    const res = applyHostileCaptureAtCell({
      boardState: input.boardState,
      nextPieces,
      hands,
      actorSide: input.actorSide,
      row: cell.row,
      col: cell.col,
      fallbackCapturedCode: null,
      capturer: input.movedPiece,
    });
    nextPieces = res.nextPieces;
    hands = res.hands;
    if (res.didCapture) didPonSweep = true;
    if (res.starReturnProcTriggered) starReturnProcTriggered = true;
  }
  return { nextPieces, hands, starReturnProcTriggered, didPonSweep };
}

function hasSoulOnBoardForSide(pieces: AiBoardPiece[], side: Side): boolean {
  return pieces.some((p) => p.side === side && isSoulPieceForApply(p));
}

/** 他の味方が取られたとき、盤上に別の「礼」がいれば1体を身代わりで消す */
function shouldConsumeReiSubstituteAfterAllyCapture(
  boardWithCaptured: AiBoardPiece[],
  captured: AiBoardPiece,
): boolean {
  if (isKingPieceForApply(captured)) return false;
  if (isReiRitualPiece(captured)) return false;
  const side = captured.side;
  return boardWithCaptured.some(
    (p) =>
      p.side === side && isReiRitualPiece(p) && !(p.row === captured.row && p.col === captured.col),
  );
}

function removeFirstReiRitualFromSide(pieces: AiBoardPiece[], side: Side): AiBoardPiece[] {
  const idx = pieces.findIndex((p) => p.side === side && isReiRitualPiece(p));
  if (idx < 0) return pieces;
  return pieces.filter((_, i) => i !== idx);
}

/** 「礼」身代わり時は取られた駒を相手ではなく防御側の手駒に戻す */
function targetHandSideForCapturedPiece(
  actorSide: Side,
  defenderSide: Side,
  consumeReiSubstitute: boolean,
): Side {
  return consumeReiSubstitute ? defenderSide : actorSide;
}

/** 合法手生成の isGunFullyBlockingAllyOnMid と同じ。王・鎧・K博士以外の味方は貫通で除去する。 */
function isGunFullyBlockingAllyOnMidForApply(mid: AiBoardPiece, actorSide: Side): boolean {
  if (mid.side !== actorSide) return false;
  return isKingPieceForApply(mid) || isArmorPieceForApply(mid) || isKbossPiece(mid);
}

/** 銃: 前方2マス直進、または斜め後ろ2マス。いずれも中間マスに敵がいる貫通取りの中点。 */
function computeGunPenetrationMidpoint(
  side: Side,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
): { midRow: number; midCol: number } | null {
  const dr = toRow - fromRow;
  const dc = toCol - fromCol;
  // 前方ちょうど2マス（同一筋）
  if (fromCol === toCol) {
    const d = side === 'player' ? -1 : 1;
    if (dr === 2 * d) {
      return { midRow: fromRow + d, midCol: fromCol };
    }
  }
  // 斜め後ろちょうど2マス（プレイヤーは下方向の斜め、敵は上方向の斜め）
  if (Math.abs(dr) === 2 && Math.abs(dc) === 2 && Math.abs(dr) === Math.abs(dc)) {
    const sr = dr / 2;
    const sc = dc / 2;
    if (side === 'player' && sr === 1 && Math.abs(sc) === 1) {
      return { midRow: fromRow + sr, midCol: fromCol + sc };
    }
    if (side === 'enemy' && sr === -1 && Math.abs(sc) === 1) {
      return { midRow: fromRow + sr, midCol: fromCol + sc };
    }
  }
  return null;
}

function gunForwardRowDeltaForApply(side: Side): number {
  return side === 'player' ? -1 : 1;
}

/** 財: 敵を取ったとき、味方の銭1体を取った駒の姿へ変える（着手駒のマスは除外して探索）。 */
function applyZaiSkillReplaceAllySenWithCaptured(
  pieces: AiBoardPiece[],
  actorSide: Side,
  capturedEnemy: AiBoardPiece,
  zaiLandingRow: number,
  zaiLandingCol: number,
): AiBoardPiece[] | null {
  const idx = pieces.findIndex(
    (p) =>
      p.side === actorSide &&
      isSenPieceForApply(p) &&
      !(p.row === zaiLandingRow && p.col === zaiLandingCol),
  );
  if (idx < 0) return null;
  const sen = pieces[idx]!;
  const next = pieces.map((p) => ({ ...p }));
  next[idx] = {
    ...capturedEnemy,
    row: sen.row,
    col: sen.col,
    side: actorSide,
  };
  return next;
}

/** 銭: 移動のたびに 20% で金、10% で宝（排他・残り70%は銭のまま）。 */
function maybeApplySenMoveSkillTransform(piece: AiBoardPiece): AiBoardPiece {
  const roll = Math.random();
  if (roll < 0.2) {
    return {
      ...piece,
      pieceCode: 'KI',
      char: '金',
      promoted: false,
      imageSignedUrl: null,
      pigInheritedPieceCode: null,
      pigInheritedChar: undefined,
      pigInheritedPromoted: undefined,
    };
  }
  if (roll < 0.3) {
    return {
      ...piece,
      pieceCode: 'TREASURE',
      char: '宝',
      promoted: false,
      imageSignedUrl: null,
      pigInheritedPieceCode: null,
      pigInheritedChar: undefined,
      pigInheritedPromoted: undefined,
    };
  }
  return piece;
}

function computeCowForwardPathDistanceForApply(
  side: Side,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
): number | null {
  if (fromCol !== toCol) return null;
  const d = gunForwardRowDeltaForApply(side);
  const dr = toRow - fromRow;
  if (dr === 0) return null;
  if (dr % d !== 0) return null;
  const dist = dr / d;
  return dist >= 1 ? dist : null;
}

type HandsBag = ReturnType<typeof normalizeHandsStateKeys>;

function cloneCombatBoardSnapshot(input: { pieces: AiBoardPiece[]; hands: HandsBag }): {
  pieces: AiBoardPiece[];
  hands: HandsBag;
} {
  return {
    pieces: input.pieces.map((p) => ({ ...p })),
    hands: normalizeHandsStateKeys({
      player: { ...sanitizeHandsBag(input.hands.player) },
      enemy: { ...sanitizeHandsBag(input.hands.enemy) },
    }),
  };
}

/** 取ったマスが巨の占有マスでも、盤上配列では錨にのみ実体があるため錨基準で除去する。 */
function removeCapturedPieceFromBoard(
  pieces: AiBoardPiece[],
  captureRow: number,
  captureCol: number,
  captured: AiBoardPiece,
): AiBoardPiece[] {
  if (isGiantPieceForEngine(captured)) {
    return pieces.filter(
      (p) =>
        !(
          p.side === captured.side &&
          p.row === captured.row &&
          p.col === captured.col &&
          isGiantPieceForEngine(p)
        ),
    );
  }
  return pieces.filter((p) => !(p.row === captureRow && p.col === captureCol));
}

function shouldSkipProcCaptureEvasions(input: {
  skipProcCaptureEvasions?: boolean;
  suppressRandomSkillProcs?: boolean;
}): boolean {
  return input.skipProcCaptureEvasions === true || input.suppressRandomSkillProcs === true;
}

function applyHostileCaptureAtCell(input: {
  boardState: Record<string, unknown> | undefined;
  nextPieces: AiBoardPiece[];
  hands: HandsBag;
  actorSide: Side;
  row: number;
  col: number;
  fallbackCapturedCode: string | null;
  capturer?: AiBoardPiece | null;
  /** 巨の 2×2 同時取りなど: 剣回避・朧・幻影の取り逃がしを無効化する。 */
  skipProcCaptureEvasions?: boolean;
  /** オンライン楽観更新: 幻・剣など確率/自動回避をサーバー結果待ちにする。 */
  suppressRandomSkillProcs?: boolean;
}): {
  nextPieces: AiBoardPiece[];
  hands: HandsBag;
  didCapture: boolean;
  starReturnProcTriggered: boolean;
  rebuffKboss: boolean;
  deathCapturedByActor: boolean;
} {
  let { nextPieces, hands } = input;
  let starReturnProcTriggered = false;
  let rebuffKboss = false;
  let deathCapturedByActor = false;
  const skipProcCaptureEvasions = shouldSkipProcCaptureEvasions(input);
  const captured = findPieceAt(nextPieces, input.row, input.col);
  if (!captured || captured.side === input.actorSide) {
    return {
      nextPieces,
      hands,
      didCapture: false,
      starReturnProcTriggered,
      rebuffKboss,
      deathCapturedByActor,
    };
  }
  if (isGiantPieceForEngine(captured)) {
    throw new Error('cannot capture giant');
  }
  if (isArmorPieceForApply(captured)) {
    throw new Error('cannot capture armor');
  }
  if (input.capturer && isKirinCaptureBlocked(input.capturer, captured)) {
    throw new Error('cannot capture kirin');
  }
  if (
    pieceHasActiveCaptureImmunityFromBoardState(
      input.boardState,
      captured.side,
      input.row,
      input.col,
      nextPieces,
    )
  ) {
    throw new Error('cannot capture immunity');
  }
  if (isKingPieceForApply(captured) && hasSoulOnBoardForSide(nextPieces, captured.side)) {
    throw new Error('cannot capture king while soul remains');
  }

  if (!skipProcCaptureEvasions && isKenSwordPieceForApply(captured)) {
    const horiz = collectHorizontalAdjacentEmptyCells(nextPieces, input.row, input.col);
    if (horiz.length > 0) {
      const pick = horiz[Math.floor(Math.random() * horiz.length)]!;
      const ksIdx = nextPieces.findIndex(
        (p) => p.row === input.row && p.col === input.col && p.side === captured.side,
      );
      if (ksIdx >= 0) {
        const ks = nextPieces[ksIdx]!;
        nextPieces = [...nextPieces];
        nextPieces[ksIdx] = { ...ks, row: pick.row, col: pick.col };
      }
      return {
        nextPieces,
        hands,
        didCapture: false,
        starReturnProcTriggered,
        rebuffKboss,
        deathCapturedByActor,
      };
    }
  }

  const oboroEvadeTo = skipProcCaptureEvasions
    ? null
    : resolveOboroEvadeWarpCell({
        captured,
        pieces: nextPieces,
        captureRow: input.row,
        captureCol: input.col,
      });
  if (oboroEvadeTo) {
    const obIdx = nextPieces.findIndex(
      (p) => p.row === input.row && p.col === input.col && p.side === captured.side,
    );
    if (obIdx >= 0) {
      const ob = nextPieces[obIdx]!;
      nextPieces = [...nextPieces];
      nextPieces[obIdx] = { ...ob, row: oboroEvadeTo.row, col: oboroEvadeTo.col };
    }
    return {
      nextPieces,
      hands,
      didCapture: false,
      starReturnProcTriggered,
      rebuffKboss,
      deathCapturedByActor,
    };
  }

  let phantomEvaded = false;
  let adjacentEmpty: { row: number; col: number }[] = [];
  const evadeChance = skipProcCaptureEvasions
    ? null
    : resolveEvadeCaptureProcChanceForPiece(input.boardState, captured);
  adjacentEmpty = collectAdjacentEmptyCells(nextPieces, input.row, input.col);
  if (!skipProcCaptureEvasions && evadeChance != null && adjacentEmpty.length > 0) {
    const roll = Math.random();
    phantomEvaded = roll <= evadeChance;
  }

  if (phantomEvaded) {
    const pick = adjacentEmpty[Math.floor(Math.random() * adjacentEmpty.length)]!;
    const phIdx = nextPieces.findIndex(
      (p) => p.row === input.row && p.col === input.col && p.side === captured.side,
    );
    if (phIdx >= 0) {
      const ph = nextPieces[phIdx]!;
      nextPieces = [...nextPieces];
      nextPieces[phIdx] = { ...ph, row: pick.row, col: pick.col };
    }
    return {
      nextPieces,
      hands,
      didCapture: false,
      starReturnProcTriggered,
      rebuffKboss,
      deathCapturedByActor,
    };
  }

  if (isKbossPiece(captured) && kbossEffectiveLives(captured) > 1) {
    rebuffKboss = true;
    const kIdx = nextPieces.findIndex(
      (p) => p.row === input.row && p.col === input.col && p.side === captured.side,
    );
    if (kIdx >= 0) {
      const cur = nextPieces[kIdx]!;
      nextPieces = [...nextPieces];
      nextPieces[kIdx] = {
        ...cur,
        kbossLivesRemaining: kbossEffectiveLives(cur) - 1,
      };
    }
    return {
      nextPieces,
      hands,
      didCapture: false,
      starReturnProcTriggered,
      rebuffKboss,
      deathCapturedByActor,
    };
  }

  if (isDeathPieceForApply(captured)) {
    deathCapturedByActor = true;
  }
  const consumeReiSubstitute = shouldConsumeReiSubstituteAfterAllyCapture(nextPieces, captured);
  if (hasActiveChrysanthemumRevival(input.boardState, captured.side, input.row, input.col)) {
    nextPieces = removeCapturedPieceFromBoard(nextPieces, input.row, input.col, captured);
    removeChrysanthemumRevivalAtCell(input.boardState, captured.side, input.row, input.col);
    if (!isSpiritPiece(captured)) {
      const capturedCode = resolveCapturedHandCode(captured, input.fallbackCapturedCode);
      if (capturedCode) {
        hands = addHandPiece(hands, captured.side, capturedCode, 1);
      }
      debugLogBookCaptureToHand({
        actorSide: input.actorSide,
        captured,
        resolvedCode: capturedCode ?? null,
        fallbackCapturedCode: input.fallbackCapturedCode,
        hands,
      });
    }
    return {
      nextPieces,
      hands,
      didCapture: true,
      starReturnProcTriggered,
      rebuffKboss,
      deathCapturedByActor,
    };
  }
  nextPieces = removeCapturedPieceFromBoard(nextPieces, input.row, input.col, captured);
  const isSpiritCaptured = isSpiritPiece(captured);
  const capturedBaseCode = toBasePieceCode(captured.pieceCode);
  const isStarCaptured = capturedBaseCode === 'HOS' || captured.char === '星';
  if (isSpiritCaptured) {
    // 手駒化しない
  } else if (isVanishOnCapturePiece(captured)) {
    // K・実・異
  } else if (isStarCaptured) {
    const procChance = 0.4;
    const roll = Math.random();
    if (roll <= procChance) {
      starReturnProcTriggered = true;
      hands = addHandPiece(hands, captured.side, 'HOS', 1);
    } else {
      const capturedCode = resolveCapturedHandCode(captured, input.fallbackCapturedCode);
      if (capturedCode) {
        const handSide = targetHandSideForCapturedPiece(
          input.actorSide,
          captured.side,
          consumeReiSubstitute,
        );
        hands = addHandPiece(hands, handSide, capturedCode, 1);
      }
      debugLogBookCaptureToHand({
        actorSide: input.actorSide,
        captured,
        resolvedCode: capturedCode,
        fallbackCapturedCode: input.fallbackCapturedCode,
        hands,
      });
    }
  } else {
    const capturedCode = resolveCapturedHandCode(captured, input.fallbackCapturedCode);
    if (capturedCode) {
      const handSide = targetHandSideForCapturedPiece(
        input.actorSide,
        captured.side,
        consumeReiSubstitute,
      );
      hands = addHandPiece(hands, handSide, capturedCode, 1);
    }
    debugLogBookCaptureToHand({
      actorSide: input.actorSide,
      captured,
      resolvedCode: capturedCode,
      fallbackCapturedCode: input.fallbackCapturedCode,
      hands,
    });
  }

  if (consumeReiSubstitute) {
    nextPieces = removeFirstReiRitualFromSide(nextPieces, captured.side);
  }

  return {
    nextPieces,
    hands,
    didCapture: true,
    starReturnProcTriggered,
    rebuffKboss,
    deathCapturedByActor,
  };
}

const GIANT_BOARD_MOVE_NOTATION = 'giant_2x2_ortho';

function applyGiantOrthogonalBoardMove(input: {
  boardState: Record<string, unknown> | undefined;
  skillView: SkillRuntimeView;
  nextPieces: AiBoardPiece[];
  hands: HandsBag;
  actorSide: Side;
  move: Pick<BattleMove, 'fromRow' | 'fromCol' | 'toRow' | 'toCol' | 'notation' | 'promote'>;
  movingIndex: number;
  movingPiece: AiBoardPiece;
}): {
  nextPieces: AiBoardPiece[];
  hands: HandsBag;
  didCapture: boolean;
  movedPiece: AiBoardPiece;
  starReturnProcTriggered: boolean;
  deathCapturedByActor: boolean;
} {
  const { boardState, skillView, actorSide, move, movingIndex, movingPiece } = input;
  let { nextPieces, hands } = input;
  if (move.fromRow == null || move.fromCol == null) {
    throw new Error('giant move requires from');
  }
  if (move.notation !== GIANT_BOARD_MOVE_NOTATION) {
    throw new Error('invalid giant move notation');
  }
  const fr = move.fromRow;
  const fc = move.fromCol;
  const tr = move.toRow;
  const tc = move.toCol;
  if (!isValidGiantAnchor(fr, fc) || !isValidGiantAnchor(tr, tc)) {
    throw new Error('giant anchor out of bounds');
  }
  const step = Math.abs(tr - fr) + Math.abs(tc - fc);
  if (step === 0 || step > 2 || (tr !== fr && tc !== fc)) {
    throw new Error('giant must move orthogonally 1 or 2 steps');
  }
  const destCells = giantAnchorFootprint(tr, tc);
  for (const c of destCells) {
    if (skillView.rockObstacleCells.has(`${c.row}:${c.col}`)) {
      throw new Error('cannot move giant onto rock');
    }
  }
  for (const c of destCells) {
    const occ = findPieceAt(nextPieces, c.row, c.col);
    if (!occ) continue;
    if (occ.side === actorSide) {
      const isSelf = occ.row === movingPiece.row && occ.col === movingPiece.col;
      if (!isSelf) {
        throw new Error('giant destination blocked by ally');
      }
    }
  }
  const victims: AiBoardPiece[] = [];
  for (const c of destCells) {
    const occ = findPieceAt(nextPieces, c.row, c.col);
    if (!occ || occ.side === actorSide) continue;
    victims.push(occ);
  }
  for (const v of victims) {
    if (tryShieldIntrinsicAbortHostileCapture(actorSide, v, nextPieces)) {
      throw new Error('shield aborted giant capture');
    }
  }
  let didCapture = false;
  let starReturnProcTriggered = false;
  let deathCapturedByActor = false;
  let work = nextPieces.filter((_, i) => i !== movingIndex);
  const sortedCells = [...destCells].sort((a, b) => a.row - b.row || a.col - b.col);
  for (const c of sortedCells) {
    const occ = findPieceAt(work, c.row, c.col);
    if (!occ || occ.side === actorSide) continue;
    const res = applyHostileCaptureAtCell({
      boardState,
      nextPieces: work,
      hands,
      actorSide,
      row: c.row,
      col: c.col,
      fallbackCapturedCode: null,
      capturer: movingPiece,
      skipProcCaptureEvasions: true,
    });
    work = res.nextPieces;
    hands = res.hands;
    if (res.didCapture) didCapture = true;
    if (res.starReturnProcTriggered) starReturnProcTriggered = true;
    if (res.deathCapturedByActor) deathCapturedByActor = true;
  }
  const moved: AiBoardPiece = {
    ...movingPiece,
    row: tr,
    col: tc,
    promoted: move.promote ? true : (movingPiece.promoted ?? false),
  };
  work = [...work, moved];
  return {
    nextPieces: work,
    hands,
    didCapture,
    movedPiece: moved,
    starReturnProcTriggered,
    deathCapturedByActor,
  };
}

function collectAdjacentEmptyCells(
  pieces: { row: number; col: number }[],
  row: number,
  col: number,
): { row: number; col: number }[] {
  const out: { row: number; col: number }[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r > 8 || c < 0 || c > 8) continue;
      if (pieces.some((p) => p.row === r && p.col === c)) continue;
      out.push({ row: r, col: c });
    }
  }
  return out;
}

/** 矢印マスに着地した駒を、矢印方向へ1マススライドさせる（HTML 原型と同様）。 */
function applyArrowTileSlideAfterLanding(input: {
  position: AiBattlePosition;
  boardState: Record<string, unknown> | undefined;
  nextPieces: AiBoardPiece[];
  hands: ReturnType<typeof normalizeHandsStateKeys>;
  actorSide: Side;
  landingRow: number;
  landingCol: number;
  movingIndex: number;
}): {
  nextPieces: AiBoardPiece[];
  hands: ReturnType<typeof normalizeHandsStateKeys>;
  didCapture: boolean;
  didSlide: boolean;
  starReturnProcTriggered: boolean;
  deathCapturedByActor: boolean;
} {
  const direction = arrowDirectionAt(input.position, input.landingRow, input.landingCol);
  if (!direction) {
    return {
      nextPieces: input.nextPieces,
      hands: input.hands,
      didCapture: false,
      didSlide: false,
      starReturnProcTriggered: false,
      deathCapturedByActor: false,
    };
  }
  const slide = arrowSlideDestination(input.landingRow, input.landingCol, direction);
  if (!slide) {
    throw new Error('arrow slide blocked: out of bounds');
  }

  let nextPieces = input.nextPieces;
  let hands = input.hands;
  let didCapture = false;
  let starReturnProcTriggered = false;
  let deathCapturedByActor = false;
  const capturer = nextPieces[input.movingIndex] ?? null;

  const movingBefore = nextPieces[input.movingIndex] ?? null;
  const captured = findPieceAt(nextPieces, slide.row, slide.col);
  if (captured) {
    if (
      captured.side === input.actorSide &&
      !(movingBefore && captured.row === movingBefore.row && captured.col === movingBefore.col)
    ) {
      throw new Error('arrow slide blocked by ally');
    }
    if (captured.side !== input.actorSide) {
      const res = applyHostileCaptureAtCell({
        boardState: input.boardState,
        nextPieces,
        hands,
        actorSide: input.actorSide,
        row: slide.row,
        col: slide.col,
        fallbackCapturedCode: null,
        capturer,
      });
      if (res.rebuffKboss) {
        throw new Error('arrow slide blocked: kboss');
      }
      nextPieces = res.nextPieces;
      hands = res.hands;
      didCapture = res.didCapture;
      starReturnProcTriggered = res.starReturnProcTriggered;
      deathCapturedByActor = res.deathCapturedByActor;
    }
  }

  const movingIndex = nextPieces.findIndex(
    (p) =>
      p.side === input.actorSide &&
      p.row === input.landingRow &&
      p.col === input.landingCol &&
      (capturer == null ||
        p.pieceCode === capturer.pieceCode ||
        (p.row === capturer.row && p.col === capturer.col)),
  );
  const idx = movingIndex >= 0 ? movingIndex : input.movingIndex;
  const moving = nextPieces[idx];
  if (!moving) {
    throw new Error('arrow slide: moving piece not found');
  }
  nextPieces[idx] = { ...moving, row: slide.row, col: slide.col };

  return {
    nextPieces,
    hands,
    didCapture,
    didSlide: true,
    starReturnProcTriggered,
    deathCapturedByActor,
  };
}

export function applyMove(input: {
  position: BattleCanonicalPosition;
  pieceCatalog: AiPieceDefinition[];
  move: AiBattleMove;
  options?: { suppressRandomSkillProcs?: boolean };
}): BattleCommittedMove {
  const current = normalizeBattlePosition(input.position);
  const move = normalizeBattleMove(input.move);
  const pieces = piecesFromBoardState(current);
  const boardBeforeMove = pieces.map((piece) => ({ ...piece }));
  let hands = normalizeHandsStateKeys({
    player: sanitizeHandsBag(current.hands.player),
    enemy: sanitizeHandsBag(current.hands.enemy),
  });
  const actorSide = current.sideToMove;
  const suppressProcCaptureEvasions = input.options?.suppressRandomSkillProcs === true;
  const otsuFollowupBefore = readFollowupCellForSide(
    current.boardState as Record<string, unknown> | undefined,
    actorSide,
    'otsu_followup',
  );
  const convexFollowupBefore = readFollowupCellForSide(
    current.boardState as Record<string, unknown> | undefined,
    actorSide,
    'convex_followup',
  );
  const preMoveSkillView = createSkillRuntimeView(current);
  ensureShinTurnMimicForBattle(current, input.pieceCatalog);
  assertMoveAllowedBySessionCatalog({
    position: current,
    pieceCatalog: input.pieceCatalog,
    move,
    actor: actorSide,
  });

  let nextPieces = pieces.map((piece) => ({ ...piece }));
  let movedPieceAfterApply: (typeof nextPieces)[number] | null = null;
  let didCapture = false;
  let diseaseCapturedByActor = false;
  let abyssCapturedByActor = false;
  let deathCapturedByActor = false;
  const capturedHoleCellsByActor: { row: number; col: number }[] = [];
  let starReturnProcTriggered = false;
  /** 刀の隣取り・銃の貫通取りなど、エンジン内在スキル（skill_definitions_v2 の 52/54 非依存）。 */
  let intrinsicCombatSkillTriggered = false;
  /** 盾の intrinsic：着手全体を巻き戻す。 */
  let shieldAbortedMove = false;
  /** 剣の捕獲回避先（スキル FX 用） */
  let kenSwordEvadeCell: { row: number; col: number } | null = null;
  let movedByOtsu = false;
  let movedByConvex = false;

  if (move.notation === 'time_skill_only' || move.notation === 'house_skill_only') {
    // no-op on board（スキルのみ）
  } else if (move.dropPieceCode) {
    const dropCode = toBasePieceCode(move.dropPieceCode);
    if (!dropCode) {
      throw new Error('dropPieceCode is invalid');
    }
    hands = addHandPiece(hands, actorSide, dropCode, -1);
    nextPieces.push({
      side: actorSide,
      row: move.toRow,
      col: move.toCol,
      pieceCode: dropCode,
      char: pieceChar(dropCode, false),
      promoted: false,
      imageSignedUrl: null,
    });
    const dropIndex = nextPieces.length - 1;
    movedPieceAfterApply = nextPieces[dropIndex] ?? null;
    const dropArrow = applyArrowTileSlideAfterLanding({
      position: current,
      boardState: current.boardState as Record<string, unknown> | undefined,
      nextPieces,
      hands,
      actorSide,
      landingRow: move.toRow,
      landingCol: move.toCol,
      movingIndex: dropIndex,
    });
    if (dropArrow.didSlide) {
      nextPieces = dropArrow.nextPieces;
      hands = dropArrow.hands;
      if (dropArrow.didCapture) didCapture = true;
      if (dropArrow.starReturnProcTriggered) starReturnProcTriggered = true;
      if (dropArrow.deathCapturedByActor) deathCapturedByActor = true;
      intrinsicCombatSkillTriggered = intrinsicCombatSkillTriggered || dropArrow.didCapture;
      movedPieceAfterApply = nextPieces[dropIndex] ?? movedPieceAfterApply;
    }
  } else {
    const movingIndex = nextPieces.findIndex(
      (piece) =>
        piece.side === actorSide && piece.row === move.fromRow && piece.col === move.fromCol,
    );
    if (movingIndex < 0) {
      throw new Error('moving piece not found');
    }
    const movingPiece = nextPieces[movingIndex]!;
    let giantHandled = false;
    if (isGiantPieceForEngine(movingPiece)) {
      const gr = applyGiantOrthogonalBoardMove({
        boardState: current.boardState as Record<string, unknown> | undefined,
        skillView: preMoveSkillView,
        nextPieces,
        hands,
        actorSide,
        move,
        movingIndex,
        movingPiece,
      });
      nextPieces = gr.nextPieces;
      hands = gr.hands;
      didCapture = gr.didCapture;
      starReturnProcTriggered = starReturnProcTriggered || gr.starReturnProcTriggered;
      deathCapturedByActor = deathCapturedByActor || gr.deathCapturedByActor;
      movedPieceAfterApply = gr.movedPiece;
      intrinsicCombatSkillTriggered = intrinsicCombatSkillTriggered || gr.didCapture;
      giantHandled = true;
    } else if (preMoveSkillView.rockObstacleCells.has(`${move.toRow}:${move.toCol}`)) {
      throw new Error('cannot move onto rock obstacle');
    }
    movedByOtsu = giantHandled ? false : isOtsuPieceForApply(movingPiece);
    movedByConvex = giantHandled ? false : isConvexPieceForApply(movingPiece);
    const movingCode = toBasePieceCode(movingPiece?.pieceCode);
    const isCloudMover = movingCode === 'CLOUD' || movingPiece?.char === '雲';
    const combatBoardSnapshot = cloneCombatBoardSnapshot({ pieces: nextPieces, hands });

    if (!giantHandled) {
      // 銃: 前方ちょうど2マスへ進む手では、まず1マス目の敵を取ってから2マス目へ入る（両方敵なら同一手で連続取り）。斜め後ろ2マス貫通も同様。
      const gunPen =
        isGunPieceForApply(movingPiece) && move.fromRow != null && move.fromCol != null
          ? computeGunPenetrationMidpoint(
              actorSide,
              move.fromRow,
              move.fromCol,
              move.toRow,
              move.toCol,
            )
          : null;
      const midForGun =
        gunPen != null ? findPieceAt(nextPieces, gunPen.midRow, gunPen.midCol) : null;

      if (isGunPieceForApply(movingPiece)) {
        gunApplyDebugLog({
          phase: 'pre-capture',
          from: [move.fromRow, move.fromCol],
          to: [move.toRow, move.toCol],
          actorSide,
          gunPen,
          mid: midForGun
            ? {
                row: midForGun.row,
                col: midForGun.col,
                side: midForGun.side,
                char: midForGun.char,
              }
            : null,
        });
      }

      if (gunPen && midForGun) {
        if (midForGun.side === actorSide) {
          if (isGunFullyBlockingAllyOnMidForApply(midForGun, actorSide)) {
            throw new Error('gun path blocked by ally');
          }
          nextPieces = nextPieces.filter(
            (p) => !(p.row === gunPen.midRow && p.col === gunPen.midCol),
          );
          didCapture = true;
        } else {
          if (isArmorPieceForApply(movingPiece)) {
            throw new Error('armor cannot capture');
          }
          if (isArmorPieceForApply(midForGun)) {
            throw new Error('cannot capture armor piece');
          }
          const midRes = applyHostileCaptureAtCell({
            boardState: current.boardState as Record<string, unknown> | undefined,
            nextPieces,
            hands,
            actorSide,
            row: gunPen.midRow,
            col: gunPen.midCol,
            fallbackCapturedCode: null,
            capturer: movingPiece,
          });
          if (midRes.rebuffKboss) {
            throw new Error('invalid gun move: kboss midpoint');
          }
          nextPieces = midRes.nextPieces;
          hands = midRes.hands;
          if (midRes.didCapture) {
            didCapture = true;
            intrinsicCombatSkillTriggered = true;
            if (isHolePieceForApply(midForGun)) {
              capturedHoleCellsByActor.push({ row: gunPen.midRow, col: gunPen.midCol });
            }
          }
          if (midRes.starReturnProcTriggered) starReturnProcTriggered = true;
          if (midRes.deathCapturedByActor) deathCapturedByActor = true;
        }
      }

      let cowChargedPathDist: number | null = null;
      if (isCowPieceForApply(movingPiece) && move.fromRow != null && move.fromCol != null) {
        cowChargedPathDist = computeCowForwardPathDistanceForApply(
          actorSide,
          move.fromRow,
          move.fromCol,
          move.toRow,
          move.toCol,
        );
        if (cowChargedPathDist != null && cowChargedPathDist > 1) {
          const d = gunForwardRowDeltaForApply(actorSide);
          for (let s = 1; s < cowChargedPathDist; s += 1) {
            const r = move.fromRow + d * s;
            const c = move.fromCol;
            const mid = findPieceAt(nextPieces, r, c);
            if (!mid) continue;
            if (mid.side === actorSide) {
              throw new Error('cow path blocked by ally');
            }
            const midHole = isHolePieceForApply(mid);
            const midRes = applyHostileCaptureAtCell({
              boardState: current.boardState as Record<string, unknown> | undefined,
              nextPieces,
              hands,
              actorSide,
              row: r,
              col: c,
              fallbackCapturedCode: null,
              capturer: movingPiece,
            });
            if (midRes.rebuffKboss) {
              throw new Error('invalid cow move: kboss path');
            }
            nextPieces = midRes.nextPieces;
            hands = midRes.hands;
            if (midRes.didCapture) {
              didCapture = true;
              intrinsicCombatSkillTriggered = true;
              if (midHole) {
                capturedHoleCellsByActor.push({ row: r, col: c });
              }
            }
            if (midRes.starReturnProcTriggered) starReturnProcTriggered = true;
            if (midRes.deathCapturedByActor) deathCapturedByActor = true;
          }
        }
      }

      const captured = findPieceAt(nextPieces, move.toRow, move.toCol);
      let pigInheritVictim: AiBoardPiece | null = null;
      /** 財スキル用: 盤上から消す直前の敵駒スナップショット */
      let zaiCapturedEnemySnapshot: AiBoardPiece | null = null;
      let rebuffKboss = false;
      if (captured) {
        const captureOwnPiece = captured.side === actorSide;
        if (!captureOwnPiece && isGiantPieceForEngine(captured)) {
          throw new Error('cannot capture giant');
        }
        if (!captureOwnPiece && !isCloudMover && isArmorPieceForApply(captured)) {
          throw new Error('cannot capture armor');
        }
        if (!captureOwnPiece && isKirinCaptureBlocked(movingPiece, captured)) {
          throw new Error('cannot capture kirin');
        }
        if (
          !captureOwnPiece &&
          isKingPieceForApply(captured) &&
          hasSoulOnBoardForSide(nextPieces, captured.side)
        ) {
          throw new Error('cannot capture king while soul remains');
        }
        if (!captureOwnPiece && isArmorPieceForApply(movingPiece)) {
          throw new Error('armor cannot capture enemy');
        }
        if (captureOwnPiece && !isCloudMover) {
          throw new Error('friendly capture is only allowed for CLOUD');
        }
        if (isCloudMover && !captureOwnPiece) {
          throw new Error('CLOUD cannot capture enemy pieces');
        }
        if (isCloudMover && captureOwnPiece) {
          const capturedBase = toBasePieceCode(captured.pieceCode);
          if (capturedBase === 'OU' || captured.char === '王' || captured.char === '玉') {
            throw new Error('CLOUD cannot capture allied king');
          }
        }

        if (
          !captureOwnPiece &&
          tryShieldIntrinsicAbortHostileCapture(actorSide, captured, nextPieces)
        ) {
          shieldAbortedMove = true;
          intrinsicCombatSkillTriggered = true;
          const snap = cloneCombatBoardSnapshot(combatBoardSnapshot);
          nextPieces = snap.pieces;
          hands = snap.hands;
          didCapture = false;
        }

        let phantomEvaded = false;
        let adjacentEmpty: { row: number; col: number }[] = [];
        let kenSwordEvadeTo: { row: number; col: number } | null = null;
        if (
          !shieldAbortedMove &&
          !captureOwnPiece &&
          !suppressProcCaptureEvasions &&
          isKenSwordPieceForApply(captured)
        ) {
          const horizKen = collectHorizontalAdjacentEmptyCells(nextPieces, move.toRow, move.toCol);
          if (horizKen.length > 0) {
            kenSwordEvadeTo = horizKen[Math.floor(Math.random() * horizKen.length)]!;
            intrinsicCombatSkillTriggered = true;
          }
        }
        let oboroEvadeTo: { row: number; col: number } | null = null;
        if (
          !shieldAbortedMove &&
          !captureOwnPiece &&
          !kenSwordEvadeTo &&
          !suppressProcCaptureEvasions
        ) {
          oboroEvadeTo = resolveOboroEvadeWarpCell({
            captured,
            pieces: nextPieces,
            captureRow: move.toRow,
            captureCol: move.toCol,
          });
        }
        if (
          !shieldAbortedMove &&
          !captureOwnPiece &&
          !kenSwordEvadeTo &&
          !suppressProcCaptureEvasions
        ) {
          const evadeChance = resolveEvadeCaptureProcChanceForPiece(
            current.boardState as Record<string, unknown> | undefined,
            captured,
          );
          adjacentEmpty = collectAdjacentEmptyCells(nextPieces, move.toRow, move.toCol);
          if (evadeChance != null) {
            if (adjacentEmpty.length > 0) {
              const roll = Math.random();
              phantomEvaded = roll <= evadeChance;
            }
          }
        }

        if (shieldAbortedMove) {
          // 盤・手駒は上で復元済み。着手駒は from のまま。
        } else if (kenSwordEvadeTo) {
          didCapture = false;
          kenSwordEvadeCell = kenSwordEvadeTo;
          const ksIdx = nextPieces.findIndex(
            (p) => p.row === move.toRow && p.col === move.toCol && p.side === captured.side,
          );
          if (ksIdx >= 0) {
            const ks = nextPieces[ksIdx]!;
            nextPieces[ksIdx] = { ...ks, row: kenSwordEvadeTo.row, col: kenSwordEvadeTo.col };
          }
        } else if (oboroEvadeTo) {
          didCapture = false;
          const obIdx = nextPieces.findIndex(
            (p) => p.row === move.toRow && p.col === move.toCol && p.side === captured.side,
          );
          if (obIdx >= 0) {
            const ob = nextPieces[obIdx]!;
            nextPieces[obIdx] = { ...ob, row: oboroEvadeTo.row, col: oboroEvadeTo.col };
          }
        } else if (phantomEvaded) {
          didCapture = false;
          intrinsicCombatSkillTriggered = true;
          const pick = adjacentEmpty[Math.floor(Math.random() * adjacentEmpty.length)]!;
          const phIdx = nextPieces.findIndex(
            (p) => p.row === move.toRow && p.col === move.toCol && p.side === captured.side,
          );
          if (phIdx >= 0) {
            const ph = nextPieces[phIdx]!;
            nextPieces[phIdx] = { ...ph, row: pick.row, col: pick.col };
          }
        } else if (
          !captureOwnPiece &&
          isKbossPiece(captured) &&
          kbossEffectiveLives(captured) > 1
        ) {
          rebuffKboss = true;
          didCapture = false;
          const kIdx = nextPieces.findIndex(
            (p) => p.row === move.toRow && p.col === move.toCol && p.side === captured.side,
          );
          if (kIdx >= 0) {
            const cur = nextPieces[kIdx]!;
            nextPieces[kIdx] = {
              ...cur,
              kbossLivesRemaining: kbossEffectiveLives(cur) - 1,
            };
          }
        } else {
          didCapture = true;
          if (!captureOwnPiece && isPigPieceForApply(movingPiece)) {
            pigInheritVictim = captured;
          }
          {
            const capturedChar = (() => {
              try {
                return (captured.char ?? '').normalize('NFKC');
              } catch {
                return captured.char ?? '';
              }
            })();
            const rawCode = (captured.pieceCode ?? '').toUpperCase();
            if (!captureOwnPiece && (capturedChar === '病' || rawCode.includes('151646512B2F'))) {
              diseaseCapturedByActor = true;
            }
            if (!captureOwnPiece && (capturedChar === '淵' || rawCode.includes('31CB39CC0FA8'))) {
              abyssCapturedByActor = true;
            }
            if (!captureOwnPiece && isDeathPieceForApply(captured)) {
              deathCapturedByActor = true;
            }
            if (!captureOwnPiece && isHolePieceForApply(captured)) {
              capturedHoleCellsByActor.push({ row: move.toRow, col: move.toCol });
            }
          }
          const consumeReiSubstitute =
            !captureOwnPiece && captured
              ? shouldConsumeReiSubstituteAfterAllyCapture(nextPieces, captured)
              : false;
          const chrysRevivalActive =
            !captureOwnPiece &&
            captured != null &&
            hasActiveChrysanthemumRevival(
              current.boardState as Record<string, unknown> | undefined,
              captured.side,
              move.toRow,
              move.toCol,
            );
          if (!captureOwnPiece && isZaiPieceForApply(movingPiece)) {
            zaiCapturedEnemySnapshot = { ...captured };
          }
          nextPieces = removeCapturedPieceFromBoard(nextPieces, move.toRow, move.toCol, captured);
          const fallbackCapturedCode = toBasePieceCode(move.capturedPieceCode);
          if (captureOwnPiece) {
            // 雲の味方捕獲は自分の手駒に加える。
            const capturedCode = resolveCapturedHandCode(captured, fallbackCapturedCode);
            if (capturedCode) {
              hands = addHandPiece(hands, actorSide, capturedCode, 1);
            }
          } else if (chrysRevivalActive) {
            removeChrysanthemumRevivalAtCell(
              current.boardState as Record<string, unknown> | undefined,
              captured.side,
              move.toRow,
              move.toCol,
            );
            if (!isSpiritPiece(captured)) {
              const capturedCode = resolveCapturedHandCode(captured, fallbackCapturedCode);
              if (capturedCode) {
                hands = addHandPiece(hands, captured.side, capturedCode, 1);
              }
            }
          } else {
            const isSpiritCaptured = isSpiritPiece(captured);
            const capturedBaseCode = toBasePieceCode(captured.pieceCode);
            const isStarCaptured = capturedBaseCode === 'HOS' || captured.char === '星';
            if (isSpiritCaptured) {
              // 霊: 相手に取られても手駒に加わらず消滅する。
            } else if (isVanishOnCapturePiece(captured)) {
              // K 博士・実・異: 手駒に加えない。
            } else if (isStarCaptured) {
              const procChance = 0.4;
              const roll = Math.random();
              const triggered = roll <= procChance;
              if (triggered) {
                starReturnProcTriggered = true;
                hands = addHandPiece(hands, captured.side, 'HOS', 1);
              } else {
                const capturedCode = resolveCapturedHandCode(captured, fallbackCapturedCode);
                if (capturedCode) {
                  const handSide = targetHandSideForCapturedPiece(
                    actorSide,
                    captured.side,
                    consumeReiSubstitute,
                  );
                  hands = addHandPiece(hands, handSide, capturedCode, 1);
                }
              }
            } else {
              const capturedCode = resolveCapturedHandCode(captured, fallbackCapturedCode);
              if (capturedCode) {
                const handSide = targetHandSideForCapturedPiece(
                  actorSide,
                  captured.side,
                  consumeReiSubstitute,
                );
                hands = addHandPiece(hands, handSide, capturedCode, 1);
              }
            }
          }
          if (consumeReiSubstitute && captured && !chrysRevivalActive) {
            nextPieces = removeFirstReiRitualFromSide(nextPieces, captured.side);
          }
        }
      }

      const movingIndexAfterCapture = nextPieces.findIndex(
        (piece) =>
          piece.side === actorSide && piece.row === move.fromRow && piece.col === move.fromCol,
      );
      if (movingIndexAfterCapture < 0) {
        throw new Error('moving piece not found after capture resolution');
      }
      if (!rebuffKboss && !shieldAbortedMove) {
        const moving = nextPieces[movingIndexAfterCapture];
        const nextPromoted = move.promote || moving.promoted === true;
        const resolvedChar = pieceChar(moving.pieceCode, nextPromoted);
        // pieceCode が剣と共有（SWORD 等）のとき pieceChar が「剣」になり、刀の intrinsic が死ぬのを防ぐ。銃も同様。
        const nextChar =
          isKatanaPieceForApply(moving) ||
          isGunPieceForApply(moving) ||
          isCowPieceForApply(moving) ||
          isPigPieceForApply(moving) ||
          isNakuPieceForApply(moving)
            ? moving.char
            : resolvedChar === '?' ||
                (toBasePieceCode(moving.pieceCode) != null &&
                  resolvedChar === toBasePieceCode(moving.pieceCode))
              ? moving.char
              : resolvedChar;
        const cowFwdDistForCharge =
          move.fromRow != null && move.fromCol != null
            ? computeCowForwardPathDistanceForApply(
                actorSide,
                move.fromRow,
                move.fromCol,
                move.toRow,
                move.toCol,
              )
            : null;
        const isCowFwdMove = isCowPieceForApply(moving) && cowFwdDistForCharge != null;
        const isCowBackMove =
          isCowPieceForApply(moving) &&
          move.fromRow != null &&
          move.toCol === move.fromCol &&
          move.toRow - move.fromRow === -gunForwardRowDeltaForApply(actorSide);
        nextPieces[movingIndexAfterCapture] = {
          ...moving,
          row: move.toRow,
          col: move.toCol,
          promoted: nextPromoted,
          char: nextChar,
          ...(isCowPieceForApply(moving)
            ? {
                cowChargeCount: isCowFwdMove
                  ? 0
                  : isCowBackMove
                    ? Math.min(8, Math.max(0, Math.floor(moving.cowChargeCount ?? 0)) + 1)
                    : Math.max(0, Math.floor(moving.cowChargeCount ?? 0)),
              }
            : {}),
          ...(isPigPieceForApply(moving)
            ? pigInheritVictim
              ? (() => {
                  const resolved =
                    resolveCapturedHandCode(
                      pigInheritVictim,
                      toBasePieceCode(move.capturedPieceCode),
                    ) ?? toBasePieceCode(pigInheritVictim.pieceCode);
                  const code =
                    resolved && `${resolved}`.trim() !== ''
                      ? `${resolved}`.trim().toUpperCase()
                      : null;
                  return code
                    ? {
                        pigInheritedPieceCode: code,
                        pigInheritedChar: pigInheritVictim.char,
                        pigInheritedPromoted: pigInheritVictim.promoted ?? false,
                      }
                    : {
                        pigInheritedPieceCode: moving.pigInheritedPieceCode ?? null,
                        ...(moving.pigInheritedChar != null
                          ? { pigInheritedChar: moving.pigInheritedChar }
                          : {}),
                        ...(moving.pigInheritedPromoted != null
                          ? { pigInheritedPromoted: moving.pigInheritedPromoted }
                          : {}),
                      };
                })()
              : {
                  pigInheritedPieceCode: moving.pigInheritedPieceCode ?? null,
                  ...(moving.pigInheritedChar != null
                    ? { pigInheritedChar: moving.pigInheritedChar }
                    : {}),
                  ...(moving.pigInheritedPromoted != null
                    ? { pigInheritedPromoted: moving.pigInheritedPromoted }
                    : {}),
                }
            : {}),
        };
        let landedAfterMove = nextPieces[movingIndexAfterCapture]!;
        if (move.fromRow != null && move.fromCol != null && isSenPieceForApply(movingPiece)) {
          const transformed = maybeApplySenMoveSkillTransform(landedAfterMove);
          if (
            transformed.pieceCode !== landedAfterMove.pieceCode ||
            transformed.char !== landedAfterMove.char
          ) {
            nextPieces[movingIndexAfterCapture] = transformed;
            landedAfterMove = transformed;
            intrinsicCombatSkillTriggered = true;
          }
        }
        if (
          zaiCapturedEnemySnapshot &&
          isZaiPieceForApply(movingPiece) &&
          didCapture &&
          move.fromRow != null &&
          move.fromCol != null
        ) {
          const zaiNext = applyZaiSkillReplaceAllySenWithCaptured(
            nextPieces,
            actorSide,
            zaiCapturedEnemySnapshot,
            move.toRow,
            move.toCol,
          );
          if (zaiNext) {
            nextPieces = zaiNext;
            intrinsicCombatSkillTriggered = true;
          }
        }
        movedPieceAfterApply = landedAfterMove;
      } else {
        movedPieceAfterApply = nextPieces[movingIndexAfterCapture] ?? null;
      }

      if (
        !rebuffKboss &&
        !shieldAbortedMove &&
        movedPieceAfterApply &&
        move.fromRow != null &&
        move.fromCol != null
      ) {
        const slideMovingIndex = nextPieces.findIndex(
          (p) =>
            p.side === actorSide &&
            p.row === movedPieceAfterApply!.row &&
            p.col === movedPieceAfterApply!.col,
        );
        if (slideMovingIndex >= 0) {
          const arrowSlide = applyArrowTileSlideAfterLanding({
            position: current,
            boardState: current.boardState as Record<string, unknown> | undefined,
            nextPieces,
            hands,
            actorSide,
            landingRow: move.toRow,
            landingCol: move.toCol,
            movingIndex: slideMovingIndex,
          });
          if (arrowSlide.didSlide) {
            nextPieces = arrowSlide.nextPieces;
            hands = arrowSlide.hands;
            if (arrowSlide.didCapture) {
              didCapture = true;
              intrinsicCombatSkillTriggered = true;
            }
            if (arrowSlide.starReturnProcTriggered) starReturnProcTriggered = true;
            if (arrowSlide.deathCapturedByActor) deathCapturedByActor = true;
            movedPieceAfterApply = nextPieces[slideMovingIndex] ?? movedPieceAfterApply;
          }
        }
      }

      // 銃の貫通手で敵を取った（中点のみ／先のみ／両方）ときスキル発動扱いにする。
      if (gunPen != null && isGunPieceForApply(movingPiece) && didCapture) {
        intrinsicCombatSkillTriggered = true;
      }
      if (
        cowChargedPathDist != null &&
        cowChargedPathDist > 1 &&
        isCowPieceForApply(movingPiece) &&
        didCapture
      ) {
        intrinsicCombatSkillTriggered = true;
      }

      if (isGunPieceForApply(movingPiece)) {
        gunApplyDebugLog({
          phase: 'post-board-update',
          didCapture,
          rebuffKboss,
          hadGunPenetration: gunPen != null,
          intrinsicCombatSkillFlag: gunPen != null && isGunPieceForApply(movingPiece) && didCapture,
          landing: movedPieceAfterApply
            ? { row: movedPieceAfterApply.row, col: movedPieceAfterApply.col }
            : null,
        });
      }
    }
  }

  let winnerSide: Side | null = null;
  if (!hasKing(nextPieces, 'player')) {
    winnerSide = 'enemy';
  } else if (!hasKing(nextPieces, 'enemy')) {
    winnerSide = 'player';
  }

  if (otsuFollowupBefore && didCapture) {
    throw new Error('otsu followup cannot capture');
  }
  let grantsOtsuFollowup = false;
  if (
    !otsuFollowupBefore &&
    movedByOtsu &&
    didCapture &&
    !shieldAbortedMove &&
    movedPieceAfterApply
  ) {
    const followupPreview = createPosition({
      pieces: nextPieces,
      hands,
      sideToMove: actorSide,
      moveCount: current.moveCount,
      pieceCatalog: input.pieceCatalog,
    });
    followupPreview.boardState = {
      ...(current.boardState ?? {}),
      ...(followupPreview.boardState ?? {}),
    };
    const previewBoard = (followupPreview.boardState ?? {}) as Record<string, unknown>;
    const previewSkillStateRaw = (previewBoard.skill_state ?? previewBoard.skillState) as
      | Record<string, unknown>
      | undefined;
    const previewSkillState =
      previewSkillStateRaw && typeof previewSkillStateRaw === 'object'
        ? { ...previewSkillStateRaw }
        : {};
    const previewStatusesRaw = (previewSkillState.piece_statuses ??
      previewSkillState.pieceStatuses) as unknown;
    const previewStatuses = Array.isArray(previewStatusesRaw) ? [...previewStatusesRaw] : [];
    previewStatuses.push({
      side: actorSide,
      row: movedPieceAfterApply.row,
      col: movedPieceAfterApply.col,
      status_type: 'otsu_followup',
      remaining_turns: 1,
    });
    (previewSkillState as Record<string, unknown>).piece_statuses = previewStatuses;
    previewBoard.skill_state = previewSkillState;
    followupPreview.boardState = previewBoard;
    grantsOtsuFollowup =
      generateLegalMoves({ position: followupPreview, pieceCatalog: input.pieceCatalog }).legalMoves
        .length > 0;
  }

  let grantsConvexFollowup = false;
  if (
    !convexFollowupBefore &&
    !otsuFollowupBefore &&
    movedByConvex &&
    !shieldAbortedMove &&
    movedPieceAfterApply &&
    move.fromRow != null &&
    move.fromCol != null &&
    !move.dropPieceCode
  ) {
    const convexPreview = createPosition({
      pieces: nextPieces,
      hands,
      sideToMove: actorSide,
      moveCount: current.moveCount,
      pieceCatalog: input.pieceCatalog,
    });
    convexPreview.boardState = {
      ...(current.boardState ?? {}),
      ...(convexPreview.boardState ?? {}),
    };
    const convexBoard = (convexPreview.boardState ?? {}) as Record<string, unknown>;
    const convexSkillStateRaw = (convexBoard.skill_state ?? convexBoard.skillState) as
      | Record<string, unknown>
      | undefined;
    const convexSkillState =
      convexSkillStateRaw && typeof convexSkillStateRaw === 'object'
        ? { ...convexSkillStateRaw }
        : {};
    const convexStatusesRaw = (convexSkillState.piece_statuses ??
      convexSkillState.pieceStatuses) as unknown;
    const convexStatuses = Array.isArray(convexStatusesRaw) ? [...convexStatusesRaw] : [];
    convexStatuses.push({
      side: actorSide,
      row: movedPieceAfterApply.row,
      col: movedPieceAfterApply.col,
      status_type: 'convex_followup',
      remaining_turns: 1,
    });
    (convexSkillState as Record<string, unknown>).piece_statuses = convexStatuses;
    convexBoard.skill_state = convexSkillState;
    convexPreview.boardState = convexBoard;
    grantsConvexFollowup =
      generateLegalMoves({ position: convexPreview, pieceCatalog: input.pieceCatalog }).legalMoves
        .length > 0;
  }

  // 盾で取りが無効化されても着手は1手として消化し、攻撃側の手番を終える。
  const turnAdvanced = !grantsOtsuFollowup && !grantsConvexFollowup;
  const applyLandingDerivedEffects = !shieldAbortedMove;
  const nextSide: Side = turnAdvanced ? (actorSide === 'player' ? 'enemy' : 'player') : actorSide;
  const nextMoveCount = current.moveCount + (turnAdvanced ? 1 : 0);
  let nextPosition = createPosition({
    pieces: nextPieces,
    hands,
    sideToMove: nextSide,
    moveCount: nextMoveCount,
    pieceCatalog: input.pieceCatalog,
  });
  const currentBoardState = (current.boardState ?? {}) as Record<string, unknown>;
  const generatedBoardState = (nextPosition.boardState ?? {}) as Record<string, unknown>;
  nextPosition.boardState = {
    ...generatedBoardState,
    ...currentBoardState,
    pieces: generatedBoardState.pieces,
    custom_move_vectors:
      generatedBoardState.custom_move_vectors ?? currentBoardState.custom_move_vectors,
    skill_definitions_v2:
      currentBoardState.skill_definitions_v2 ?? generatedBoardState.skill_definitions_v2,
    skillDefinitionsV2:
      currentBoardState.skillDefinitionsV2 ?? generatedBoardState.skillDefinitionsV2,
  };

  let moveSkillEffectTriggeredFromMoveEffects = false;
  let skillVisualEffectsFromMoveEffects: SkillVisualEffect[] = [];
  const shieldSkillVisualEffects: SkillVisualEffect[] = [];
  if (shieldAbortedMove) {
    shieldSkillVisualEffects.push(
      createSkillVisualEffect({
        id: `mv${current.moveCount}-shield`,
        pieceChar: '盾',
        placements: [boardSkillFxPlacement(move.toRow, move.toCol)],
      }),
    );
  }
  if (kenSwordEvadeCell) {
    shieldSkillVisualEffects.push(
      createSkillVisualEffect({
        id: `mv${current.moveCount}-holy-sword`,
        pieceChar: '剣',
        placements: [boardSkillFxPlacement(kenSwordEvadeCell.row, kenSwordEvadeCell.col)],
      }),
    );
  }
  if (turnAdvanced) {
    // オンライン楽観更新では持続ターンの消費はサーバー wire を正とする（×マスが早消えしない）
    if (!input.options?.suppressRandomSkillProcs) {
      tickSkillStateDurations(nextPosition);
    }
    if (applyLandingDerivedEffects) {
      // 着手によるスキル効果（移動制限・毒マスなど）を反映（実際にマスへ入ったときのみ）。
      const { moveSkillEffectTriggered, skillVisualEffects } = applyMoveSkillEffects({
        position: nextPosition,
        move,
        actorSide,
        movedPiece: movedPieceAfterApply,
        pieces: nextPieces,
        didCapture,
        suppressRandomSkillProcs: input.options?.suppressRandomSkillProcs === true,
      });
      moveSkillEffectTriggeredFromMoveEffects = moveSkillEffectTriggered;
      skillVisualEffectsFromMoveEffects = skillVisualEffects;
    }
    hands = nextPosition.hands;
  }

  let movedPieceForIntrinsic = movedPieceAfterApply;
  if (move.fromRow != null && move.fromCol != null && !move.dropPieceCode) {
    const refreshed = nextPieces.find(
      (p) => p.side === actorSide && p.row === move.toRow && p.col === move.toCol,
    );
    if (refreshed) movedPieceForIntrinsic = refreshed;
  }

  if (turnAdvanced && applyLandingDerivedEffects) {
    const intrinsicKatana = applyIntrinsicKatanaSideCaptures({
      boardState: current.boardState as Record<string, unknown> | undefined,
      nextPieces,
      hands,
      actorSide,
      didCapture,
      movedPiece: movedPieceForIntrinsic,
      move,
    });
    nextPieces = intrinsicKatana.nextPieces;
    hands = intrinsicKatana.hands;
    if (intrinsicKatana.starReturnProcTriggered) starReturnProcTriggered = true;
    if (intrinsicKatana.didSideSweep) {
      intrinsicCombatSkillTriggered = true;
    }
    const intrinsicNaku = applyIntrinsicNakuPonCaptures({
      boardState: current.boardState as Record<string, unknown> | undefined,
      boardBeforeMove,
      nextPieces,
      hands,
      actorSide,
      didCapture,
      movedPiece: movedPieceForIntrinsic,
      move,
    });
    nextPieces = intrinsicNaku.nextPieces;
    hands = intrinsicNaku.hands;
    if (intrinsicNaku.starReturnProcTriggered) starReturnProcTriggered = true;
    if (intrinsicNaku.didPonSweep) {
      intrinsicCombatSkillTriggered = true;
    }
  }

  // 銃の「前方2マスへ進むと1マス目・2マス目の敵を同時に取る」は本関数前半の gun penetration（中点＋着地）で処理する。
  nextPosition.hands = hands;

  // 毒マスへ侵入した駒は消滅。
  if (
    turnAdvanced &&
    applyLandingDerivedEffects &&
    move.notation !== 'time_skill_only' &&
    move.notation !== 'house_skill_only'
  ) {
    applyBoardHazardsOnLanding({
      position: nextPosition,
      actorSide,
      movedTo: { row: move.toRow, col: move.toCol },
      pieces: nextPieces,
    });
  }
  // スキルで駒数が変わる（家の召喚など）ため、常に nextPieces を board_state.pieces に反映する。
  nextPosition.boardState = {
    ...(nextPosition.boardState ?? {}),
    pieces: nextPieces.map((piece) => ({ ...piece })),
  };

  if (applyLandingDerivedEffects && didCapture && movedPieceAfterApply) {
    const cookingSummoned = applyCookingCaptureSummonEffects({
      position: nextPosition,
      pieces: nextPieces,
      movedPiece: movedPieceAfterApply,
      actorSide,
    });
    if (cookingSummoned) {
      intrinsicCombatSkillTriggered = true;
      nextPosition.boardState = {
        ...(nextPosition.boardState ?? {}),
        pieces: nextPieces.map((piece) => ({ ...piece })),
      };
    }
  }

  // スキルで盤上座標が変わる（例: 水の押し流し）ため、
  // boardState だけでなく SFEN も同じターン内で再構築して二重表示を防ぐ。
  const latestHands = normalizeHandsStateKeys({
    player: sanitizeHandsBag(nextPosition.hands.player),
    enemy: sanitizeHandsBag(nextPosition.hands.enemy),
  });
  const recomputedPosition = createPosition({
    pieces: nextPieces,
    hands: latestHands,
    sideToMove: nextSide,
    moveCount: nextMoveCount,
    pieceCatalog: input.pieceCatalog,
  });
  recomputedPosition.boardState = {
    ...(recomputedPosition.boardState ?? {}),
    ...(nextPosition.boardState ?? {}),
  };
  const skillStateRaw =
    (recomputedPosition.boardState as Record<string, unknown>).skill_state ??
    (recomputedPosition.boardState as Record<string, unknown>).skillState;
  const skillState =
    skillStateRaw && typeof skillStateRaw === 'object'
      ? { ...(skillStateRaw as Record<string, unknown>) }
      : {};
  // 行動後、移動した駒に付いている座標依存ステータスを着地点へ追従させる。
  if (
    turnAdvanced &&
    applyLandingDerivedEffects &&
    move.fromRow != null &&
    move.fromCol != null &&
    movedPieceAfterApply
  ) {
    const prev = (skillState.piece_statuses ?? skillState.pieceStatuses) as unknown;
    const list = Array.isArray(prev) ? [...prev] : [];
    const relocated = list.map((raw) => {
      const st = (raw ?? {}) as Record<string, unknown>;
      const side = String(st.side ?? 'player') === 'enemy' ? 'enemy' : 'player';
      const row = Number(st.row);
      const col = Number(st.col);
      if (
        side === actorSide &&
        Number.isFinite(row) &&
        Number.isFinite(col) &&
        row === move.fromRow &&
        col === move.fromCol
      ) {
        return { ...st, row: movedPieceAfterApply.row, col: movedPieceAfterApply.col };
      }
      return st;
    });
    (skillState as Record<string, unknown>).piece_statuses = relocated;
  }
  // 病: 取った駒（攻撃側）を 3 ターン行動不能にする。
  if (
    turnAdvanced &&
    applyLandingDerivedEffects &&
    diseaseCapturedByActor &&
    movedPieceAfterApply
  ) {
    const prev = (skillState.piece_statuses ?? skillState.pieceStatuses) as unknown;
    const arr = Array.isArray(prev) ? [...prev] : [];
    arr.push({
      row: movedPieceAfterApply.row,
      col: movedPieceAfterApply.col,
      side: actorSide,
      status_type: 'stun',
      remaining_turns: 3,
    });
    (skillState as Record<string, unknown>).piece_statuses = arr;
  }
  // 死: 取った駒（攻撃側）に呪いを付与。5ターン後に消滅する。
  if (turnAdvanced && applyLandingDerivedEffects && deathCapturedByActor && movedPieceAfterApply) {
    const prev = (skillState.piece_statuses ?? skillState.pieceStatuses) as unknown;
    const arr = Array.isArray(prev) ? [...prev] : [];
    arr.push({
      row: movedPieceAfterApply.row,
      col: movedPieceAfterApply.col,
      side: actorSide,
      status_type: 'death_curse',
      remaining_turns: 5,
    });
    (skillState as Record<string, unknown>).piece_statuses = arr;
  }
  // 淵: 取った駒（攻撃側）を 3 ターン行動不能にする（紫オーラ表示は UI 側で abyss_stun を参照）。
  if (turnAdvanced && applyLandingDerivedEffects && abyssCapturedByActor && movedPieceAfterApply) {
    const prev = (skillState.piece_statuses ?? skillState.pieceStatuses) as unknown;
    const arr = Array.isArray(prev) ? [...prev] : [];
    arr.push({
      row: movedPieceAfterApply.row,
      col: movedPieceAfterApply.col,
      side: actorSide,
      status_type: 'abyss_stun',
      remaining_turns: 3,
    });
    (skillState as Record<string, unknown>).piece_statuses = arr;
  }
  // 穴: 取られたとき、その位置の周囲8マスの空きマスを4ターン侵入不可（バツマス）にする。
  if (turnAdvanced && applyLandingDerivedEffects && capturedHoleCellsByActor.length > 0) {
    const hazardsRaw = (skillState.board_hazards ?? skillState.boardHazards) as unknown;
    const hazards = Array.isArray(hazardsRaw) ? [...hazardsRaw] : [];
    const occupied = new Set(nextPieces.map((p) => `${p.row}:${p.col}`));
    for (const center of capturedHoleCellsByActor) {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const row = center.row + dr;
          const col = center.col + dc;
          if (row < 0 || row > 8 || col < 0 || col > 8) continue;
          if (occupied.has(`${row}:${col}`)) continue;
          for (let i = hazards.length - 1; i >= 0; i -= 1) {
            const raw = hazards[i] as Record<string, unknown>;
            const type = String(raw.hazard_type ?? raw.hazardType ?? '');
            const hRow = Number(raw.row);
            const hCol = Number(raw.col);
            if (type === 'pit_cell' && hRow === row && hCol === col) {
              hazards.splice(i, 1);
            }
          }
          hazards.push({
            row,
            col,
            hazard_type: 'pit_cell',
            affects_side: 'both',
            remaining_turns: 4,
          });
        }
      }
    }
    (skillState as Record<string, unknown>).board_hazards = hazards;
  }
  {
    const rawStatuses = (skillState.piece_statuses ?? skillState.pieceStatuses) as unknown;
    const statuses = Array.isArray(rawStatuses) ? [...rawStatuses] : [];
    const withoutPieceFollowups = statuses.filter((raw) => {
      const st = (raw ?? {}) as Record<string, unknown>;
      const statusType = String(st.status_type ?? st.statusType ?? '');
      if (statusType !== 'otsu_followup' && statusType !== 'convex_followup') return true;
      const side = String(st.side ?? 'player') === 'enemy' ? 'enemy' : 'player';
      return side !== actorSide;
    });
    if (grantsOtsuFollowup && movedPieceAfterApply) {
      withoutPieceFollowups.push({
        side: actorSide,
        row: movedPieceAfterApply.row,
        col: movedPieceAfterApply.col,
        status_type: 'otsu_followup',
        remaining_turns: 1,
      });
    }
    if (grantsConvexFollowup && movedPieceAfterApply) {
      withoutPieceFollowups.push({
        side: actorSide,
        row: movedPieceAfterApply.row,
        col: movedPieceAfterApply.col,
        status_type: 'convex_followup',
        remaining_turns: 1,
      });
    }
    (skillState as Record<string, unknown>).piece_statuses = withoutPieceFollowups;
  }
  if (turnAdvanced && applyLandingDerivedEffects && movedPieceAfterApply) {
    const key = actorSide === 'player' ? 'last_player_moved_piece' : 'last_enemy_moved_piece';
    const movedCode = toBasePieceCode(movedPieceAfterApply.pieceCode);
    const movedChar = movedPieceAfterApply.char ?? '';
    const movedDef =
      (movedCode
        ? input.pieceCatalog.find((def) => toBasePieceCode(def.pieceCode) === movedCode)
        : undefined) ??
      input.pieceCatalog.find((def) => def.char === movedChar) ??
      null;
    const copiedMoveVectors = Array.isArray(movedDef?.moveVectors)
      ? movedDef.moveVectors.map((v) => ({
          dx: v.dx,
          dy: v.dy,
          maxStep: v.maxStep,
          ...(v.captureMode ? { captureMode: v.captureMode } : {}),
        }))
      : [];
    skillState[key] = {
      side: actorSide,
      row: movedPieceAfterApply.row,
      col: movedPieceAfterApply.col,
      pieceCode: movedPieceAfterApply.pieceCode,
      char: movedPieceAfterApply.char,
      promoted: movedPieceAfterApply.promoted === true,
      copiedMoveVectors,
    };
  }
  (recomputedPosition.boardState as Record<string, unknown>).skill_state = skillState;
  nextPosition = recomputedPosition;
  let deathCurseVanishedAny = false;
  {
    const boardState = (nextPosition.boardState ?? {}) as Record<string, unknown>;
    const skillStateRaw = (boardState.skill_state ?? boardState.skillState) as
      | Record<string, unknown>
      | undefined;
    const statusesRaw = (skillStateRaw?.piece_statuses ?? skillStateRaw?.pieceStatuses) as unknown;
    const statuses = Array.isArray(statusesRaw) ? statusesRaw : [];
    const shouldVanish = new Set<string>();
    const survivors: Record<string, unknown>[] = [];
    for (const raw of statuses) {
      const st = (raw ?? {}) as Record<string, unknown>;
      const statusType = String(st.status_type ?? st.statusType ?? '');
      const side = String(st.side ?? 'player') === 'enemy' ? 'enemy' : 'player';
      const row = Number(st.row);
      const col = Number(st.col);
      const remaining = Number(st.remaining_turns ?? st.remainingTurns ?? 0);
      if (
        statusType === 'death_curse' &&
        Number.isFinite(row) &&
        Number.isFinite(col) &&
        remaining <= 0
      ) {
        shouldVanish.add(`${side}:${row}:${col}`);
        continue;
      }
      survivors.push(st);
    }
    if (shouldVanish.size > 0) {
      deathCurseVanishedAny = true;
      nextPieces = nextPieces.filter((p) => !shouldVanish.has(`${p.side}:${p.row}:${p.col}`));
    }
    if (skillStateRaw) {
      (skillStateRaw as Record<string, unknown>).piece_statuses = survivors;
      (boardState as Record<string, unknown>).skill_state = skillStateRaw;
    }
  }
  if (deathCurseVanishedAny) {
    const syncedHands = normalizeHandsStateKeys({
      player: sanitizeHandsBag(nextPosition.hands.player),
      enemy: sanitizeHandsBag(nextPosition.hands.enemy),
    });
    const vanishedSyncedPosition = createPosition({
      pieces: nextPieces,
      hands: syncedHands,
      sideToMove: nextSide,
      moveCount: nextMoveCount,
      pieceCatalog: input.pieceCatalog,
    });
    vanishedSyncedPosition.boardState = {
      ...(vanishedSyncedPosition.boardState ?? {}),
      ...((nextPosition.boardState as Record<string, unknown> | undefined) ?? {}),
      pieces: nextPieces.map((piece) => ({ ...piece })),
    };
    nextPosition = vanishedSyncedPosition;
  }

  if (!winnerSide) {
    const nextLegal = generateLegalMoves({
      position: nextPosition,
      pieceCatalog: input.pieceCatalog,
    });
    if (nextLegal.legalMoves.length === 0) {
      winnerSide = actorSide;
    }
  }

  const game = createGameStatus(winnerSide);

  return {
    moveNo: current.moveCount + 1,
    actorSide,
    move: { ...move, notation: notationForMove(move) },
    skillTriggered:
      shieldAbortedMove ||
      intrinsicCombatSkillTriggered ||
      starReturnProcTriggered ||
      moveSkillEffectTriggeredFromMoveEffects ||
      move.notation === 'time_skill' ||
      move.notation === 'time_skill_only' ||
      move.notation === 'house_skill_only' ||
      Boolean(move.notation && move.notation !== 'time_normal' && !/^\d/.test(move.notation)),
    turnConsumed: turnAdvanced,
    position: nextPosition,
    game,
    skillVisualEffects: [...skillVisualEffectsFromMoveEffects, ...shieldSkillVisualEffects],
  };
}
