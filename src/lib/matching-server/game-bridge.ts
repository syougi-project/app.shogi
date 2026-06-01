import { generateLegalMoves } from '@/ai/engine';
import { normalizePieceCatalog } from '@/ai/model';
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
  pieceCharFromCode,
} from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import { formatMatchingSquare, parseMatchingSquare } from '@/lib/matching-server/square';
import { toBasePieceCode } from '@/ai/model/move';
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

export function battleMoveToServerPayload(move: BattleMove, myRole: PlayerSide): MovePayload {
  const rawCode = move.dropPieceCode ?? move.pieceCode;
  const piece = toBasePieceCode(rawCode) ?? rawCode.toUpperCase();
  if (move.dropPieceCode) {
    return {
      to: formatMatchingSquare(move.toRow, move.toCol),
      piece,
      drop: true,
      promote: false,
    };
  }
  return {
    from:
      move.fromRow != null && move.fromCol != null
        ? formatMatchingSquare(move.fromRow, move.fromCol)
        : undefined,
    to: formatMatchingSquare(move.toRow, move.toCol),
    piece,
    promote: move.promote === true,
    drop: false,
  };
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
  const out: Record<string, PieceCatalogItem> = {};
  for (const item of catalog) {
    const code = item.pieceCode?.toUpperCase();
    if (code) out[code] = item;
    const canonicalCode = item.canonicalCode?.toUpperCase();
    if (canonicalCode) out[canonicalCode] = item;
  }
  return out;
}

export function isInteractablePhysicalMove(move: BattleMove): boolean {
  if (move.dropPieceCode) return true;
  if (move.fromRow == null || move.fromCol == null) return false;
  return move.fromRow !== move.toRow || move.fromCol !== move.toCol;
}
