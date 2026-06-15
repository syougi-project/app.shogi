import { toBasePieceCode } from '@/ai/model/move';
import { decodeWirePieceCodePart } from '@/lib/matching-server/wire-piece-code';

import { CHAR_TO_CODE } from '@/features/stage-shogi/domain/char-to-piece-code-map';
import { CODE_TO_CHAR } from '@/features/stage-shogi/domain/piece-conversion';

const OPAQUE_PIECE_CODE_TO_CHAR: Readonly<Record<string, string>> = {
  piece_c518b11858f2: '歩',
  piece_8bc5d3ca0b32: '香',
  piece_7c0b1e09154b: '桂',
  piece_6e7f7100e7bb: '銀',
  piece_c8295f7ed9a8: '金',
  piece_f221427c3f31: '角',
  piece_cc64bbd54bb3: '飛',
  piece_cb504254c93f: '玉',
  piece_533b7fec5456: '赤鬼',
};

/** ステージ39の赤鬼・青鬼・黒鬼（piece_code / canonical / 表示字）。 */
const ONI_VARIANT_IDENTITY: Readonly<Record<string, { pieceCode: string; char: string }>> = {
  REDONI: { pieceCode: 'REDONI', char: '赤鬼' },
  BLUEONI: { pieceCode: 'BLUEONI', char: '青鬼' },
  BLACKONI: { pieceCode: 'BLACKONI', char: '黒鬼' },
  赤鬼: { pieceCode: 'REDONI', char: '赤鬼' },
  青鬼: { pieceCode: 'BLUEONI', char: '青鬼' },
  黒鬼: { pieceCode: 'BLACKONI', char: '黒鬼' },
};

function resolveOniVariantIdentity(
  pieceCode: string | null | undefined,
  char: string | null | undefined,
): { pieceCode: string; char: string } | null {
  const rawCode = pieceCode?.trim();
  if (rawCode) {
    const upper = (toBasePieceCode(rawCode) ?? rawCode).toUpperCase();
    if (upper === 'BLUEONI' || rawCode.toLowerCase() === 'blueoni') {
      return ONI_VARIANT_IDENTITY.BLUEONI;
    }
    if (upper === 'BLACKONI' || rawCode.toLowerCase() === 'blackoni') {
      return ONI_VARIANT_IDENTITY.BLACKONI;
    }
    if (
      upper === 'REDONI' ||
      rawCode.toLowerCase() === 'redoni' ||
      rawCode.toLowerCase() === 'piece_533b7fec5456'
    ) {
      return ONI_VARIANT_IDENTITY.REDONI;
    }
  }
  const displayChar = (char ?? '').trim();
  if (displayChar === '青鬼' || displayChar === '黒鬼' || displayChar === '赤鬼') {
    return ONI_VARIANT_IDENTITY[displayChar];
  }
  return null;
}

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
  const raw = pieceCode?.trim();
  if (!raw) return null;
  const opaqueChar = OPAQUE_PIECE_CODE_TO_CHAR[raw] ?? OPAQUE_PIECE_CODE_TO_CHAR[raw.toLowerCase()];
  if (opaqueChar) return opaqueChar;
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
  const oniVariant = resolveOniVariantIdentity(pieceCode, char);
  if (oniVariant) return oniVariant;

  const rawChar = (char ?? '').trim();
  const displayChar = isDisplayKanjiChar(rawChar) ? rawChar : null;

  if (displayChar === '鬼') {
    const fromCode = resolveOniVariantIdentity(pieceCode, null);
    if (fromCode) return fromCode;
    return ONI_VARIANT_IDENTITY.REDONI;
  }

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
    const wireDecoded =
      rawCode && (rawCode.includes('>') || rawCode.includes('@'))
        ? decodeWirePieceCodePart(rawCode)
        : null;
    const { pieceCode, char } = canonicalizeBoardPieceIdentity(
      wireDecoded?.code ?? rawCode,
      rawChar,
    );
    const nextNested = {
      ...nested,
      pieceCode,
      char,
      ...(wireDecoded?.pigInheritedPieceCode
        ? {
            pigInheritedPieceCode: wireDecoded.pigInheritedPieceCode,
            ...(wireDecoded.pigInheritedPromoted != null
              ? { pigInheritedPromoted: wireDecoded.pigInheritedPromoted }
              : {}),
          }
        : {}),
      ...(wireDecoded && wireDecoded.cowChargeCount > 0
        ? { cowChargeCount: wireDecoded.cowChargeCount }
        : {}),
    };
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
