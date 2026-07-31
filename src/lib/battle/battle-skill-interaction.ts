import { toBasePieceCode as toAiBasePieceCode } from '@/ai/model/move';
import type { BoardCell, BoardPiece } from '@/features/stage-shogi/domain/game-rules';
import { CHAR_TO_CODE, CODE_TO_CHAR } from '@/features/stage-shogi/domain/piece-conversion';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

const BOARD_SIZE = 9;

function findPieceAt(placements: BoardPiece[], row: number, col: number): BoardPiece | null {
  return placements.find((p) => p.row === row && p.col === col) ?? null;
}

function pieceCodeFromPlacementLite(
  pieceCode: string | null,
  char: string,
  pieceDefsByChar: Partial<Record<string, PieceCatalogItem>>,
): string | null {
  const opaque = pieceCode && /^piece_[a-z0-9]+$/i.test(pieceCode.trim());
  if (!opaque && pieceCode) {
    return toAiBasePieceCode(pieceCode) ?? pieceCode.toUpperCase();
  }
  const catalogItem = pieceDefsByChar[char];
  if (catalogItem?.pieceCode && !/^piece_[a-z0-9]+$/i.test(catalogItem.pieceCode)) {
    return toAiBasePieceCode(catalogItem.pieceCode) ?? catalogItem.pieceCode;
  }
  const fromKanji = CHAR_TO_CODE[char];
  if (fromKanji) return toAiBasePieceCode(fromKanji) ?? fromKanji;
  if (pieceCode && !opaque) return toAiBasePieceCode(pieceCode) ?? pieceCode;
  return pieceCode;
}

export type TimeActionMode = 'skill' | 'normal';

export function isPhysicalBattleMove(move: BattleMove): boolean {
  const notation = typeof move.notation === 'string' ? move.notation : '';
  if (notation === 'time_skill_only' || notation === 'house_skill_only') return false;
  if (move.dropPieceCode) return true;
  if (move.fromRow == null || move.fromCol == null) return false;
  return move.fromRow !== move.toRow || move.fromCol !== move.toCol;
}

export function filterActionableMoves(moves: BattleMove[]): BattleMove[] {
  return moves.filter((m) => m.notation !== 'house_skill_only');
}

export function normalizeKanjiForSkillId(ch: string): string {
  if (!ch) return ch;
  try {
    return ch.normalize('NFKC');
  } catch {
    return ch;
  }
}

export function isPlayerHousePieceForSkillUi(
  piece: BoardPiece,
  pieceDefsByChar: Partial<Record<string, PieceCatalogItem>>,
): boolean {
  if (piece.side !== 'player') return false;
  const charN = normalizeKanjiForSkillId(piece.char);
  const resolved = pieceCodeFromPlacementLite(
    piece.pieceCode ?? null,
    piece.char,
    pieceDefsByChar,
  )?.toUpperCase();
  const pc = piece.pieceCode?.toUpperCase() ?? '';
  if (resolved === 'HOUSE' || pc === 'HOUSE') return true;
  if (piece.char === '家' || charN === '家') return true;
  if (CHAR_TO_CODE[piece.char] === 'HOUSE' || CHAR_TO_CODE[charN] === 'HOUSE') return true;
  if (normalizeKanjiForSkillId(piece.char) === '家') return true;
  const stripped = (toAiBasePieceCode(pc) ?? pc).toUpperCase();
  if (stripped === 'HOUSE') return true;
  if (CODE_TO_CHAR[stripped] === '家') return true;
  return false;
}

export function countPeopleOnBoardUi(
  board: BoardPiece[],
  pieceDefsByChar: Partial<Record<string, PieceCatalogItem>>,
): number {
  return board.filter((p) => {
    const c = pieceCodeFromPlacementLite(
      p.pieceCode ?? null,
      p.char,
      pieceDefsByChar,
    )?.toUpperCase();
    const ch = normalizeKanjiForSkillId(p.char);
    return (
      c === 'PEOPLE' ||
      p.char === '民' ||
      ch === '民' ||
      CHAR_TO_CODE[p.char] === 'PEOPLE' ||
      CHAR_TO_CODE[ch] === 'PEOPLE'
    );
  }).length;
}

export function isTimePiece(piece: BoardPiece): boolean {
  return (piece.pieceCode?.toUpperCase() ?? '') === 'TIME' || piece.char === '時';
}

export function buildTimeSkillOnlyMove(cell: BoardCell, piece: BoardPiece): BattleMove {
  return {
    fromRow: cell.row,
    fromCol: cell.col,
    toRow: cell.row,
    toCol: cell.col,
    pieceCode: (piece.pieceCode ?? 'TIME').toUpperCase(),
    promote: false,
    dropPieceCode: null,
    capturedPieceCode: null,
    notation: 'time_skill_only',
  };
}

