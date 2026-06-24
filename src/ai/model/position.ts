import type { BoardPiece, HandsState } from '@/features/stage-shogi/domain/game-rules';
import { createEmptyHandsState } from '@/features/stage-shogi/domain/game-rules';
import type { BattleCanonicalPosition } from '@/usecases/stage-battle/game-move-contract';
import {
  canonicalizeBoardPieceIdentity,
  sanitizeBoardStatePieceRecords,
} from '@/features/stage-shogi/domain/board-piece-identity';
import { CHAR_TO_CODE } from '@/features/stage-shogi/domain/piece-conversion';
import { normalizePieceCode, toBasePieceCode } from '@/ai/model/move';
import { decodeWirePieceCodePart } from '@/lib/matching-server/wire-piece-code';

export type AiHandsState = HandsState;
export type AiBattlePosition = Omit<BattleCanonicalPosition, 'hands'> & {
  hands: AiHandsState;
};
export type AiBoardPiece = BoardPiece & {
  imageSignedUrl?: string | null;
  copiedMoveVectors?: unknown[];
};
export type BoardPieceIndex = {
  byCell: Map<number, AiBoardPiece>;
  bySide: Record<'player' | 'enemy', AiBoardPiece[]>;
};

function boardCellKey(row: number, col: number): number {
  return row * 9 + col;
}

export function buildBoardPieceIndex(pieces: AiBoardPiece[]): BoardPieceIndex {
  const index: BoardPieceIndex = {
    byCell: new Map<number, AiBoardPiece>(),
    bySide: { player: [], enemy: [] },
  };
  for (const piece of pieces) {
    index.byCell.set(boardCellKey(piece.row, piece.col), piece);
    index.bySide[piece.side].push(piece);
  }
  return index;
}

export function getBoardPieceAt(
  index: BoardPieceIndex,
  row: number,
  col: number,
): AiBoardPiece | null {
  return index.byCell.get(boardCellKey(row, col)) ?? null;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function isOpaquePieceInstanceId(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^piece_[a-z0-9]+$/i.test(value.trim());
}

function isHolySwordOpaqueId(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  // 聖剣「剣」の opaque id（lib/piece-image-registry.ts と同根）
  return v.includes('0f14abcc6e5e');
}

function charFromCanonicalCode(code: string | null): string | null {
  if (!code) return null;
  if (code === 'HOLY_SWORD') return '剣';
  if (code === 'SWORD' || code === 'KATANA') return '刀';
  if (code === 'GUN') return '銃';
  if (code === 'ARMOR') return '鎧';
  if (code === 'SHIELD') return '盾';
  for (const [char, mapped] of Object.entries(CHAR_TO_CODE)) {
    const base = toBasePieceCode(mapped);
    if (base === code) return char;
  }
  return null;
}

export function sanitizeHandsBag(
  bag: Partial<Record<string, number>> | undefined,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(bag ?? {})) {
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    const normalized = Math.max(0, Math.floor(value));
    if (normalized <= 0) continue;
    out[key.toUpperCase()] = normalized;
  }
  return out;
}

export function normalizeHands(
  input?: BattleCanonicalPosition['hands'] | Partial<AiHandsState> | null,
): AiHandsState {
  const empty = createEmptyHandsState();
  return {
    player: { ...empty.player, ...sanitizeHandsBag(input?.player) },
    enemy: { ...empty.enemy, ...sanitizeHandsBag(input?.enemy) },
  };
}

export function cloneBattlePosition(position: BattleCanonicalPosition): AiBattlePosition {
  return {
    ...position,
    boardState: cloneRecord(position.boardState),
    hands: normalizeHands(position.hands),
  };
}

export function normalizeBattlePosition(position: BattleCanonicalPosition): AiBattlePosition {
  const cloned = cloneBattlePosition(position);
  const boardState = sanitizeBoardStatePieceRecords(cloneRecord(cloned.boardState)) ?? {};
  return {
    ...cloned,
    sideToMove: cloned.sideToMove === 'enemy' ? 'enemy' : 'player',
    turnNumber: Math.max(1, Math.floor(cloned.turnNumber)),
    moveCount: Math.max(0, Math.floor(cloned.moveCount)),
    sfen: cloned.sfen,
    stateHash: cloned.stateHash ?? null,
    boardState,
    hands: normalizeHands(cloned.hands),
  };
}

