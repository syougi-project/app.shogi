import { CHAR_TO_CODE } from '@/features/stage-shogi/domain/piece-conversion';
import { toBasePieceCode } from '@/ai/model/move';
import { giantAnchorFootprint, isGiantPieceForEngine } from '@/ai/engine/giant-piece';
import { isBirdPiece } from '@/ai/engine/piece-identifiers';
import { moveRandomAllyToCellBehindBird } from '@/ai/engine/bird-skill';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';
import type { Side } from '@/features/stage-shogi/domain/game-rules';
import type {
  BoardPiece,
  PreservedMovedPiece,
  TrustedBoardEndpoints,
} from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import {
  findPieceAt,
  normalizeCellIndex,
  normalizeBoardPieceForDisplay,
  pieceCodeFromPlacement,
  pieceCharFromCode,
  preferBundledPromotedImageOverRemoteUrl,
} from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import {
  isPromotedVisualPiece,
  localPromotedModuleFromBaseCodeCandidates,
  resolvePromotedImageSource,
} from '@/features/stage-shogi/ui/stage-shogi-screen.display';

const PERSISTENT_SYNC_GUARD_CHARS = new Set([
  '毒',
  '沼',
  '映',
  '鏡',
  'あ',
  '牢',
  '柵',
  '峰',
  '嶺',
  '岩',
  '鉱',
  '墓',
  '霊',
]);

function pieceIdentityKey(piece: BoardPiece) {
  return `${piece.side}:${piece.row}:${piece.col}`;
}

function preferDisplayKanjiChar(
  primary: string | null | undefined,
  fallback: string | null | undefined,
): string {
  if (primary && /[一-龯ぁ-んァ-ン]/.test(primary)) return primary;
  if (fallback && /[一-龯ぁ-んァ-ン]/.test(fallback)) return fallback;
  return primary ?? fallback ?? '?';
}

function basePieceKeyForReconcile(p: BoardPiece): string | null {
  if (p.pieceCode) {
    return toBasePieceCode(p.pieceCode) ?? p.pieceCode.toUpperCase();
  }
  if (p.char && CHAR_TO_CODE[p.char]) {
    const c = CHAR_TO_CODE[p.char];
    return toBasePieceCode(c) ?? c;
  }
  return null;
}

function sameBoardPieceForReconcile(lhs: BoardPiece, rhs: BoardPiece) {
  if (lhs.side !== rhs.side || lhs.row !== rhs.row || lhs.col !== rhs.col) return false;
  if ((lhs.promoted ?? false) !== (rhs.promoted ?? false)) return false;
  const lk = basePieceKeyForReconcile(lhs);
  const rk = basePieceKeyForReconcile(rhs);
  if (lk && rk) return lk === rk;
  return lhs.pieceCode === rhs.pieceCode && lhs.char === rhs.char;
}

export function preserveMovedPieceIdentity(
  nextPieces: BoardPiece[],
  preserved?: PreservedMovedPiece,
): BoardPiece[] {
  if (!preserved) return nextPieces;
  const index = nextPieces.findIndex(
    (piece) =>
      piece.side === preserved.side &&
      piece.row === preserved.toRow &&
      piece.col === preserved.toCol,
  );
  if (index < 0) return nextPieces;
  const updated = [...nextPieces];
  updated[index] = {
    ...updated[index],
    pieceCode: preserved.pieceCode,
    char: preserved.char,
    imageSignedUrl: preserved.imageSignedUrl,
    promoted: preserved.promoted ?? false,
  };
  return updated;
}

