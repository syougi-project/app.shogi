import type { SkillVisualEffect } from '@/domain/battle/skill-visual-effect';
import {
  appendBoardCenterSkillVisualEffect,
  appendBoardSkillVisualEffects,
  appendHandSkillVisualEffects,
  handSlotIndexBeforeRemoval,
  resolveSkillFxPieceChar,
} from '@/domain/battle/skill-visual-fx';
import type { ArrowDirection } from '@/constants/stage-fixed-arrow-cells';
import type { Side } from '@/features/stage-shogi/domain/game-rules';
import { capturedToHandPieceCode } from '@/features/stage-shogi/domain/game-rules';
import { CHAR_TO_CODE } from '@/features/stage-shogi/domain/piece-conversion';
import type { AiBattleMove, AiBattlePosition, AiBoardPiece } from '@/ai/model';
import { piecesFromBoardState, toBasePieceCode } from '@/ai/model';
import {
  buildSkillMoverFlags,
  isAoriPiece,
  isAPieceInstance,
  isDeckBuilderStyleSpecialBoardPiece,
  isKingPiece,
  isKoPiece,
  isMaiPiece,
  isShopPPiece,
  isSpecialTenPlusPiece,
  isTanePiece,
  normalizeSkillPieceCode,
} from '@/ai/engine/piece-identifiers';
import {
  findPieceCoveringCell,
  giantAnchorFootprint,
  isGiantPieceForEngine,
} from '@/ai/engine/giant-piece';
import {
  listSpringImmunityAllyCandidates,
  SPRING_ALLY_IMMUNITY_TURNS,
  upsertCaptureImmunityDefense,
} from '@/ai/engine/spring-random-ally-immunity';
import {
  HEN_BOARD_EDGES,
  pieceOnHenBoardEdge,
  type HenBoardEdge,
} from '@/ai/engine/hen-board-edge';

import { buildArrowTileByCellMap } from '@/ai/engine/arrow-tile';

type SkillStateRecord = {
  board_hazards: Record<string, unknown>[];
  board_arrow_tiles: Record<string, unknown>[];
  movement_modifiers: Record<string, unknown>[];
  piece_statuses: Record<string, unknown>[];
  piece_defenses: Record<string, unknown>[];
};

export type SkillRuntimeView = {
  state: SkillStateRecord;
  movementRulesByCell: Map<string, string>;
  immobilizedCells: Set<string>;
  darkBlindCells: Set<string>;
  kingPoisonBlockedCells: Set<string>;
  rockObstacleCells: Set<string>;
  aTransformCells: Set<string>;
  /** `piece_defenses` の mode=immunity かつ remaining>0（敵から取れない） */
  captureImmunityCells: Set<string>;
  /** 茨化マス: 指定 side はそのセルに持ち駒を打てない */
  thornDropBlockedCells: Set<string>;
  /** 矢印マス: `${row}:${col}` → スライド方向 */
  arrowTileByCell: Map<string, ArrowDirection>;
};

const TIME_PIECE_CODES = new Set(['TIME', '時']);
const SAND_PIECE_CODES = new Set(['SAND', '砂']);
const PEAK_PIECE_CODES = new Set(['PEAK', 'MINE', '峰', '5A24E1332FF7']);
const SEAL_PIECE_CODES = new Set(['SEAL', '封']);
const TREASURE_REWARD_CODES = ['KI', 'GI', 'COPPER'] as const;

function stableHashSkillSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function isSealPieceForAura(piece: { char: string; pieceCode: string | null }): boolean {
  if (piece.char === '封') return true;
  const code = normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode) ?? '');
  return SEAL_PIECE_CODES.has(code);
}

/** skill_definitions_v2 の pieceChars が漢字のみ（例: 霧）でも pieceCode（例: MIST）と突合できるようにする */
function catalogPieceTokenMatchesMoved(
  catalogToken: string,
  movedCode: string,
  movedPiece: AiBoardPiece | null,
): boolean {
  const t = catalogToken.trim();
  if (!t) return false;
  if (movedPiece?.char && t === movedPiece.char) return true;
  if (normalizeSkillPieceCode(t) === movedCode) return true;
  const codeFromKanji = (CHAR_TO_CODE as Readonly<Record<string, string>>)[t];
  if (codeFromKanji != null && normalizeSkillPieceCode(codeFromKanji) === movedCode) return true;
  // カタログは漢字のみ・着手は不透明 pieceId のときでも突合できるようにする（獣72・禽73）
  if (t === '獣') {
    if (movedCode === 'BEAST' || movedCode.includes('05E4EFB89DAE')) return true;
  }
  if (t === '禽') {
    if (movedCode === 'BIRD' || movedCode.includes('29ECAB1EF3C3')) return true;
  }
  return false;
}

/** 捕獲される側の駒と skill_definitions_v2 の pieceChars（漢字など）を突合 */
export function catalogPieceTokenMatchesPiece(catalogToken: string, piece: AiBoardPiece): boolean {
  const movedCode = normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode) ?? '');
  return catalogPieceTokenMatchesMoved(catalogToken, movedCode, piece);
}

/**
 * 被捕獲時に「空きマスへ逃げる」系（evade_capture）の発動確率を返す。該当定義が無ければ null。
 */
export function resolveEvadeCaptureProcChanceForPiece(
  boardState: Record<string, unknown> | null | undefined,
  piece: AiBoardPiece,
): number | null {
  const root = asRecord(boardState ?? {}) ?? {};
  const defsRoot = asRecord(root.skill_definitions_v2 ?? root.skillDefinitionsV2) ?? {};
  const definitions = asArray(defsRoot.definitions);
  for (const raw of definitions) {
    const def = asRecord(raw);
    if (!def) continue;
    const trigger = asRecord(def.trigger);
    if (asString(trigger?.type) !== 'continuous_rule') continue;
    const pieceChars = asArray(def.pieceChars);
    if (!pieceChars.some((p) => catalogPieceTokenMatchesPiece(asString(p) ?? '', piece))) continue;
    const effects = asArray(def.effects);
    const hasEvade = effects.some((e) => {
      const er = asRecord(e);
      if (asString(er?.type) !== 'defense_or_immunity') return false;
      const t = asRecord(er?.target);
      if (asString(t?.selector) !== 'self_piece') return false;
      return asString(asRecord(er?.params)?.mode) === 'evade_capture';
    });
    if (!hasEvade) continue;
    const conditions = asArray(def.conditions);
    for (const rawC of conditions) {
      const c = asRecord(rawC);
      if (asString(c?.type) !== 'chance_roll') continue;
      const pr = asRecord(c?.params);
      const pc = asNumber(pr?.procChance) ?? asNumber(pr?.chance);
      if (pc != null && pc > 0 && pc < 1) return pc;
    }
    return 0.5;
  }
  return null;
}

function removeRandomAdjacentEnemyPiece(input: {
  pieces: AiBoardPiece[];
  center: AiBoardPiece;
  actorSide: Side;
}): { removed: boolean; row: number; col: number } | null {
  const candidates = input.pieces
    .map((piece, idx) => ({ piece, idx }))
    .filter(({ piece }) => {
      if (piece.side === input.actorSide) return false;
      if (piece.char === '王' || piece.char === '玉' || toBasePieceCode(piece.pieceCode) === 'OU') {
        return false;
      }
      if (isGiantPieceForEngine(piece)) return false;
      return (
        Math.abs(piece.row - input.center.row) <= 1 &&
        Math.abs(piece.col - input.center.col) <= 1 &&
        !(piece.row === input.center.row && piece.col === input.center.col)
      );
    });
  if (candidates.length === 0) return null;
  const selected = candidates[Math.floor(Math.random() * candidates.length)]!;
  const { row, col } = selected.piece;
  input.pieces.splice(selected.idx, 1);
  return { removed: true, row, col };
}

function removeUpToRandomAdjacentEnemyPieces(input: {
  pieces: AiBoardPiece[];
  center: AiBoardPiece;
  actorSide: Side;
  maxRemove: number;
}): { removed: number; cells: { row: number; col: number }[] } {
  const candidates = input.pieces
    .map((piece, idx) => ({ piece, idx }))
    .filter(({ piece }) => {
      if (piece.side === input.actorSide) return false;
      if (piece.char === '王' || piece.char === '玉' || toBasePieceCode(piece.pieceCode) === 'OU') {
        return false;
      }
      if (isGiantPieceForEngine(piece)) return false;
      return (
        Math.abs(piece.row - input.center.row) <= 1 &&
        Math.abs(piece.col - input.center.col) <= 1 &&
        !(piece.row === input.center.row && piece.col === input.center.col)
      );
    });
  if (candidates.length === 0 || input.maxRemove <= 0) return { removed: 0, cells: [] };
  let removed = 0;
  const cells: { row: number; col: number }[] = [];
  let pool = [...candidates];
  while (pool.length > 0 && removed < input.maxRemove) {
    const selected = pool[Math.floor(Math.random() * pool.length)]!;
    cells.push({ row: selected.piece.row, col: selected.piece.col });
    input.pieces.splice(selected.idx, 1);
    removed += 1;
    pool = pool
      .filter((entry) => entry.idx !== selected.idx)
      .map((entry) => ({
        ...entry,
        idx: entry.idx > selected.idx ? entry.idx - 1 : entry.idx,
      }));
  }
  return { removed, cells };
}

function waterfallSkillDebugLog(payload: Record<string, unknown>): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.info('[waterfall-skill-debug]', payload);
  }
}

function anSkillDebugLog(payload: Record<string, unknown>): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.info('[an-skill-debug]', payload);
  }
}

function touSkillDebugLog(payload: Record<string, unknown>): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.info('[tou-skill-debug]', payload);
  }
}

function itsuSkillDebugLog(payload: Record<string, unknown>): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.info('[itsu-skill-debug]', payload);
  }
}

function sendAllAdjacentEnemiesToOwnerHands(input: {
  position: AiBattlePosition;
  pieces: AiBoardPiece[];
  center: AiBoardPiece;
  actorSide: Side;
}): { row: number; col: number; side: Side; char: string; handCode: string }[] {
  const moved: { row: number; col: number; side: Side; char: string; handCode: string }[] = [];
  const targets = input.pieces.filter((piece) => {
    if (piece.side === input.actorSide) return false;
    if (isGiantPieceForEngine(piece)) return false;
    const dr = Math.abs(piece.row - input.center.row);
    const dc = Math.abs(piece.col - input.center.col);
    return (dr !== 0 || dc !== 0) && dr <= 1 && dc <= 1;
  });
  for (const target of targets) {
    const handCode = toBasePieceCode(capturedToHandPieceCode(target));
    if (!handCode) continue;
    const idx = input.pieces.findIndex(
      (p) => p.side === target.side && p.row === target.row && p.col === target.col,
    );
    if (idx < 0) continue;
    input.pieces.splice(idx, 1);
    // 仕様: 取られた駒は「相手（対象駒の所有者）」の手駒へ移動。
    incrementHand(input.position, target.side, handCode, 1);
    moved.push({
      row: target.row,
      col: target.col,
      side: target.side,
      char: target.char,
      handCode,
    });
  }
  return moved;
}

function pushAdjacentEnemyPiecesOneStep(input: {
  pieces: AiBoardPiece[];
  center: AiBoardPiece;
  actorSide: Side;
}): { count: number; origins: { row: number; col: number }[] } {
  const occupied = new Set(input.pieces.map((piece) => `${piece.row}:${piece.col}`));
  const planned = new Map<number, { row: number; col: number }>();
  const plannedDest = new Set<string>();
  const origins: { row: number; col: number }[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const row = input.center.row + dr;
      const col = input.center.col + dc;
      if (row < 0 || row > 8 || col < 0 || col > 8) continue;
      const idx = input.pieces.findIndex((piece) => piece.row === row && piece.col === col);
      if (idx < 0) continue;
      const target = input.pieces[idx]!;
      if (target.side === input.actorSide) continue;
      const stepR = Math.sign(target.row - input.center.row);
      const stepC = Math.sign(target.col - input.center.col);
      if (stepR === 0 && stepC === 0) continue;
      const nextRow = target.row + stepR;
      const nextCol = target.col + stepC;
      if (nextRow < 0 || nextRow > 8 || nextCol < 0 || nextCol > 8) continue;
      const destKey = `${nextRow}:${nextCol}`;
      if (occupied.has(destKey) || plannedDest.has(destKey)) continue;
      planned.set(idx, { row: nextRow, col: nextCol });
      plannedDest.add(destKey);
      origins.push({ row: target.row, col: target.col });
    }
  }
  for (const [idx, destination] of planned.entries()) {
    input.pieces[idx] = {
      ...input.pieces[idx]!,
      row: destination.row,
      col: destination.col,
    };
  }
  return { count: planned.size, origins };
}

function pushOrthogonalAdjacentEnemiesToEdge(input: {
  pieces: AiBoardPiece[];
  center: AiBoardPiece;
  actorSide: Side;
}): { count: number; origins: { row: number; col: number }[] } {
  const directions: { dr: number; dc: number }[] = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];
  let pushed = 0;
  const origins: { row: number; col: number }[] = [];
  for (const direction of directions) {
    const row = input.center.row + direction.dr;
    const col = input.center.col + direction.dc;
    if (row < 0 || row > 8 || col < 0 || col > 8) continue;
    const idx = input.pieces.findIndex((piece) => piece.row === row && piece.col === col);
    if (idx < 0) continue;
    const target = input.pieces[idx]!;
    if (target.side === input.actorSide) continue;
    let nextRow = target.row;
    let nextCol = target.col;
    while (true) {
      const candidateRow = nextRow + direction.dr;
      const candidateCol = nextCol + direction.dc;
      if (candidateRow < 0 || candidateRow > 8 || candidateCol < 0 || candidateCol > 8) break;
      if (!isCellEmpty(input.pieces, candidateRow, candidateCol)) break;
      nextRow = candidateRow;
      nextCol = candidateCol;
    }
    if (nextRow === target.row && nextCol === target.col) continue;
    origins.push({ row: target.row, col: target.col });
    input.pieces[idx] = {
      ...target,
      row: nextRow,
      col: nextCol,
    };
    pushed += 1;
  }
  return { count: pushed, origins };
}

function warpHorizontalAdjacentEnemiesToRandomEmptyCell(input: {
  pieces: AiBoardPiece[];
  center: AiBoardPiece;
  actorSide: Side;
}): number {
  const offsets: readonly { dr: number; dc: number }[] = [
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];
  let warped = 0;
  for (const offset of offsets) {
    const row = input.center.row + offset.dr;
    const col = input.center.col + offset.dc;
    if (row < 0 || row > 8 || col < 0 || col > 8) continue;
    const idx = input.pieces.findIndex((piece) => piece.row === row && piece.col === col);
    if (idx < 0) continue;
    const target = input.pieces[idx]!;
    if (target.side === input.actorSide) continue;
    const emptyCells: { row: number; col: number }[] = [];
    for (let r = 0; r <= 8; r += 1) {
      for (let c = 0; c <= 8; c += 1) {
        if (r === target.row && c === target.col) continue;
        if (!isCellEmpty(input.pieces, r, c)) continue;
        emptyCells.push({ row: r, col: c });
      }
    }
    if (emptyCells.length === 0) continue;
    const picked = emptyCells[Math.floor(Math.random() * emptyCells.length)]!;
    input.pieces[idx] = {
      ...target,
      row: picked.row,
      col: picked.col,
    };
    warped += 1;
  }
  return warped;
}

function pushHorizontalAdjacentEnemiesOneStepAway(input: {
  pieces: AiBoardPiece[];
  center: AiBoardPiece;
  actorSide: Side;
}): number {
  const offsets: readonly { dc: number }[] = [{ dc: -1 }, { dc: 1 }];
  let pushed = 0;
  for (const offset of offsets) {
    const row = input.center.row;
    const col = input.center.col + offset.dc;
    if (col < 0 || col > 8) continue;
    const idx = input.pieces.findIndex((piece) => piece.row === row && piece.col === col);
    if (idx < 0) continue;
    const target = input.pieces[idx]!;
    if (target.side === input.actorSide) continue;
    const nextCol = target.col + offset.dc;
    if (nextCol < 0 || nextCol > 8) continue;
    if (!isCellEmpty(input.pieces, row, nextCol)) continue;
    input.pieces[idx] = {
      ...target,
      row,
      col: nextCol,
    };
    pushed += 1;
  }
  return pushed;
}

function addRandomAdjacentHazard(input: {
  state: SkillStateRecord;
  center: AiBoardPiece;
  hazardType: string;
  affectsSide: Side;
  durationTurns: number;
}): boolean {
  const candidates: { row: number; col: number }[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const row = input.center.row + dr;
      const col = input.center.col + dc;
      if (row < 0 || row > 8 || col < 0 || col > 8) continue;
      candidates.push({ row, col });
    }
  }
  if (candidates.length === 0) return false;
  const picked = candidates[Math.floor(Math.random() * candidates.length)]!;
  input.state.board_hazards.push({
    row: picked.row,
    col: picked.col,
    hazard_type: input.hazardType,
    affects_side: input.affectsSide,
    remaining_turns: input.durationTurns,
  });
  return true;
}

function addRandomOpponentCampPoisonCells(input: {
  state: SkillStateRecord;
  pieces: AiBoardPiece[];
  actorSide: Side;
  count: number;
  durationTurns: number;
}): number {
  const targetRows = input.actorSide === 'player' ? [0, 1, 2] : [6, 7, 8];
  const pool: { row: number; col: number }[] = [];
  for (const row of targetRows) {
    for (let col = 0; col <= 8; col += 1) {
      if (!isCellEmpty(input.pieces, row, col)) continue;
      pool.push({ row, col });
    }
  }
  if (pool.length === 0) return 0;
  let applied = 0;
  const used = new Set<string>();
  while (applied < input.count && used.size < pool.length) {
    const picked = pool[Math.floor(Math.random() * pool.length)]!;
    const key = `${picked.row}:${picked.col}`;
    if (used.has(key)) continue;
    used.add(key);
    input.state.board_hazards.push({
      row: picked.row,
      col: picked.col,
      hazard_type: 'poison_cell',
      affects_side: sideOpposite(input.actorSide),
      remaining_turns: input.durationTurns,
    });
    applied += 1;
  }
  return applied;
}

function moveAdjacentAllySandWithLeader(input: {
  pieces: AiBoardPiece[];
  center: AiBoardPiece;
  actorSide: Side;
  deltaRow: number;
  deltaCol: number;
}): number {
  if (input.deltaRow === 0 && input.deltaCol === 0) return 0;
  const candidates = input.pieces
    .map((piece, idx) => ({ piece, idx }))
    .filter(({ piece }) => {
      if (piece.side !== input.actorSide) return false;
      const code = normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode) ?? piece.char);
      if (!SAND_PIECE_CODES.has(code)) return false;
      if (piece.row === input.center.row && piece.col === input.center.col) return false;
      return (
        Math.abs(piece.row - input.center.row) <= 1 && Math.abs(piece.col - input.center.col) <= 1
      );
    });
  let moved = 0;
  for (const { piece, idx } of candidates) {
    const toRow = piece.row + input.deltaRow;
    const toCol = piece.col + input.deltaCol;
    if (toRow < 0 || toRow > 8 || toCol < 0 || toCol > 8) continue;
    if (!isCellEmpty(input.pieces, toRow, toCol)) continue;
    input.pieces[idx] = {
      ...piece,
      row: toRow,
      col: toCol,
    };
    moved += 1;
  }
  return moved;
}

function isGearPieceForFollow(piece: AiBoardPiece): boolean {
  const code = normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode) ?? piece.char);
  return code === 'GEAR' || piece.char === '歯';
}

/** 膠: 着手味方の出発マス8近傍にいる膠を、横移動（Δrow=0）と同じベクトルで空きマスへ追従。 */
function moveAdjacentAllyKoGlueFollowLeader(input: {
  pieces: AiBoardPiece[];
  actorSide: Side;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}): number {
  const deltaRow = input.toRow - input.fromRow;
  const deltaCol = input.toCol - input.fromCol;
  if (deltaRow !== 0 || deltaCol === 0) return 0;
  const candidates = input.pieces
    .map((piece, idx) => ({ piece, idx }))
    .filter(({ piece }) => {
      if (piece.side !== input.actorSide) return false;
      if (!isKoPiece(piece)) return false;
      if (piece.row === input.fromRow && piece.col === input.fromCol) return false;
      return Math.abs(piece.row - input.fromRow) <= 1 && Math.abs(piece.col - input.fromCol) <= 1;
    });
  let moved = 0;
  for (const { piece, idx } of candidates) {
    const destRow = piece.row + deltaRow;
    const destCol = piece.col + deltaCol;
    if (destRow < 0 || destRow > 8 || destCol < 0 || destCol > 8) continue;
    if (destRow === input.toRow && destCol === input.toCol) continue;
    if (!isCellEmpty(input.pieces, destRow, destCol)) continue;
    input.pieces[idx] = {
      ...piece,
      row: destRow,
      col: destCol,
    };
    moved += 1;
  }
  return moved;
}

