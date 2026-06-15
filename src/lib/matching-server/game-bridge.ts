import { generateLegalMoves } from '@/ai/engine';
import { normalizePieceCatalog } from '@/ai/model';
import { toBasePieceCode } from '@/ai/model/move';
import { buildPieceLookups } from '@/ai/model/piece';
import type { AiBattlePosition } from '@/ai/model';
import type { MovePayload, MatchingGameState, PlayerSide } from '@/domain/matching-server/protocol';
import {
  createEmptyHandsState,
  type BoardPiece,
  type HandsState,
  type Side,
} from '@/features/stage-shogi/domain/game-rules';
import {
  buildBoardState,
  handKeyToDisplayPieceCode,
  pieceCharFromCode,
} from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import { formatMatchingSquare, parseMatchingSquare } from '@/lib/matching-server/square';
import { normalizeWirePieceCode } from '@/lib/matching-server/piece-display';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

export type MatchingBattleContext = {
  pieces: BoardPiece[];
  hands: HandsState;
  sideToMove: Side;
  position: AiBattlePosition;
  playerLegalMoves: BattleMove[];
};

function oppositeRole(role: PlayerSide): PlayerSide {
  return role === 'black' ? 'white' : 'black';
}

export function decodeEncodedBoardPiece(encoded: string): {
  serverSide: PlayerSide;
  code: string;
  promoted: boolean;
} {
  const [sideRaw, restRaw] = encoded.split(':');
  const serverSide: PlayerSide = sideRaw === 'white' ? 'white' : 'black';
  const rest = restRaw ?? '';
  const promoted = rest.endsWith('+');
  const code = (promoted ? rest.slice(0, -1) : rest).trim().toUpperCase();
  return { serverSide, code, promoted };
}

export function mapServerSideToUiSide(serverSide: PlayerSide, myRole: PlayerSide): Side {
  return serverSide === myRole ? 'player' : 'enemy';
}

export function mapUiSideToServerSide(uiSide: Side, myRole: PlayerSide): PlayerSide {
  return uiSide === 'player' ? myRole : oppositeRole(myRole);
}

export function matchingGameToBoardPieces(
  game: MatchingGameState,
  myRole: PlayerSide,
): BoardPiece[] {
  const pieces: BoardPiece[] = [];
  for (const [square, encoded] of Object.entries(game.board)) {
    const { serverSide, code, promoted } = decodeEncodedBoardPiece(encoded);
    const { row, col } = parseMatchingSquare(square);
    const side = mapServerSideToUiSide(serverSide, myRole);
    pieces.push({
      row,
      col,
      side,
      pieceCode: code,
      char: pieceCharFromCode(code, side, promoted),
      promoted,
      imageSignedUrl: null,
    });
  }
  return pieces;
}

export function matchingGameToHands(game: MatchingGameState, myRole: PlayerSide): HandsState {
  const hands = createEmptyHandsState();
  const enemyRole = oppositeRole(myRole);
  for (const [code, count] of Object.entries(game.hands[myRole] ?? {})) {
    if (count > 0) hands.player[code.toUpperCase()] = count;
  }
  for (const [code, count] of Object.entries(game.hands[enemyRole] ?? {})) {
    if (count > 0) hands.enemy[code.toUpperCase()] = count;
  }
  return hands;
}

export function buildMatchingBattleContext(input: {
  game: MatchingGameState;
  myRole: PlayerSide;
  pieceCatalog: PieceCatalogItem[];
  pieceDefsByCode: Record<string, PieceCatalogItem>;
}): MatchingBattleContext {
  const pieces = matchingGameToBoardPieces(input.game, input.myRole);
  const hands = matchingGameToHands(input.game, input.myRole);
  const sideToMove: Side = input.game.turn === input.myRole ? 'player' : 'enemy';
  const position: AiBattlePosition = {
    sideToMove,
    turnNumber: 1,
    moveCount: 0,
    sfen: 'online-match',
    stateHash: `v${input.game.version}`,
    boardState: buildBoardState(pieces, input.pieceDefsByCode),
    hands,
  };
  const catalog = normalizePieceCatalog(input.pieceCatalog);
  const legal = generateLegalMoves({ position, pieceCatalog: catalog });
  const playerLegalMoves = sideToMove === 'player' ? legal.legalMoves : [];
  return { pieces, hands, sideToMove, position, playerLegalMoves };
}

/** wire 盤面キー（USI 風座標）を大文字小文字無視で引く */
export function lookupWireBoardEncoded(
  board: Record<string, string>,
  square: string,
): string | undefined {
  const normalized = square.trim().toLowerCase();
  if (board[normalized]) return board[normalized];
  for (const [key, value] of Object.entries(board)) {
    if (key.trim().toLowerCase() === normalized) return value;
  }
  return undefined;
}

export function findEncodedBoardPieceAt(
  wire: Pick<MatchingGameState, 'board'>,
  myRole: PlayerSide,
  row: number,
  col: number,
): { square: string; code: string } | null {
  const square = formatMatchingSquare(row, col).toLowerCase();
  const encoded = lookupWireBoardEncoded(wire.board, square);
  if (!encoded) return null;
  const decoded = decodeEncodedBoardPiece(encoded);
  if (decoded.serverSide !== myRole) return null;
  return { square, code: decoded.code };
}

