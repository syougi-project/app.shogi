import { buildBoardState } from '@/ai/engine/shared';
import { assembleSkillDefinitionsV2ForSession } from '@/ai/engine/session-skill-definitions-v2';
import { normalizePieceCatalog, type AiBattlePosition } from '@/ai/model';
import { buildPieceLookups } from '@/ai/model/piece';
import type { MatchingGameState, PlayerSide } from '@/domain/matching-server/protocol';
import {
  createEmptyHandsState,
  type BoardPiece,
  type Side,
} from '@/features/stage-shogi/domain/game-rules';
import { resolveWirePieceChar } from '@/lib/matching-server/piece-display';
import { normalizeSkillPieceCode } from '@/lib/matching-server/skill-piece-code';
import { formatMatchingSquare, parseMatchingSquare } from '@/lib/matching-server/square';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

/** 正典局面では常に先手(black)=player, 後手(white)=enemy */
export function serverSideToCanonicalSide(serverSide: PlayerSide): Side {
  return serverSide === 'black' ? 'player' : 'enemy';
}

export function canonicalSideToServerSide(side: Side): PlayerSide {
  return side === 'player' ? 'black' : 'white';
}

function decodeEncodedBoardPiece(encoded: string): {
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

export function matchingWireToCanonicalPosition(
  wire: MatchingGameState,
  pieceCatalog: PieceCatalogItem[],
): AiBattlePosition {
  const catalog = normalizePieceCatalog(pieceCatalog);
  const { pieceDefsByCode } = buildPieceLookups(catalog);

  const pieces: BoardPiece[] = [];
  for (const [square, encoded] of Object.entries(wire.board)) {
    const { serverSide, code, promoted } = decodeEncodedBoardPiece(encoded);
    const { row, col } = parseMatchingSquare(square);
    const side = serverSideToCanonicalSide(serverSide);
    const displayChar = resolveWirePieceChar(code, side, promoted, pieceDefsByCode);
    pieces.push({
      row,
      col,
      side,
      pieceCode: normalizeSkillPieceCode(code, displayChar),
      char: displayChar,
      promoted,
    });
  }

  const hands = createEmptyHandsState();
  for (const [code, count] of Object.entries(wire.hands.black ?? {})) {
    if (count > 0) hands.player[code.toUpperCase()] = count;
  }
  for (const [code, count] of Object.entries(wire.hands.white ?? {})) {
    if (count > 0) hands.enemy[code.toUpperCase()] = count;
  }

  const position: AiBattlePosition = {
    sideToMove: serverSideToCanonicalSide(wire.turn),
    turnNumber: Math.max(1, wire.version),
    moveCount: Math.max(0, wire.version - 1),
    sfen: 'online-match',
    stateHash: `v${wire.version}`,
    boardState: buildBoardState(pieces, pieceDefsByCode),
    hands,
  };
  if (wire.skillState) {
    position.boardState = {
      ...(position.boardState as Record<string, unknown>),
      skill_state: serverSkillStateToCanonical(wire.skillState),
    };
  }

  return injectSkillDefinitionsIntoPosition(position, pieceCatalog);
}

export function injectSkillDefinitionsIntoPosition(
  position: AiBattlePosition,
  pieceCatalog: PieceCatalogItem[],
): AiBattlePosition {
  const { pieceDefsByCode } = buildPieceLookups(normalizePieceCatalog(pieceCatalog));
  const assembled = assembleSkillDefinitionsV2ForSession(pieceDefsByCode);
  const boardState = { ...(position.boardState as Record<string, unknown>) };
  boardState.skill_definitions_v2 = assembled;
  return { ...position, boardState };
}

export function canonicalToMatchingWire(position: AiBattlePosition): MatchingGameState {
  const boardState = position.boardState as {
    pieces?: BoardPiece[];
    skill_state?: MatchingGameState['skillState'];
  };
  const pieces = boardState.pieces ?? [];
  const board: Record<string, string> = {};
  for (const piece of pieces) {
    const square = formatMatchingSquare(piece.row, piece.col);
    const serverSide = canonicalSideToServerSide(piece.side);
    const code = piece.pieceCode ?? 'FU';
    board[square] = `${serverSide}:${code}${piece.promoted ? '+' : ''}`;
  }

  const hands: MatchingGameState['hands'] = {
    black: { ...position.hands.player },
    white: { ...position.hands.enemy },
  };

  return {
    version: Math.max(1, position.moveCount + 1),
    turn: canonicalSideToServerSide(position.sideToMove),
    board,
    hands,
    skillState: canonicalSkillStateToServer(boardState.skill_state),
  };
}

function serverSkillStateToCanonical(
  skillState: NonNullable<MatchingGameState['skillState']>,
): NonNullable<MatchingGameState['skillState']> {
  return mapSkillStateSides(skillState, serverSideValueToCanonical);
}

function canonicalSkillStateToServer(raw: unknown): MatchingGameState['skillState'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return mapSkillStateSides(
    raw as NonNullable<MatchingGameState['skillState']>,
    canonicalSideValueToServer,
  );
}

function mapSkillStateSides(
  skillState: NonNullable<MatchingGameState['skillState']>,
  mapper: (value: unknown) => unknown,
): NonNullable<MatchingGameState['skillState']> {
  return {
    board_hazards: mapSkillEntries(skillState.board_hazards, mapper),
    board_arrow_tiles: mapSkillEntries(skillState.board_arrow_tiles, mapper),
    movement_modifiers: mapSkillEntries(skillState.movement_modifiers, mapper),
    piece_statuses: mapSkillEntries(skillState.piece_statuses, mapper),
    piece_defenses: mapSkillEntries(skillState.piece_defenses, mapper),
  };
}

function mapSkillEntries(
  entries: Record<string, unknown>[] | undefined,
  mapper: (value: unknown) => unknown,
): Record<string, unknown>[] {
  return (entries ?? []).map((entry) => ({
    ...entry,
    side: mapper(entry.side),
    affects_side: mapper(entry.affects_side),
    affectsSide: mapper(entry.affectsSide),
  }));
}

function serverSideValueToCanonical(value: unknown): unknown {
  if (value === 'black') return 'player';
  if (value === 'white') return 'enemy';
  return value;
}

function canonicalSideValueToServer(value: unknown): unknown {
  if (value === 'player') return 'black';
  if (value === 'enemy') return 'white';
  return value;
}

export function isMyTurnInCanonical(myRole: PlayerSide, position: AiBattlePosition): boolean {
  return canonicalSideToServerSide(position.sideToMove) === myRole;
}

/** UI 表示用: 自分の駒を player 側として見せる */
export function piecesForDisplay(pieces: BoardPiece[], myRole: PlayerSide): BoardPiece[] {
  if (myRole === 'black') return pieces;
  return pieces.map((piece) => ({
    ...piece,
    side: piece.side === 'player' ? 'enemy' : 'player',
  }));
}

export function handsForDisplay(
  hands: { player: Record<string, number>; enemy: Record<string, number> },
  myRole: PlayerSide,
) {
  if (myRole === 'black') return hands;
  return { player: hands.enemy, enemy: hands.player };
}