export function buildHouseSkillOnlyMove(cell: BoardCell, piece: BoardPiece): BattleMove {
  return {
    fromRow: cell.row,
    fromCol: cell.col,
    toRow: cell.row,
    toCol: cell.col,
    pieceCode: (piece.pieceCode ?? 'HOUSE').toUpperCase(),
    promote: false,
    dropPieceCode: null,
    capturedPieceCode: null,
    notation: 'house_skill_only',
  };
}

export function applyTimeActionNotation(
  move: BattleMove,
  timeActionMode: TimeActionMode | null,
  isTimeSelected: boolean,
): BattleMove {
  if (!isTimeSelected || !timeActionMode) return move;
  if (timeActionMode === 'normal') return { ...move, notation: null };
  return { ...move, notation: 'time_skill' };
}

export type SatoriPickState = {
  moves: BattleMove[];
  targetCells: BoardCell[];
};

export function resolveSatoriEnemyPick(actionableMoves: BattleMove[]): SatoriPickState | null {
  const stunVariants = actionableMoves.filter(
    (m) => typeof m.notation === 'string' && /^satori_stun:\d+:\d+$/i.test(m.notation),
  );
  if (stunVariants.length <= 1) return null;
  const targetCells = stunVariants.map((mv) => {
    const matched = /^satori_stun:(\d+):(\d+)$/i.exec(mv.notation!);
    if (!matched) return { row: mv.toRow, col: mv.toCol };
    return { row: Number(matched[1]), col: Number(matched[2]) };
  });
  return { moves: stunVariants, targetCells };
}

export function findSatoriMoveAt(moves: BattleMove[], row: number, col: number): BattleMove | null {
  return (
    moves.find((mv) => {
      const p = /^satori_stun:(\d+):(\d+)$/i.exec(mv.notation ?? '');
      return p != null && Number(p[1]) === row && Number(p[2]) === col;
    }) ?? null
  );
}

/**
 * 悟スキル選択中のマス入力。
 * - スタン対象の敵マス → その表記で確定
 * - 移動先（捕獲マス含む）→ 先頭バリアントで確定（捕獲マスは対象外のため誤タップで固まらない）
 * - それ以外 → キャンセル（着手は確定しない）
 */
export function resolvePendingSatoriCellPress(
  pendingMoves: BattleMove[],
  row: number,
  col: number,
): { kind: 'commit'; move: BattleMove } | { kind: 'cancel' } | { kind: 'ignore' } {
  if (pendingMoves.length === 0) return { kind: 'ignore' };
  const matchedStun = findSatoriMoveAt(pendingMoves, row, col);
  if (matchedStun) return { kind: 'commit', move: matchedStun };
  const sample = pendingMoves[0]!;
  if (row === sample.toRow && col === sample.toCol) {
    return { kind: 'commit', move: sample };
  }
  return { kind: 'cancel' };
}

export type HeartPickState = {
  moves: BattleMove[];
  targetCells: BoardCell[];
};

export function resolveHeartAllyPick(actionableMoves: BattleMove[]): HeartPickState | null {
  const protectVariants = actionableMoves.filter(
    (m) => typeof m.notation === 'string' && /^heart_protect:\d+:\d+$/i.test(m.notation),
  );
  if (protectVariants.length <= 1) return null;
  const targetCells = protectVariants.map((mv) => {
    const matched = /^heart_protect:(\d+):(\d+)$/i.exec(mv.notation!);
    if (!matched) return { row: mv.toRow, col: mv.toCol };
    return { row: Number(matched[1]), col: Number(matched[2]) };
  });
  return { moves: protectVariants, targetCells };
}

export function findHeartMoveAt(moves: BattleMove[], row: number, col: number): BattleMove | null {
  return (
    moves.find((mv) => {
      const p = /^heart_protect:(\d+):(\d+)$/i.exec(mv.notation ?? '');
      return p != null && Number(p[1]) === row && Number(p[2]) === col;
    }) ?? null
  );
}

export function pieceDefsByCharFromCatalog(
  catalog: PieceCatalogItem[],
): Record<string, PieceCatalogItem> {
  return Object.fromEntries(catalog.map((item) => [item.char, item])) as Record<
    string,
    PieceCatalogItem
  >;
}

export function hasAdjacentEnemyPiece(
  pieces: BoardPiece[],
  centerRow: number,
  centerCol: number,
): boolean {
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const row = centerRow + dr;
      const col = centerCol + dc;
      if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) continue;
      if (findPieceAt(pieces, row, col)?.side === 'enemy') return true;
    }
  }
  return false;
}