/** 歯: 着手した味方駒の出発マスに8近傍していた歯を、同じ移動ベクトルで空きマスへ連動（砂と同様・先頭マスのみ） */
function moveAdjacentAllyGearFollowLeader(input: {
  pieces: AiBoardPiece[];
  actorSide: Side;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}): number {
  const deltaRow = input.toRow - input.fromRow;
  const deltaCol = input.toCol - input.fromCol;
  if (deltaRow === 0 && deltaCol === 0) return 0;
  const candidates = input.pieces
    .map((piece, idx) => ({ piece, idx }))
    .filter(({ piece }) => {
      if (piece.side !== input.actorSide) return false;
      if (!isGearPieceForFollow(piece)) return false;
      if (piece.row === input.fromRow && piece.col === input.fromCol) return false;
      return (
        Math.abs(piece.row - input.fromRow) <= 1 &&
        Math.abs(piece.col - input.fromCol) <= 1 &&
        !(piece.row === input.fromRow && piece.col === input.fromCol)
      );
    });
  let moved = 0;
  for (const { piece, idx } of candidates) {
    const destRow = piece.row + deltaRow;
    const destCol = piece.col + deltaCol;
    if (destRow < 0 || destRow > 8 || destCol < 0 || destCol > 8) continue;
    if (destRow === input.toRow && destCol === input.toCol) continue;
    if (!isCellEmpty(input.pieces, destRow, destCol)) continue;
    input.pieces[idx] = {
      ...piece,
      row: destRow,
      col: destCol,
    };
    moved += 1;
  }
  return moved;
}

/** 味方の陣営における「後ろ」は盤面 row の増減で表す（player: +row, enemy: -row） */
function backRowDeltaForBoatTow(side: Side): number {
  return side === 'player' ? 1 : -1;
}

function isKingLikePieceForBoatTow(piece: AiBoardPiece): boolean {
  const base = toBasePieceCode(piece.pieceCode);
  return base === 'OU' || piece.char === '王' || piece.char === '玉';
}

/** 舟: 移動前の「真後ろ1マス」の味方駒を、舟と同じベクトルで引きずる（玉は対象外） */
function moveAllyBehindBoatOneStep(input: {
  pieces: AiBoardPiece[];
  actorSide: Side;
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
}): void {
  const dR = input.toRow - input.fromRow;
  const dC = input.toCol - input.fromCol;
  if (dR === 0 && dC === 0) return;
  const allyRow = input.fromRow + backRowDeltaForBoatTow(input.actorSide);
  const allyCol = input.fromCol;
  if (allyRow < 0 || allyRow > 8 || allyCol < 0 || allyCol > 8) return;
  const destRow = allyRow + dR;
  const destCol = allyCol + dC;
  if (destRow < 0 || destRow > 8 || destCol < 0 || destCol > 8) return;
  const idx = input.pieces.findIndex((p) => p.row === allyRow && p.col === allyCol);
  if (idx < 0) return;
  const ally = input.pieces[idx]!;
  if (ally.side !== input.actorSide) return;
  if (isKingLikePieceForBoatTow(ally)) return;
  const blocked = input.pieces.some(
    (p) =>
      p.row === destRow &&
      p.col === destCol &&
      !(p.row === input.fromRow && p.col === input.fromCol),
  );
  if (blocked) return;
  input.pieces[idx] = { ...ally, row: destRow, col: destCol };
}

function parseSatoriStunTargetNotation(
  notation: string | null,
): { row: number; col: number } | null {
  if (!notation) return null;
  const m = /^satori_stun:(\d+):(\d+)$/i.exec(notation.trim());
  if (!m) return null;
  const row = Number(m[1]);
  const col = Number(m[2]);
  if (!Number.isFinite(row) || !Number.isFinite(col) || row < 0 || row > 8 || col < 0 || col > 8) {
    return null;
  }
  return { row, col };
}

function normCharNFKC(char: string | undefined): string {
  try {
    return char?.normalize('NFKC') ?? '';
  } catch {
    return char ?? '';
  }
}

function isSatoriMovedPieceActor(piece: AiBoardPiece): boolean {
  if (normCharNFKC(piece.char) === '悟') return true;
  const raw = (piece.pieceCode ?? '').toUpperCase();
  if (raw.includes('SATORI')) return true;
  if (raw.includes('6D4AFA9CDF1C')) return true;
  const base = normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode) ?? '');
  return base === 'SATORI';
}

function parseHeartProtectTargetNotation(
  notation: string | null,
): { row: number; col: number } | null {
  if (!notation) return null;
  const m = /^heart_protect:(\d+):(\d+)$/i.exec(notation.trim());
  if (!m) return null;
  const row = Number(m[1]);
  const col = Number(m[2]);
  if (!Number.isFinite(row) || !Number.isFinite(col) || row < 0 || row > 8 || col < 0 || col > 8) {
    return null;
  }
  return { row, col };
}

function isHeartMovedPieceActor(piece: AiBoardPiece): boolean {
  if (normCharNFKC(piece.char) === '心') return true;
  const raw = (piece.pieceCode ?? '').toUpperCase();
  if (raw.includes('HEART')) return true;
  if (raw.includes('CA16911978FF')) return true;
  const base = normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode) ?? '');
  return base === 'HEART';
}

/** スキルの王除外: 先手の「王」と後手の「玉」の双方を選択不可とする。 */
function isKingExcludedFromSatoriStun(piece: AiBoardPiece): boolean {
  const code = normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode) ?? '');
  return code === 'OU' || piece.char === '王' || piece.char === '玉';
}

/** 禽: 移動後、真後ろ1マスが空いていればランダムな味方駒（玉除く・自身除く）をそのマスへ移す */
function moveRandomAllyToCellBehindBird(input: {
  pieces: AiBoardPiece[];
  actorSide: Side;
  movedBird: AiBoardPiece;
}): void {
  const dBack = backRowDeltaForBoatTow(input.actorSide);
  const backRow = input.movedBird.row + dBack;
  const backCol = input.movedBird.col;
  if (backRow < 0 || backRow > 8 || backCol < 0 || backCol > 8) return;
  if (!isCellEmpty(input.pieces, backRow, backCol)) return;
  const candidates = input.pieces.filter((p) => {
    if (p.side !== input.actorSide) return false;
    if (p.row === input.movedBird.row && p.col === input.movedBird.col) return false;
    if (isKingLikePieceForBoatTow(p)) return false;
    return true;
  });
  if (candidates.length === 0) return;
  const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
  const idx = input.pieces.findIndex(
    (p) => p.side === pick.side && p.row === pick.row && p.col === pick.col,
  );
  if (idx < 0) return;
  input.pieces[idx] = { ...pick, row: backRow, col: backCol };
}

function summonRandomAdjacentEmptyPiece(input: {
  pieces: AiBoardPiece[];
  center: AiBoardPiece;
  actorSide: Side;
  summonCode: string;
  summonChar: string;
}): { summoned: boolean; row: number | null; col: number | null } {
  const candidates: { row: number; col: number }[] = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const row = input.center.row + dr;
      const col = input.center.col + dc;
      if (row < 0 || row > 8 || col < 0 || col > 8) continue;
      if (input.pieces.some((piece) => piece.row === row && piece.col === col)) continue;
      candidates.push({ row, col });
    }
  }
  if (candidates.length === 0) {
    return { summoned: false, row: null, col: null };
  }
  const selected = candidates[Math.floor(Math.random() * candidates.length)]!;
  input.pieces.push({
    side: input.actorSide,
    row: selected.row,
    col: selected.col,
    pieceCode: input.summonCode,
    char: input.summonChar,
    promoted: false,
    imageSignedUrl: null,
  });
  return { summoned: true, row: selected.row, col: selected.col };
}

function summonOrthogonalAdjacentEmptyPieces(input: {
  pieces: AiBoardPiece[];
  center: AiBoardPiece;
  actorSide: Side;
  summonCode: string;
  summonChar: string;
}): { row: number; col: number }[] {
  const summoned: { row: number; col: number }[] = [];
  const directions: readonly { dr: number; dc: number }[] = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];
  for (const direction of directions) {
    const row = input.center.row + direction.dr;
    const col = input.center.col + direction.dc;
    if (row < 0 || row > 8 || col < 0 || col > 8) continue;
    if (!isCellEmpty(input.pieces, row, col)) continue;
    input.pieces.push({
      side: input.actorSide,
      row,
      col,
      pieceCode: input.summonCode,
      char: input.summonChar,
      promoted: false,
      imageSignedUrl: null,
    });
    summoned.push({ row, col });
  }
  return summoned;
}

function isSearCaptureSkillPiece(piece: AiBoardPiece): boolean {
  try {
    if ((piece.char ?? '').normalize('NFKC') === '焼') return true;
  } catch {
    /* ignore */
  }
  if (piece.char === '焼') return true;
  if (normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode)) === 'SEAR') return true;
  return (piece.pieceCode ?? '').toUpperCase().includes('FDC83CF95746');
}

function isStewCaptureSkillPiece(piece: AiBoardPiece): boolean {
  try {
    if ((piece.char ?? '').normalize('NFKC') === '煮') return true;
  } catch {
    /* ignore */
  }
  if (piece.char === '煮') return true;
  if (normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode)) === 'STEW') return true;
  return (piece.pieceCode ?? '').toUpperCase().includes('8DE5676A5E92');
}

function isSauteCaptureSkillPiece(piece: AiBoardPiece): boolean {
  try {
    if ((piece.char ?? '').normalize('NFKC') === '炒') return true;
  } catch {
    /* ignore */
  }
  if (piece.char === '炒') return true;
  if (normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode)) === 'SAUTE') return true;
  return (piece.pieceCode ?? '').toUpperCase().includes('1732246A37D8');
}

/**
 * 「焼」「煮」「炒」: 敵駒を取ったとき、盤上の空きマス（岩・穴マス不可）に味方として「炎」または「火」を召喚する。
 * 凸の2手目など手番が続く局面でも捕獲時に必ず評価されるよう apply-move から呼ぶ。
 */
export function applyCookingCaptureSummonEffects(input: {
  position: AiBattlePosition;
  pieces: AiBoardPiece[];
  movedPiece: AiBoardPiece;
  actorSide: Side;
}): boolean {
  const m = input.movedPiece;
  const isSear = isSearCaptureSkillPiece(m);
  const isStew = isStewCaptureSkillPiece(m);
  const isSaute = isSauteCaptureSkillPiece(m);
  if (!isSear && !isStew && !isSaute) return false;

  const positionForView: AiBattlePosition = {
    ...input.position,
    boardState: {
      ...(asRecord(input.position.boardState) ?? {}),
      pieces: input.pieces.map((p) => ({ ...p })),
    },
  };
  const view = createSkillRuntimeView(positionForView);

  const candidates: { row: number; col: number }[] = [];
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      if (input.pieces.some((p) => p.row === row && p.col === col)) continue;
      if (view.rockObstacleCells.has(`${row}:${col}`)) continue;
      candidates.push({ row, col });
    }
  }
  if (candidates.length === 0) return false;
  const cell = candidates[Math.floor(Math.random() * candidates.length)]!;

  let summonCode = 'ENN';
  let summonChar = '炎';
  if (isStew) {
    summonCode = 'FIR';
    summonChar = '火';
  } else if (isSear) {
    summonCode = 'ENN';
    summonChar = '炎';
  } else if (isSaute) {
    if (Math.random() < 0.5) {
      summonCode = 'ENN';
      summonChar = '炎';
    } else {
      summonCode = 'FIR';
      summonChar = '火';
    }
  }

  input.pieces.push({
    side: input.actorSide,
    row: cell.row,
    col: cell.col,
    pieceCode: summonCode,
    char: summonChar,
    promoted: false,
    imageSignedUrl: null,
  });
  return true;
}

function isYangAllyAuraPiece(piece: AiBoardPiece): boolean {
  try {
    if ((piece.char ?? '').normalize('NFKC') === '陽') return true;
  } catch {
    /* ignore */
  }
  if (piece.char === '陽') return true;
  if (normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode)) === 'YANG') return true;
  return (piece.pieceCode ?? '').toUpperCase().includes('313B9456C8AC');
}

function isYinYangBondPiece(piece: AiBoardPiece): boolean {
  try {
    if ((piece.char ?? '').normalize('NFKC') === '陰') return true;
  } catch {
    /* ignore */
  }
  if (piece.char === '陰') return true;
  if (normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode)) === 'YIN') return true;
  return (piece.pieceCode ?? '').toUpperCase().includes('A67CE76969F7');
}

function allyYinSharesRowOrColumnWithYang(pieces: AiBoardPiece[], yang: AiBoardPiece): boolean {
  return pieces.some(
    (p) =>
      p !== yang &&
      p.side === yang.side &&
      isYinYangBondPiece(p) &&
      (p.row === yang.row || p.col === yang.col),
  );
}

function allyYangSharesRowOrColumnWithYin(pieces: AiBoardPiece[], yin: AiBoardPiece): boolean {
  return pieces.some(
    (p) =>
      p !== yin &&
      p.side === yin.side &&
      isYangAllyAuraPiece(p) &&
      (p.row === yin.row || p.col === yin.col),
  );
}

/** 味方「陰」が同一行または同一列にいる「陽」は敵に取られない（合法手・捕捉の両方で参照）。 */
export function isYangBondProtectedFromCapture(
  pieces: AiBoardPiece[],
  target: AiBoardPiece,
): boolean {
  if (!isYangAllyAuraPiece(target)) return false;
  return allyYinSharesRowOrColumnWithYang(pieces, target);
}

/** 味方「陽」が同一行または同一列にいる「陰」は敵に取られない（合法手・捕捉の両方で参照）。 */
export function isYinBondProtectedFromCapture(
  pieces: AiBoardPiece[],
  target: AiBoardPiece,
): boolean {
  if (!isYinYangBondPiece(target)) return false;
  return allyYangSharesRowOrColumnWithYin(pieces, target);
}

/** 味方「陽」の周囲8マスにいるとき、スキル発動確率を 1.3 倍（上限1）。 */
export function computeYangSkillProcFactorForMover(
  pieces: AiBoardPiece[],
  actorSide: Side,
  movedPiece: AiBoardPiece | null,
): number {
  if (!movedPiece || movedPiece.side !== actorSide) return 1;
  for (const p of pieces) {
    if (p.side !== actorSide) continue;
    if (!isYangAllyAuraPiece(p)) continue;
    const dr = Math.abs(p.row - movedPiece.row);
    const dc = Math.abs(p.col - movedPiece.col);
    if (dr <= 1 && dc <= 1 && (dr !== 0 || dc !== 0)) return 1.3;
  }
  return 1;
}

export function applyYangAllySkillProcMultiplier(baseChance: number, yangFactor: number): number {
  if (yangFactor <= 1) return baseChance;
  if (!Number.isFinite(baseChance) || baseChance <= 0) return baseChance;
  if (baseChance >= 1) return baseChance;
  return Math.min(1, baseChance * yangFactor);
}

/** 家スキル: 自陣4行の空マスに民を1体召喚（row 0 が盤の奥＝画面上端、player は手前 row 5–8 が自陣） */
const HOUSE_SUMMON_HOME_DEPTH = 4;

