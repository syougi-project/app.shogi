import { toBasePieceCode } from '@/ai/model/move';

import { CHAR_TO_CODE } from '@/features/stage-shogi/domain/char-to-piece-code-map';
import { CODE_TO_CHAR } from '@/features/stage-shogi/domain/piece-conversion';

/** DB の `piece_<hex>` インスタンス ID。 */
export function isOpaquePieceInstanceId(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^piece_[a-z0-9]+$/i.test(value.trim());
}

/** 盤面表示用の漢字（1〜2文字・opaque 以外）。 */
export function isDisplayKanjiChar(char: string | null | undefined): boolean {
  if (!char) return false;
  const trimmed = char.trim();
  if (!trimmed || trimmed === '?') return false;
  if (isOpaquePieceInstanceId(trimmed)) return false;
  return trimmed.length <= 2;
}

function getDisplayCharFromPieceCode(pieceCode: string | null | undefined): string | null {
  const base = toBasePieceCode(pieceCode);
  return base ? (CODE_TO_CHAR[base] ?? null) : null;
}

/**
 * 盤面・合法手・画像で共有する駒 identity。
 * opaque `piece_…` は漢字が分かれば canonical（FU / FIR 等）へ寄せる。
 */
export function canonicalizeBoardPieceIdentity(
  pieceCode: string | null | undefined,
  char: string | null | undefined,
): { pieceCode: string | null; char: string } {
  const rawChar = (char ?? '').trim();
  const displayChar = isDisplayKanjiChar(rawChar) ? rawChar : null;

  if (displayChar && CHAR_TO_CODE[displayChar]) {
    const canonical = toBasePieceCode(CHAR_TO_CODE[displayChar]) ?? CHAR_TO_CODE[displayChar];
    return { pieceCode: canonical, char: displayChar };
  }

  const baseFromInput = pieceCode ? (toBasePieceCode(pieceCode) ?? pieceCode.toUpperCase()) : null;
  if (baseFromInput && !isOpaquePieceInstanceId(pieceCode) && CODE_TO_CHAR[baseFromInput]) {
    return { pieceCode: baseFromInput, char: CODE_TO_CHAR[baseFromInput] };
  }

  if (baseFromInput && CODE_TO_CHAR[baseFromInput]) {
    return { pieceCode: baseFromInput, char: CODE_TO_CHAR[baseFromInput] };
  }

  if (displayChar) {
    return { pieceCode: pieceCode ?? null, char: displayChar };
  }

  return { pieceCode: pieceCode ?? null, char: rawChar || '?' };
}

/** ステージ開始 API の placement.piece から表示用 char / pieceCode を決める。 */
export function resolveStagePlacementIdentity(piece: {
  char: string | null | undefined;
  code: string | null | undefined;
}): { pieceCode: string | null; char: string } {
  const rawCode = piece.code ?? null;
  let char = (piece.char ?? '').trim();
  if (!isDisplayKanjiChar(char) && rawCode) {
    const fromRegistry = getDisplayCharFromPieceCode(rawCode);
    if (fromRegistry) char = fromRegistry;
    const base = toBasePieceCode(rawCode);
    if (!isDisplayKanjiChar(char) && base && CODE_TO_CHAR[base]) {
      char = CODE_TO_CHAR[base];
    }
  }
  if (isOpaquePieceInstanceId(char) && rawCode) {
    const fromRegistry = getDisplayCharFromPieceCode(rawCode);
    if (fromRegistry) char = fromRegistry;
    const base = toBasePieceCode(rawCode);
    if (base && CODE_TO_CHAR[base]) {
      char = CODE_TO_CHAR[base];
    }
  }
  return canonicalizeBoardPieceIdentity(rawCode, char || '?');
}

export function sanitizeBoardStatePieceRecords(
  boardState: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!boardState) return boardState ?? null;
  const rawPieces = [
    boardState.pieces,
    boardState.placements,
    boardState.boardPieces,
    boardState.board_pieces,
  ].find((value) => Array.isArray(value)) as unknown[] | undefined;
  if (!rawPieces || rawPieces.length === 0) return boardState;

  const sanitizeEntry = (raw: unknown): unknown => {
    if (!raw || typeof raw !== 'object') return raw;
    const entry = raw as Record<string, unknown>;
    const nested = (entry.piece as Record<string, unknown> | undefined) ?? entry;
    const rawChar = String(nested.char ?? entry.char ?? '').trim();
    const rawCode =
      (typeof nested.pieceCode === 'string' ? nested.pieceCode : null) ??
      (typeof nested.piece_code === 'string' ? nested.piece_code : null) ??
      (typeof nested.code === 'string' ? nested.code : null) ??
      (typeof entry.pieceCode === 'string' ? entry.pieceCode : null) ??
      null;
    const { pieceCode, char } = canonicalizeBoardPieceIdentity(rawCode, rawChar);
    const nextNested = { ...nested, pieceCode, char };
    if (entry.piece && typeof entry.piece === 'object') {
      return { ...entry, piece: nextNested, char, pieceCode };
    }
    return { ...entry, ...nextNested };
  };

  if (Array.isArray(boardState.pieces)) {
    return { ...boardState, pieces: boardState.pieces.map(sanitizeEntry) };
  }
  if (Array.isArray(boardState.placements)) {
    return {
      ...boardState,
      placements: boardState.placements.map((raw) => {
        if (!raw || typeof raw !== 'object') return raw;
        const placement = raw as Record<string, unknown>;
        const piece = placement.piece;
        if (!piece || typeof piece !== 'object') return placement;
        const nested = piece as Record<string, unknown>;
        const { pieceCode, char } = canonicalizeBoardPieceIdentity(
          (nested.code as string | undefined) ?? (nested.pieceCode as string | undefined) ?? null,
          (nested.char as string | undefined) ?? null,
        );
        return {
          ...placement,
          piece: { ...nested, code: pieceCode, pieceCode, char },
        };
      }),
    };
  }
  return boardState;
}