export function piecesFromBoardState(position: AiBattlePosition): AiBoardPiece[] {
  const boardState = asRecord(position.boardState) ?? {};
  const rawPieces = Array.isArray(boardState.pieces)
    ? boardState.pieces
    : Array.isArray(boardState.placements)
      ? boardState.placements
      : [];

  const pieces: AiBoardPiece[] = [];
  for (const raw of rawPieces) {
    const obj = asRecord(raw);
    if (!obj) continue;
    const side = (obj.side === 'enemy' ? 'enemy' : 'player') as 'player' | 'enemy';
    const row = typeof obj.row === 'number' ? obj.row : null;
    const col = typeof obj.col === 'number' ? obj.col : null;
    if (row == null || col == null) continue;

    const rawPiece = asRecord(obj.piece);
    const rawPieceCode =
      (obj.pieceCode as string | null | undefined) ??
      (rawPiece?.code as string | null | undefined) ??
      CHAR_TO_CODE[String(obj.char ?? rawPiece?.char ?? '')];
    const wireDecoded =
      typeof rawPieceCode === 'string' && (rawPieceCode.includes('>') || rawPieceCode.includes('@'))
        ? decodeWirePieceCodePart(rawPieceCode)
        : null;
    const pieceCode = normalizePieceCode(wireDecoded?.code ?? rawPieceCode);
    const promoted = Boolean(obj.promoted ?? rawPiece?.promoted ?? false);
    const rawChar = String(obj.char ?? rawPiece?.char ?? '?') || (pieceCode ? pieceCode : '?');
    const baseCode = toBasePieceCode(pieceCode);
    const char = (() => {
      // board_state の char が opaque id に潰れている場合でも、聖剣だけは表示/ロジック上「剣」に戻す。
      if (isHolySwordOpaqueId(rawChar) || isHolySwordOpaqueId(pieceCode)) return '剣';
      if (isOpaquePieceInstanceId(rawChar) || rawChar === pieceCode) {
        return charFromCanonicalCode(baseCode) ?? rawChar;
      }
      return rawChar;
    })();

    const livesRaw = obj.kbossLivesRemaining ?? obj.kboss_lives_remaining;
    const kbossLivesRemaining =
      typeof livesRaw === 'number' && Number.isFinite(livesRaw)
        ? Math.max(1, Math.min(2, Math.floor(livesRaw)))
        : undefined;

    const mrpc = obj.mutantRevertPieceCode ?? obj.mutant_revert_piece_code;
    const mrch = obj.mutantRevertChar ?? obj.mutant_revert_char;
    const mrpr = obj.mutantRevertPromoted ?? obj.mutant_revert_promoted;
    const mrimg = obj.mutantRevertImageSignedUrl ?? obj.mutant_revert_image_signed_url;
    const hasMutantRevert =
      (typeof mrpc === 'string' && mrpc.length > 0) ||
      (typeof mrch === 'string' && mrch.length > 0);

    const cowChargeRaw = obj.cowChargeCount ?? obj.cow_charge_count ?? wireDecoded?.cowChargeCount;
    const cowChargeCount =
      typeof cowChargeRaw === 'number' && Number.isFinite(cowChargeRaw)
        ? Math.max(0, Math.min(8, Math.floor(cowChargeRaw)))
        : undefined;

    const pigCodeRaw =
      typeof obj.pigInheritedPieceCode === 'string'
        ? obj.pigInheritedPieceCode
        : typeof obj.pig_inherited_piece_code === 'string'
          ? obj.pig_inherited_piece_code
          : (wireDecoded?.pigInheritedPieceCode ?? null);
    const pigInheritedPieceCode =
      pigCodeRaw && pigCodeRaw.trim().length > 0 ? pigCodeRaw.trim().toUpperCase() : null;
    const pigIc =
      typeof obj.pigInheritedChar === 'string'
        ? obj.pigInheritedChar
        : typeof obj.pig_inherited_char === 'string'
          ? obj.pig_inherited_char
          : undefined;
    const pigInheritedChar =
      typeof pigIc === 'string' && pigIc.trim().length > 0 ? pigIc : undefined;
    const pigPr =
      obj.pigInheritedPromoted ?? obj.pig_inherited_promoted ?? wireDecoded?.pigInheritedPromoted;
    const pigInheritedPromoted =
      typeof pigPr === 'boolean' ? pigPr : typeof pigPr === 'number' ? pigPr !== 0 : undefined;

    const canonical = canonicalizeBoardPieceIdentity(baseCode ?? pieceCode, char);
    pieces.push({
      side,
      row,
      col,
      pieceCode: canonical.pieceCode,
      char: canonical.char,
      promoted,
      ...(cowChargeCount != null ? { cowChargeCount } : {}),
      ...(pigInheritedPieceCode != null
        ? {
            pigInheritedPieceCode,
            ...(pigInheritedChar != null ? { pigInheritedChar } : {}),
            ...(pigInheritedPromoted != null ? { pigInheritedPromoted } : {}),
          }
        : {}),
      ...(kbossLivesRemaining != null ? { kbossLivesRemaining } : {}),
      ...(hasMutantRevert
        ? {
            mutantRevertPieceCode: typeof mrpc === 'string' ? mrpc : null,
            mutantRevertChar: typeof mrch === 'string' ? mrch : undefined,
            mutantRevertPromoted: Boolean(mrpr),
            mutantRevertImageSignedUrl: typeof mrimg === 'string' ? mrimg : null,
          }
        : {}),
      imageSignedUrl:
        typeof obj.imageSignedUrl === 'string'
          ? obj.imageSignedUrl
          : typeof rawPiece?.imageSignedUrl === 'string'
            ? rawPiece.imageSignedUrl
            : null,
    });
  }

  return pieces;
}
