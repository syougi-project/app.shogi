import { applyMove, generateLegalMoves } from '@/ai/engine';
import {
  normalizeBattleGameStatus,
  normalizeBattlePosition,
  normalizePieceCatalog,
  piecesFromBoardState,
  type AiBattleGameStatus,
  type AiBattlePosition,
  type AiPieceDefinition,
} from '@/ai/model';
import { buildPieceLookups } from '@/ai/model/piece';
import type { MatchingGameState, PlayerSide } from '@/domain/matching-server/protocol';
import {
  canonicalToMatchingWire,
  injectSkillDefinitionsIntoPosition,
  isMyTurnInCanonical,
  matchingWireToCanonicalPosition,
  piecesForDisplay,
  handsForDisplay,
} from '@/lib/matching-server/canonical-game';
import { battleMoveToServerPayload } from '@/lib/matching-server/game-bridge';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';
import {
  normalizeBoardPieceForDisplay,
  type BoardPiece as UiBoardPiece,
} from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

export type OnlineBattleGameRecord = {
  matchId: string;
  myRole: PlayerSide;
  pieceCatalog: AiPieceDefinition[];
  displayPieceCatalog: PieceCatalogItem[];
  position: AiBattlePosition;
  game: AiBattleGameStatus;
};

const games = new Map<string, OnlineBattleGameRecord>();

export function setOnlineBattlePieceCatalog(items: PieceCatalogItem[]) {
  for (const record of games.values()) {
    record.pieceCatalog = normalizePieceCatalog(items);
    record.displayPieceCatalog = items;
  }
}

export function createOnlineBattleGame(input: {
  matchId: string;
  myRole: PlayerSide;
  wire: MatchingGameState;
  pieceCatalog: PieceCatalogItem[];
}): OnlineBattleGameRecord {
  const pieceCatalog = normalizePieceCatalog(input.pieceCatalog);
  const position = matchingWireToCanonicalPosition(input.wire, pieceCatalog);
  const record: OnlineBattleGameRecord = {
    matchId: input.matchId,
    myRole: input.myRole,
    pieceCatalog,
    displayPieceCatalog: input.pieceCatalog,
    position,
    game: { status: 'in_progress', result: null, winnerSide: null },
  };
  games.set(input.matchId, record);
  return record;
}

export function getOnlineBattleGame(matchId: string): OnlineBattleGameRecord | null {
  return games.get(matchId) ?? null;
}

export function updateOnlineBattleGame(
  matchId: string,
  updater: (current: OnlineBattleGameRecord) => OnlineBattleGameRecord,
): OnlineBattleGameRecord | null {
  const current = games.get(matchId);
  if (!current) return null;
  const next = updater(current);
  games.set(matchId, next);
  return next;
}

export function removeOnlineBattleGame(matchId: string) {
  games.delete(matchId);
}

export function applyOnlineBattleMove(input: { matchId: string; move: BattleMove }) {
  const record = games.get(input.matchId);
  if (!record) {
    throw new Error(`online battle game not found: ${input.matchId}`);
  }
  const committed = applyMove({
    position: record.position,
    pieceCatalog: record.pieceCatalog,
    move: input.move,
  });
  const next: OnlineBattleGameRecord = {
    ...record,
    position: normalizeBattlePosition(committed.position),
    game: normalizeBattleGameStatus(committed.game),
  };
  games.set(input.matchId, next);
  return {
    committed,
    record: next,
    wire: canonicalToMatchingWire(next.position),
    payload: battleMoveToServerPayload(input.move, record.myRole),
  };
}

export function getMyLegalMoves(matchId: string): BattleMove[] {
  const record = games.get(matchId);
  if (!record) return [];
  if (!isMyTurnInCanonical(record.myRole, record.position)) return [];
  const legal = generateLegalMoves({
    position: record.position,
    pieceCatalog: record.pieceCatalog,
  });
  return legal.legalMoves;
}

export function getBoardPieces(matchId: string) {
  const record = games.get(matchId);
  if (!record) return [];
  return piecesFromBoardState(record.position);
}

export function getDisplayBoardPieces(matchId: string): UiBoardPiece[] {
  const record = games.get(matchId);
  if (!record) return [];
  const { pieceDefsByChar } = buildPieceLookups(normalizePieceCatalog(record.displayPieceCatalog));
  return piecesForDisplay(piecesFromBoardState(record.position), record.myRole).map((piece) =>
    normalizeBoardPieceForDisplay(
      {
        ...piece,
        imageSignedUrl: null,
      },
      pieceDefsByChar,
    ),
  );
}

export function getDisplayHands(matchId: string) {
  const record = games.get(matchId);
  if (!record) return { player: {}, enemy: {} };
  return handsForDisplay(record.position.hands, record.myRole);
}

export function syncFromServerWire(input: {
  matchId: string;
  myRole: PlayerSide;
  wire: MatchingGameState;
  pieceCatalog: PieceCatalogItem[];
  game?: AiBattleGameStatus;
}) {
  const pieceCatalog = normalizePieceCatalog(input.pieceCatalog);
  const position = input.wire.canonicalState
    ? injectSkillDefinitionsIntoPosition(
        normalizeBattlePosition(input.wire.canonicalState as AiBattlePosition),
        input.pieceCatalog,
      )
    : matchingWireToCanonicalPosition(input.wire, pieceCatalog);
  const existing = games.get(input.matchId);
  const record: OnlineBattleGameRecord = {
    matchId: input.matchId,
    myRole: input.myRole,
    pieceCatalog,
    displayPieceCatalog: input.pieceCatalog,
    position,
    game: input.game ?? existing?.game ?? { status: 'in_progress', result: null, winnerSide: null },
  };
  games.set(input.matchId, record);
  return record;
}