function summonPeopleInHomeRandomEmpty(input: { pieces: AiBoardPiece[]; actorSide: Side }): void {
  const d = HOUSE_SUMMON_HOME_DEPTH;
  const homeRows =
    input.actorSide === 'player'
      ? Array.from({ length: d }, (_, i) => 9 - d + i)
      : Array.from({ length: d }, (_, i) => i);
  const candidates: { row: number; col: number }[] = [];
  for (const row of homeRows) {
    for (let col = 0; col < 9; col += 1) {
      if (input.pieces.some((p) => p.row === row && p.col === col)) continue;
      candidates.push({ row, col });
    }
  }
  if (candidates.length === 0) return;
  const selected = candidates[Math.floor(Math.random() * candidates.length)]!;
  input.pieces.push({
    side: input.actorSide,
    row: selected.row,
    col: selected.col,
    pieceCode: 'PEOPLE',
    char: '民',
    promoted: false,
    imageSignedUrl: null,
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** JSON 経由で string になる数値（例: "0.3", "39"）も受け取る */
function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function sideOpposite(side: Side): Side {
  return side === 'player' ? 'enemy' : 'player';
}

function resolveSkillAffectsSide(value: unknown): Side {
  const raw = asString(value);
  if (raw === 'enemy' || raw === 'white') return 'enemy';
  if (raw === 'player' || raw === 'black') return 'player';
  return 'player';
}

function cellKey(side: Side, row: number, col: number): string {
  return `${side}:${row}:${col}`;
}

function isChebyshevAdjacent(aRow: number, aCol: number, bRow: number, bCol: number): boolean {
  const dr = Math.abs(aRow - bRow);
  const dc = Math.abs(aCol - bCol);
  return dr <= 1 && dc <= 1 && (dr !== 0 || dc !== 0);
}

/** 舞の移動制限は、盤上の味方「舞」の周囲8マスにいる敵にだけ効く。 */
function pruneDanceMovementModifiersNotAdjacentToMai(
  modifiers: Record<string, unknown>[],
  pieces: AiBoardPiece[],
): Record<string, unknown>[] {
  const maiAllies = pieces.filter((p) => isMaiPiece(p));
  return modifiers.filter((entry) => {
    const rule = asString(entry.movement_rule ?? entry.movementRule) ?? '';
    if (rule !== 'diagonal_forward_step_only') return true;
    const side = (asString(entry.side) ?? 'player') === 'enemy' ? 'enemy' : 'player';
    const row = asNumber(entry.row);
    const col = asNumber(entry.col);
    if (row == null || col == null) return false;
    if (maiAllies.length === 0) return false;
    return maiAllies.some(
      (mai) => mai.side !== side && isChebyshevAdjacent(mai.row, mai.col, row, col),
    );
  });
}

function anyGiantFootprintContainsCell(pieces: AiBoardPiece[], row: number, col: number): boolean {
  for (const p of pieces) {
    if (!isGiantPieceForEngine(p)) continue;
    if (giantAnchorFootprint(p.row, p.col).some((c) => c.row === row && c.col === col)) return true;
  }
  return false;
}

function pieceStatusEntryAffectsGiantImmunePiece(
  pieces: AiBoardPiece[],
  entry: Record<string, unknown>,
): boolean {
  const side = (asString(entry.side) ?? 'player') === 'enemy' ? 'enemy' : 'player';
  const row = asNumber(entry.row);
  const col = asNumber(entry.col);
  if (row == null || col == null) return false;
  const at = findPieceCoveringCell(pieces, row, col);
  return Boolean(at && isGiantPieceForEngine(at) && at.side === side);
}

function stripSkillStateForGiantImmunity(state: SkillStateRecord, pieces: AiBoardPiece[]): void {
  state.piece_statuses = state.piece_statuses.filter(
    (e) => !pieceStatusEntryAffectsGiantImmunePiece(pieces, e),
  );
  state.movement_modifiers = state.movement_modifiers.filter(
    (e) => !pieceStatusEntryAffectsGiantImmunePiece(pieces, e),
  );
  state.piece_defenses = state.piece_defenses.filter(
    (e) => !pieceStatusEntryAffectsGiantImmunePiece(pieces, e),
  );
  state.board_hazards = state.board_hazards.filter((e) => {
    const row = asNumber(e.row);
    const col = asNumber(e.col);
    if (row == null || col == null) return true;
    return !anyGiantFootprintContainsCell(pieces, row, col);
  });
}

/**
 * いずれかの「陰」の周囲8マスにいる **その陰にとっての敵駒** が着手したとき、
 * その駒のスキルは発動しない（陰と同じ側の駒は対象外）。
 */
export function isActorSkillProcSuppressedByAdjacentEnemyYin(
  pieces: AiBoardPiece[],
  actorSide: Side,
  movedPiece: AiBoardPiece | null,
): boolean {
  if (!movedPiece || movedPiece.side !== actorSide) return false;
  if (isGiantPieceForEngine(movedPiece)) return false;
  for (const yin of pieces) {
    if (!isYinYangBondPiece(yin)) continue;
    if (yin.side === movedPiece.side) continue;
    const dr = Math.abs(yin.row - movedPiece.row);
    const dc = Math.abs(yin.col - movedPiece.col);
    if (dr <= 1 && dc <= 1 && (dr !== 0 || dc !== 0)) return true;
  }
  return false;
}

function hasAdjacentPiece(input: {
  pieces: AiBoardPiece[];
  row: number;
  col: number;
  side: Side;
  match: 'ally' | 'enemy';
}): boolean {
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const row = input.row + dr;
      const col = input.col + dc;
      if (row < 0 || row > 8 || col < 0 || col > 8) continue;
      const piece = input.pieces.find((p) => p.row === row && p.col === col);
      if (!piece) continue;
      if (input.match === 'ally' && piece.side === input.side) return true;
      if (input.match === 'enemy' && piece.side !== input.side) return true;
    }
  }
  return false;
}

function hasSameRowAlly(input: {
  pieces: AiBoardPiece[];
  row: number;
  col: number;
  side: Side;
}): boolean {
  return input.pieces.some(
    (p) => p.side === input.side && p.row === input.row && p.col !== input.col,
  );
}

function findKingIndex(pieces: AiBoardPiece[], side: Side): number {
  return pieces.findIndex(
    (p) =>
      p.side === side &&
      (toBasePieceCode(p.pieceCode) === 'OU' || p.char === '王' || p.char === '玉'),
  );
}

function isCellEmpty(pieces: AiBoardPiece[], row: number, col: number): boolean {
  return !pieces.some((p) => p.row === row && p.col === col);
}

function incrementHand(position: AiBattlePosition, side: Side, pieceCode: string, delta: number) {
  const bag = { ...(position.hands[side] ?? {}) };
  const key = pieceCode.toUpperCase();
  const current = typeof bag[key] === 'number' ? Math.max(0, Math.floor(bag[key] as number)) : 0;
  const next = Math.max(0, current + delta);
  if (next <= 0) delete bag[key];
  else bag[key] = next;
  position.hands = {
    ...position.hands,
    [side]: bag,
  };
}

function decrementFirstHandPiece(
  position: AiBattlePosition,
  side: Side,
  preferredKey?: string,
): string | null {
  const bag = { ...(position.hands[side] ?? {}) };
  const keys = Object.keys(bag).sort();
  const ordered =
    preferredKey && (bag[preferredKey] ?? 0) > 0
      ? [preferredKey, ...keys.filter((key) => key !== preferredKey)]
      : keys;
  for (const key of ordered) {
    const current = typeof bag[key] === 'number' ? Math.max(0, Math.floor(bag[key] as number)) : 0;
    if (current <= 0) continue;
    const next = current - 1;
    if (next <= 0) delete bag[key];
    else bag[key] = next;
    position.hands = {
      ...position.hands,
      [side]: bag,
    };
    return key;
  }
  return null;
}

function removeRandomHandPiece(position: AiBattlePosition, side: Side): string | null {
  const bag = { ...(position.hands[side] ?? {}) };
  const keys = Object.keys(bag).filter((key) => {
    const qty = bag[key];
    return typeof qty === 'number' && Number.isFinite(qty) && qty > 0;
  });
  if (keys.length === 0) return null;
  const selectedKey = keys[Math.floor(Math.random() * keys.length)]!;
  const current = Math.max(0, Math.floor((bag[selectedKey] as number) ?? 0));
  const next = current - 1;
  if (next <= 0) delete bag[selectedKey];
  else bag[selectedKey] = next;
  position.hands = {
    ...position.hands,
    [side]: bag,
  };
  return selectedKey;
}

function readSkillState(position: AiBattlePosition): SkillStateRecord {
  const boardState = asRecord(position.boardState) ?? {};
  const skillState = asRecord(boardState.skill_state ?? boardState.skillState) ?? {};
  return {
    board_hazards: asArray(skillState.board_hazards ?? skillState.boardHazards).filter(
      (v): v is Record<string, unknown> => asRecord(v) != null,
    ) as Record<string, unknown>[],
    board_arrow_tiles: asArray(skillState.board_arrow_tiles ?? skillState.boardArrowTiles).filter(
      (v): v is Record<string, unknown> => asRecord(v) != null,
    ) as Record<string, unknown>[],
    movement_modifiers: asArray(
      skillState.movement_modifiers ?? skillState.movementModifiers,
    ).filter((v): v is Record<string, unknown> => asRecord(v) != null) as Record<string, unknown>[],
    piece_statuses: asArray(skillState.piece_statuses ?? skillState.pieceStatuses).filter(
      (v): v is Record<string, unknown> => asRecord(v) != null,
    ) as Record<string, unknown>[],
    piece_defenses: asArray(skillState.piece_defenses ?? skillState.pieceDefenses).filter(
      (v): v is Record<string, unknown> => asRecord(v) != null,
    ) as Record<string, unknown>[],
  };
}

function writeSkillState(position: AiBattlePosition, state: SkillStateRecord) {
  const boardState = asRecord(position.boardState) ?? {};
  position.boardState = {
    ...boardState,
    skill_state: {
      ...(asRecord(boardState.skill_state ?? boardState.skillState) ?? {}),
      board_hazards: state.board_hazards,
      board_arrow_tiles: state.board_arrow_tiles,
      movement_modifiers: state.movement_modifiers,
      piece_statuses: state.piece_statuses,
      piece_defenses: state.piece_defenses,
    },
  };
}

/** 現在の `skill_state.piece_defenses` に immunity が付いているセルかどうか（合法手・捕捉の整合用） */
export function pieceHasActiveCaptureImmunityFromBoardState(
  boardState: Record<string, unknown> | undefined,
  side: Side,
  row: number,
  col: number,
  pieces?: AiBoardPiece[] | null,
): boolean {
  const placeholder: AiBattlePosition = {
    sideToMove: 'player',
    turnNumber: 1,
    moveCount: 0,
    sfen: '',
    stateHash: null,
    boardState: boardState ?? {},
    hands: { player: {}, enemy: {} },
  };
  const state = readSkillState(placeholder);
  for (const entry of state.piece_defenses) {
    const remaining = asNumber(entry.remaining_turns ?? entry.remainingTurns) ?? 0;
    if (remaining <= 0) continue;
    const mode = asString(entry.mode) ?? '';
    if (mode !== 'immunity') continue;
    const s = (asString(entry.side) ?? 'player') === 'enemy' ? 'enemy' : 'player';
    const r = asNumber(entry.row);
    const c = asNumber(entry.col);
    if (r == null || c == null) continue;
    if (s === side && r === row && c === col) return true;
  }
  if (pieces && pieces.length > 0) {
    const covering = findPieceCoveringCell(pieces, row, col);
    if (covering && covering.side === side && isGiantPieceForEngine(covering)) {
      return true;
    }
    const target =
      covering && covering.side === side
        ? covering
        : pieces.find((p) => p.side === side && p.row === row && p.col === col);
    if (target && isYangBondProtectedFromCapture(pieces, target)) return true;
    if (target && isYinBondProtectedFromCapture(pieces, target)) return true;
    for (const entry of state.board_hazards) {
      const type = asString(entry.hazard_type ?? entry.hazardType) ?? '';
      if (type !== 'safe_room_cell') continue;
      const remaining = asNumber(entry.remaining_turns ?? entry.remainingTurns) ?? 0;
      if (remaining <= 0) continue;
      const affectsSide = resolveSkillAffectsSide(entry.affects_side ?? entry.affectsSide);
      if (affectsSide !== side) continue;
      const r = asNumber(entry.row);
      const c = asNumber(entry.col);
      if (r !== row || c !== col) continue;
      const kingHere = pieces.find(
        (p) => p.side === side && p.row === row && p.col === col && isKingPiece(p),
      );
      if (kingHere) return true;
    }
  }
  return false;
}

/** 封・駒ショップPなど、盤上オーラで移動不能になるマス（`side:row:col`）。 */
export function passiveAuraImmobilizedCellKeys(boardPieces: AiBoardPiece[]): Set<string> {
  const immobilizedCells = new Set<string>();
  for (const piece of boardPieces) {
    if (isSealPieceForAura(piece)) {
      for (const [dr, dc] of [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ] as const) {
        const row = piece.row + dr;
        const col = piece.col + dc;
        if (row < 0 || row > 8 || col < 0 || col > 8) continue;
        const target = findPieceCoveringCell(boardPieces, row, col);
        if (!target || target.side === piece.side) continue;
        if (isGiantPieceForEngine(target)) continue;
        immobilizedCells.add(cellKey(target.side, target.row, target.col));
      }
    }
  }
  for (const piece of boardPieces) {
    if (!isShopPPiece(piece)) continue;
    for (const target of boardPieces) {
      if (target.side === piece.side) continue;
      if (target.row !== piece.row && target.col !== piece.col) continue;
      if (isKingPiece(target) || isGiantPieceForEngine(target)) continue;
      immobilizedCells.add(cellKey(target.side, target.row, target.col));
    }
  }
  return immobilizedCells;
}

function isSaintPieceForAura(piece: AiBoardPiece): boolean {
  const char = (piece.char ?? '').normalize('NFKC');
  return char === '聖' || toBasePieceCode(piece.pieceCode) === 'SAINT';
}

/** 聖の周囲8マスにいる駒は移動・スキル不可（HTML isNearSaintGlobal 準拠）。 */
function saintAdjacentImmobilizedCellKeys(boardPieces: AiBoardPiece[]): Set<string> {
  const immobilizedCells = new Set<string>();
  for (const saint of boardPieces) {
    if (!isSaintPieceForAura(saint)) continue;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const row = saint.row + dr;
        const col = saint.col + dc;
        if (row < 0 || row > 8 || col < 0 || col > 8) continue;
        const target = findPieceCoveringCell(boardPieces, row, col);
        if (!target) continue;
        immobilizedCells.add(cellKey(target.side, target.row, target.col));
      }
    }
  }
  return immobilizedCells;
}

export function immobilizedCellKeysForPosition(position: AiBattlePosition): Set<string> {
  return createSkillRuntimeView(position).immobilizedCells;
}

export function createSkillRuntimeView(position: AiBattlePosition): SkillRuntimeView {
  const state = readSkillState(position);
  const boardPieces = piecesFromBoardState(position);
  const movementRulesByCell = new Map<string, string>();
  const immobilizedCells = new Set<string>();
  const darkBlindCells = new Set<string>();
  const kingPoisonBlockedCells = new Set<string>();
  const rockObstacleCells = new Set<string>();
  const aTransformCells = new Set<string>();

  function cellTargetsGiantImmune(statusSide: Side, row: number, col: number): boolean {
    const at = findPieceCoveringCell(boardPieces, row, col);
    return Boolean(at && isGiantPieceForEngine(at) && at.side === statusSide);
  }

  const danceAwareModifiers = pruneDanceMovementModifiersNotAdjacentToMai(
    state.movement_modifiers,
    boardPieces,
  );
  for (const entry of danceAwareModifiers) {
    const side = (asString(entry.side) ?? 'player') === 'enemy' ? 'enemy' : 'player';
    const row = asNumber(entry.row);
    const col = asNumber(entry.col);
    const remaining = asNumber(entry.remaining_turns ?? entry.remainingTurns) ?? 0;
    const rule = asString(entry.movement_rule ?? entry.movementRule);
    if (row == null || col == null || remaining <= 0 || !rule) continue;
    if (cellTargetsGiantImmune(side, row, col)) continue;
    const key = cellKey(side, row, col);
    if (!movementRulesByCell.has(key)) {
      movementRulesByCell.set(key, rule);
    }
  }

  for (const entry of state.piece_statuses) {
    const side = (asString(entry.side) ?? 'player') === 'enemy' ? 'enemy' : 'player';
    const row = asNumber(entry.row);
    const col = asNumber(entry.col);
    const remaining = asNumber(entry.remaining_turns ?? entry.remainingTurns) ?? 0;
    const statusType = asString(entry.status_type ?? entry.statusType) ?? '';
    if (row == null || col == null || remaining <= 0) continue;
    if (cellTargetsGiantImmune(side, row, col)) continue;
    const key = cellKey(side, row, col);
    if (
      statusType === 'stun' ||
      statusType === 'abyss_stun' ||
      statusType === 'time_stop' ||
      statusType === 'dark_blind' ||
      statusType === 'prison_fence_stun' ||
      statusType === 'peak_lock'
    ) {
      immobilizedCells.add(key);
    }
    if (statusType === 'dark_blind') {
      darkBlindCells.add(key);
    }
    if (statusType === 'a_transform' || statusType === 'an_transform') {
      aTransformCells.add(key);
    }
  }

  for (const key of passiveAuraImmobilizedCellKeys(boardPieces)) {
    immobilizedCells.add(key);
  }
  for (const key of saintAdjacentImmobilizedCellKeys(boardPieces)) {
    immobilizedCells.add(key);
  }

  for (const entry of state.board_hazards) {
    const type = asString(entry.hazard_type ?? entry.hazardType);
    const row = asNumber(entry.row);
    const col = asNumber(entry.col);
    const remaining = asNumber(entry.remaining_turns ?? entry.remainingTurns) ?? 0;
    const affectsSide = resolveSkillAffectsSide(entry.affects_side ?? entry.affectsSide);
    if (type !== 'poison_cell' && type !== 'poison') continue;
    if (row == null || col == null || remaining <= 0) continue;
    if (anyGiantFootprintContainsCell(boardPieces, row, col)) continue;
    kingPoisonBlockedCells.add(cellKey(affectsSide, row, col));
  }
  for (const entry of state.board_hazards) {
    const type = asString(entry.hazard_type ?? entry.hazardType);
    const row = asNumber(entry.row);
    const col = asNumber(entry.col);
    const remaining = asNumber(entry.remaining_turns ?? entry.remainingTurns) ?? 0;
    if (type !== 'rock_obstacle' && type !== 'pit_cell') continue;
    if (row == null || col == null || remaining <= 0) continue;
    if (anyGiantFootprintContainsCell(boardPieces, row, col)) continue;
    rockObstacleCells.add(`${row}:${col}`);
  }

  const captureImmunityCells = new Set<string>();
  for (const entry of state.piece_defenses) {
    const remaining = asNumber(entry.remaining_turns ?? entry.remainingTurns) ?? 0;
    if (remaining <= 0) continue;
    const mode = asString(entry.mode) ?? '';
    if (mode !== 'immunity') continue;
    const side = (asString(entry.side) ?? 'player') === 'enemy' ? 'enemy' : 'player';
    const row = asNumber(entry.row);
    const col = asNumber(entry.col);
    if (row == null || col == null) continue;
    if (cellTargetsGiantImmune(side, row, col)) continue;
    captureImmunityCells.add(cellKey(side, row, col));
  }

  for (const p of boardPieces) {
    if (isGiantPieceForEngine(p)) continue;
    if (
      isYangBondProtectedFromCapture(boardPieces, p) ||
      isYinBondProtectedFromCapture(boardPieces, p)
    ) {
      captureImmunityCells.add(cellKey(p.side, p.row, p.col));
    }
  }

  for (const entry of state.board_hazards) {
    const type = asString(entry.hazard_type ?? entry.hazardType) ?? '';
    if (type !== 'safe_room_cell') continue;
    const row = asNumber(entry.row);
    const col = asNumber(entry.col);
    const remaining = asNumber(entry.remaining_turns ?? entry.remainingTurns) ?? 0;
    const affectsSide = resolveSkillAffectsSide(entry.affects_side ?? entry.affectsSide);
    if (row == null || col == null || remaining <= 0) continue;
    const kingOnCell = boardPieces.find(
      (p) => p.side === affectsSide && p.row === row && p.col === col && isKingPiece(p),
    );
    if (!kingOnCell) continue;
    const key = cellKey(affectsSide, row, col);
    immobilizedCells.add(key);
    captureImmunityCells.add(key);
  }

  const thornDropBlockedCells = new Set<string>();
  for (const entry of state.board_hazards) {
    const type = asString(entry.hazard_type ?? entry.hazardType) ?? '';
    if (type !== 'thorn_cell') continue;
    const row = asNumber(entry.row);
    const col = asNumber(entry.col);
    const remaining = asNumber(entry.remaining_turns ?? entry.remainingTurns) ?? 0;
    const affectsSide = resolveSkillAffectsSide(entry.affects_side ?? entry.affectsSide);
    if (row == null || col == null || remaining <= 0) continue;
    if (anyGiantFootprintContainsCell(boardPieces, row, col)) continue;
    thornDropBlockedCells.add(cellKey(affectsSide, row, col));
  }

  return {
    state,
    movementRulesByCell,
    immobilizedCells,
    darkBlindCells,
    kingPoisonBlockedCells,
    rockObstacleCells,
    aTransformCells,
    captureImmunityCells,
    thornDropBlockedCells,
    arrowTileByCell: buildArrowTileByCellMap(position),
  };
}

export function tickSkillStateDurations(position: AiBattlePosition) {
  const state = readSkillState(position);
  function tick(list: Record<string, unknown>[]) {
    const out: Record<string, unknown>[] = [];
    for (const entry of list) {
      if (
        entry.permanent === true ||
        entry.stage_fixed === true ||
        (asNumber(entry.remaining_turns ?? entry.remainingTurns) ?? 0) >= 999
      ) {
        out.push(entry);
        continue;
      }
      const remaining = asNumber(entry.remaining_turns ?? entry.remainingTurns) ?? 0;
      if (remaining <= 0) continue;
      const statusType = asString(entry.status_type ?? entry.statusType) ?? '';
      const next = remaining - 1;
      if (next <= 0) {
        if (statusType === 'death_curse') {
          out.push({ ...entry, remaining_turns: 0 });
        }
        continue;
      }
      out.push({ ...entry, remaining_turns: next });
    }
    return out;
  }
  state.board_hazards = tick(state.board_hazards);
  state.board_arrow_tiles = tick(state.board_arrow_tiles);
  state.movement_modifiers = tick(state.movement_modifiers);
  state.piece_statuses = tick(state.piece_statuses);
  state.piece_defenses = tick(state.piece_defenses);
  const boardPieces = piecesFromBoardState(position);
  state.movement_modifiers = pruneDanceMovementModifiersNotAdjacentToMai(
    state.movement_modifiers,
    boardPieces,
  );
  stripSkillStateForGiantImmunity(state, boardPieces);
  writeSkillState(position, state);
}

/** 定スキル等: 次の1回の手番だけ、指定 side の駒はコスト上限以下しか動かせない。 */
export function activeOpponentTurnMaxPieceCostCap(
  position: AiBattlePosition,
  sideToMove: Side,
): number | null {
  const state = readSkillState(position);
  for (const entry of state.piece_statuses) {
    const statusType = asString(entry.status_type ?? entry.statusType) ?? '';
    if (statusType !== 'opponent_turn_max_piece_cost') continue;
    const remaining = asNumber(entry.remaining_turns ?? entry.remainingTurns) ?? 0;
    if (remaining <= 0) continue;
    const applierSide = (asString(entry.side) ?? 'player') === 'enemy' ? 'enemy' : 'player';
    const restrictedSide: Side = applierSide === 'player' ? 'enemy' : 'player';
    if (restrictedSide !== sideToMove) continue;
    const cap = asNumber(entry.max_piece_cost ?? entry.maxPieceCost);
    return cap != null && Number.isFinite(cap) ? cap : 5;
  }
  return null;
}

export function movementRuleAt(
  position: AiBattlePosition,
  side: Side,
  row: number,
  col: number,
): string | null {
  return createSkillRuntimeView(position).movementRulesByCell.get(cellKey(side, row, col)) ?? null;
}

export function isPieceImmobilized(
  position: AiBattlePosition,
  side: Side,
  row: number,
  col: number,
): boolean {
  const boardPieces = piecesFromBoardState(position);
  const currentPiece = findPieceCoveringCell(boardPieces, row, col);
  if (currentPiece && currentPiece.side === side && isGiantPieceForEngine(currentPiece)) {
    return false;
  }
  if (
    currentPiece &&
    currentPiece.side === side &&
    (toBasePieceCode(currentPiece.pieceCode) === 'OU' ||
      currentPiece.char === '王' ||
      currentPiece.char === '玉')
  ) {
    return false;
  }
  return createSkillRuntimeView(position).immobilizedCells.has(cellKey(side, row, col));
}

export function isCaptureBlockedByDarkBlind(
  position: AiBattlePosition,
  side: Side,
  row: number,
  col: number,
): boolean {
  return createSkillRuntimeView(position).darkBlindCells.has(cellKey(side, row, col));
}

export function applyBoardHazardsOnLanding(input: {
  position: AiBattlePosition;
  actorSide: Side;
  movedTo: { row: number; col: number };
  pieces: AiBoardPiece[];
}) {
  const state = readSkillState(input.position);
  const lethal = state.board_hazards.some((entry) => {
    const type = asString(entry.hazard_type ?? entry.hazardType);
    const row = asNumber(entry.row);
    const col = asNumber(entry.col);
    const remaining = asNumber(entry.remaining_turns ?? entry.remainingTurns) ?? 0;
    const affectsSide = resolveSkillAffectsSide(entry.affects_side ?? entry.affectsSide);
    return (
      remaining > 0 &&
      affectsSide === input.actorSide &&
      row === input.movedTo.row &&
      col === input.movedTo.col &&
      (type === 'poison_cell' || type === 'poison')
    );
  });
  if (!lethal) return;
  const landed = findPieceCoveringCell(input.pieces, input.movedTo.row, input.movedTo.col);
  if (!landed || landed.side !== input.actorSide) return;
  if (isGiantPieceForEngine(landed)) return;
  const idx = input.pieces.findIndex(
    (p) => p.side === landed.side && p.row === landed.row && p.col === landed.col,
  );
  if (idx >= 0) {
    input.pieces.splice(idx, 1);
  }
}