export function reconcilePieceIdentity(
  nextPieces: BoardPiece[],
  existingPieces: BoardPiece[],
  pieceDefsByChar: Partial<Record<string, PieceCatalogItem>> = {},
): BoardPiece[] {
  const existingByKey = new Map(existingPieces.map((piece) => [pieceIdentityKey(piece), piece]));
  return nextPieces.map((piece) => {
    const existing = existingByKey.get(pieceIdentityKey(piece));
    const normalized = normalizeBoardPieceForDisplay(piece, pieceDefsByChar);
    if (!existing) return normalized;

    const withPreservedDisplay = normalizeBoardPieceForDisplay(
      {
        ...normalized,
        char: preferDisplayKanjiChar(normalized.char, existing.char),
        imageSignedUrl: existing.imageSignedUrl ?? normalized.imageSignedUrl,
      },
      pieceDefsByChar,
    );
    if (!sameBoardPieceForReconcile(existing, withPreservedDisplay)) {
      return withPreservedDisplay;
    }
    if (isPromotedVisualPiece(withPreservedDisplay) !== isPromotedVisualPiece(existing)) {
      return withPreservedDisplay;
    }
    return normalizeBoardPieceForDisplay(
      {
        ...existing,
        row: withPreservedDisplay.row,
        col: withPreservedDisplay.col,
        pieceCode: withPreservedDisplay.pieceCode ?? existing.pieceCode,
        char: preferDisplayKanjiChar(withPreservedDisplay.char, existing.char),
        promoted: withPreservedDisplay.promoted ?? existing.promoted,
        cowChargeCount: withPreservedDisplay.cowChargeCount ?? existing.cowChargeCount,
        pigInheritedPieceCode:
          withPreservedDisplay.pigInheritedPieceCode !== undefined
            ? withPreservedDisplay.pigInheritedPieceCode
            : existing.pigInheritedPieceCode,
        pigInheritedChar: withPreservedDisplay.pigInheritedChar ?? existing.pigInheritedChar,
        pigInheritedPromoted:
          withPreservedDisplay.pigInheritedPromoted ?? existing.pigInheritedPromoted,
        kbossLivesRemaining:
          withPreservedDisplay.kbossLivesRemaining ?? existing.kbossLivesRemaining,
        imageSignedUrl: existing.imageSignedUrl ?? withPreservedDisplay.imageSignedUrl,
      },
      pieceDefsByChar,
    );
  });
}

export function restoreMissingPersistentHazardPieces(
  nextPieces: BoardPiece[],
  existingPieces: BoardPiece[],
): BoardPiece[] {
  const nextByCell = new Map<string, BoardPiece>();
  for (const p of nextPieces) nextByCell.set(`${p.row}:${p.col}`, p);
  for (const p of existingPieces) {
    if (!PERSISTENT_SYNC_GUARD_CHARS.has(p.char)) continue;
    const cellKey = `${p.row}:${p.col}`;
    if (!nextByCell.has(cellKey)) nextByCell.set(cellKey, p);
  }
  return [...nextByCell.values()];
}

export function enforcePersistentHazardCells(
  nextPieces: BoardPiece[],
  persistentHazards: readonly BoardPiece[],
): BoardPiece[] {
  if (persistentHazards.length === 0) return nextPieces;
  const nextHazardCount = new Map<string, number>();
  for (const p of nextPieces) {
    if (!PERSISTENT_SYNC_GUARD_CHARS.has(p.char)) continue;
    const key = `${p.side}:${p.char}`;
    nextHazardCount.set(key, (nextHazardCount.get(key) ?? 0) + 1);
  }
  const byCell = new Map<string, BoardPiece>();
  for (const p of nextPieces) byCell.set(`${p.row}:${p.col}`, p);
  for (const hz of persistentHazards) {
    const cellKey = `${hz.row}:${hz.col}`;
    if (byCell.has(cellKey)) continue;
    const kindKey = `${hz.side}:${hz.char}`;
    const remaining = nextHazardCount.get(kindKey) ?? 0;
    if (remaining > 0) {
      nextHazardCount.set(kindKey, remaining - 1);
      continue;
    }
    byCell.set(cellKey, hz);
  }
  return [...byCell.values()];
}