/** サーバー wire 上で着手 payload を組み立て可能な手だけ残す */
export function filterBattleMovesForServerWire(
  moves: BattleMove[],
  wire: Pick<MatchingGameState, 'board' | 'hands'>,
  myRole: PlayerSide,
  catalog?: readonly PieceCatalogItem[],
): BattleMove[] {
  return moves.filter((move) => {
    try {
      battleMoveToServerPayload(move, myRole, wire, catalog);
      return true;
    } catch {
      return false;
    }
  });
}

/** マッチングサーバーが盤面・持ち駒に使う piece コードと UI 側コードが一致するか */
export function serverPieceCodesEquivalent(left: string, right: string): boolean {
  const a = normalizeWirePieceCode(left.trim().toUpperCase());
  const b = normalizeWirePieceCode(right.trim().toUpperCase());
  if (a === b) return true;
  const stripPiecePrefix = (code: string) =>
    code.startsWith('PIECE_') && !/^PIECE_[0-9A-F]{8,}$/i.test(code)
      ? code.slice('PIECE_'.length)
      : code;
  return stripPiecePrefix(a) === stripPiecePrefix(b);
}

function handPieceCodesEquivalent(
  left: string,
  right: string,
  catalog?: readonly PieceCatalogItem[],
): boolean {
  if (serverPieceCodesEquivalent(left, right)) return true;
  const leftBase = toBasePieceCode(left.trim().toUpperCase());
  const rightBase = toBasePieceCode(right.trim().toUpperCase());
  if (leftBase && rightBase && leftBase === rightBase) return true;
  if (!catalog) return false;
  const leftDisplay = handKeyToDisplayPieceCode(left, catalog).toUpperCase();
  const rightDisplay = handKeyToDisplayPieceCode(right, catalog).toUpperCase();
  if (leftDisplay === rightDisplay) return true;
  if (leftBase && leftDisplay === rightBase) return true;
  if (rightBase && rightDisplay === leftBase) return true;
  return false;
}

function findHandBagKey(
  bag: Record<string, number>,
  pieceCode: string,
  catalog?: readonly PieceCatalogItem[],
): string | null {
  const want = pieceCode.trim().toUpperCase();
  if ((bag[want] ?? 0) > 0) return want;
  for (const [key, count] of Object.entries(bag)) {
    if (count > 0 && handPieceCodesEquivalent(key, want, catalog)) {
      return key.toUpperCase();
    }
  }
  return null;
}

/** サーバー wire 上の盤面/持ち駒キーを優先して move.piece を決める（toBasePieceCode による不一致を防ぐ） */
export function resolveServerMovePieceCode(
  move: BattleMove,
  myRole: PlayerSide,
  wire?: Pick<MatchingGameState, 'board' | 'hands'>,
  catalog?: readonly PieceCatalogItem[],
): string {
  if (move.dropPieceCode) {
    const bag = wire?.hands?.[myRole];
    if (bag) {
      const resolved = findHandBagKey(bag, move.dropPieceCode, catalog);
      if (resolved) return resolved;
      throw new Error('サーバー持ち駒と打ち駒が一致しません。再接続してください。');
    }
    return move.dropPieceCode.trim().toUpperCase();
  }

  if (move.fromRow != null && move.fromCol != null && wire?.board) {
    const at = findEncodedBoardPieceAt(wire, myRole, move.fromRow, move.fromCol);
    if (!at) {
      throw new Error('サーバー盤面と着手が一致しません。再接続してください。');
    }
    return at.code;
  }

  const rawCode = move.dropPieceCode ?? move.pieceCode;
  return (rawCode ?? 'FU').trim().toUpperCase();
}

export function battleMoveToServerPayload(
  move: BattleMove,
  myRole: PlayerSide,
  wire?: Pick<MatchingGameState, 'board' | 'hands'>,
  catalog?: readonly PieceCatalogItem[],
): MovePayload {
  const piece = resolveServerMovePieceCode(move, myRole, wire, catalog);
  const to = formatMatchingSquare(move.toRow, move.toCol).toLowerCase();
  if (move.dropPieceCode) {
    return {
      to,
      piece,
      drop: true,
      promote: false,
    };
  }
  if (move.fromRow == null || move.fromCol == null) {
    throw new Error('盤上の着手に移動元がありません');
  }
  const from = formatMatchingSquare(move.fromRow, move.fromCol).toLowerCase();
  const payload: MovePayload = {
    from,
    to,
    piece,
    promote: move.promote === true,
    drop: false,
  };
  if (move.notation) {
    payload.notation = move.notation;
  }
  return payload;
}

/** 表示用に盤を180度回転（後手プレイヤー向け） */
export function toViewCoord(
  row: number,
  col: number,
  myRole: PlayerSide,
): { row: number; col: number } {
  if (myRole === 'white') {
    return { row: 8 - row, col: 8 - col };
  }
  return { row, col };
}

export function fromViewCoord(
  viewRow: number,
  viewCol: number,
  myRole: PlayerSide,
): { row: number; col: number } {
  if (myRole === 'white') {
    return { row: 8 - viewRow, col: 8 - viewCol };
  }
  return { row: viewRow, col: viewCol };
}

export function catalogDefsByCode(catalog: PieceCatalogItem[]): Record<string, PieceCatalogItem> {
  return buildPieceLookups(normalizePieceCatalog(catalog)).pieceDefsByCode;
}

export function isInteractablePhysicalMove(move: BattleMove): boolean {
  if (move.dropPieceCode) return true;
  if (move.fromRow == null || move.fromCol == null) return false;
  return move.fromRow !== move.toRow || move.fromCol !== move.toCol;
}
