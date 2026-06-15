import { toBasePieceCode } from '@/ai/model/move';
import { BATTLE_PIECE_EFFECT_SOUND_MODULES } from '@/constants/battle-piece-effect-sound-modules.generated';
import type { MovePayload } from '@/domain/matching-server/protocol';
import type { BoardPiece, Side } from '@/features/stage-shogi/domain/game-rules';
import {
  CODE_TO_CHAR,
  PROMOTED_CODE_TO_CHAR,
} from '@/features/stage-shogi/domain/piece-conversion';
import { normalizeSkillName } from '@/features/stage-shogi/ui/stage-shogi-screen.presenters';
import {
  playBattlePieceEffectSound,
  playBattlePieceEffectSoundFirstMatch,
  playSe,
} from '@/lib/audio/audio-manager';
import { isPhysicalBattleMove } from '@/lib/battle/battle-skill-interaction';
import { parseMatchingSquare } from '@/lib/matching-server/square';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

export type BattleAudioCatalog = {
  pieceDefsByCode: Record<string, PieceCatalogItem>;
  pieceDefsByChar: Record<string, PieceCatalogItem>;
  promotedPieceDefsByCode: Record<string, PieceCatalogItem>;
};

function findPieceAt(placements: BoardPiece[], row: number, col: number): BoardPiece | null {
  return placements.find((p) => p.row === row && p.col === col) ?? null;
}

function normalizeKanjiForBattleAudioKey(s: string): string {
  const t = s.trim();
  try {
    return t.normalize('NFKC');
  } catch {
    return t;
  }
}

function pieceCharFromCode(pieceCode: string, side: Side, promoted: boolean): string {
  if (promoted && PROMOTED_CODE_TO_CHAR[pieceCode]) {
    return PROMOTED_CODE_TO_CHAR[pieceCode];
  }
  if (pieceCode === 'OU') {
    return side === 'enemy' ? '玉' : '王';
  }
  return CODE_TO_CHAR[pieceCode] ?? '?';
}

function resolveKanjiForBattleMoveSound(
  move: BattleMove,
  actorSide: Side,
  board: BoardPiece[],
): string | null {
  if (move.dropPieceCode) {
    const code = move.dropPieceCode.toUpperCase();
    const ch = pieceCharFromCode(code, actorSide, false);
    return ch && ch !== '?' ? normalizeKanjiForBattleAudioKey(ch) : null;
  }
  const atTo = findPieceAt(board, move.toRow, move.toCol);
  if (atTo?.side === actorSide && atTo.char && !/^piece_/i.test(atTo.char)) {
    return normalizeKanjiForBattleAudioKey(atTo.char);
  }
  if (move.fromRow != null && move.fromCol != null) {
    const atFrom = findPieceAt(board, move.fromRow, move.fromCol);
    if (atFrom?.side === actorSide && atFrom.char && !/^piece_/i.test(atFrom.char)) {
      return normalizeKanjiForBattleAudioKey(atFrom.char);
    }
  }
  const rawPc = (move.pieceCode ?? '').toUpperCase();
  const base = (toBasePieceCode(move.pieceCode ?? null) ?? rawPc).toUpperCase();
  const ch = pieceCharFromCode(base, actorSide, move.promote === true);
  return ch && ch !== '?' ? normalizeKanjiForBattleAudioKey(ch) : null;
}

function pieceDefForBattleAudio(
  move: BattleMove,
  kanji: string | null,
  catalog: BattleAudioCatalog,
): PieceCatalogItem | undefined {
  const { pieceDefsByCode, pieceDefsByChar, promotedPieceDefsByCode } = catalog;
  const rawCode = (move.pieceCode ?? '').toUpperCase();
  const baseRaw = toBasePieceCode(move.pieceCode ?? null);
  const base = (baseRaw ?? rawCode).toUpperCase();
  if (move.promote) {
    return (
      promotedPieceDefsByCode[base] ??
      promotedPieceDefsByCode[rawCode] ??
      pieceDefsByCode[base] ??
      pieceDefsByCode[rawCode]
    );
  }
  if (kanji && pieceDefsByChar[kanji]) return pieceDefsByChar[kanji];
  return pieceDefsByCode[base] ?? pieceDefsByCode[rawCode];
}

const PIECE_CHARS_ALWAYS_USE_EFFECT_SOUND_ON_MOVE = new Set<string>(['鳳']);

function shouldUsePieceEffectInsteadOfGenericMove(
  move: BattleMove,
  kanji: string | null,
  catalog: BattleAudioCatalog,
): boolean {
  if (move.promote) return false;
  const key = kanji ? normalizeKanjiForBattleAudioKey(kanji) : '';
  if (!key || BATTLE_PIECE_EFFECT_SOUND_MODULES[key] == null) return false;
  if (PIECE_CHARS_ALWAYS_USE_EFFECT_SOUND_ON_MOVE.has(key)) return true;
  const def = pieceDefForBattleAudio(move, kanji, catalog);
  if (!def) return true;
  return normalizeSkillName(def.skill) == null;
}