export function resolveBattleMovePlacements(
  prev: BoardPiece[],
  move: BattleMove,
): { fromRow: number; fromCol: number; toRow: number; toCol: number; moving: BoardPiece } | null {
  if (move.fromRow === null || move.fromCol === null) return null;
  const variants: { fr: number; fc: number; tr: number; tc: number }[] = [];
  const nFr = normalizeCellIndex(move.fromRow);
  const nFc = normalizeCellIndex(move.fromCol);
  const nTr = normalizeCellIndex(move.toRow);
  const nTc = normalizeCellIndex(move.toCol);
  if (nFr !== null && nFc !== null && nTr !== null && nTc !== null) {
    variants.push({ fr: nFr, fc: nFc, tr: nTr, tc: nTc });
  }
  variants.push({ fr: move.fromRow, fc: move.fromCol, tr: move.toRow, tc: move.toCol });

  const seen = new Set<string>();
  for (const v of variants) {
    const key = `${v.fr},${v.fc},${v.tr},${v.tc}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const moving = prev.find((p) => p.row === v.fr && p.col === v.fc);
    if (moving) return { fromRow: v.fr, fromCol: v.fc, toRow: v.tr, toCol: v.tc, moving };
  }
  return null;
}

export function isSelfCaptureLikeMove(
  prev: BoardPiece[],
  move: BattleMove,
  actorSide: Side,
  persistentHazards: readonly BoardPiece[] = [],
): boolean {
  const targetVariants: { row: number; col: number }[] = [];
  const nRow = normalizeCellIndex(move.toRow);
  const nCol = normalizeCellIndex(move.toCol);
  if (nRow !== null && nCol !== null) targetVariants.push({ row: nRow, col: nCol });
  targetVariants.push({ row: move.toRow, col: move.toCol });
  const hasAllyAtTarget = targetVariants.some(
    ({ row, col }) =>
      prev.some((p) => p.side === actorSide && p.row === row && p.col === col) ||
      persistentHazards.some((p) => p.side === actorSide && p.row === row && p.col === col),
  );
  if (!hasAllyAtTarget) return false;
  if (move.fromRow != null && move.fromCol != null) {
    const fromVariants: { row: number; col: number }[] = [];
    const nFr = normalizeCellIndex(move.fromRow);
    const nFc = normalizeCellIndex(move.fromCol);
    if (nFr !== null && nFc !== null) fromVariants.push({ row: nFr, col: nFc });
    fromVariants.push({ row: move.fromRow, col: move.fromCol });
    if (fromVariants.some((f) => targetVariants.some((t) => f.row === t.row && f.col === t.col))) {
      return false;
    }
  }
  return true;
}

export function buildPreservedMovedPieceForPlayer(
  sourceBoard: BoardPiece[],
  move: BattleMove,
  pieceDefsByChar: Partial<Record<string, PieceCatalogItem>>,
  promotedPieceDefsByCode: Partial<Record<string, PieceCatalogItem>>,
  trustedBoard?: TrustedBoardEndpoints,
): PreservedMovedPiece | undefined {
  let resolved = trustedBoard
    ? ({
        fromRow: trustedBoard.fromRow,
        fromCol: trustedBoard.fromCol,
        toRow: trustedBoard.toRow,
        toCol: trustedBoard.toCol,
        moving:
          sourceBoard.find(
            (p) => p.row === trustedBoard.fromRow && p.col === trustedBoard.fromCol,
          ) ??
          sourceBoard.find(
            (p) =>
              p.row === trustedBoard.toRow && p.col === trustedBoard.toCol && p.side === 'player',
          )!,
      } as const)
    : null;
  if (!resolved || resolved.moving?.side !== 'player') {
    resolved = resolveBattleMovePlacements(sourceBoard, move);
  }
  if (!resolved || resolved.moving.side !== 'player') return undefined;
  const moved = resolved.moving;
  const resolvedPieceCode = pieceCodeFromPlacement(
    moved.pieceCode ?? null,
    moved.char,
    pieceDefsByChar,
  );
  const codeKey = (resolvedPieceCode ?? moved.pieceCode ?? '').toUpperCase();
  const promoted = move.promote ? true : (moved.promoted ?? false);
  const promotedDef = move.promote ? promotedPieceDefsByCode[codeKey] : null;
  const imageSignedUrl = preferBundledPromotedImageOverRemoteUrl(
    resolvedPieceCode ?? moved.pieceCode ?? null,
    promoted,
    promotedDef?.imageSignedUrl ?? moved.imageSignedUrl,
  );
  const resolvedChar = resolvedPieceCode
    ? pieceCharFromCode(resolvedPieceCode, moved.side, promoted)
    : moved.char;
  const char =
    resolvedChar === '?' || (resolvedPieceCode != null && resolvedChar === resolvedPieceCode)
      ? moved.char
      : resolvedChar;
  return {
    side: moved.side,
    toRow: resolved.toRow,
    toCol: resolved.toCol,
    pieceCode: resolvedPieceCode ?? moved.pieceCode ?? null,
    char,
    imageSignedUrl,
    promoted,
  };
}

export function overlayPromotionFromOptimistic(
  canonical: BoardPiece[],
  optimistic: BoardPiece[],
): BoardPiece[] {
  const optByKey = new Map(optimistic.map((p) => [pieceIdentityKey(p), p]));
  return canonical.map((p) => {
    const o = optByKey.get(pieceIdentityKey(p));
    if (!o || !isPromotedVisualPiece(o)) return p;
    const optHasLocalPromoted = resolvePromotedImageSource(o) != null;
    const canHasLocalPromoted = resolvePromotedImageSource(p) != null;
    if (optHasLocalPromoted && !canHasLocalPromoted) {
      return {
        ...p,
        promoted: (p.promoted ?? false) || (o.promoted ?? false),
        pieceCode: o.pieceCode ?? p.pieceCode,
        char: o.char,
        imageSignedUrl: o.imageSignedUrl,
      };
    }
    if (isPromotedVisualPiece(p)) return p;
    const preferLocalPromoted =
      resolvePromotedImageSource(o) != null || (o.promoted && o.imageSignedUrl == null);
    return {
      ...p,
      promoted: o.promoted ?? true,
      pieceCode: o.pieceCode ?? p.pieceCode,
      char: o.char,
      imageSignedUrl: preferLocalPromoted ? null : (o.imageSignedUrl ?? p.imageSignedUrl),
    };
  });
}

export function computePiecesAfterOptimisticMove(
  prev: BoardPiece[],
  actorSide: Side,
  move: BattleMove,
  pieceDefsByCode: Partial<Record<string, PieceCatalogItem>>,
  pieceDefsByChar: Partial<Record<string, PieceCatalogItem>>,
  promotedPieceDefsByCode: Partial<Record<string, PieceCatalogItem>>,
  trustedBoard?: TrustedBoardEndpoints,
): BoardPiece[] {
  if (move.dropPieceCode) {
    const rawCode = move.dropPieceCode;
    const pieceCode = rawCode.toUpperCase();
    const pieceDef = pieceDefsByCode[pieceCode] ?? pieceDefsByCode[rawCode];
    const tr = normalizeCellIndex(move.toRow) ?? move.toRow;
    const tc = normalizeCellIndex(move.toCol) ?? move.toCol;
    const occupiedHazard = prev.find(
      (p) => p.row === tr && p.col === tc && PERSISTENT_SYNC_GUARD_CHARS.has(p.char),
    );
    if (occupiedHazard) return prev;
    const occupiedByAlly = prev.some((p) => p.row === tr && p.col === tc && p.side === actorSide);
    if (occupiedByAlly) return prev;
    return [
      ...prev,
      {
        side: actorSide,
        row: tr,
        col: tc,
        pieceCode,
        char: pieceCharFromCode(pieceCode, actorSide, false),
        promoted: false,
        imageSignedUrl: pieceDef?.imageSignedUrl ?? null,
      },
    ];
  }
  if (move.fromRow === null || move.fromCol === null) return prev;
  const resolved =
    (trustedBoard &&
      prev.find(
        (p) =>
          p.row === trustedBoard.fromRow && p.col === trustedBoard.fromCol && p.side === actorSide,
      ) && {
        fromRow: trustedBoard.fromRow,
        fromCol: trustedBoard.fromCol,
        toRow: trustedBoard.toRow,
        toCol: trustedBoard.toCol,
        moving: prev.find(
          (p) =>
            p.row === trustedBoard.fromRow &&
            p.col === trustedBoard.fromCol &&
            p.side === actorSide,
        )!,
      }) ||
    resolveBattleMovePlacements(prev, move);
  if (!resolved || resolved.moving.side !== actorSide) return prev;
  const { fromRow, fromCol, toRow, toCol, moving } = resolved;
  if (move.notation === 'giant_2x2_ortho' && isGiantPieceForEngine(moving)) {
    const nToR = normalizeCellIndex(move.toRow) ?? move.toRow;
    const nToC = normalizeCellIndex(move.toCol) ?? move.toCol;
    const destSet = new Set(giantAnchorFootprint(nToR, nToC).map((c) => `${c.row}:${c.col}`));
    return prev
      .filter(
        (p) =>
          !(p.side !== actorSide && destSet.has(`${p.row}:${p.col}`)) &&
          !(p.row === fromRow && p.col === fromCol && p.side === actorSide),
      )
      .concat([
        {
          ...moving,
          row: nToR,
          col: nToC,
          promoted: move.promote ? true : (moving.promoted ?? false),
        },
      ]);
  }
  const targetAtDestination = findPieceAt(prev, toRow, toCol);
  const movingIsHazard = PERSISTENT_SYNC_GUARD_CHARS.has(moving.char);
  if (
    targetAtDestination &&
    targetAtDestination.side === actorSide &&
    PERSISTENT_SYNC_GUARD_CHARS.has(targetAtDestination.char) &&
    !movingIsHazard
  )
    return prev;
  if (targetAtDestination && targetAtDestination.side === actorSide) return prev;
  const resolvedPieceCode = pieceCodeFromPlacement(
    moving.pieceCode ?? null,
    moving.char,
    pieceDefsByChar,
  );
  const codeKey = (resolvedPieceCode ?? moving.pieceCode ?? '').toUpperCase();
  const promoted = move.promote ? true : (moving.promoted ?? false);
  const promotedDef = move.promote ? promotedPieceDefsByCode[codeKey] : null;
  const baseForChar =
    resolvedPieceCode ??
    (moving.pieceCode ? (toBasePieceCode(moving.pieceCode) ?? moving.pieceCode) : null);
  const resolvedChar = baseForChar
    ? pieceCharFromCode(baseForChar, moving.side, promoted)
    : moving.char;
  const char =
    resolvedChar === '?' || (baseForChar != null && resolvedChar === baseForChar)
      ? moving.char
      : resolvedChar;
  const baseForLocalKey = (toBasePieceCode(codeKey) ?? codeKey).toUpperCase();
  const imageSignedUrl =
    move.promote && localPromotedModuleFromBaseCodeCandidates([baseForLocalKey]) != null
      ? null
      : (promotedDef?.imageSignedUrl ?? moving.imageSignedUrl);
  const captureVictim = findPieceAt(prev, toRow, toCol);
  const nextPieces = prev
    .filter((p) => {
      if (p.side === actorSide) return true;
      if (captureVictim && isGiantPieceForEngine(captureVictim)) {
        return !(
          p.side === captureVictim.side &&
          p.row === captureVictim.row &&
          p.col === captureVictim.col &&
          isGiantPieceForEngine(p)
        );
      }
      return !(p.row === toRow && p.col === toCol);
    })
    .map((p) =>
      p.row === fromRow && p.col === fromCol
        ? {
            ...p,
            row: toRow,
            col: toCol,
            pieceCode: baseForChar ?? resolvedPieceCode ?? p.pieceCode,
            promoted,
            imageSignedUrl,
            char,
          }
        : p,
    );
  const movedBird = nextPieces.find(
    (piece) => piece.side === actorSide && piece.row === toRow && piece.col === toCol,
  );
  if (movedBird && isBirdPiece(movedBird)) {
    moveRandomAllyToCellBehindBird({
      pieces: nextPieces,
      actorSide,
      movedBird: { row: toRow, col: toCol },
    });
  }
  return nextPieces;
}