/** 「実」で異化した駒: 周囲 8 マスに敵の「実」がいなくなったら元の駒に戻す。 */
function applyExperimentMutantReverts(pieces: AiBoardPiece[]): void {
  for (const piece of pieces) {
    const hasRevert = piece.mutantRevertChar != null || piece.mutantRevertPieceCode != null;
    if (!hasRevert) continue;

    const isMutantSurface = piece.char === '異' || toBasePieceCode(piece.pieceCode) === 'MUTANT';
    if (!isMutantSurface) {
      delete piece.mutantRevertPieceCode;
      delete piece.mutantRevertChar;
      delete piece.mutantRevertPromoted;
      delete piece.mutantRevertImageSignedUrl;
      continue;
    }

    const enemySide = sideOpposite(piece.side);
    let adjacentEnemyExperiment = false;
    for (const other of pieces) {
      if (other.side !== enemySide) continue;
      const isExperiment = other.char === '実' || toBasePieceCode(other.pieceCode) === 'EXPERIMENT';
      if (!isExperiment) continue;
      const dr = Math.abs(other.row - piece.row);
      const dc = Math.abs(other.col - piece.col);
      if (dr <= 1 && dc <= 1 && (dr !== 0 || dc !== 0)) {
        adjacentEnemyExperiment = true;
        break;
      }
    }
    if (adjacentEnemyExperiment) continue;

    const rc = piece.mutantRevertPieceCode;
    const rch = piece.mutantRevertChar;
    piece.pieceCode = rc ?? null;
    piece.char = rch ?? '?';
    piece.promoted = Boolean(piece.mutantRevertPromoted);
    piece.imageSignedUrl = piece.mutantRevertImageSignedUrl ?? null;
    delete piece.mutantRevertPieceCode;
    delete piece.mutantRevertChar;
    delete piece.mutantRevertPromoted;
    delete piece.mutantRevertImageSignedUrl;
  }
}

/** 着手スキル発動検知用: 盤上駒の multiset 署名（並び替えで安定） */
function boardSignatureForSkillFx(pieces: AiBoardPiece[]): string {
  return [...pieces]
    .map(
      (p) =>
        `${p.side}:${p.row}:${p.col}:${String(p.char)}:${String(p.pieceCode ?? '')}:${
          p.promoted ? 1 : 0
        }`,
    )
    .sort()
    .join(';');
}

function stableHandsStringForSkillFx(position: AiBattlePosition): string {
  const enc = (side: 'player' | 'enemy'): string => {
    const bag = (position.hands?.[side] ?? {}) as Record<string, unknown>;
    return Object.keys(bag)
      .sort()
      .map((k) => `${k}:${String(bag[k])}`)
      .join(',');
  };
  return `${enc('player')}|${enc('enemy')}`;
}