export function buildPromotedPieceDefsByCode(
  catalog: PieceCatalogItem[],
  pieceDefsByChar: Record<string, PieceCatalogItem>,
): Record<string, PieceCatalogItem> {
  const map: Record<string, PieceCatalogItem> = {};
  for (const item of catalog) {
    if (!item.isPromoted) continue;
    const byPieceCode = item.pieceCode?.toUpperCase();
    if (byPieceCode) map[byPieceCode] = item;
    const byChar = CODE_TO_CHAR[item.char]?.toUpperCase();
    if (byChar) map[byChar] = item;
  }
  for (const [code, char] of Object.entries(PROMOTED_CODE_TO_CHAR)) {
    if (map[code]) continue;
    const fallback = pieceDefsByChar[char];
    if (fallback) map[code] = fallback;
  }
  return map;
}

export function movePayloadToBattleMove(payload: MovePayload): BattleMove {
  const piece = toBasePieceCode(payload.piece) ?? payload.piece.toUpperCase();
  const isDrop = payload.drop === true || payload.from == null || payload.from === '';
  if (isDrop) {
    const { row, col } = parseMatchingSquare(payload.to);
    return {
      fromRow: null,
      fromCol: null,
      toRow: row,
      toCol: col,
      pieceCode: piece,
      promote: false,
      dropPieceCode: piece,
      capturedPieceCode: null,
      notation: null,
    };
  }
  const to = parseMatchingSquare(payload.to);
  const from = payload.from ? parseMatchingSquare(payload.from) : null;
  return {
    fromRow: from?.row ?? null,
    fromCol: from?.col ?? null,
    toRow: to.row,
    toCol: to.col,
    pieceCode: piece,
    promote: payload.promote === true,
    dropPieceCode: null,
    capturedPieceCode: null,
    notation: null,
  };
}

export function playBattleMoveOrPromoteSe(
  move: BattleMove,
  actorSide: Side,
  board: BoardPiece[],
  catalog: BattleAudioCatalog,
): void {
  if (move.promote) {
    void playSe('battlePromote');
    return;
  }
  if (!isPhysicalBattleMove(move)) return;
  const kanji = resolveKanjiForBattleMoveSound(move, actorSide, board);
  if (shouldUsePieceEffectInsteadOfGenericMove(move, kanji, catalog)) {
    void playBattlePieceEffectSound(kanji, 'battlePieceMove');
    return;
  }
  void playSe('battlePieceMove');
}

function buildSkillActivationEffectSoundKeys(
  move: BattleMove,
  actorSide: Side,
  board: BoardPiece[],
  catalog: BattleAudioCatalog,
): string[] {
  const keys: string[] = [];
  const push = (s: string | null | undefined) => {
    if (!s) return;
    let t = s.trim();
    if (!t) return;
    try {
      t = t.normalize('NFKC');
    } catch {
      /* ignore */
    }
    if (!keys.includes(t)) keys.push(t);
  };

  const rawCode = move.pieceCode ?? move.dropPieceCode;
  if (rawCode) {
    const upper = rawCode.toUpperCase();
    const base = (toBasePieceCode(rawCode) ?? upper).toUpperCase();
    push(pieceCharFromCode(upper, actorSide, move.promote === true));
    if (base !== upper) {
      push(pieceCharFromCode(base, actorSide, move.promote === true));
    }
    const c1 = CODE_TO_CHAR[upper];
    const c2 = CODE_TO_CHAR[base];
    if (typeof c1 === 'string') push(c1);
    if (typeof c2 === 'string') push(c2);
  }

  const kanji = resolveKanjiForBattleMoveSound(move, actorSide, board);
  const def = pieceDefForBattleAudio(move, kanji, catalog);
  if (def?.char) push(def.char);
  if (def?.name) push(def.name.replace(/\s+/g, ''));
  push(kanji);

  return keys;
}

/** スキル発動時の駒効果音（ステージ戦と同じ） */
export function playBattleSkillActivationSe(
  move: BattleMove,
  actorSide: Side,
  board: BoardPiece[],
  catalog: BattleAudioCatalog,
): void {
  const keys = buildSkillActivationEffectSoundKeys(move, actorSide, board, catalog);
  void playBattlePieceEffectSoundFirstMatch(keys, 'battleSkill', 0.92);
}

export function resolveSkillActivationLabel(
  move: BattleMove,
  actorSide: Side,
  catalog: BattleAudioCatalog,
): string | null {
  const code = move.pieceCode || move.dropPieceCode;
  if (!code) return null;
  const { pieceDefsByCode, promotedPieceDefsByCode } = catalog;
  const base = normalizeSkillName(pieceDefsByCode[code]?.skill);
  const promoted = normalizeSkillName(promotedPieceDefsByCode[code]?.skill);
  const skillName = move.promote ? (promoted ?? base) : (base ?? promoted);
  if (!skillName) return null;
  const actorLabel = actorSide === 'player' ? 'あなた' : '相手';
  return `${actorLabel} スキル発動: ${skillName}`;
}
