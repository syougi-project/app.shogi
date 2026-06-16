import { applyMove, generateLegalMoves } from '@/ai/engine';
import { mapPiecesForSpringDragonAwakeningDisplay } from '@/ai/engine/spring-ryu-awakening';
import { applyOnlineBattleSkillDisplayToPieces } from '@/features/online-battle/lib/online-battle-display-pieces';
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
  resolveOnlineBattlePositionFromWire,
} from '@/lib/matching-server/canonical-game';
import { resolveWinnerSideFromWire } from '@/lib/matching-server/online-battle-outcome';
import { preparePieceCatalogForBattleAndDisplay } from '@/features/piece-info/lib/piece-catalog-display';
import { buildPromotedPieceDefsByCode } from '@/lib/battle/battle-move-audio';
import { battleMoveToServerPayload } from '@/lib/matching-server/game-bridge';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';
import {
  getDisplayChar,
  normalizeBoardPieceForDisplay,
  pieceCharFromCode,
  preferBundledPromotedImageOverRemoteUrl,
  remapHandsStateToDisplayPieceCodes,
  type BoardPiece as UiBoardPiece,
} from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import { normalizeHandsStateKeys } from '@/features/stage-shogi/domain/game-rules';
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

function normalizeEnginePieceCatalog(items: PieceCatalogItem[]): AiPieceDefinition[] {
  return normalizePieceCatalog(preparePieceCatalogForBattleAndDisplay(items));
}

export function setOnlineBattlePieceCatalog(
  engineCatalog: PieceCatalogItem[],
  displayCatalog?: PieceCatalogItem[],
) {
  const display = displayCatalog ?? engineCatalog;
  for (const record of games.values()) {
    record.pieceCatalog = normalizeEnginePieceCatalog(engineCatalog);
    record.displayPieceCatalog = display;
    record.position = injectSkillDefinitionsIntoPosition(record.position, display);
  }
}

export function createOnlineBattleGame(input: {
  matchId: string;
  myRole: PlayerSide;
  wire: MatchingGameState;
  pieceCatalog: PieceCatalogItem[];
  displayPieceCatalog?: PieceCatalogItem[];
}): OnlineBattleGameRecord {
  const pieceCatalog = normalizeEnginePieceCatalog(input.pieceCatalog);
  const displayPieceCatalog = input.displayPieceCatalog ?? input.pieceCatalog;
  const position = resolveOnlineBattlePositionFromWire(input.wire, displayPieceCatalog);
  const record: OnlineBattleGameRecord = {
    matchId: input.matchId,
    myRole: input.myRole,
    pieceCatalog,
    displayPieceCatalog,
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

export function applyOnlineBattleMove(input: {
  matchId: string;
  move: BattleMove;
  serverWire?: MatchingGameState;
}) {
  const record = games.get(input.matchId);
  if (!record) {
    throw new Error(`online battle game not found: ${input.matchId}`);
  }
  const committed = applyMove({
    position: record.position,
    pieceCatalog: record.pieceCatalog,
    move: input.move,
    options: { suppressRandomSkillProcs: true },
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
    payload: battleMoveToServerPayload(
      input.move,
      record.myRole,
      input.serverWire,
      record.displayPieceCatalog,
    ),
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
  const catalog = normalizePieceCatalog(record.displayPieceCatalog);
  const { pieceDefsByChar } = buildPieceLookups(catalog);
  const promotedPieceDefsByCode = buildPromotedPieceDefsByCode(
    record.displayPieceCatalog,
    pieceDefsByChar,
  );
  const canonicalPieces = piecesFromBoardState(record.position);
  const withSpringDisplay = mapPiecesForSpringDragonAwakeningDisplay(
    canonicalPieces.map((piece) => {
      const normalized = normalizeBoardPieceForDisplay(
        {
          ...piece,
          imageSignedUrl: null,
        },
        pieceDefsByChar,
      );
      const codeKey = normalized.pieceCode?.toUpperCase() ?? '';
      const promotedDef = normalized.promoted ? promotedPieceDefsByCode[codeKey] : undefined;
      const displayChar =
        normalized.promoted && codeKey
          ? pieceCharFromCode(codeKey, normalized.side, true)
          : getDisplayChar(normalized);
      return {
        ...normalized,
        char: displayChar,
        imageSignedUrl: preferBundledPromotedImageOverRemoteUrl(
          codeKey || null,
          Boolean(normalized.promoted),
          promotedDef?.imageSignedUrl ?? null,
        ),
      };
    }),
    pieceDefsByChar,
  );
  const withDarkVeil = applyOnlineBattleSkillDisplayToPieces(withSpringDisplay, record.position);
  return piecesForDisplay(withDarkVeil, record.myRole);
}

export function getDisplayHands(matchId: string) {
  const record = games.get(matchId);
  if (!record) return { player: {}, enemy: {} };
  const catalog = record.displayPieceCatalog;
  const remapped = remapHandsStateToDisplayPieceCodes(
    normalizeHandsStateKeys(record.position.hands),
    catalog,
  );
  return handsForDisplay(remapped, record.myRole);
}

export function syncFromServerWire(input: {
  matchId: string;
  myRole: PlayerSide;
  wire: MatchingGameState;
  pieceCatalog: PieceCatalogItem[];
  displayPieceCatalog?: PieceCatalogItem[];
  game?: AiBattleGameStatus;
}) {
  const pieceCatalog = normalizeEnginePieceCatalog(input.pieceCatalog);
  const displayPieceCatalog = input.displayPieceCatalog ?? input.pieceCatalog;
  const position = resolveOnlineBattlePositionFromWire(input.wire, displayPieceCatalog);
  const existing = games.get(input.matchId);
  const winnerFromWire = resolveWinnerSideFromWire(input.wire, input.myRole);
  const resolvedGame =
    input.game ??
    (winnerFromWire
      ? {
          status: 'finished' as const,
          result: winnerFromWire === 'player' ? ('player_win' as const) : ('enemy_win' as const),
          winnerSide: winnerFromWire,
        }
      : (existing?.game ?? { status: 'in_progress' as const, result: null, winnerSide: null }));
  const record: OnlineBattleGameRecord = {
    matchId: input.matchId,
    myRole: input.myRole,
    pieceCatalog,
    displayPieceCatalog,
    position,
    game: resolvedGame,
  };
  games.set(input.matchId, record);
  return record;
}