export function applyMoveSkillEffects(input: {
  position: AiBattlePosition;
  move: AiBattleMove;
  actorSide: Side;
  movedPiece: AiBoardPiece | null;
  pieces: AiBoardPiece[];
  didCapture: boolean;
  suppressRandomSkillProcs?: boolean;
}): { moveSkillEffectTriggered: boolean; skillVisualEffects: SkillVisualEffect[] } {
  const skillVisualEffects: SkillVisualEffect[] = [];
  let skillFxSeq = 0;
  const skillFxIdPrefix = `mv${input.position.moveCount}`;
  const movedCodeRaw = toBasePieceCode(input.move.pieceCode);
  const movedCode = normalizeSkillPieceCode(movedCodeRaw);
  const movedPiece = input.movedPiece;
  const yangSkillProcFactor = computeYangSkillProcFactorForMover(
    input.pieces,
    input.actorSide,
    movedPiece,
  );
  const yinEnemySuppressesSkills = isActorSkillProcSuppressedByAdjacentEnemyYin(
    input.pieces,
    input.actorSide,
    movedPiece,
  );
  const skillProcRoll = (p: number): boolean => {
    if (input.suppressRandomSkillProcs) return false;
    if (yinEnemySuppressesSkills) return false;
    const eff = applyYangAllySkillProcMultiplier(p, yangSkillProcFactor);
    return Math.random() <= eff;
  };
  if (!movedCode) return { moveSkillEffectTriggered: false, skillVisualEffects };
  let moveSkillEffectTriggered = false;
  const markMoveSkillFx = (): void => {
    moveSkillEffectTriggered = true;
  };
  const boardState = asRecord(input.position.boardState) ?? {};
  const defsRoot = asRecord(boardState.skill_definitions_v2 ?? boardState.skillDefinitionsV2);
  const defs = asArray(defsRoot?.definitions);
  const state = readSkillState(input.position);
  if (input.move.fromRow != null && input.move.fromCol != null && movedPiece) {
    state.piece_statuses = state.piece_statuses.map((entry) => {
      const statusType = asString(entry.status_type ?? entry.statusType) ?? '';
      const side = (asString(entry.side) ?? 'player') === 'enemy' ? 'enemy' : 'player';
      const row = asNumber(entry.row);
      const col = asNumber(entry.col);
      if (statusType !== 'a_transform' && statusType !== 'an_transform') return entry;
      if (side !== input.actorSide) return entry;
      if (row !== input.move.fromRow || col !== input.move.fromCol) return entry;
      return {
        ...entry,
        row: movedPiece.row,
        col: movedPiece.col,
      };
    });
    state.movement_modifiers = state.movement_modifiers.map((entry) => {
      const rule = asString(entry.movement_rule ?? entry.movementRule) ?? '';
      if (rule !== 'diagonal_forward_step_only') return entry;
      const side = (asString(entry.side) ?? 'player') === 'enemy' ? 'enemy' : 'player';
      const row = asNumber(entry.row);
      const col = asNumber(entry.col);
      if (side !== movedPiece.side) return entry;
      if (row !== input.move.fromRow || col !== input.move.fromCol) return entry;
      return {
        ...entry,
        row: movedPiece.row,
        col: movedPiece.col,
      };
    });
  }
  const {
    isAMover,
    isBirdMover,
    isBignoiseMover,
    isBlackOniMover,
    isBlueOniMover,
    isBoatMover,
    isBullMover,
    isChrysanthemumMover,
    isDarkMover,
    isDemonMover,
    isDepressionMover,
    isElectricMover,
    isExperimentMover,
    isFireMover,
    isFishMover,
    isFlameMover,
    isGraveMover,
    isIceMover,
    isIronMover,
    isKbossMover,
    isLeafMover,
    isMossMover,
    isOreMover,
    isPoisonMover,
    isPrisonFenceMover,
    isRainbowMover,
    isDanceMover,
    isRedOniMover,
    isRidgeMover,
    isRockMover,
    isRoseMover,
    isSandMover,
    isSnowMover,
    isSwampMover,
    isTatsuGodMover,
    isThunderMover,
    isTimeMover,
    isTinMover,
    isTreasureMover,
    isWaterMover,
    isWaterfallMover,
    isWaveMover,
    isWindMover,
    isWoodMover,
  } = buildSkillMoverFlags({
    movedCode,
    movePieceCode: input.move.pieceCode,
    movedPiece,
  });

  // 煽: 移動時に盤面中央へスキル画像を大きく表示（演出のみ）。
  if (
    input.movedPiece &&
    isAoriPiece(input.movedPiece) &&
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    !input.move.dropPieceCode
  ) {
    skillFxSeq = appendBoardCenterSkillVisualEffect(skillVisualEffects, {
      idPrefix: skillFxIdPrefix,
      seq: skillFxSeq,
      pieceChar: '煽',
    });
  }

  // ai.shogi の explicit override 相当: 定義読み込み失敗時でも炎スキルは発動可能にする。
  if (
    isFlameMover &&
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    input.movedPiece
  ) {
    const procChance = 0.2;
    const triggered = skillProcRoll(procChance);
    if (triggered) {
      const burned = removeRandomAdjacentEnemyPiece({
        pieces: input.pieces,
        center: input.movedPiece,
        actorSide: input.actorSide,
      });
      if (burned) {
        markMoveSkillFx();
        skillFxSeq = appendBoardSkillVisualEffects(skillVisualEffects, {
          idPrefix: skillFxIdPrefix,
          seq: skillFxSeq,
          pieceChar: '炎',
          cells: [{ row: burned.row, col: burned.col }],
        });
      }
    }
  }
  // 火: 移動時20%で敵の手持ち駒を1つ消滅。
  if (isFireMover && input.move.fromRow != null && input.move.fromCol != null) {
    const procChance = 0.2;
    const triggered = skillProcRoll(procChance);
    if (triggered) {
      const targetSide = sideOpposite(input.actorSide);
      const bag = input.position.hands[targetSide] ?? {};
      const candidateKeys = Object.keys(bag).filter((key) => {
        const qty = bag[key];
        return typeof qty === 'number' && Number.isFinite(qty) && qty > 0;
      });
      if (candidateKeys.length > 0) {
        const selectedKey = candidateKeys[Math.floor(Math.random() * candidateKeys.length)]!;
        const slotIndex = handSlotIndexBeforeRemoval(input.position.hands, targetSide, selectedKey);
        const removedKey = decrementFirstHandPiece(input.position, targetSide, selectedKey);
        if (removedKey) {
          markMoveSkillFx();
          skillFxSeq = appendHandSkillVisualEffects(skillVisualEffects, {
            idPrefix: skillFxIdPrefix,
            seq: skillFxSeq,
            pieceChar: '火',
            entries: [{ side: targetSide, pieceCode: removedKey, slotIndex }],
          });
        }
      }
    }
  }
  // 宝: 移動時20%で手持ちに金・銀・銅のいずれか1つを加える。
  if (isTreasureMover && input.move.fromRow != null && input.move.fromCol != null) {
    const procChance = 0.2;
    const triggered = skillProcRoll(procChance);
    let grantedCode: string | null = null;
    if (triggered) {
      const idx = Math.floor(Math.random() * TREASURE_REWARD_CODES.length);
      grantedCode = TREASURE_REWARD_CODES[idx] ?? null;
      if (grantedCode) {
        incrementHand(input.position, input.actorSide, grantedCode, 1);
        markMoveSkillFx();
      }
    }
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info('[treasure-skill-debug]', {
        moveCount: input.position.moveCount,
        turnNumber: input.position.turnNumber,
        pieceCode: movedCode,
        procChance,
        effectiveChance: applyYangAllySkillProcMultiplier(procChance, yangSkillProcFactor),
        triggered,
        grantedCode,
      });
    }
  }
  // 水: 移動時に周囲8マスの敵駒を1マス押し流す。
  if (
    isWaterMover &&
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    input.movedPiece
  ) {
    const waterPush = pushAdjacentEnemyPiecesOneStep({
      pieces: input.pieces,
      center: input.movedPiece,
      actorSide: input.actorSide,
    });
    if (waterPush.count > 0) {
      markMoveSkillFx();
      skillFxSeq = appendBoardSkillVisualEffects(skillVisualEffects, {
        idPrefix: skillFxIdPrefix,
        seq: skillFxSeq,
        pieceChar: '水',
        cells: waterPush.origins,
      });
    }
  }
  // 鉄: 水と同様、移動時に周囲8マスの敵駒を1マス押し流す。
  if (isIronMover && input.move.fromRow != null && input.move.fromCol != null && input.movedPiece) {
    const ironPush = pushAdjacentEnemyPiecesOneStep({
      pieces: input.pieces,
      center: input.movedPiece,
      actorSide: input.actorSide,
    });
    if (ironPush.count > 0) {
      markMoveSkillFx();
      skillFxSeq = appendBoardSkillVisualEffects(skillVisualEffects, {
        idPrefix: skillFxIdPrefix,
        seq: skillFxSeq,
        pieceChar: '鉄',
        cells: ironPush.origins,
      });
    }
  }
  // 波: 移動時に周囲8マスの敵駒を1マス押し流す。
  if (isWaveMover && input.move.fromRow != null && input.move.fromCol != null && input.movedPiece) {
    const wavePush = pushAdjacentEnemyPiecesOneStep({
      pieces: input.pieces,
      center: input.movedPiece,
      actorSide: input.actorSide,
    });
    if (wavePush.count > 0) {
      markMoveSkillFx();
      skillFxSeq = appendBoardSkillVisualEffects(skillVisualEffects, {
        idPrefix: skillFxIdPrefix,
        seq: skillFxSeq,
        pieceChar: '波',
        cells: wavePush.origins,
      });
    }
  }
  // 砂: 移動時、隣接する味方の砂駒があれば同じ方向へ連携移動する。
  if (isSandMover && input.move.fromRow != null && input.move.fromCol != null && input.movedPiece) {
    const deltaRow = input.move.toRow - input.move.fromRow;
    const deltaCol = input.move.toCol - input.move.fromCol;
    if (
      moveAdjacentAllySandWithLeader({
        pieces: input.pieces,
        center: input.movedPiece,
        actorSide: input.actorSide,
        deltaRow,
        deltaCol,
      }) > 0
    ) {
      markMoveSkillFx();
    }
  }
  // 舟: 移動時、真後ろ1マスにいる味方駒（玉除く）を同じベクトルで引きずる。
  if (isBoatMover && input.move.fromRow != null && input.move.fromCol != null && input.movedPiece) {
    const sigBoat = boardSignatureForSkillFx(input.pieces);
    moveAllyBehindBoatOneStep({
      pieces: input.pieces,
      actorSide: input.actorSide,
      fromRow: input.move.fromRow,
      fromCol: input.move.fromCol,
      toRow: input.move.toRow,
      toCol: input.move.toCol,
    });
    if (boardSignatureForSkillFx(input.pieces) !== sigBoat) {
      markMoveSkillFx();
    }
  }
  // 禽: 移動後、真後ろ1マスが空いていればランダムな味方駒（玉除く）をそのマスへ。
  if (isBirdMover && input.move.fromRow != null && input.move.fromCol != null && input.movedPiece) {
    const sigBird = boardSignatureForSkillFx(input.pieces);
    moveRandomAllyToCellBehindBird({
      pieces: input.pieces,
      actorSide: input.actorSide,
      movedBird: input.movedPiece,
    });
    if (boardSignatureForSkillFx(input.pieces) !== sigBird) {
      markMoveSkillFx();
    }
  }
  // 悟: 移動後にプレイヤーが選んだ敵駒（王・玉以外）を2ターン行動不能（stun）。
  {
    const satoriTargetCell = parseSatoriStunTargetNotation(input.move.notation ?? null);
    if (satoriTargetCell && movedPiece && isSatoriMovedPieceActor(movedPiece)) {
      const targetPiece = input.pieces.find(
        (piece) => piece.row === satoriTargetCell.row && piece.col === satoriTargetCell.col,
      );
      if (
        targetPiece &&
        targetPiece.side !== input.actorSide &&
        !isKingExcludedFromSatoriStun(targetPiece)
      ) {
        state.piece_statuses.push({
          row: targetPiece.row,
          col: targetPiece.col,
          side: targetPiece.side,
          status_type: 'stun',
          remaining_turns: 2,
        });
        markMoveSkillFx();
      }
    }
  }
  // 泉: 移動時、盤上の味方駒からランダムに1体を5ターン、敵から取られないようにする。
  if (
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    movedPiece &&
    !input.move.dropPieceCode &&
    (movedCode === 'SPRING' || movedPiece.char === '泉')
  ) {
    const allies = listSpringImmunityAllyCandidates({
      pieces: input.pieces,
      actorSide: input.actorSide,
      movedPiece,
    });
    if (allies.length > 0) {
      const target = allies[Math.floor(Math.random() * allies.length)]!;
      upsertCaptureImmunityDefense(
        state.piece_defenses,
        target.side,
        target.row,
        target.col,
        SPRING_ALLY_IMMUNITY_TURNS,
      );
      markMoveSkillFx();
      skillFxSeq = appendBoardSkillVisualEffects(skillVisualEffects, {
        idPrefix: skillFxIdPrefix,
        seq: skillFxSeq,
        pieceChar: '泉',
        cells: [{ row: target.row, col: target.col }],
      });
    }
  }
  // 心: 選んだ味方駒を2ターン、敵の捕獲から守る（piece_defenses / mode=immunity）。
  {
    const heartProtectCell = parseHeartProtectTargetNotation(input.move.notation ?? null);
    if (heartProtectCell && movedPiece && isHeartMovedPieceActor(movedPiece)) {
      const targetPiece = input.pieces.find(
        (piece) => piece.row === heartProtectCell.row && piece.col === heartProtectCell.col,
      );
      if (
        targetPiece &&
        targetPiece.side === input.actorSide &&
        !isKingExcludedFromSatoriStun(targetPiece)
      ) {
        state.piece_defenses.push({
          row: targetPiece.row,
          col: targetPiece.col,
          side: targetPiece.side,
          mode: 'immunity',
          remaining_turns: 2,
        });
        markMoveSkillFx();
      }
    }
  }
  // 歯: 隣接していた味方が盤上を動いたとき、同じベクトルで空きマスへ連動。
  if (
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    input.move.notation !== 'time_skill_only' &&
    input.move.notation !== 'house_skill_only' &&
    !input.move.dropPieceCode
  ) {
    if (
      moveAdjacentAllyGearFollowLeader({
        pieces: input.pieces,
        actorSide: input.actorSide,
        fromRow: input.move.fromRow,
        fromCol: input.move.fromCol,
        toRow: input.move.toRow,
        toCol: input.move.toCol,
      }) > 0
    ) {
      markMoveSkillFx();
    }
    if (
      moveAdjacentAllyKoGlueFollowLeader({
        pieces: input.pieces,
        actorSide: input.actorSide,
        fromRow: input.move.fromRow,
        fromCol: input.move.fromCol,
        toRow: input.move.toRow,
        toCol: input.move.toCol,
      }) > 0
    ) {
      markMoveSkillFx();
    }
  }
  // 風: 前後左右1マスの敵駒を、その方向の行けるところまで押し流す。
  if (isWindMover && input.move.fromRow != null && input.move.fromCol != null && input.movedPiece) {
    const windPush = pushOrthogonalAdjacentEnemiesToEdge({
      pieces: input.pieces,
      center: input.movedPiece,
      actorSide: input.actorSide,
    });
    if (windPush.count > 0) {
      markMoveSkillFx();
      skillFxSeq = appendBoardSkillVisualEffects(skillVisualEffects, {
        idPrefix: skillFxIdPrefix,
        seq: skillFxSeq,
        pieceChar: '風',
        cells: windPush.origins,
      });
    }
  }
  // 魚: 移動時30%で周囲の敵駒1体（玉除く）を3ターン行動不能（stun）。
  if (isFishMover && input.move.fromRow != null && input.move.fromCol != null && movedPiece) {
    const procChance = 0.3;
    const triggered = skillProcRoll(procChance);
    if (triggered) {
      const candidates = input.pieces.filter((piece) => {
        if (piece.side === input.actorSide) return false;
        if (Math.abs(piece.row - movedPiece.row) > 1 || Math.abs(piece.col - movedPiece.col) > 1) {
          return false;
        }
        if (piece.row === movedPiece.row && piece.col === movedPiece.col) return false;
        const base = toBasePieceCode(piece.pieceCode);
        if (base === 'OU' || piece.char === '王' || piece.char === '玉') return false;
        return true;
      });
      if (candidates.length > 0) {
        const target = candidates[Math.floor(Math.random() * candidates.length)]!;
        state.piece_statuses.push({
          row: target.row,
          col: target.col,
          side: target.side,
          status_type: 'stun',
          remaining_turns: 3,
        });
        markMoveSkillFx();
      }
    }
  }
  // 苔: 移動時30%で周囲の空きマスに苔駒（MOSS）を1体召喚。
  if (isMossMover && input.move.fromRow != null && input.move.fromCol != null && input.movedPiece) {
    const procChance = 0.3;
    const triggered = skillProcRoll(procChance);
    if (triggered) {
      const sum = summonRandomAdjacentEmptyPiece({
        pieces: input.pieces,
        center: input.movedPiece,
        actorSide: input.actorSide,
        summonCode: 'MOSS',
        summonChar: '苔',
      });
      if (sum.summoned) {
        markMoveSkillFx();
      }
    }
  }
  // 虹: 移動時、周囲8マスの敵駒の移動範囲を4ターン縦横1マスに制限する。
  // 青鬼: 移動時、周囲8マスの敵駒の移動範囲を2ターン縦横1マスに制限する。
  const adjacentOrthogonalRestrictDuration = isRainbowMover ? 4 : isBlueOniMover ? 2 : 0;
  if (
    adjacentOrthogonalRestrictDuration > 0 &&
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    input.movedPiece
  ) {
    let rainbowMods = 0;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const row = input.movedPiece.row + dr;
        const col = input.movedPiece.col + dc;
        if (row < 0 || row > 8 || col < 0 || col > 8) continue;
        const target = input.pieces.find((piece) => piece.row === row && piece.col === col);
        if (!target || target.side === input.actorSide) continue;
        state.movement_modifiers.push({
          row,
          col,
          side: target.side,
          movement_rule: 'orthogonal_step_only',
          remaining_turns: adjacentOrthogonalRestrictDuration,
        });
        rainbowMods += 1;
      }
    }
    if (rainbowMods > 0) {
      markMoveSkillFx();
    }
  }
  // 沼: 周囲8マスの敵駒の移動範囲を上下1マスに制限する。
  if (
    isSwampMover &&
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    input.movedPiece
  ) {
    let affectedCount = 0;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const row = input.movedPiece.row + dr;
        const col = input.movedPiece.col + dc;
        if (row < 0 || row > 8 || col < 0 || col > 8) continue;
        const target = input.pieces.find((piece) => piece.row === row && piece.col === col);
        if (!target || target.side === input.actorSide) continue;
        state.movement_modifiers.push({
          row,
          col,
          side: target.side,
          movement_rule: 'vertical_step_only',
          remaining_turns: 2,
        });
        affectedCount += 1;
      }
    }
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info('[swamp-skill-debug]', {
        moveCount: input.position.moveCount,
        turnNumber: input.position.turnNumber,
        pieceCode: movedCode,
        affectedCount,
        movementRule: 'vertical_step_only',
        remainingTurns: affectedCount > 0 ? 2 : 0,
      });
    }
    if (affectedCount > 0) {
      markMoveSkillFx();
    }
  }
  // 舞: 移動時、その時点で周囲8マスにいる敵駒の移動範囲を斜め前1マスのみに制限する。
  if (
    (isDanceMover || (input.movedPiece != null && isMaiPiece(input.movedPiece))) &&
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    input.movedPiece
  ) {
    let danceMods = 0;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const row = input.movedPiece.row + dr;
        const col = input.movedPiece.col + dc;
        if (row < 0 || row > 8 || col < 0 || col > 8) continue;
        const target = input.pieces.find((piece) => piece.row === row && piece.col === col);
        if (!target || target.side === input.actorSide) continue;
        if (isGiantPieceForEngine(target)) continue;
        state.movement_modifiers.push({
          row,
          col,
          side: target.side,
          movement_rule: 'diagonal_forward_step_only',
          remaining_turns: 999,
        });
        danceMods += 1;
      }
    }
    if (danceMods > 0) {
      markMoveSkillFx();
    }
  }
  // 毒: 移動前マスを4ターンの毒マスにする（敵が踏むと消滅）。
  if (isPoisonMover && input.move.fromRow != null && input.move.fromCol != null) {
    const durationTurns = 4;
    state.board_hazards.push({
      row: input.move.fromRow,
      col: input.move.fromCol,
      hazard_type: 'poison_cell',
      affects_side: sideOpposite(input.actorSide),
      remaining_turns: durationTurns,
    });
    markMoveSkillFx();
  }
  // 滝: 移動時20%で周囲8マスの敵駒をすべて相手の手駒へ移動する。
  if (
    isWaterfallMover &&
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    input.movedPiece
  ) {
    const procChance = 0.2;
    const triggered = skillProcRoll(procChance);
    waterfallSkillDebugLog({
      phase: 'proc-roll',
      moveCount: input.position.moveCount,
      turnNumber: input.position.turnNumber,
      actorSide: input.actorSide,
      from: [input.move.fromRow, input.move.fromCol],
      to: [input.move.toRow, input.move.toCol],
      procChance,
      effectiveChance: applyYangAllySkillProcMultiplier(procChance, yangSkillProcFactor),
      triggered,
    });
    if (triggered) {
      const movedToHands = sendAllAdjacentEnemiesToOwnerHands({
        position: input.position,
        pieces: input.pieces,
        center: input.movedPiece,
        actorSide: input.actorSide,
      });
      waterfallSkillDebugLog({
        phase: 'resolved',
        actorSide: input.actorSide,
        center: [input.movedPiece.row, input.movedPiece.col],
        movedCount: movedToHands.length,
        movedPieces: movedToHands,
      });
      if (movedToHands.length > 0) {
        markMoveSkillFx();
      }
    }
  }
  // あ: 周囲8マスの敵駒を「歩」に変化させる（王/玉は除外）。
  // - あ駒自身が移動したとき
  // - 敵駒があ駒の周囲8マスへ侵入したとき
  if (input.move.fromRow != null && input.move.fromCol != null && input.movedPiece) {
    const triggerCenters: AiBoardPiece[] = [];
    if (isAMover) {
      triggerCenters.push(input.movedPiece);
    }
    // 侵入トリガー: 着手後の移動駒に隣接する相手側の「あ」を起動する。
    for (const piece of input.pieces) {
      if (!isAPieceInstance(piece)) continue;
      if (piece.side === input.actorSide) continue;
      if (
        Math.abs(piece.row - input.movedPiece.row) > 1 ||
        Math.abs(piece.col - input.movedPiece.col) > 1
      )
        continue;
      triggerCenters.push(piece);
    }
    const centerKey = (piece: AiBoardPiece) => `${piece.side}:${piece.row}:${piece.col}`;
    const uniqueCenters = triggerCenters.filter(
      (piece, idx, arr) => arr.findIndex((p) => centerKey(p) === centerKey(piece)) === idx,
    );
    let aSkillTransformedAny = false;
    for (const center of uniqueCenters) {
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const row = center.row + dr;
          const col = center.col + dc;
          if (row < 0 || row > 8 || col < 0 || col > 8) continue;
          const target = input.pieces.find((piece) => piece.row === row && piece.col === col);
          if (!target || target.side === center.side) continue;
          if (
            target.char === '王' ||
            target.char === '玉' ||
            toBasePieceCode(target.pieceCode) === 'OU'
          )
            continue;
          target.pieceCode = 'FU';
          target.char = '歩';
          target.promoted = false;
          aSkillTransformedAny = true;
          const existingIdx = state.piece_statuses.findIndex((entry) => {
            const statusType = asString(entry.status_type ?? entry.statusType) ?? '';
            const side = (asString(entry.side) ?? 'player') === 'enemy' ? 'enemy' : 'player';
            return (
              statusType === 'a_transform' &&
              side === target.side &&
              asNumber(entry.row) === target.row &&
              asNumber(entry.col) === target.col
            );
          });
          if (existingIdx >= 0) {
            state.piece_statuses[existingIdx] = {
              ...state.piece_statuses[existingIdx],
              row: target.row,
              col: target.col,
              side: target.side,
              status_type: 'a_transform',
              remaining_turns: 999,
            };
          } else {
            state.piece_statuses.push({
              row: target.row,
              col: target.col,
              side: target.side,
              status_type: 'a_transform',
              remaining_turns: 999,
            });
          }
        }
      }
    }
    if (aSkillTransformedAny) {
      markMoveSkillFx();
    }
  }
  // 実: 移動後、周囲 8 マスの敵駒を「異」に変える（王・玉除く・既に異は対象外）。
  if (isExperimentMover && movedPiece) {
    let experimentMutatedAny = false;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const row = movedPiece.row + dr;
        const col = movedPiece.col + dc;
        if (row < 0 || row > 8 || col < 0 || col > 8) continue;
        const target = input.pieces.find((piece) => piece.row === row && piece.col === col);
        if (!target || target.side === input.actorSide) continue;
        if (
          target.char === '王' ||
          target.char === '玉' ||
          toBasePieceCode(target.pieceCode) === 'OU'
        ) {
          continue;
        }
        if (target.char === '異' || toBasePieceCode(target.pieceCode) === 'MUTANT') continue;
        const revertPieceCode = target.pieceCode;
        const revertChar = target.char;
        const revertPromoted = Boolean(target.promoted);
        const revertImage = target.imageSignedUrl ?? null;
        target.pieceCode = 'MUTANT';
        target.char = '異';
        target.promoted = false;
        target.mutantRevertPieceCode = revertPieceCode;
        target.mutantRevertChar = revertChar;
        target.mutantRevertPromoted = revertPromoted;
        target.mutantRevertImageSignedUrl = revertImage;
        experimentMutatedAny = true;
      }
    }
    if (experimentMutatedAny) {
      markMoveSkillFx();
    }
  }
  // 錫: 移動時10%で周囲8マスの敵駒（玉除く）を2ターン行動不能（stun）。
  if (isTinMover && input.move.fromRow != null && input.move.fromCol != null && input.movedPiece) {
    const procChance = 0.1;
    const triggered = skillProcRoll(procChance);
    if (triggered) {
      const stunnedCells: { row: number; col: number }[] = [];
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const row = input.movedPiece.row + dr;
          const col = input.movedPiece.col + dc;
          if (row < 0 || row > 8 || col < 0 || col > 8) continue;
          const targetPiece = input.pieces.find((piece) => piece.row === row && piece.col === col);
          if (!targetPiece || targetPiece.side === input.actorSide) continue;
          if (
            targetPiece.char === '王' ||
            targetPiece.char === '玉' ||
            toBasePieceCode(targetPiece.pieceCode) === 'OU'
          ) {
            continue;
          }
          state.piece_statuses.push({
            row,
            col,
            side: targetPiece.side,
            status_type: 'stun',
            remaining_turns: 2,
          });
          stunnedCells.push({ row, col });
        }
      }
      if (stunnedCells.length > 0) {
        markMoveSkillFx();
        skillFxSeq = appendBoardSkillVisualEffects(skillVisualEffects, {
          idPrefix: skillFxIdPrefix,
          seq: skillFxSeq,
          pieceChar: '錫',
          cells: stunnedCells,
        });
      }
    }
  }
  // 電: 移動時20%で周囲8マスの敵駒（玉除く）を1ターン行動不能（stun）。
  if (isElectricMover && input.move.fromRow != null && input.move.fromCol != null && movedPiece) {
    const procChance = 0.2;
    const triggered = skillProcRoll(procChance);
    if (triggered) {
      const stunnedCells: { row: number; col: number }[] = [];
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const row = movedPiece.row + dr;
          const col = movedPiece.col + dc;
          if (row < 0 || row > 8 || col < 0 || col > 8) continue;
          const targetPiece = input.pieces.find((piece) => piece.row === row && piece.col === col);
          if (!targetPiece || targetPiece.side === input.actorSide) continue;
          if (
            targetPiece.char === '王' ||
            targetPiece.char === '玉' ||
            toBasePieceCode(targetPiece.pieceCode) === 'OU'
          ) {
            continue;
          }
          state.piece_statuses.push({
            row,
            col,
            side: targetPiece.side,
            status_type: 'stun',
            remaining_turns: 2,
          });
          stunnedCells.push({ row, col });
        }
      }
      if (stunnedCells.length > 0) {
        markMoveSkillFx();
        skillFxSeq = appendBoardSkillVisualEffects(skillVisualEffects, {
          idPrefix: skillFxIdPrefix,
          seq: skillFxSeq,
          pieceChar: '電',
          cells: stunnedCells,
        });
      }
    }
  }
  // 雷: 移動時10%で相手手持ち駒を最大2つランダム消滅。
  if (isThunderMover && input.move.fromRow != null && input.move.fromCol != null) {
    const procChance = 0.1;
    const triggered = skillProcRoll(procChance);
    const removedHandEntries: { side: Side; pieceCode: string; slotIndex: number }[] = [];
    if (triggered) {
      const targetSide = sideOpposite(input.actorSide);
      for (let i = 0; i < 2; i += 1) {
        const bag = input.position.hands[targetSide] ?? {};
        const keys = Object.keys(bag).filter((key) => {
          const qty = bag[key];
          return typeof qty === 'number' && Number.isFinite(qty) && qty > 0;
        });
        if (keys.length === 0) break;
        const selectedKey = keys[Math.floor(Math.random() * keys.length)]!;
        const slotIndex = handSlotIndexBeforeRemoval(input.position.hands, targetSide, selectedKey);
        const removed = removeRandomHandPiece(input.position, targetSide);
        if (!removed) break;
        removedHandEntries.push({ side: targetSide, pieceCode: removed, slotIndex });
      }
    }
    if (removedHandEntries.length > 0) {
      markMoveSkillFx();
      skillFxSeq = appendHandSkillVisualEffects(skillVisualEffects, {
        idPrefix: skillFxIdPrefix,
        seq: skillFxSeq,
        pieceChar: '雷',
        entries: removedHandEntries,
      });
    }
  }
  // 氷: 移動時30%で周囲8マスの敵駒（玉除く）1体を2ターン行動不能（stun）。
  if (isIceMover && input.move.fromRow != null && input.move.fromCol != null && movedPiece) {
    const procChance = 0.3;
    const triggered = skillProcRoll(procChance);
    if (triggered) {
      const candidates = input.pieces.filter((piece) => {
        if (piece.side === input.actorSide) return false;
        if (Math.abs(piece.row - movedPiece.row) > 1 || Math.abs(piece.col - movedPiece.col) > 1) {
          return false;
        }
        if (piece.row === movedPiece.row && piece.col === movedPiece.col) return false;
        const base = toBasePieceCode(piece.pieceCode);
        if (base === 'OU' || piece.char === '王' || piece.char === '玉') return false;
        return true;
      });
      if (candidates.length > 0) {
        const target = candidates[Math.floor(Math.random() * candidates.length)]!;
        state.piece_statuses.push({
          row: target.row,
          col: target.col,
          side: target.side,
          status_type: 'stun',
          remaining_turns: 2,
        });
        markMoveSkillFx();
      }
    }
  }
  // 雪: 移動時20%で手持ちに氷（ICE）を1つ加える。
  if (isSnowMover && input.move.fromRow != null && input.move.fromCol != null) {
    const procChance = 0.2;
    const triggered = skillProcRoll(procChance);
    if (triggered) {
      const handsBeforeSnow = stableHandsStringForSkillFx(input.position);
      incrementHand(input.position, input.actorSide, 'ICE', 1);
      if (stableHandsStringForSkillFx(input.position) !== handsBeforeSnow) {
        markMoveSkillFx();
      }
    }
  }
  // 時: skill 発動時（time_skill_only/time_skill）に周囲8マスの敵駒（玉除く）を4ターン行動不能。
  if (
    isTimeMover &&
    (input.move.notation === 'time_skill_only' || input.move.notation === 'time_skill')
  ) {
    const center =
      input.movedPiece ??
      (input.move.fromRow != null && input.move.fromCol != null
        ? (input.pieces.find(
            (piece) =>
              piece.side === input.actorSide &&
              piece.row === input.move.fromRow &&
              piece.col === input.move.fromCol &&
              TIME_PIECE_CODES.has(
                normalizeSkillPieceCode(toBasePieceCode(piece.pieceCode) ?? piece.char),
              ),
          ) ?? null)
        : null);
    if (center) {
      const stunnedCells: { row: number; col: number }[] = [];
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const row = center.row + dr;
          const col = center.col + dc;
          if (row < 0 || row > 8 || col < 0 || col > 8) continue;
          const target = input.pieces.find((piece) => piece.row === row && piece.col === col);
          if (!target || target.side === input.actorSide) continue;
          const base = toBasePieceCode(target.pieceCode);
          if (base === 'OU' || target.char === '王' || target.char === '玉') continue;
          state.piece_statuses.push({
            row,
            col,
            side: target.side,
            status_type: 'stun',
            remaining_turns: 4,
          });
          stunnedCells.push({ row, col });
        }
      }
      if (stunnedCells.length > 0) {
        markMoveSkillFx();
        skillFxSeq = appendBoardSkillVisualEffects(skillVisualEffects, {
          idPrefix: skillFxIdPrefix,
          seq: skillFxSeq,
          pieceChar: '時',
          cells: stunnedCells,
        });
      }
    }
  }
  // 家: house_skill_only で自陣4行の空マスに民を1体召喚（合法手で5体上限）。
  if (input.move.notation === 'house_skill_only') {
    const people = input.pieces.filter((p) => {
      const c = toBasePieceCode(p.pieceCode);
      if (c === 'PEOPLE' || p.char === '民') return true;
      return CHAR_TO_CODE[p.char] === 'PEOPLE';
    });
    if (people.length < 5) {
      const sigHouse = boardSignatureForSkillFx(input.pieces);
      summonPeopleInHomeRandomEmpty({
        pieces: input.pieces,
        actorSide: input.actorSide,
      });
      if (boardSignatureForSkillFx(input.pieces) !== sigHouse) {
        markMoveSkillFx();
      }
    }
  }
  // 種: 移動時20%で周囲8マスのランダム1マスに葉を召喚。
  if (
    input.movedPiece &&
    isTanePiece(input.movedPiece) &&
    input.move.fromRow != null &&
    input.move.fromCol != null
  ) {
    const procChance = 0.2;
    const triggered = skillProcRoll(procChance);
    const taneSum = triggered
      ? summonRandomAdjacentEmptyPiece({
          pieces: input.pieces,
          center: input.movedPiece,
          actorSide: input.actorSide,
          summonCode: 'HAA',
          summonChar: '葉',
        })
      : { summoned: false, row: null, col: null };
    if (taneSum.summoned) {
      markMoveSkillFx();
    }
  }
  // 木: 移動時10%で周囲8マスのランダム1マスに木を召喚。
  if (isWoodMover && input.move.fromRow != null && input.move.fromCol != null && input.movedPiece) {
    const procChance = 0.1;
    const triggered = skillProcRoll(procChance);
    if (triggered) {
      const wSum = summonRandomAdjacentEmptyPiece({
        pieces: input.pieces,
        center: input.movedPiece,
        actorSide: input.actorSide,
        summonCode: 'MOK',
        summonChar: '木',
      });
      if (wSum.summoned) {
        markMoveSkillFx();
      }
    }
  }
  // 葉: 移動時10%で周囲8マスのランダム1マスに葉を召喚。
  if (isLeafMover && input.move.fromRow != null && input.move.fromCol != null && input.movedPiece) {
    const procChance = 0.1;
    const triggered = skillProcRoll(procChance);
    if (triggered) {
      const lSum = summonRandomAdjacentEmptyPiece({
        pieces: input.pieces,
        center: input.movedPiece,
        actorSide: input.actorSide,
        summonCode: 'HAA',
        summonChar: '葉',
      });
      if (lSum.summoned) {
        markMoveSkillFx();
      }
    }
  }
  // 犇: 移動時10%で前後左右4マスの空きマスに犇を召喚。
  if (isBullMover && input.move.fromRow != null && input.move.fromCol != null && input.movedPiece) {
    const procChance = 0.1;
    const triggered = skillProcRoll(procChance);
    const summoned = triggered
      ? summonOrthogonalAdjacentEmptyPieces({
          pieces: input.pieces,
          center: input.movedPiece,
          actorSide: input.actorSide,
          summonCode: 'BULL',
          summonChar: '犇',
        })
      : [];
    console.info('[bull-skill-debug]', {
      moveCount: input.position.moveCount,
      turnNumber: input.position.turnNumber,
      actorSide: input.actorSide,
      at: [input.movedPiece.row, input.movedPiece.col],
      procChance,
      effectiveChance: applyYangAllySkillProcMultiplier(procChance, yangSkillProcFactor),
      triggered,
      summonedCount: summoned.length,
      summoned,
    });
    if (summoned.length > 0) {
      markMoveSkillFx();
    }
  }
  // 轟: 移動時、左右1マスの敵駒を盤面のランダム空きマスへ飛ばす。
  if (
    isBignoiseMover &&
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    input.movedPiece
  ) {
    const warped = warpHorizontalAdjacentEnemiesToRandomEmptyCell({
      pieces: input.pieces,
      center: input.movedPiece,
      actorSide: input.actorSide,
    });
    console.info('[bignoise-skill-debug]', {
      moveCount: input.position.moveCount,
      turnNumber: input.position.turnNumber,
      actorSide: input.actorSide,
      at: [input.movedPiece.row, input.movedPiece.col],
      warpedCount: warped,
    });
    if (warped > 0) {
      markMoveSkillFx();
    }
  }
  // 赤鬼: 移動時、左右の敵駒を1マス遠ざける + 周囲ランダム1マスを2ターンのバツマスにする。
  if (
    isRedOniMover &&
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    input.movedPiece
  ) {
    const redPushed = pushHorizontalAdjacentEnemiesOneStepAway({
      pieces: input.pieces,
      center: input.movedPiece,
      actorSide: input.actorSide,
    });
    const redHazard = addRandomAdjacentHazard({
      state,
      center: input.movedPiece,
      hazardType: 'pit_cell',
      affectsSide: sideOpposite(input.actorSide),
      durationTurns: 2,
    });
    if (redPushed > 0 || redHazard) {
      markMoveSkillFx();
    }
  }
  // 黒鬼: 移動時、相手側3行のランダム3マスを2ターン毒マスにする。
  if (
    isBlackOniMover &&
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    input.movedPiece
  ) {
    if (
      addRandomOpponentCampPoisonCells({
        state,
        pieces: input.pieces,
        actorSide: input.actorSide,
        count: 3,
        durationTurns: 2,
      }) > 0
    ) {
      markMoveSkillFx();
    }
  }
  // 魔: 移動時10%で周囲8マスの敵駒を最大2体消滅。
  if (
    isDemonMover &&
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    input.movedPiece
  ) {
    if (skillProcRoll(0.1)) {
      const demonRemoved = removeUpToRandomAdjacentEnemyPieces({
        pieces: input.pieces,
        center: input.movedPiece,
        actorSide: input.actorSide,
        maxRemove: 2,
      });
      if (demonRemoved.removed > 0) {
        markMoveSkillFx();
        skillFxSeq = appendBoardSkillVisualEffects(skillVisualEffects, {
          idPrefix: skillFxIdPrefix,
          seq: skillFxSeq,
          pieceChar: '魔',
          cells: demonRemoved.cells,
        });
      }
    }
  }
  // 辰神（辰）: 移動時10%で周囲8マスの敵駒を1体消滅（玉除く）。
  if (
    isTatsuGodMover &&
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    input.movedPiece
  ) {
    if (skillProcRoll(0.1)) {
      const tatsuRemoved = removeUpToRandomAdjacentEnemyPieces({
        pieces: input.pieces,
        center: input.movedPiece,
        actorSide: input.actorSide,
        maxRemove: 1,
      });
      if (tatsuRemoved.removed > 0) {
        markMoveSkillFx();
      }
    }
  }
  // 闇: 周囲8マスの敵を闇で覆う（移動不能・捕獲不可）。
  if (isDarkMover && input.move.fromRow != null && input.move.fromCol != null && input.movedPiece) {
    let darkApplied = 0;
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const row = input.movedPiece.row + dr;
        const col = input.movedPiece.col + dc;
        if (row < 0 || row > 8 || col < 0 || col > 8) continue;
        const targetPiece = input.pieces.find((piece) => piece.row === row && piece.col === col);
        if (!targetPiece || targetPiece.side === input.actorSide) continue;
        state.piece_statuses.push({
          row,
          col,
          side: targetPiece.side,
          status_type: 'dark_blind',
          remaining_turns: 2,
        });
        darkApplied += 1;
      }
    }
    if (darkApplied > 0) {
      markMoveSkillFx();
    }
  }
  // 牢・柵: 移動時、盤上の敵駒からランダムで1体（玉除く）を2ターン行動不能（鎖表示用 status）。
  if (
    isPrisonFenceMover &&
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    movedPiece
  ) {
    const candidates = input.pieces.filter((piece) => {
      if (piece.side === input.actorSide) return false;
      const base = toBasePieceCode(piece.pieceCode);
      if (base === 'OU' || piece.char === '王' || piece.char === '玉') return false;
      return true;
    });
    const moverChar =
      movedPiece.char === '牢' || movedPiece.char === '柵' ? movedPiece.char : '牢/柵';
    if (candidates.length === 0) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.info('[prison-fence-skill-debug]', {
          moveCount: input.position.moveCount,
          turnNumber: input.position.turnNumber,
          moverChar,
          moverSide: input.actorSide,
          triggered: false,
          reason: 'no_enemy_candidates',
        });
      }
    } else {
      const seed = `${input.position.stateHash ?? ''}:${input.position.turnNumber}:${input.position.moveCount}:${movedPiece.row}:${movedPiece.col}:${input.actorSide}`;
      const idx = stableHashSkillSeed(seed) % candidates.length;
      const target = candidates[idx]!;
      state.piece_statuses = state.piece_statuses.filter((entry) => {
        const statusType = asString(entry.status_type ?? entry.statusType) ?? '';
        if (statusType !== 'prison_fence_stun') return true;
        const side = (asString(entry.side) ?? 'player') === 'enemy' ? 'enemy' : 'player';
        return !(
          side === target.side &&
          asNumber(entry.row) === target.row &&
          asNumber(entry.col) === target.col
        );
      });
      state.piece_statuses.push({
        row: target.row,
        col: target.col,
        side: target.side,
        status_type: 'prison_fence_stun',
        remaining_turns: 2,
      });
      markMoveSkillFx();
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.info('[prison-fence-skill-debug]', {
          moveCount: input.position.moveCount,
          turnNumber: input.position.turnNumber,
          moverChar,
          moverSide: input.actorSide,
          triggered: true,
          targetSide: target.side,
          targetRow: target.row,
          targetCol: target.col,
          candidateCount: candidates.length,
          pickedIndex: idx,
        });
      }
    }
  }
  // 峰: 盤上に存在する間、敵の「10画以上の特殊駒」を行動不能にする（常時再計算）。
  {
    state.piece_statuses = state.piece_statuses.filter((entry) => {
      const statusType = asString(entry.status_type ?? entry.statusType) ?? '';
      return statusType !== 'peak_lock';
    });
    const peakSides = new Set<Side>();
    for (const piece of input.pieces) {
      const normalized = normalizeSkillPieceCode(piece.pieceCode);
      const base = toBasePieceCode(piece.pieceCode);
      const isPeak =
        piece.char === '峰' ||
        (base != null && PEAK_PIECE_CODES.has(base)) ||
        PEAK_PIECE_CODES.has(normalized);
      if (isPeak) {
        peakSides.add(piece.side);
      }
    }
    if (peakSides.size > 0) {
      for (const piece of input.pieces) {
        if (!isSpecialTenPlusPiece(piece)) continue;
        const enemyHasPeak = peakSides.has(sideOpposite(piece.side));
        if (!enemyHasPeak) continue;
        state.piece_statuses.push({
          row: piece.row,
          col: piece.col,
          side: piece.side,
          status_type: 'peak_lock',
          remaining_turns: 1,
        });
      }
    }
  }
  // 嶺: 移動時20%で周囲1マスの空きマスに「山」駒を1体召喚。
  if (isRidgeMover && input.move.fromRow != null && input.move.fromCol != null && movedPiece) {
    const procChance = 0.2;
    const triggered = skillProcRoll(procChance);
    let summoned = false;
    let summonRow: number | null = null;
    let summonCol: number | null = null;
    if (triggered) {
      const around: { row: number; col: number }[] = [];
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const row = movedPiece.row + dr;
          const col = movedPiece.col + dc;
          if (row < 0 || row > 8 || col < 0 || col > 8) continue;
          if (!isCellEmpty(input.pieces, row, col)) continue;
          around.push({ row, col });
        }
      }
      if (around.length > 0) {
        const picked = around[Math.floor(Math.random() * around.length)]!;
        const onBoardYama = input.pieces.find((piece) => piece.char === '山');
        input.pieces.push({
          side: input.actorSide,
          row: picked.row,
          col: picked.col,
          pieceCode: onBoardYama?.pieceCode ?? 'YAMA',
          char: '山',
          promoted: false,
        });
        summoned = true;
        summonRow = picked.row;
        summonCol = picked.col;
      }
    }
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info('[ridge-skill-debug]', {
        moveCount: input.position.moveCount,
        turnNumber: input.position.turnNumber,
        procChance,
        effectiveChance: applyYangAllySkillProcMultiplier(procChance, yangSkillProcFactor),
        triggered,
        summoned,
        summonRow,
        summonCol,
      });
    }
    if (summoned) {
      markMoveSkillFx();
    }
  }
  // K 博士: 移動・打ち後 40% で周囲 8 マスの空き 1 マスに「実」を召喚（味方として出現）。
  if (isKbossMover && movedPiece) {
    const procChance = 0.4;
    if (skillProcRoll(procChance)) {
      const template = input.pieces.find((p) => p.char === '実' && p.pieceCode) ?? null;
      const summonCode =
        (template?.pieceCode ? toBasePieceCode(template.pieceCode) : null) ?? 'EXPERIMENT';
      const sum = summonRandomAdjacentEmptyPiece({
        pieces: input.pieces,
        center: movedPiece,
        actorSide: input.actorSide,
        summonCode,
        summonChar: '実',
      });
      if (sum.summoned) {
        markMoveSkillFx();
      }
      if (sum.summoned && sum.row != null && sum.col != null && template?.imageSignedUrl) {
        const placed = input.pieces.find((p) => p.row === sum.row && p.col === sum.col);
        if (placed) placed.imageSignedUrl = template.imageSignedUrl;
      }
    }
  }
  // 鉱: 移動時20%で味方の歩1体を金/銀/銅のいずれかへ変化。
  if (isOreMover && input.move.fromRow != null && input.move.fromCol != null && movedPiece) {
    const procChance = 0.2;
    const triggered = skillProcRoll(procChance);
    let transformed = false;
    if (triggered) {
      const alliesFu = input.pieces.filter((piece) => {
        if (piece.side !== input.actorSide) return false;
        const base = toBasePieceCode(piece.pieceCode);
        return base === 'FU' || piece.char === '歩';
      });
      if (alliesFu.length > 0) {
        const target = alliesFu[Math.floor(Math.random() * alliesFu.length)]!;
        const options = ['KI', 'GI', 'COPPER'] as const;
        const picked = options[Math.floor(Math.random() * options.length)]!;
        target.pieceCode = picked;
        target.char = picked === 'KI' ? '金' : picked === 'GI' ? '銀' : '銅';
        target.promoted = false;
        transformed = true;
      }
    }
    if (transformed) {
      markMoveSkillFx();
    }
  }
  // 墓: 移動時20%で周囲8マスの空きマス1つに霊を召喚。
  if (isGraveMover && input.move.fromRow != null && input.move.fromCol != null && movedPiece) {
    const procChance = 0.2;
    const triggered = skillProcRoll(procChance);
    let summonedSpirit = false;
    if (triggered) {
      const around: { row: number; col: number }[] = [];
      for (let dr = -1; dr <= 1; dr += 1) {
        for (let dc = -1; dc <= 1; dc += 1) {
          if (dr === 0 && dc === 0) continue;
          const row = movedPiece.row + dr;
          const col = movedPiece.col + dc;
          if (row < 0 || row > 8 || col < 0 || col > 8) continue;
          if (!isCellEmpty(input.pieces, row, col)) continue;
          around.push({ row, col });
        }
      }
      if (around.length > 0) {
        const picked = around[Math.floor(Math.random() * around.length)]!;
        input.pieces.push({
          side: input.actorSide,
          row: picked.row,
          col: picked.col,
          pieceCode: 'SPIRIT',
          char: '霊',
          promoted: false,
          imageSignedUrl: null,
        });
        summonedSpirit = true;
      }
    }
    if (summonedSpirit) {
      markMoveSkillFx();
    }
  }
  // 岩: 移動時、左右1マスに2ターン持続する岩障害物を召喚。
  if (isRockMover && input.move.fromRow != null && input.move.fromCol != null && movedPiece) {
    const summoned: { row: number; col: number }[] = [];
    for (const dc of [-1, 1] as const) {
      const row = movedPiece.row;
      const col = movedPiece.col + dc;
      if (col < 0 || col > 8) continue;
      if (!isCellEmpty(input.pieces, row, col)) continue;
      state.board_hazards = state.board_hazards.filter((entry) => {
        const type = asString(entry.hazard_type ?? entry.hazardType) ?? '';
        const hRow = asNumber(entry.row);
        const hCol = asNumber(entry.col);
        return !(type === 'rock_obstacle' && hRow === row && hCol === col);
      });
      state.board_hazards.push({
        row,
        col,
        hazard_type: 'rock_obstacle',
        affects_side: 'both',
        remaining_turns: 2,
      });
      summoned.push({ row, col });
    }
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.info('[rock-skill-debug]', {
        moveCount: input.position.moveCount,
        turnNumber: input.position.turnNumber,
        summonedCount: summoned.length,
        summoned,
      });
    }
    if (summoned.length > 0) {
      markMoveSkillFx();
    }
  }
  // 鬱: 移動後、左右の空きマスを2ターン持続する侵入菌糸（×マス）にする。
  if (isDepressionMover && input.move.fromRow != null && input.move.fromCol != null && movedPiece) {
    let depressionHazards = 0;
    for (const dc of [-1, 1] as const) {
      const row = movedPiece.row;
      const col = movedPiece.col + dc;
      if (col < 0 || col > 8) continue;
      if (!isCellEmpty(input.pieces, row, col)) continue;
      state.board_hazards = state.board_hazards.filter((entry) => {
        const type = asString(entry.hazard_type ?? entry.hazardType) ?? '';
        const hRow = asNumber(entry.row);
        const hCol = asNumber(entry.col);
        return !(type === 'pit_cell' && hRow === row && hCol === col);
      });
      state.board_hazards.push({
        row,
        col,
        hazard_type: 'pit_cell',
        affects_side: sideOpposite(input.actorSide),
        remaining_turns: 2,
      });
      depressionHazards += 1;
    }
    if (depressionHazards > 0) {
      markMoveSkillFx();
    }
  }
  // 薔: 移動時、上下1マスを2ターン持続する茨化マスにする（相手はそのマスへ打てない）。
  if (isRoseMover && input.move.fromRow != null && input.move.fromCol != null && movedPiece) {
    let roseHazards = 0;
    for (const dr of [-1, 1] as const) {
      const row = movedPiece.row + dr;
      const col = movedPiece.col;
      if (row < 0 || row > 8) continue;
      if (!isCellEmpty(input.pieces, row, col)) continue;
      state.board_hazards = state.board_hazards.filter((entry) => {
        const type = asString(entry.hazard_type ?? entry.hazardType) ?? '';
        const hRow = asNumber(entry.row);
        const hCol = asNumber(entry.col);
        return !(type === 'thorn_cell' && hRow === row && hCol === col);
      });
      state.board_hazards.push({
        row,
        col,
        hazard_type: 'thorn_cell',
        affects_side: sideOpposite(input.actorSide),
        remaining_turns: 2,
      });
      roseHazards += 1;
    }
    if (roseHazards > 0) {
      markMoveSkillFx();
    }
  }
  // 菊: 移動後、周囲8マスにいる味方駒1体（玉除く）に2ターンの復活効果。実装は apply-move（捕獲時に元の陣営の手駒へ）。
  if (
    isChrysanthemumMover &&
    input.move.fromRow != null &&
    input.move.fromCol != null &&
    movedPiece
  ) {
    const allies: AiBoardPiece[] = [];
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const r = movedPiece.row + dr;
        const c = movedPiece.col + dc;
        const p = input.pieces.find(
          (x) => x.side === input.actorSide && x.row === r && x.col === c,
        );
        if (!p) continue;
        const b = toBasePieceCode(p.pieceCode);
        if (b === 'OU' || p.char === '王' || p.char === '玉') continue;
        if (isGiantPieceForEngine(p)) continue;
        allies.push(p);
      }
    }
    allies.sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col));
    const target = allies[0];
    if (target) {
      state.piece_statuses = state.piece_statuses.filter((entry) => {
        const t = asString(entry.status_type ?? entry.statusType) ?? '';
        if (t !== 'chrysanthemum_revival') return true;
        const s = (asString(entry.side) ?? 'player') === 'enemy' ? 'enemy' : 'player';
        const row = asNumber(entry.row);
        const col = asNumber(entry.col);
        if (s === target.side && row === target.row && col === target.col) return false;
        return true;
      });
      state.piece_statuses.push({
        side: target.side,
        row: target.row,
        col: target.col,
        status_type: 'chrysanthemum_revival',
        remaining_turns: 2,
      });
      markMoveSkillFx();
    }
  }
  const skipGenericAdjacentSummon =
    isWoodMover ||
    isLeafMover ||
    isBullMover ||
    (input.movedPiece != null && isTanePiece(input.movedPiece));
  const skipGenericAdjacentRemove = isDemonMover || isTatsuGodMover;
  if (defs.length === 0) {
    stripSkillStateForGiantImmunity(state, input.pieces);
    writeSkillState(input.position, state);
    return { moveSkillEffectTriggered, skillVisualEffects };
  }

  const matchedDefs = defs.filter((raw) => {
    const d = asRecord(raw);
    if (!d) return false;
    const pieces = asArray(d.pieceChars);
    return pieces.some((p) =>
      catalogPieceTokenMatchesMoved(asString(p) ?? '', movedCode, movedPiece),
    );
  });
  for (const rawDef of matchedDefs) {
    const def = asRecord(rawDef);
    if (!def) continue;
    const trigger = asRecord(def.trigger);
    const triggerType = asString(trigger?.type) ?? '';
    const skillIdNum = Number(def.skillId ?? def.skill_id);
    const allowGunContinuousRule =
      triggerType === 'continuous_rule' && Number.isFinite(skillIdNum) && skillIdNum === 54;
    if (
      triggerType !== 'after_move' &&
      triggerType !== 'continuous_aura' &&
      !(triggerType === 'after_capture' && input.didCapture) &&
      !allowGunContinuousRule
    ) {
      continue;
    }
    const conditions = asArray(def.conditions);
    let blockedByCondition = false;
    for (const rawCondition of conditions) {
      const condition = asRecord(rawCondition);
      if (!condition) continue;
      const conditionType = asString(condition.type) ?? '';
      const conditionParams = asRecord(condition.params) ?? {};
      if (
        conditionType === 'adjacent_enemy_exists' ||
        conditionType === 'orthogonal_adjacent_enemy_exists'
      ) {
        if (!input.movedPiece) {
          blockedByCondition = true;
          break;
        }
        const mp = input.movedPiece;
        const orthOnly = conditionType === 'orthogonal_adjacent_enemy_exists';
        const deltas: readonly (readonly [number, number])[] = orthOnly
          ? [
              [-1, 0],
              [1, 0],
              [0, -1],
              [0, 1],
            ]
          : [
              [-1, -1],
              [-1, 0],
              [-1, 1],
              [0, -1],
              [0, 1],
              [1, -1],
              [1, 0],
              [1, 1],
            ];
        let found = false;
        for (const [dr, dc] of deltas) {
          const row = mp.row + dr;
          const col = mp.col + dc;
          if (row < 0 || row > 8 || col < 0 || col > 8) continue;
          const tp = input.pieces.find((p) => p.row === row && p.col === col);
          if (tp && tp.side !== input.actorSide) {
            found = true;
            break;
          }
        }
        if (!found) {
          blockedByCondition = true;
          break;
        }
      }
      if (conditionType === 'chance_roll') {
        let procChance =
          asFiniteNumber(conditionParams.procChance) ?? asFiniteNumber(conditionParams.chance);
        if (procChance != null && procChance > 1 && procChance <= 100) {
          procChance = procChance / 100;
        }
        if (procChance != null && procChance > 0 && procChance < 1) {
          const triggered = skillProcRoll(procChance);
          if (!triggered) {
            blockedByCondition = true;
            break;
          }
        }
      }
    }
    if (blockedByCondition) continue;
    const effects = asArray(def.effects);
    const v2FxSnapPieces = boardSignatureForSkillFx(input.pieces);
    const v2FxSnapHands = stableHandsStringForSkillFx(input.position);
    const v2FxSnapLens = {
      ps: state.piece_statuses.length,
      mm: state.movement_modifiers.length,
      bh: state.board_hazards.length,
      pd: state.piece_defenses.length,
    };
    for (const rawEffect of effects) {
      const effect = asRecord(rawEffect);
      if (!effect) continue;
      const effectType = asString(effect.type) ?? '';
      const target = asRecord(effect.target);
      const selector = asString(target?.selector) ?? '';
      const params = asRecord(effect.params) ?? {};
      const duration = Math.max(1, Math.floor(asNumber(params.durationTurns) ?? 1));

      if (effectType === 'board_hazard' && selector === 'origin_cell') {
        if (input.move.fromRow == null || input.move.fromCol == null) continue;
        const hazardType = asString(params.hazardType) ?? '';
        if (!hazardType) continue;
        state.board_hazards.push({
          row: input.move.fromRow,
          col: input.move.fromCol,
          hazard_type: hazardType,
          affects_side:
            hazardType === 'poison_cell' ? sideOpposite(input.actorSide) : input.actorSide,
          remaining_turns: duration,
        });
        continue;
      }

      if (effectType === 'board_hazard' && selector === 'adjacent_empty') {
        if (!input.movedPiece) continue;
        const hazardType = asString(params.hazardType) ?? '';
        if (!hazardType) continue;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const row = input.movedPiece.row + dr;
            const col = input.movedPiece.col + dc;
            if (row < 0 || row > 8 || col < 0 || col > 8) continue;
            if (input.pieces.some((p) => p.row === row && p.col === col)) continue;
            state.board_hazards.push({
              row,
              col,
              hazard_type: hazardType,
              affects_side:
                hazardType === 'poison_cell' ? sideOpposite(input.actorSide) : input.actorSide,
              remaining_turns: duration,
            });
          }
        }
        continue;
      }

      if (effectType === 'modify_movement' && selector === 'adjacent_enemy') {
        if (!input.movedPiece) continue;
        const movementRule = asString(params.movementRule) ?? '';
        if (!movementRule) continue;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const row = input.movedPiece.row + dr;
            const col = input.movedPiece.col + dc;
            if (row < 0 || row > 8 || col < 0 || col > 8) continue;
            const targetPiece = input.pieces.find((p) => p.row === row && p.col === col);
            if (!targetPiece || targetPiece.side === input.actorSide) continue;
            const targetCode = toBasePieceCode(targetPiece.pieceCode);
            if (targetCode === 'OU' || targetPiece.char === '王' || targetPiece.char === '玉') {
              continue;
            }
            state.movement_modifiers.push({
              row,
              col,
              side: targetPiece.side,
              movement_rule: movementRule,
              remaining_turns: duration,
            });
          }
        }
      }

      if (effectType === 'modify_movement' && selector === 'self_piece') {
        if (!input.movedPiece) continue;
        const movementRule = asString(params.movementRule) ?? '';
        if (!movementRule) continue;
        state.movement_modifiers.push({
          row: input.movedPiece.row,
          col: input.movedPiece.col,
          side: input.actorSide,
          movement_rule: movementRule,
          remaining_turns: duration,
        });
        continue;
      }

      if (effectType === 'modify_movement' && selector === 'adjacent_ally') {
        if (!input.movedPiece) continue;
        const movementRule = asString(params.movementRule) ?? '';
        if (!movementRule) continue;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const row = input.movedPiece.row + dr;
            const col = input.movedPiece.col + dc;
            if (row < 0 || row > 8 || col < 0 || col > 8) continue;
            const targetPiece = input.pieces.find((p) => p.row === row && p.col === col);
            if (!targetPiece || targetPiece.side !== input.actorSide) continue;
            const targetCode = toBasePieceCode(targetPiece.pieceCode);
            if (targetCode === 'OU' || targetPiece.char === '王' || targetPiece.char === '玉') {
              continue;
            }
            state.movement_modifiers.push({
              row,
              col,
              side: targetPiece.side,
              movement_rule: movementRule,
              remaining_turns: duration,
            });
          }
        }
        continue;
      }

      if (effectType === 'modify_movement' && selector === 'same_row_ally') {
        if (!input.movedPiece) continue;
        const movementRule = asString(params.movementRule) ?? '';
        if (!movementRule) continue;
        const row = input.movedPiece.row;
        for (const targetPiece of input.pieces) {
          if (targetPiece.side !== input.actorSide) continue;
          if (targetPiece.row !== row) continue;
          const targetCode = toBasePieceCode(targetPiece.pieceCode);
          if (targetCode === 'OU' || targetPiece.char === '王' || targetPiece.char === '玉') {
            continue;
          }
          state.movement_modifiers.push({
            row: targetPiece.row,
            col: targetPiece.col,
            side: targetPiece.side,
            movement_rule: movementRule,
            remaining_turns: duration,
          });
        }
        continue;
      }

      if (effectType === 'apply_status' && selector === 'adjacent_enemy') {
        if (!input.movedPiece) continue;
        const statusType = asString(params.statusType) ?? '';
        if (!statusType) continue;
        const adjacency = asString(params.adjacency)?.toLowerCase() ?? '';
        const orthOnly = adjacency === 'orthogonal';
        if (orthOnly) {
          let applied = 0;
          const maxTargetsRaw = asNumber(params.maxTargets);
          const maxTargets =
            maxTargetsRaw != null && Number.isFinite(maxTargetsRaw) && maxTargetsRaw > 0
              ? Math.floor(maxTargetsRaw)
              : null;
          const orthDeltas: readonly (readonly [number, number])[] = [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ];
          for (const [dr, dc] of orthDeltas) {
            if (maxTargets != null && applied >= maxTargets) break;
            const row = input.movedPiece.row + dr;
            const col = input.movedPiece.col + dc;
            if (row < 0 || row > 8 || col < 0 || col > 8) continue;
            const targetPiece = input.pieces.find((p) => p.row === row && p.col === col);
            if (!targetPiece || targetPiece.side === input.actorSide) continue;
            state.piece_statuses.push({
              row,
              col,
              side: targetPiece.side,
              status_type: statusType,
              remaining_turns: duration,
            });
            applied += 1;
          }
        } else {
          for (let dr = -1; dr <= 1; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
              if (dr === 0 && dc === 0) continue;
              const row = input.movedPiece.row + dr;
              const col = input.movedPiece.col + dc;
              if (row < 0 || row > 8 || col < 0 || col > 8) continue;
              const targetPiece = input.pieces.find((p) => p.row === row && p.col === col);
              if (!targetPiece || targetPiece.side === input.actorSide) continue;
              state.piece_statuses.push({
                row,
                col,
                side: targetPiece.side,
                status_type: statusType,
                remaining_turns: duration,
              });
            }
          }
        }
        continue;
      }

      if (effectType === 'seal_skill' && selector === 'adjacent_enemy') {
        if (!input.movedPiece) continue;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const row = input.movedPiece.row + dr;
            const col = input.movedPiece.col + dc;
            if (row < 0 || row > 8 || col < 0 || col > 8) continue;
            const targetPiece = input.pieces.find((p) => p.row === row && p.col === col);
            if (!targetPiece || targetPiece.side === input.actorSide) continue;
            state.piece_statuses.push({
              row,
              col,
              side: targetPiece.side,
              status_type: 'skill_sealed',
              remaining_turns: duration,
            });
          }
        }
        continue;
      }

      if (effectType === 'copy_ability' && selector === 'adjacent_ally') {
        if (!input.movedPiece) continue;
        if (
          hasAdjacentPiece({
            pieces: input.pieces,
            row: input.movedPiece.row,
            col: input.movedPiece.col,
            side: input.actorSide,
            match: 'ally',
          })
        ) {
          state.piece_statuses.push({
            row: input.movedPiece.row,
            col: input.movedPiece.col,
            side: input.actorSide,
            status_type: 'copy_ability',
            remaining_turns: duration,
          });
        }
        continue;
      }

      if (effectType === 'copy_ability' && selector === 'front_enemy') {
        if (!input.movedPiece) continue;
        const forward = input.actorSide === 'player' ? -1 : 1;
        const front = input.pieces.find(
          (p) =>
            p.row === input.movedPiece!.row + forward &&
            p.col === input.movedPiece!.col &&
            p.side !== input.actorSide,
        );
        if (front) {
          state.piece_statuses.push({
            row: input.movedPiece.row,
            col: input.movedPiece.col,
            side: input.actorSide,
            status_type: 'copy_ability',
            remaining_turns: duration,
          });
        }
        continue;
      }

      if (effectType === 'copy_ability' && selector === 'self_piece') {
        if (!input.movedPiece) continue;
        state.piece_statuses.push({
          row: input.movedPiece.row,
          col: input.movedPiece.col,
          side: input.actorSide,
          status_type: 'copy_ability',
          remaining_turns: duration,
        });
        continue;
      }

      if (effectType === 'capture_with_leap' && selector === 'self_piece') {
        if (!input.movedPiece) continue;
        state.piece_statuses.push({
          row: input.movedPiece.row,
          col: input.movedPiece.col,
          side: input.actorSide,
          status_type: 'capture_with_leap',
          remaining_turns: duration,
        });
        continue;
      }

      if (effectType === 'linked_action' && selector === 'adjacent_ally') {
        if (!input.movedPiece) continue;
        if (
          hasAdjacentPiece({
            pieces: input.pieces,
            row: input.movedPiece.row,
            col: input.movedPiece.col,
            side: input.actorSide,
            match: 'ally',
          })
        ) {
          state.piece_statuses.push({
            row: input.movedPiece.row,
            col: input.movedPiece.col,
            side: input.actorSide,
            status_type: 'linked_action',
            remaining_turns: duration,
          });
        }
        continue;
      }

      if (effectType === 'linked_action' && selector === 'same_row_ally') {
        if (!input.movedPiece) continue;
        if (
          hasSameRowAlly({
            pieces: input.pieces,
            row: input.movedPiece.row,
            col: input.movedPiece.col,
            side: input.actorSide,
          })
        ) {
          state.piece_statuses.push({
            row: input.movedPiece.row,
            col: input.movedPiece.col,
            side: input.actorSide,
            status_type: 'linked_action',
            remaining_turns: duration,
          });
        }
        continue;
      }

      if (effectType === 'disable_piece' && selector === 'adjacent_enemy') {
        if (!input.movedPiece) continue;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const row = input.movedPiece.row + dr;
            const col = input.movedPiece.col + dc;
            if (row < 0 || row > 8 || col < 0 || col > 8) continue;
            const targetPiece = input.pieces.find((p) => p.row === row && p.col === col);
            if (!targetPiece || targetPiece.side === input.actorSide) continue;
            state.piece_statuses.push({
              row,
              col,
              side: targetPiece.side,
              status_type: 'disabled',
              remaining_turns: duration,
            });
          }
        }
        continue;
      }

      if (effectType === 'disable_piece' && selector === 'adjacent_ally') {
        if (!input.movedPiece) continue;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const row = input.movedPiece.row + dr;
            const col = input.movedPiece.col + dc;
            if (row < 0 || row > 8 || col < 0 || col > 8) continue;
            const targetPiece = input.pieces.find((p) => p.row === row && p.col === col);
            if (!targetPiece || targetPiece.side !== input.actorSide) continue;
            state.piece_statuses.push({
              row,
              col,
              side: targetPiece.side,
              status_type: 'disabled',
              remaining_turns: duration,
            });
          }
        }
        continue;
      }

      if (effectType === 'capture_constraint' && selector === 'self_piece') {
        if (!input.movedPiece) continue;
        state.piece_statuses.push({
          row: input.movedPiece.row,
          col: input.movedPiece.col,
          side: input.actorSide,
          status_type: 'capture_constraint',
          remaining_turns: duration,
        });
        continue;
      }

      if (effectType === 'apply_status' && selector === 'origin_cell') {
        if (input.move.fromRow == null || input.move.fromCol == null) continue;
        const statusType = asString(params.statusType) ?? '';
        if (!statusType) continue;
        state.board_hazards.push({
          row: input.move.fromRow,
          col: input.move.fromCol,
          hazard_type: `status:${statusType}`,
          affects_side: input.actorSide,
          remaining_turns: duration,
        });
        continue;
      }

      if (effectType === 'summon_piece' && selector === 'adjacent_empty') {
        if (skipGenericAdjacentSummon) continue;
        if (!input.movedPiece) continue;
        const summonCode =
          toBasePieceCode(asString(params.summonPieceCode)) ??
          toBasePieceCode(asString(params.pieceCode)) ??
          movedCode;
        const summonChar = asString(params.summonPieceChar) ?? input.movedPiece.char;
        let spawned = false;
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const row = input.movedPiece.row + dr;
            const col = input.movedPiece.col + dc;
            if (row < 0 || row > 8 || col < 0 || col > 8) continue;
            if (input.pieces.some((p) => p.row === row && p.col === col)) continue;
            input.pieces.push({
              side: input.actorSide,
              row,
              col,
              pieceCode: summonCode,
              char: summonChar,
              promoted: false,
              imageSignedUrl: null,
            });
            spawned = true;
            break;
          }
          if (spawned) break;
        }
        continue;
      }

      if (effectType === 'remove_piece' && selector === 'adjacent_enemy') {
        if (skipGenericAdjacentRemove) continue;
        if (!input.movedPiece) continue;
        const candidates = input.pieces
          .map((p, idx) => ({ p, idx }))
          .filter(({ p }) => {
            if (p.side === input.actorSide) return false;
            if (p.char === '王' || p.char === '玉' || toBasePieceCode(p.pieceCode) === 'OU')
              return false;
            if (isGiantPieceForEngine(p)) return false;
            return (
              Math.abs(p.row - input.movedPiece!.row) <= 1 &&
              Math.abs(p.col - input.movedPiece!.col) <= 1
            );
          });
        if (candidates.length <= 0) continue;
        const randomOne = params.randomOne === true;
        const selected =
          randomOne && candidates.length > 1
            ? candidates[Math.floor(Math.random() * candidates.length)]!
            : candidates[0]!;
        input.pieces.splice(selected.idx, 1);
        continue;
      }

      if (effectType === 'multi_capture' && selector === 'adjacent_enemy') {
        if (!input.movedPiece) continue;
        const captureMode = asString(params.captureMode) ?? '';
        let katanaChar = input.movedPiece.char;
        try {
          katanaChar = katanaChar.normalize('NFKC');
        } catch {
          /* ignore */
        }
        if (
          (captureMode === 'adjacent_after_capture' ||
            captureMode === 'capture_square_left_right') &&
          katanaChar === '刀'
        ) {
          // 名刀「刀」の左右斬撃は apply-move の intrinsic のみ（前方1マスで取ったとき限定）で処理する。
          continue;
        }
        if (
          captureMode === 'adjacent_after_capture' ||
          captureMode === 'capture_square_left_right'
        ) {
          for (const dc of [-1, 1] as const) {
            const row = input.movedPiece.row;
            const col = input.movedPiece.col + dc;
            if (col < 0 || col > 8) continue;
            const idx = input.pieces.findIndex((p) => p.row === row && p.col === col);
            if (idx < 0) continue;
            const target = input.pieces[idx]!;
            if (target.side === input.actorSide) continue;
            if (
              target.char === '王' ||
              target.char === '玉' ||
              toBasePieceCode(target.pieceCode) === 'OU'
            ) {
              continue;
            }
            const armor = target.char === '鎧' || toBasePieceCode(target.pieceCode) === 'ARMOR';
            if (armor) continue;
            if (isGiantPieceForEngine(target)) continue;
            const spirit =
              target.char === '霊' ||
              toBasePieceCode(target.pieceCode) === 'SPIRIT' ||
              (target.pieceCode ?? '').toUpperCase().includes('9D7397390E77');
            const vanish =
              target.char === 'K' ||
              target.char === '実' ||
              target.char === '異' ||
              toBasePieceCode(target.pieceCode) === 'KBOSS' ||
              toBasePieceCode(target.pieceCode) === 'EXPERIMENT' ||
              toBasePieceCode(target.pieceCode) === 'MUTANT';
            const star = toBasePieceCode(target.pieceCode) === 'HOS' || target.char === '星';
            input.pieces.splice(idx, 1);
            if (spirit || vanish) {
              continue;
            }
            if (star) {
              if (skillProcRoll(0.4)) {
                incrementHand(input.position, target.side, 'HOS', 1);
              } else {
                const code = toBasePieceCode(capturedToHandPieceCode(target));
                if (code) incrementHand(input.position, input.actorSide, code, 1);
              }
              continue;
            }
            const code = toBasePieceCode(capturedToHandPieceCode(target));
            if (code) incrementHand(input.position, input.actorSide, code, 1);
          }
          continue;
        }
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const row = input.movedPiece.row + dr;
            const col = input.movedPiece.col + dc;
            if (row < 0 || row > 8 || col < 0 || col > 8) continue;
            const idx = input.pieces.findIndex((p) => p.row === row && p.col === col);
            if (idx < 0) continue;
            const target = input.pieces[idx]!;
            if (target.side === input.actorSide) continue;
            if (
              target.char === '王' ||
              target.char === '玉' ||
              toBasePieceCode(target.pieceCode) === 'OU'
            ) {
              continue;
            }
            if (isGiantPieceForEngine(target)) continue;
            input.pieces.splice(idx, 1);
          }
        }
        continue;
      }

      if (effectType === 'multi_capture' && selector === 'front_enemy') {
        if (!input.movedPiece) continue;
        const captureMode = asString(params.captureMode) ?? '';
        // 銃の前方2マス貫通（1マス目＋2マス目の同時取り）は apply-move の gun penetration で済ませる。
        // ここで forward_chain を走らせると「移動後の位置」基準になり誤取りになる。
        if (
          captureMode === 'forward_chain' &&
          (input.movedPiece.char === '銃' || toBasePieceCode(input.movedPiece.pieceCode) === 'GUN')
        ) {
          continue;
        }
        const forward = input.actorSide === 'player' ? -1 : 1;
        const steps = captureMode === 'forward_chain' ? [1, 2] : [1];
        for (const step of steps) {
          const row = input.movedPiece.row + forward * step;
          const col = input.movedPiece.col;
          if (row < 0 || row > 8 || col < 0 || col > 8) continue;
          const idx = input.pieces.findIndex((p) => p.row === row && p.col === col);
          if (idx < 0) continue;
          const target = input.pieces[idx]!;
          if (target.side === input.actorSide) continue;
          if (
            target.char === '王' ||
            target.char === '玉' ||
            toBasePieceCode(target.pieceCode) === 'OU'
          ) {
            continue;
          }
          const armor = target.char === '鎧' || toBasePieceCode(target.pieceCode) === 'ARMOR';
          if (armor) continue;
          if (isGiantPieceForEngine(target)) continue;
          const spirit =
            target.char === '霊' ||
            toBasePieceCode(target.pieceCode) === 'SPIRIT' ||
            (target.pieceCode ?? '').toUpperCase().includes('9D7397390E77');
          const vanish =
            target.char === 'K' ||
            target.char === '実' ||
            target.char === '異' ||
            toBasePieceCode(target.pieceCode) === 'KBOSS' ||
            toBasePieceCode(target.pieceCode) === 'EXPERIMENT' ||
            toBasePieceCode(target.pieceCode) === 'MUTANT';
          const star = toBasePieceCode(target.pieceCode) === 'HOS' || target.char === '星';
          input.pieces.splice(idx, 1);
          if (spirit || vanish) continue;
          if (star) {
            if (skillProcRoll(0.4)) {
              incrementHand(input.position, target.side, 'HOS', 1);
            } else {
              const code = toBasePieceCode(capturedToHandPieceCode(target));
              if (code) incrementHand(input.position, input.actorSide, code, 1);
            }
            continue;
          }
          const code = toBasePieceCode(capturedToHandPieceCode(target));
          if (code) incrementHand(input.position, input.actorSide, code, 1);
        }
        continue;
      }

      if (effectType === 'send_to_hand' && selector === 'adjacent_enemy') {
        if (!input.movedPiece) continue;
        const candidates = input.pieces
          .map((p, idx) => ({ p, idx }))
          .filter(({ p }) => {
            if (p.side === input.actorSide) return false;
            if (p.char === '王' || p.char === '玉' || toBasePieceCode(p.pieceCode) === 'OU')
              return false;
            if (isGiantPieceForEngine(p)) return false;
            return (
              Math.abs(p.row - input.movedPiece!.row) <= 1 &&
              Math.abs(p.col - input.movedPiece!.col) <= 1
            );
          });
        if (candidates.length === 0) {
          continue;
        }
        const selected = candidates[Math.floor(Math.random() * candidates.length)]!;
        const target = selected.p;
        const idx = selected.idx;
        const code = toBasePieceCode(target.pieceCode);
        input.pieces.splice(idx, 1);
        if (code) {
          // 仕様準拠: 対象駒の持ち主（相手）の手駒へ送る。
          incrementHand(input.position, target.side, code, 1);
        }
        continue;
      }

      if (effectType === 'return_to_hand' && selector === 'self_piece') {
        if (!input.movedPiece) continue;
        if (isGiantPieceForEngine(input.movedPiece)) continue;
        const handOwner = asString(params.handOwner) ?? 'self';
        const ownerSide: Side =
          handOwner === 'enemy' ? sideOpposite(input.actorSide) : input.actorSide;
        const code = toBasePieceCode(input.movedPiece.pieceCode);
        const idx = input.pieces.findIndex(
          (p) =>
            p.side === input.movedPiece!.side &&
            p.row === input.movedPiece!.row &&
            p.col === input.movedPiece!.col,
        );
        if (idx >= 0) input.pieces.splice(idx, 1);
        if (code) incrementHand(input.position, ownerSide, code, 1);
        continue;
      }

      if (effectType === 'transform_piece' && selector === 'adjacent_enemy') {
        if (!input.movedPiece) continue;
        const toPieceCode = toBasePieceCode(asString(params.toPieceCode));
        const toPieceChar = asString(params.toPieceChar);
        if (!toPieceCode && !toPieceChar) continue;
        const idx = input.pieces.findIndex((p) => {
          if (p.side === input.actorSide) return false;
          if (p.char === '王' || p.char === '玉' || toBasePieceCode(p.pieceCode) === 'OU')
            return false;
          if (isGiantPieceForEngine(p)) return false;
          return (
            Math.abs(p.row - input.movedPiece!.row) <= 1 &&
            Math.abs(p.col - input.movedPiece!.col) <= 1
          );
        });
        if (idx < 0) continue;
        const target = input.pieces[idx]!;
        input.pieces[idx] = {
          ...target,
          pieceCode: toPieceCode ?? target.pieceCode,
          char: toPieceChar ?? target.char,
          promoted: false,
        };
        continue;
      }

      if (effectType === 'transform_piece' && selector === 'self_piece') {
        if (!input.movedPiece) continue;
        if (isGiantPieceForEngine(input.movedPiece)) continue;
        const idx = input.pieces.findIndex(
          (p) =>
            p.side === input.actorSide &&
            p.row === input.movedPiece!.row &&
            p.col === input.movedPiece!.col,
        );
        if (idx < 0) continue;
        const toPieceCode = toBasePieceCode(asString(params.toPieceCode));
        const toPieceChar = asString(params.toPieceChar);
        const piece = input.pieces[idx]!;
        input.pieces[idx] = {
          ...piece,
          pieceCode: toPieceCode ?? piece.pieceCode,
          char: toPieceChar ?? piece.char,
          promoted: false,
        };
        continue;
      }

      if (effectType === 'transform_piece' && selector === 'all_ally') {
        const toPieceCode = toBasePieceCode(asString(params.toPieceCode));
        const toPieceChar = asString(params.toPieceChar);
        if (!toPieceCode && !toPieceChar) continue;
        const fromPieceCode = toBasePieceCode(asString(params.fromPieceCode));
        for (let i = 0; i < input.pieces.length; i += 1) {
          const piece = input.pieces[i]!;
          if (piece.side !== input.actorSide) continue;
          if (isGiantPieceForEngine(piece)) continue;
          if (fromPieceCode && toBasePieceCode(piece.pieceCode) !== fromPieceCode) continue;
          input.pieces[i] = {
            ...piece,
            pieceCode: toPieceCode ?? piece.pieceCode,
            char: toPieceChar ?? piece.char,
            promoted: false,
          };
        }
        continue;
      }

      if (effectType === 'defense_or_immunity' && selector === 'self_piece') {
        if (!input.movedPiece) continue;
        if (isGiantPieceForEngine(input.movedPiece)) continue;
        const mode = asString(params.mode) ?? 'immunity';
        state.piece_defenses.push({
          row: input.movedPiece.row,
          col: input.movedPiece.col,
          side: input.actorSide,
          mode,
          remaining_turns: duration,
        });
        continue;
      }

      if (effectType === 'defense_or_immunity' && selector === 'adjacent_ally') {
        if (!input.movedPiece) continue;
        const mode = asString(params.mode) ?? 'immunity';
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const row = input.movedPiece.row + dr;
            const col = input.movedPiece.col + dc;
            if (row < 0 || row > 8 || col < 0 || col > 8) continue;
            const targetPiece = input.pieces.find((p) => p.row === row && p.col === col);
            if (!targetPiece || targetPiece.side !== input.actorSide) continue;
            if (isGiantPieceForEngine(targetPiece)) continue;
            state.piece_defenses.push({
              row,
              col,
              side: targetPiece.side,
              mode,
              remaining_turns: duration,
            });
          }
        }
        continue;
      }

      if (effectType === 'extra_action' && selector === 'self_piece') {
        if (!input.movedPiece) continue;
        if (isGiantPieceForEngine(input.movedPiece)) continue;
        state.piece_statuses.push({
          row: input.movedPiece.row,
          col: input.movedPiece.col,
          side: input.actorSide,
          status_type: 'extra_action',
          remaining_turns: duration,
        });
        continue;
      }

      if (effectType === 'gain_piece' && selector === 'ally_hand_piece') {
        const single = toBasePieceCode(asString(params.gainPieceCode));
        const multi = asArray(params.gainPieceCodes)
          .map((v) => toBasePieceCode(asString(v)))
          .filter((v): v is string => Boolean(v));
        const candidate = single ?? multi[0] ?? 'KI';
        incrementHand(input.position, input.actorSide, candidate, 1);
        continue;
      }

      if (effectType === 'inherit_ability' && selector === 'self_piece') {
        if (!input.movedPiece) continue;
        if (isGiantPieceForEngine(input.movedPiece)) continue;
        state.piece_statuses.push({
          row: input.movedPiece.row,
          col: input.movedPiece.col,
          side: input.actorSide,
          status_type: 'inherit_ability',
          remaining_turns: duration,
        });
        continue;
      }

      if (effectType === 'substitute' && selector === 'self_piece') {
        if (!input.movedPiece) continue;
        if (isGiantPieceForEngine(input.movedPiece)) continue;
        state.piece_defenses.push({
          row: input.movedPiece.row,
          col: input.movedPiece.col,
          side: input.actorSide,
          mode: 'substitute',
          remaining_turns: duration,
        });
        continue;
      }

      if (effectType === 'revive' && selector === 'adjacent_ally') {
        if (!input.movedPiece) continue;
        if (isGiantPieceForEngine(input.movedPiece)) continue;
        const reviveDuration = Math.max(2, duration);
        for (let dr = -1; dr <= 1; dr += 1) {
          for (let dc = -1; dc <= 1; dc += 1) {
            if (dr === 0 && dc === 0) continue;
            const row = input.movedPiece.row + dr;
            const col = input.movedPiece.col + dc;
            if (row < 0 || row > 8 || col < 0 || col > 8) continue;
            const targetPiece = input.pieces.find((p) => p.row === row && p.col === col);
            if (!targetPiece || targetPiece.side !== input.actorSide) continue;
            state.piece_statuses.push({
              row,
              col,
              side: input.actorSide,
              status_type: 'revive',
              remaining_turns: reviveDuration,
            });
          }
        }
        continue;
      }

      if (effectType === 'script_hook' && selector === 'self_piece') {
        if (!input.movedPiece) continue;
        const hook = asString(params.hook) ?? asString(params.hookName) ?? '';
        if (!hook) continue;

        if (hook === 'bomb_explosion_push') {
          const bombOrigins: { row: number; col: number }[] = [];
          for (let dr = -1; dr <= 1; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
              if (dr === 0 && dc === 0) continue;
              const row = input.movedPiece.row + dr;
              const col = input.movedPiece.col + dc;
              if (row < 0 || row > 8 || col < 0 || col > 8) continue;
              const idx = input.pieces.findIndex((p) => p.row === row && p.col === col);
              if (idx < 0) continue;
              const target = input.pieces[idx]!;
              if (isGiantPieceForEngine(target)) continue;
              const pushRow = row + dr;
              const pushCol = col + dc;
              if (pushRow < 0 || pushRow > 8 || pushCol < 0 || pushCol > 8) continue;
              if (!isCellEmpty(input.pieces, pushRow, pushCol)) continue;
              bombOrigins.push({ row, col });
              input.pieces[idx] = { ...target, row: pushRow, col: pushCol };
            }
          }
          if (bombOrigins.length > 0) {
            markMoveSkillFx();
            skillFxSeq = appendBoardSkillVisualEffects(skillVisualEffects, {
              idPrefix: skillFxIdPrefix,
              seq: skillFxSeq,
              pieceChar: '爆',
              cells: bombOrigins,
            });
          }
          continue;
        }

        if (
          isGiantPieceForEngine(input.movedPiece) &&
          hook !== 'safe_room_king_relocation' &&
          hook !== 'safe_room_mark_king_cell' &&
          hook !== 'escape_king_follow'
        ) {
          continue;
        }

        if (hook === 'reflect_until_blocked') {
          state.piece_statuses.push({
            row: input.movedPiece.row,
            col: input.movedPiece.col,
            side: input.actorSide,
            status_type: 'reflect_until_blocked',
            remaining_turns: duration,
          });
          continue;
        }

        if (hook === 'safe_room_king_relocation') {
          const kingIdx = findKingIndex(input.pieces, input.actorSide);
          if (kingIdx >= 0) {
            const targetRow = input.actorSide === 'player' ? 8 : 0;
            const targetCol = 4;
            if (isCellEmpty(input.pieces, targetRow, targetCol)) {
              const king = input.pieces[kingIdx]!;
              input.pieces[kingIdx] = { ...king, row: targetRow, col: targetCol };
            }
          }
          continue;
        }

        if (hook === 'safe_room_mark_king_cell') {
          const durationTurns =
            asNumber(params.durationTurns) ?? asNumber(params.duration_turns) ?? 2;
          const kingIdx = findKingIndex(input.pieces, input.actorSide);
          if (kingIdx < 0) continue;
          const king = input.pieces[kingIdx]!;
          state.board_hazards = state.board_hazards.filter((entry) => {
            const type = asString(entry.hazard_type ?? entry.hazardType) ?? '';
            if (type !== 'safe_room_cell') return true;
            const side = resolveSkillAffectsSide(entry.affects_side ?? entry.affectsSide);
            const er = asNumber(entry.row);
            const ec = asNumber(entry.col);
            return !(side === input.actorSide && er === king.row && ec === king.col);
          });
          state.board_hazards.push({
            row: king.row,
            col: king.col,
            hazard_type: 'safe_room_cell',
            affects_side: input.actorSide,
            remaining_turns: Math.max(1, durationTurns),
          });
          continue;
        }

        if (hook === 'fixed_next_turn_restriction') {
          state.piece_statuses.push({
            row: input.movedPiece.row,
            col: input.movedPiece.col,
            side: input.actorSide,
            status_type: 'fixed_next_turn_restriction',
            remaining_turns: duration,
          });
          continue;
        }

        if (hook === 'itsu_random_enemy_to_opponent_hand') {
          const enemySide: Side = input.actorSide === 'player' ? 'enemy' : 'player';
          const candidates = input.pieces
            .map((p, idx) => ({ p, idx }))
            .filter(({ p }) => {
              if (p.side !== enemySide) return false;
              if (isKingPiece(p)) return false;
              if (isGiantPieceForEngine(p)) return false;
              return true;
            });
          itsuSkillDebugLog({
            hook,
            actorSide: input.actorSide,
            candidateCount: candidates.length,
            candidates: candidates.map(({ p }) => ({
              char: p.char,
              pieceCode: p.pieceCode,
              row: p.row,
              col: p.col,
            })),
          });
          if (candidates.length === 0) continue;
          const selected = candidates[Math.floor(Math.random() * candidates.length)]!;
          const target = selected.p;
          const handCode =
            toBasePieceCode(capturedToHandPieceCode(target)) ?? toBasePieceCode(target.pieceCode);
          const before = {
            char: target.char,
            pieceCode: target.pieceCode,
            row: target.row,
            col: target.col,
          };
          input.pieces.splice(selected.idx, 1);
          if (handCode) {
            const slotIndex = handSlotIndexBeforeRemoval(input.position.hands, enemySide, handCode);
            incrementHand(input.position, enemySide, handCode, 1);
            markMoveSkillFx();
            skillFxSeq = appendBoardSkillVisualEffects(skillVisualEffects, {
              idPrefix: skillFxIdPrefix,
              seq: skillFxSeq,
              pieceChar: resolveSkillFxPieceChar({ char: input.movedPiece.char }),
              cells: [{ row: before.row, col: before.col }],
            });
            skillFxSeq = appendHandSkillVisualEffects(skillVisualEffects, {
              idPrefix: skillFxIdPrefix,
              seq: skillFxSeq,
              pieceChar: resolveSkillFxPieceChar({ char: input.movedPiece.char }),
              entries: [{ side: enemySide, pieceCode: handCode, slotIndex }],
            });
          }
          itsuSkillDebugLog({
            hook,
            sentToHand: true,
            handOwner: enemySide,
            handCode,
            before,
          });
          continue;
        }

        if (hook === 'tou_ally_pawn_to_fire') {
          const toPieceCode =
            toBasePieceCode(asString(params.toPieceCode)) ??
            toBasePieceCode(asString(params.pieceCode)) ??
            'FIR';
          const toPieceChar = asString(params.toPieceChar) ?? '火';
          const allyPawns = input.pieces.filter((piece) => {
            if (piece.side !== input.actorSide) return false;
            const base = toBasePieceCode(piece.pieceCode);
            return base === 'FU' || piece.char === '歩';
          });
          touSkillDebugLog({
            hook,
            actorSide: input.actorSide,
            mover: {
              char: input.movedPiece.char,
              row: input.movedPiece.row,
              col: input.movedPiece.col,
            },
            candidateCount: allyPawns.length,
            candidates: allyPawns.map((p) => ({
              char: p.char,
              pieceCode: p.pieceCode,
              row: p.row,
              col: p.col,
            })),
          });
          if (allyPawns.length === 0) continue;
          const target = allyPawns[Math.floor(Math.random() * allyPawns.length)]!;
          const before = {
            char: target.char,
            pieceCode: target.pieceCode,
            row: target.row,
            col: target.col,
          };
          target.pieceCode = toPieceCode;
          target.char = toPieceChar;
          target.promoted = false;
          touSkillDebugLog({
            hook,
            transformed: true,
            before,
            after: {
              char: target.char,
              pieceCode: target.pieceCode,
              row: target.row,
              col: target.col,
            },
          });
          continue;
        }

        if (hook === 'so_summon_random_adjacent_gold') {
          const summonCode =
            toBasePieceCode(asString(params.summonPieceCode)) ??
            toBasePieceCode(asString(params.pieceCode)) ??
            'KI';
          const summonChar = asString(params.summonPieceChar) ?? '金';
          summonRandomAdjacentEmptyPiece({
            pieces: input.pieces,
            center: input.movedPiece,
            actorSide: input.actorSide,
            summonCode,
            summonChar,
          });
          continue;
        }

        if (hook === 'sou_grass_random_pit_cells') {
          if (!movedPiece || input.move.fromRow == null || input.move.fromCol == null) continue;
          const maxCells = Math.min(
            3,
            Math.max(
              1,
              Math.floor(
                asNumber(params.maxCells) ??
                  asNumber(params.max_cells) ??
                  asNumber(params.count) ??
                  3,
              ),
            ),
          );
          const candidates: { row: number; col: number }[] = [];
          for (let dr = -1; dr <= 1; dr += 1) {
            for (let dc = -1; dc <= 1; dc += 1) {
              if (dr === 0 && dc === 0) continue;
              const row = movedPiece.row + dr;
              const col = movedPiece.col + dc;
              if (row < 0 || row > 8 || col < 0 || col > 8) continue;
              if (!isCellEmpty(input.pieces, row, col)) continue;
              candidates.push({ row, col });
            }
          }
          const pool = [...candidates];
          let placed = 0;
          while (placed < maxCells && pool.length > 0) {
            const idx = Math.floor(Math.random() * pool.length);
            const cell = pool.splice(idx, 1)[0]!;
            state.board_hazards = state.board_hazards.filter((entry) => {
              const type = asString(entry.hazard_type ?? entry.hazardType) ?? '';
              const hRow = asNumber(entry.row);
              const hCol = asNumber(entry.col);
              return !(type === 'pit_cell' && hRow === cell.row && hCol === cell.col);
            });
            state.board_hazards.push({
              row: cell.row,
              col: cell.col,
              hazard_type: 'pit_cell',
              affects_side: sideOpposite(input.actorSide),
              remaining_turns: 1,
            });
            placed += 1;
          }
          if (placed > 0) {
            markMoveSkillFx();
          }
          continue;
        }

        if (hook === 'an_opponent_special_to_pawn') {
          const enemySide: Side = input.actorSide === 'player' ? 'enemy' : 'player';
          const candidates = input.pieces
            .map((p, idx) => ({ p, idx }))
            .filter(({ p }) => {
              if (p.side !== enemySide) return false;
              if (isKingPiece(p)) return false;
              if (isGiantPieceForEngine(p)) return false;
              return isDeckBuilderStyleSpecialBoardPiece(p);
            });
          anSkillDebugLog({
            hook,
            actorSide: input.actorSide,
            mover: {
              char: input.movedPiece.char,
              row: input.movedPiece.row,
              col: input.movedPiece.col,
            },
            candidateCount: candidates.length,
            candidates: candidates.map(({ p }) => ({
              char: p.char,
              pieceCode: p.pieceCode,
              row: p.row,
              col: p.col,
            })),
          });
          if (candidates.length === 0) continue;
          const selected = candidates[Math.floor(Math.random() * candidates.length)]!;
          const target = selected.p;
          const before = {
            char: target.char,
            pieceCode: target.pieceCode,
            row: target.row,
            col: target.col,
          };
          target.pieceCode = 'FU';
          target.char = '歩';
          target.promoted = false;
          const existingIdx = state.piece_statuses.findIndex((entry) => {
            const statusType = asString(entry.status_type ?? entry.statusType) ?? '';
            const side = (asString(entry.side) ?? 'player') === 'enemy' ? 'enemy' : 'player';
            return (
              (statusType === 'an_transform' || statusType === 'a_transform') &&
              side === target.side &&
              asNumber(entry.row) === target.row &&
              asNumber(entry.col) === target.col
            );
          });
          if (existingIdx >= 0) {
            state.piece_statuses[existingIdx] = {
              ...state.piece_statuses[existingIdx],
              row: target.row,
              col: target.col,
              side: target.side,
              status_type: 'an_transform',
              remaining_turns: 999,
            };
          } else {
            state.piece_statuses.push({
              row: target.row,
              col: target.col,
              side: target.side,
              status_type: 'an_transform',
              remaining_turns: 999,
            });
          }
          anSkillDebugLog({
            hook,
            transformed: true,
            before,
            after: {
              char: target.char,
              pieceCode: target.pieceCode,
              row: target.row,
              col: target.col,
            },
          });
          markMoveSkillFx();
          continue;
        }

        if (hook === 'sadame_opponent_next_turn_cost_cap') {
          const maxPieceCost =
            asNumber(params.maxPieceCost) ??
            asNumber(params.max_piece_cost) ??
            asNumber(params.maxCost) ??
            5;
          state.piece_statuses.push({
            row: input.movedPiece.row,
            col: input.movedPiece.col,
            side: input.actorSide,
            status_type: 'opponent_turn_max_piece_cost',
            max_piece_cost: maxPieceCost,
            remaining_turns: 1,
          });
          continue;
        }

        if (hook === 'edge_line_imprison' || hook === 'hen_random_edge_imprison') {
          const imprisonTurns = Math.max(
            2,
            Math.floor(
              asNumber(params.durationTurns) ?? asNumber(params.duration_turns) ?? duration,
            ),
          );
          const selectedEdge: HenBoardEdge =
            HEN_BOARD_EDGES[Math.floor(Math.random() * HEN_BOARD_EDGES.length)]!;
          state.board_hazards = state.board_hazards.filter((entry) => {
            const type = asString(entry.hazard_type ?? entry.hazardType) ?? '';
            return type !== 'hen_edge_highlight';
          });
          state.board_hazards.push({
            hazard_type: 'hen_edge_highlight',
            edge: selectedEdge,
            remaining_turns: imprisonTurns,
          });
          for (const piece of input.pieces) {
            if (!pieceOnHenBoardEdge(piece, selectedEdge)) continue;
            const existingIdx = state.piece_statuses.findIndex((entry) => {
              const statusType = asString(entry.status_type ?? entry.statusType) ?? '';
              const side = (asString(entry.side) ?? 'player') === 'enemy' ? 'enemy' : 'player';
              return (
                statusType === 'stun' &&
                side === piece.side &&
                asNumber(entry.row) === piece.row &&
                asNumber(entry.col) === piece.col
              );
            });
            const stunEntry = {
              side: piece.side,
              row: piece.row,
              col: piece.col,
              status_type: 'stun',
              remaining_turns: imprisonTurns,
            };
            if (existingIdx >= 0) {
              state.piece_statuses[existingIdx] = {
                ...state.piece_statuses[existingIdx],
                ...stunEntry,
              };
            } else {
              state.piece_statuses.push(stunEntry);
            }
          }
          continue;
        }

        if (hook === 'escape_king_follow') {
          if (input.move.fromRow == null || input.move.fromCol == null) continue;
          const dr = Math.sign(input.move.toRow - input.move.fromRow);
          const dc = Math.sign(input.move.toCol - input.move.fromCol);
          if (dr === 0 && dc === 0) continue;
          const kingIdx = findKingIndex(input.pieces, input.actorSide);
          if (kingIdx < 0) continue;
          const king = input.pieces[kingIdx]!;
          const targetRow = king.row + dr;
          const targetCol = king.col + dc;
          if (targetRow < 0 || targetRow > 8 || targetCol < 0 || targetCol > 8) continue;
          if (!isCellEmpty(input.pieces, targetRow, targetCol)) continue;
          input.pieces[kingIdx] = { ...king, row: targetRow, col: targetCol };
          continue;
        }
      }

      if (effectType === 'remove_piece' && selector === 'enemy_hand_random') {
        decrementFirstHandPiece(input.position, sideOpposite(input.actorSide));
        continue;
      }

      if (effectType === 'destroy_hand_piece' && selector === 'enemy_hand_random') {
        decrementFirstHandPiece(input.position, sideOpposite(input.actorSide));
      }
    }
    if (
      boardSignatureForSkillFx(input.pieces) !== v2FxSnapPieces ||
      stableHandsStringForSkillFx(input.position) !== v2FxSnapHands ||
      state.piece_statuses.length !== v2FxSnapLens.ps ||
      state.movement_modifiers.length !== v2FxSnapLens.mm ||
      state.board_hazards.length !== v2FxSnapLens.bh ||
      state.piece_defenses.length !== v2FxSnapLens.pd
    ) {
      markMoveSkillFx();
    }
  }

  applyExperimentMutantReverts(input.pieces);
  state.movement_modifiers = pruneDanceMovementModifiersNotAdjacentToMai(
    state.movement_modifiers,
    input.pieces,
  );
  stripSkillStateForGiantImmunity(state, input.pieces);
  writeSkillState(input.position, state);
  return { moveSkillEffectTriggered, skillVisualEffects };
}
