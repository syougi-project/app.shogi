import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ONLINE_PVP_TURN_SECONDS } from '@/constants/online-battle';

import { applyMove } from '@/ai/engine';
import type { SkillVisualEffect } from '@/domain/battle/skill-visual-effect';
import type {
  MatchingGameState,
  PlayerSide,
  WebSocketServerMessage,
} from '@/domain/matching-server/protocol';
import { useAuthSession } from '@/hooks/common/auth-session-context';
import { OnlineMatchApiDataSource } from '@/infra/datasources/online-match-datasource';
import { getMatchingServerClient } from '@/infra/matching-server/matching-server-client';
import { boardPiecesFromState, handSummary } from '@/lib/matching-server/board-view';
import {
  battleMoveToServerPayload,
  catalogDefsByCode,
  filterBattleMovesForServerWire,
  fromViewCoord,
} from '@/lib/matching-server/game-bridge';
import { canonicalToMatchingWire, isMyTurnInCanonical } from '@/lib/matching-server/canonical-game';
import { parseMatchingSquare } from '@/lib/matching-server/square';
import { buildFireHandSkillFxFromWireHandsDiff } from '@/lib/matching-server/online-skill-hand-fx';
import { buildStunSkillFxFromWireSkillStateDiff } from '@/lib/matching-server/online-skill-stun-fx';
import { resolveWinnerSideFromWire } from '@/lib/matching-server/online-battle-outcome';
import {
  formatMatchPlayerLabel,
  getActiveMatchProfile,
} from '@/lib/matching-server/match-profile-store';
import {
  getActiveMatchSession,
  getAuthoritativeMatchGame,
  setActiveMatchSession,
} from '@/lib/matching-server/session-store';
import {
  applyOnlineBattleMove,
  createOnlineBattleGame,
  getDisplayBoardPieces,
  getDisplayHands,
  getMyLegalMoves,
  getOnlineBattleGame,
  removeOnlineBattleGame,
  setOnlineBattlePieceCatalog,
  syncFromServerWire,
} from '@/ai/online-battle-registry';
import {
  BoardCell,
  getHandCount,
  type BoardPiece,
  type HandsState,
  type Side,
} from '@/features/stage-shogi/domain/game-rules';
import { createPieceSfenMapping } from '@/features/stage-shogi/domain/piece-conversion';
import {
  findPieceAt,
  handKeyToDisplayPieceCode,
  legalMoveOriginCellForPiece,
  legalMovesForBoardPiece,
  legalMovesForBoardPieceAt,
  legalMovesForDropPiece,
  legalMovesToTarget,
  poisonHazardCellsForDisplay,
  rockObstacleCellsForDisplay,
  batsuHazardCellsForDisplay,
  thornHazardCellsForDisplay,
  safeRoomHazardCellsForDisplay,
  SAFE_ROOM_CELL_IMAGE_SOURCE,
  alignLegalMovesToBoardPieces,
  isFixedHouseFieldPieceForUi,
  uniqueTargetsFromMoves,
} from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import {
  buildHandInspectTarget,
  resolveInspectingPieceState,
} from '@/features/stage-shogi/ui/stage-shogi-screen.inspect';
import type { InspectingPieceState } from '@/features/stage-shogi/ui/stage-shogi-screen.presenters';
import {
  createLoadPieceCatalogUseCase,
  createLoadRawPieceCatalogUseCase,
} from '@/usecases/piece-info/create-piece-info-usecases';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';
import type { OnlineBattleSession } from '@/usecases/online-battle/load-online-battle-session-usecase';
import { pickRandomTimeoutBattleMove } from '@/lib/battle/pick-random-timeout-battle-move';
import {
  applyTimeActionNotation,
  buildHouseSkillOnlyMove,
  buildTimeSkillOnlyMove,
  countPeopleOnBoardUi,
  filterActionableMoves,
  findHeartMoveAt,
  findSatoriMoveAt,
  hasAdjacentEnemyPiece,
  isPhysicalBattleMove,
  isPlayerHousePieceForSkillUi,
  isTimePiece,
  pieceDefsByCharFromCatalog,
  resolveHeartAllyPick,
  resolveSatoriEnemyPick,
  type TimeActionMode,
} from '@/lib/battle/battle-skill-interaction';
import {
  buildPromotedPieceDefsByCode,
  movePayloadToBattleMove,
  playBattleMoveOrPromoteSe,
  playBattleSkillActivationSe,
  playHolySwordEvadeSkillSe,
  type BattleAudioCatalog,
} from '@/lib/battle/battle-move-audio';
import { formatOnlineBattleMoveLogLine } from '@/lib/battle/battle-log';
import {
  detectHolySwordCaptureEvadeFromPieces,
  detectHolySwordCaptureEvadeFromWire,
} from '@/lib/battle/holy-sword-capture-evade';

export type PendingOnlinePromotion = {
  promoteMove: BattleMove;
  nonPromoteMove: BattleMove;
};

const REMOTE_OPPONENT_MOVE_PREVIEW_MS = 1000;
const ONLINE_BATTLE_LOG_MAX_LINES = 11;

function trimOnlineBattleLogLines(lines: readonly string[]): string[] {
  return lines.slice(-ONLINE_BATTLE_LOG_MAX_LINES);
}

const emptySession: OnlineBattleSession = {
  roomId: '----',
  matchId: '',
  connectionStatus: '接続中...',
  playerLabel: 'あなた: -',
  opponentLabel: '相手: -',
  role: null,
  isMyTurn: false,
  turnLabel: '接続中',
  version: 0,
  boardPieces: [],
  playerHandSummary: 'なし',
  opponentHandSummary: 'なし',
  logLines: [],
};

function sideLabel(side: PlayerSide): string {
  return side === 'black' ? '先手' : '後手';
}

function buildSession(
  matchId: string,
  role: PlayerSide,
  game: MatchingGameState,
  connectionStatus: string,
  logLines: string[],
  winnerSide?: 'player' | 'enemy' | null,
): OnlineBattleSession {
  const isMyTurn = game.turn === role;
  const opponentSide = role === 'black' ? 'white' : 'black';
  const profile = getActiveMatchProfile();
  return {
    roomId: matchId.slice(0, 6).toUpperCase(),
    matchId,
    connectionStatus,
    playerLabel: profile
      ? formatMatchPlayerLabel(profile.self, 'あなた')
      : `あなた: ${sideLabel(role)}`,
    opponentLabel: profile
      ? formatMatchPlayerLabel(profile.opponent, '相手')
      : `相手: ${sideLabel(opponentSide)}`,
    role,
    isMyTurn,
    turnLabel: isMyTurn ? 'あなたの手番' : '相手の手番',
    version: game.version,
    boardPieces: boardPiecesFromState(game),
    playerHandSummary: handSummary(game.hands, role),
    opponentHandSummary: handSummary(game.hands, opponentSide),
    logLines,
    winnerSide: winnerSide ?? null,
  };
}

export function useOnlineBattleGame(matchId?: string) {
  const { accessToken, isReady, userId } = useAuthSession();
  const [session, setSession] = useState<OnlineBattleSession>(emptySession);
  const [game, setGame] = useState<MatchingGameState | null>(null);
  const [role, setRole] = useState<PlayerSide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pieceCatalog, setPieceCatalog] = useState<PieceCatalogItem[]>([]);
  const [pieces, setPieces] = useState<BoardPiece[]>([]);
  const [hands, setHands] = useState<HandsState>({ player: {}, enemy: {} });
  const [selectedCell, setSelectedCell] = useState<BoardCell | null>(null);
  const [selectedDropPieceCode, setSelectedDropPieceCode] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<BoardCell[]>([]);
  const [pendingPromotion, setPendingPromotion] = useState<PendingOnlinePromotion | null>(null);
  const [pendingTimeActionCell, setPendingTimeActionCell] = useState<BoardCell | null>(null);
  const [pendingHouseSkillCell, setPendingHouseSkillCell] = useState<BoardCell | null>(null);
  const [pendingSatoriEnemyPick, setPendingSatoriEnemyPick] = useState<BattleMove[] | null>(null);
  const [pendingHeartAllyPick, setPendingHeartAllyPick] = useState<BattleMove[] | null>(null);
  const [enemyPreviewTargets, setEnemyPreviewTargets] = useState<BoardCell[]>([]);
  const [timeActionMode, setTimeActionMode] = useState<TimeActionMode | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(ONLINE_PVP_TURN_SECONDS);
  const [skillVisualEffects, setSkillVisualEffects] = useState<SkillVisualEffect[]>([]);
  const [poisonHazardCells, setPoisonHazardCells] = useState<BoardCell[]>([]);
  const [rockObstacleCells, setRockObstacleCells] = useState<BoardCell[]>([]);
  const [batsuHazardCells, setBatsuHazardCells] = useState<BoardCell[]>([]);
  const [thornHazardCells, setThornHazardCells] = useState<BoardCell[]>([]);
  const [safeRoomHazardCells, setSafeRoomHazardCells] = useState<BoardCell[]>([]);
  const [inspectingPiece, setInspectingPiece] = useState<InspectingPieceState>(null);

  const queueSkillVisualEffects = useCallback((effects: SkillVisualEffect[] | undefined) => {
    if (!effects?.length) return;
    setSkillVisualEffects(effects);
  }, []);

  const handleSkillVisualEffectFinished = useCallback((finished: SkillVisualEffect) => {
    setSkillVisualEffects((current) => current.filter((effect) => effect.id !== finished.id));
  }, []);

  const client = useMemo(() => getMatchingServerClient(), []);
  const loadDisplayCatalogUseCase = useMemo(() => createLoadPieceCatalogUseCase(), []);
  const loadEngineCatalogUseCase = useMemo(() => createLoadRawPieceCatalogUseCase(), []);
  const enginePieceCatalogRef = useRef<PieceCatalogItem[]>([]);
  const pieceDefsByCode = useMemo(() => catalogDefsByCode(pieceCatalog), [pieceCatalog]);
  const pieceDefsByChar = useMemo(() => pieceDefsByCharFromCatalog(pieceCatalog), [pieceCatalog]);
  const promotedPieceDefsByCode = useMemo(
    () => buildPromotedPieceDefsByCode(pieceCatalog, pieceDefsByChar),
    [pieceCatalog, pieceDefsByChar],
  );
  const battleAudioCatalog = useMemo<BattleAudioCatalog>(
    () => ({ pieceDefsByCode, pieceDefsByChar, promotedPieceDefsByCode }),
    [pieceDefsByChar, pieceDefsByCode, promotedPieceDefsByCode],
  );
  const battleAudioCatalogRef = useRef(battleAudioCatalog);
  battleAudioCatalogRef.current = battleAudioCatalog;
  const locallyAuditedVersionsRef = useRef<Set<number>>(new Set());
  const remoteMovePreviewTokenRef = useRef(0);
  const remoteMovePreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setEnemyPreviewTargetsRef = useRef(setEnemyPreviewTargets);
  setEnemyPreviewTargetsRef.current = setEnemyPreviewTargets;
  const preMoveWireHandsRef = useRef<MatchingGameState['hands'] | null>(null);
  const preMoveWireSkillStateRef = useRef<MatchingGameState['skillState'] | null>(null);
  const preMoveSkillFxRef = useRef<SkillVisualEffect[]>([]);
  const timeoutMoveInFlightRef = useRef(false);
  const turnTimerDeadlineRef = useRef<number | null>(null);
  const timeoutFiredForVersionRef = useRef<number | null>(null);
  const authoritativeServerGameRef = useRef<MatchingGameState | null>(null);
  const playMoveAudio = useCallback(
    (move: BattleMove, actorSide: Side, board: BoardPiece[]) => {
      playBattleMoveOrPromoteSe(move, actorSide, board, battleAudioCatalog);
    },
    [battleAudioCatalog],
  );
  const playSkillAudio = useCallback(
    (move: BattleMove, actorSide: Side, board: BoardPiece[]) => {
      playBattleSkillActivationSe(move, actorSide, board, battleAudioCatalog);
    },
    [battleAudioCatalog],
  );
  const playRemoteLastMoveAudio = useCallback(
    (
      nextGame: MatchingGameState,
      myRole: PlayerSide,
      board: BoardPiece[],
      options: { skillTriggered: boolean; holySwordEvaded?: boolean },
    ) => {
      if (locallyAuditedVersionsRef.current.delete(nextGame.version)) return;
      if (!nextGame.lastMove) return;
      const actorSide: Side = nextGame.turn === myRole ? 'enemy' : 'player';
      const move = movePayloadToBattleMove(nextGame.lastMove);
      playMoveAudio(move, actorSide, board);
      if (options.holySwordEvaded) {
        playHolySwordEvadeSkillSe();
      } else if (options.skillTriggered) {
        playSkillAudio(move, actorSide, board);
      }
    },
    [playMoveAudio, playSkillAudio],
  );

  const clearSkillUiState = useCallback(() => {
    setPendingTimeActionCell(null);
    setPendingHouseSkillCell(null);
    setPendingSatoriEnemyPick(null);
    setPendingHeartAllyPick(null);
    setEnemyPreviewTargets([]);
    setTimeActionMode(null);
  }, []);
  const pieceSfenMapping = useMemo(
    () => (pieceCatalog.length > 0 ? createPieceSfenMapping(pieceCatalog) : null),
    [pieceCatalog],
  );

  const refreshLocalFromRegistry = useCallback((matchIdValue: string) => {
    const record = getOnlineBattleGame(matchIdValue);
    if (!record) return;
    const displayWire = canonicalToMatchingWire(record.position);
    displayWire.canonicalState = {
      sideToMove: record.position.sideToMove,
      turnNumber: record.position.turnNumber,
      moveCount: record.position.moveCount,
      sfen: record.position.sfen,
      stateHash: record.position.stateHash,
      boardState: record.position.boardState as Record<string, unknown>,
      hands: record.position.hands,
    };
    const displayPieces = getDisplayBoardPieces(matchIdValue);
    setPieces(displayPieces);
    setHands(getDisplayHands(matchIdValue));
    setPoisonHazardCells(poisonHazardCellsForDisplay(record.position));
    setRockObstacleCells(rockObstacleCellsForDisplay(record.position));
    setBatsuHazardCells(batsuHazardCellsForDisplay(record.position));
    setThornHazardCells(thornHazardCellsForDisplay(record.position));
    setSafeRoomHazardCells(safeRoomHazardCellsForDisplay(record.position));
    setSession((current) =>
      buildSession(
        matchIdValue,
        record.myRole,
        displayWire,
        current.connectionStatus,
        current.logLines,
        record.game.winnerSide,
      ),
    );
  }, []);

  const buildAlignedPlayerLegalMoves = useCallback(
    (boardPieces: BoardPiece[]) => {
      if (!matchId) return [];
      const battleRecord = getOnlineBattleGame(matchId);
      if (!battleRecord) return [];
      const displayWire = canonicalToMatchingWire(battleRecord.position);
      return filterBattleMovesForServerWire(
        alignLegalMovesToBoardPieces(boardPieces, getMyLegalMoves(matchId)),
        displayWire,
        battleRecord.myRole,
        battleRecord.displayPieceCatalog,
      );
    },
    [matchId],
  );

  useEffect(() => {
    let active = true;
    void Promise.all([
      loadDisplayCatalogUseCase.execute(),
      loadEngineCatalogUseCase.execute(),
    ]).then(([displayCatalog, engineCatalog]) => {
      if (!active) return;
      enginePieceCatalogRef.current = engineCatalog;
      setPieceCatalog(displayCatalog);
      setOnlineBattlePieceCatalog(engineCatalog, displayCatalog);
    });
    return () => {
      active = false;
    };
  }, [loadDisplayCatalogUseCase, loadEngineCatalogUseCase]);

  const appendLog = useCallback((line: string) => {
    setSession((current) => ({
      ...current,
      logLines: trimOnlineBattleLogLines([...current.logLines, line]),
    }));
  }, []);

  const applyServerGame = useCallback(
    (matchIdValue: string, nextRole: PlayerSide, nextGame: MatchingGameState, logLine?: string) => {
      authoritativeServerGameRef.current = nextGame;
      setActiveMatchSession({
        matchId: matchIdValue,
        role: nextRole,
        userId: userId ?? '',
        game: nextGame,
        authoritativeGame: nextGame,
      });
      setGame(nextGame);
      setRole(nextRole);
      const engineCatalog = enginePieceCatalogRef.current;
      if (pieceCatalog.length > 0 && engineCatalog.length > 0) {
        if (!getOnlineBattleGame(matchIdValue)) {
          createOnlineBattleGame({
            matchId: matchIdValue,
            myRole: nextRole,
            wire: nextGame,
            pieceCatalog: engineCatalog,
            displayPieceCatalog: pieceCatalog,
          });
        } else {
          syncFromServerWire({
            matchId: matchIdValue,
            myRole: nextRole,
            wire: nextGame,
            pieceCatalog: engineCatalog,
            displayPieceCatalog: pieceCatalog,
          });
        }
        refreshLocalFromRegistry(matchIdValue);
      }
      setSelectedCell(null);
      setSelectedDropPieceCode(null);
      setLegalTargets([]);
      setPendingPromotion(null);
      clearSkillUiState();
      setSession((current) => {
        const winnerFromWire = resolveWinnerSideFromWire(nextGame, nextRole);
        const winnerSide =
          winnerFromWire ??
          getOnlineBattleGame(matchIdValue)?.game.winnerSide ??
          current.winnerSide;
        const endLogLine =
          winnerSide === 'enemy'
            ? '対局終了: 王を取られました'
            : winnerSide === 'player'
              ? '対局終了: 王を取りました'
              : null;
        return buildSession(
          matchIdValue,
          nextRole,
          nextGame,
          winnerSide ? '接続状態: 終了' : '接続状態: 対局中',
          endLogLine
            ? trimOnlineBattleLogLines([...current.logLines, endLogLine])
            : logLine
              ? trimOnlineBattleLogLines([...current.logLines, logLine])
              : current.logLines,
          winnerSide,
        );
      });
      setIsLoading(false);
    },
    [clearSkillUiState, pieceCatalog, refreshLocalFromRegistry, userId],
  );

  const applyServerGameRef = useRef(applyServerGame);
  applyServerGameRef.current = applyServerGame;
  const appendLogRef = useRef(appendLog);
  appendLogRef.current = appendLog;
  const clearSkillUiStateRef = useRef(clearSkillUiState);
  clearSkillUiStateRef.current = clearSkillUiState;
  const playRemoteLastMoveAudioRef = useRef(playRemoteLastMoveAudio);
  playRemoteLastMoveAudioRef.current = playRemoteLastMoveAudio;
  const queueSkillVisualEffectsRef = useRef(queueSkillVisualEffects);
  queueSkillVisualEffectsRef.current = queueSkillVisualEffects;
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const roleRef = useRef(role);
  roleRef.current = role;

  useEffect(() => {
    const serverWire = getAuthoritativeMatchGame() ?? authoritativeServerGameRef.current;
    const engineCatalog = enginePieceCatalogRef.current;
    if (
      !matchId ||
      !role ||
      !serverWire ||
      pieceCatalog.length === 0 ||
      engineCatalog.length === 0
    ) {
      return;
    }
    const existing = getOnlineBattleGame(matchId);
    if (!existing) {
      createOnlineBattleGame({
        matchId,
        myRole: role,
        wire: serverWire,
        pieceCatalog: engineCatalog,
        displayPieceCatalog: pieceCatalog,
      });
    } else {
      syncFromServerWire({
        matchId,
        myRole: role,
        wire: serverWire,
        pieceCatalog: engineCatalog,
        displayPieceCatalog: pieceCatalog,
      });
    }
    refreshLocalFromRegistry(matchId);
  }, [matchId, role, game, pieceCatalog, refreshLocalFromRegistry]);

  // 対局中は WebSocket を1本だけ維持する（駒カタログ読込などで effect が再実行されると
  // disconnect→再接続となり、サーバー側で切断扱い／「接続に失敗しました」になる）。
  useEffect(() => {
    let active = true;
    if (!isReady || !userId || !accessToken || !matchId) {
      setIsLoading(true);
      return () => {
        active = false;
      };
    }

    const stored = getActiveMatchSession();
    if (stored && stored.matchId === matchId) {
      applyServerGameRef.current(matchId, stored.role, stored.authoritativeGame ?? stored.game);
    }

    const handleMessage = (payload: WebSocketServerMessage) => {
      if (!active) return;
      switch (payload.type) {
        case 'game_started': {
          remoteMovePreviewTokenRef.current += 1;
          if (remoteMovePreviewTimerRef.current) {
            clearTimeout(remoteMovePreviewTimerRef.current);
            remoteMovePreviewTimerRef.current = null;
          }
          setEnemyPreviewTargetsRef.current([]);
          const nextRole = client.getRole() ?? stored?.role;
          if (!nextRole) return;
          applyServerGameRef.current(
            payload.matchId,
            nextRole,
            payload.initialState,
            '対局が開始されました',
          );
          return;
        }
        case 'game_state_updated': {
          const nextRole = client.getRole() ?? getActiveMatchSession()?.role ?? stored?.role;
          if (!nextRole) return;
          const nextGame: MatchingGameState = {
            version: payload.version,
            turn: payload.turn,
            board: payload.board,
            hands: payload.hands,
            skillState: payload.skillState,
            lastMove: payload.lastMove,
            lastSkillTriggered: payload.lastSkillTriggered,
            canonicalState: payload.canonicalState,
          };
          setMoveError(null);
          const skipRemoteFx = locallyAuditedVersionsRef.current.delete(payload.version);
          const wireHandsBefore =
            (skipRemoteFx ? preMoveWireHandsRef.current : null) ??
            authoritativeServerGameRef.current?.hands ??
            getAuthoritativeMatchGame()?.hands ??
            null;
          const wireSkillStateBefore =
            (skipRemoteFx ? preMoveWireSkillStateRef.current : null) ??
            authoritativeServerGameRef.current?.skillState ??
            getAuthoritativeMatchGame()?.skillState ??
            null;
          const catalogForLog =
            getOnlineBattleGame(payload.matchId)?.displayPieceCatalog ?? pieceCatalog;
          const logSkillVisualEffects: SkillVisualEffect[] = [];
          const remoteSkillFxToQueue: SkillVisualEffect[] = [];
          if (payload.lastSkillTriggered && payload.lastMove && wireHandsBefore) {
            const fireFx = buildFireHandSkillFxFromWireHandsDiff({
              before: wireHandsBefore,
              after: payload.hands,
              victimServerSide: payload.turn,
              moveCount: payload.version,
              lastMovePieceCode: payload.lastMove.piece,
              pieceCatalog: catalogForLog,
            });
            if (fireFx.length > 0) {
              logSkillVisualEffects.push(...fireFx);
              if (!skipRemoteFx) {
                remoteSkillFxToQueue.push(...fireFx);
              }
            }
          }
          if (payload.lastSkillTriggered && payload.lastMove) {
            const stunFx = buildStunSkillFxFromWireSkillStateDiff({
              before: wireSkillStateBefore ?? undefined,
              after: payload.skillState,
              moveCount: payload.version,
              lastMovePieceCode: payload.lastMove.piece,
            });
            if (stunFx.length > 0) {
              logSkillVisualEffects.push(...stunFx);
              if (!skipRemoteFx) {
                remoteSkillFxToQueue.push(...stunFx);
              }
            }
          }
          preMoveWireHandsRef.current = null;
          preMoveWireSkillStateRef.current = null;
          if (skipRemoteFx && preMoveSkillFxRef.current.length > 0) {
            logSkillVisualEffects.push(...preMoveSkillFxRef.current);
            preMoveSkillFxRef.current = [];
          }
          if (!skipRemoteFx && payload.lastMove) {
            const record = getOnlineBattleGame(payload.matchId);
            if (record) {
              try {
                const move = movePayloadToBattleMove(payload.lastMove);
                const preview = applyMove({
                  position: record.position,
                  pieceCatalog: record.pieceCatalog,
                  move,
                  options: { suppressRandomSkillProcs: true },
                });
                logSkillVisualEffects.push(...(preview.skillVisualEffects ?? []));
                if (preview.skillVisualEffects?.length) {
                  remoteSkillFxToQueue.push(...preview.skillVisualEffects);
                }
              } catch {
                // 相手着手の FX プレビュー失敗は盤面同期を妨げない
              }
            }
          }
          const moveText = payload.lastMove
            ? formatOnlineBattleMoveLogLine({
                lastMove: payload.lastMove,
                turnAfterMove: payload.turn,
                lastSkillTriggered: payload.lastSkillTriggered,
                myRole: nextRole,
                catalog: battleAudioCatalogRef.current,
                skillVisualEffects: logSkillVisualEffects,
              })
            : '盤面が更新されました';
          const wireBoardBefore =
            authoritativeServerGameRef.current?.board ?? getAuthoritativeMatchGame()?.board ?? null;
          const holySwordEvaded =
            payload.lastMove && wireBoardBefore
              ? detectHolySwordCaptureEvadeFromWire(
                  wireBoardBefore,
                  payload.board,
                  payload.lastMove,
                )
              : false;
          const commitRemoteUpdate = () => {
            if (remoteSkillFxToQueue.length > 0) {
              queueSkillVisualEffectsRef.current(remoteSkillFxToQueue);
            }
            if (skipRemoteFx && payload.lastSkillTriggered && payload.lastMove && nextRole) {
              if (!holySwordEvaded) {
                const board = getDisplayBoardPieces(payload.matchId);
                playSkillAudio(movePayloadToBattleMove(payload.lastMove), 'player', board);
              }
            }
            applyServerGameRef.current(payload.matchId, nextRole, nextGame, moveText);
            if (nextRole && payload.lastMove) {
              const board = getDisplayBoardPieces(payload.matchId);
              playRemoteLastMoveAudioRef.current(nextGame, nextRole, board, {
                skillTriggered: payload.lastSkillTriggered === true,
                holySwordEvaded,
              });
            }
          };
          const shouldPreviewOpponentMove =
            !skipRemoteFx && payload.lastMove != null && payload.turn === nextRole;
          const opponentLastMove = shouldPreviewOpponentMove ? payload.lastMove : null;
          if (opponentLastMove) {
            let destination: BoardCell | null = null;
            try {
              destination = parseMatchingSquare(opponentLastMove.to);
            } catch {
              destination = null;
            }
            if (destination) {
              const previewToken = ++remoteMovePreviewTokenRef.current;
              if (remoteMovePreviewTimerRef.current) {
                clearTimeout(remoteMovePreviewTimerRef.current);
                remoteMovePreviewTimerRef.current = null;
              }
              setEnemyPreviewTargetsRef.current([destination]);
              remoteMovePreviewTimerRef.current = setTimeout(() => {
                remoteMovePreviewTimerRef.current = null;
                if (!active || previewToken !== remoteMovePreviewTokenRef.current) return;
                setEnemyPreviewTargetsRef.current([]);
                commitRemoteUpdate();
              }, REMOTE_OPPONENT_MOVE_PREVIEW_MS);
              return;
            }
          }
          remoteMovePreviewTokenRef.current += 1;
          if (remoteMovePreviewTimerRef.current) {
            clearTimeout(remoteMovePreviewTimerRef.current);
            remoteMovePreviewTimerRef.current = null;
          }
          setEnemyPreviewTargetsRef.current([]);
          commitRemoteUpdate();
          return;
        }
        case 'opponent_disconnected':
          setSession((current) => ({
            ...current,
            connectionStatus: '接続状態: 相手切断（再接続待ち）',
            logLines: trimOnlineBattleLogLines([...current.logLines, '相手が切断しました']),
          }));
          return;
        case 'opponent_reconnected':
          setSession((current) => ({
            ...current,
            connectionStatus: '接続状態: 対局中',
            logLines: trimOnlineBattleLogLines([...current.logLines, '相手が再接続しました']),
          }));
          return;
        case 'game_finished': {
          const won = payload.winnerUserId === userIdRef.current;
          setSelectedCell(null);
          setLegalTargets([]);
          setPendingPromotion(null);
          clearSkillUiStateRef.current();
          setSession((current) => ({
            ...current,
            connectionStatus: `接続状態: 終了（${payload.reason}）`,
            winnerSide: won ? 'player' : 'enemy',
            turnLabel: '対局終了',
            logLines: trimOnlineBattleLogLines([
              ...current.logLines,
              `対局終了: ${payload.reason}`,
            ]),
          }));
          return;
        }
        case 'state_resync_required':
          appendLogRef.current(`版数不一致（サーバー v${payload.currentVersion}）`);
          setMoveError('盤面の版数がずれました。再接続してください。');
          return;
        case 'error':
          setMoveError(payload.message);
          appendLogRef.current(`エラー: ${payload.message}`);
          const activeRole = roleRef.current ?? getActiveMatchSession()?.role ?? stored?.role;
          const authoritativeGame =
            authoritativeServerGameRef.current ?? getAuthoritativeMatchGame();
          if (matchId && activeRole && authoritativeGame) {
            applyServerGameRef.current(matchId, activeRole, authoritativeGame);
          }
          {
            const moveFailureCodes = new Set(['ILLEGAL_MOVE', 'INVALID_MOVE', 'NOT_YOUR_TURN']);
            if (!moveFailureCodes.has(payload.code)) {
              setSession((current) => ({
                ...current,
                connectionStatus: `接続状態: エラー（${payload.message}）`,
              }));
            }
          }
          setIsLoading(false);
          return;
      }
    };

    const unsubscribe = client.subscribe(handleMessage);

    void (async () => {
      try {
        const ticket = await new OnlineMatchApiDataSource(accessToken).issueMatchmakingTicket();
        await client.connect(userId, { matchId, ticket: ticket.ticket });
        if (!active) return;
        const nextRole = client.getRole() ?? getActiveMatchSession()?.role ?? stored?.role;
        const session = getActiveMatchSession();
        const nextGame =
          session?.authoritativeGame ?? session?.game ?? stored?.authoritativeGame ?? stored?.game;
        if (nextRole && nextGame) {
          applyServerGameRef.current(
            matchId,
            nextRole,
            nextGame,
            'マッチングサーバーに接続しました',
          );
        }
      } catch {
        if (!active) return;
        setSession((current) => ({
          ...current,
          connectionStatus: client.getLastError() ?? '接続先が未設定です',
          logLines: trimOnlineBattleLogLines([
            ...current.logLines,
            client.getLastError() ?? '接続に失敗しました',
          ]),
        }));
        setIsLoading(false);
      }
    })();

    return () => {
      active = false;
      remoteMovePreviewTokenRef.current += 1;
      if (remoteMovePreviewTimerRef.current) {
        clearTimeout(remoteMovePreviewTimerRef.current);
        remoteMovePreviewTimerRef.current = null;
      }
      setEnemyPreviewTargetsRef.current([]);
      unsubscribe();
    };
  }, [accessToken, client, isReady, matchId, userId]);

  useEffect(() => {
    return () => {
      if (matchId) removeOnlineBattleGame(matchId);
    };
  }, [matchId]);

  const record = matchId ? getOnlineBattleGame(matchId) : null;
  const canInteract =
    Boolean(record && isMyTurnInCanonical(record.myRole, record.position)) &&
    !session.winnerSide &&
    !pendingPromotion &&
    !pendingTimeActionCell &&
    !pendingHouseSkillCell &&
    Boolean(game) &&
    Boolean(role);

  const commitMove = useCallback(
    (move: BattleMove) => {
      if (!userId || !matchId || !role) return;
      const serverWire = getAuthoritativeMatchGame() ?? authoritativeServerGameRef.current;
      if (!serverWire) return;
      setMoveError(null);
      try {
        const catalog = getOnlineBattleGame(matchId)?.displayPieceCatalog ?? pieceCatalog;
        const payload = battleMoveToServerPayload(move, role, serverWire, catalog);
        const expectedVersion = serverWire.version + 1;
        preMoveWireHandsRef.current = serverWire.hands;
        preMoveWireSkillStateRef.current = serverWire.skillState;
        preMoveSkillFxRef.current = [];
        const beforePieces = getDisplayBoardPieces(matchId);
        const { committed } = applyOnlineBattleMove({
          matchId,
          move,
          serverWire,
        });
        refreshLocalFromRegistry(matchId);
        const boardAfter = getDisplayBoardPieces(matchId);
        playMoveAudio(move, 'player', boardAfter);
        const holySwordEvaded = detectHolySwordCaptureEvadeFromPieces(
          beforePieces,
          boardAfter,
          move,
        );
        if (holySwordEvaded) {
          playHolySwordEvadeSkillSe();
        } else if (committed.skillTriggered) {
          playSkillAudio(move, 'player', boardAfter);
        }
        preMoveSkillFxRef.current = committed.skillVisualEffects ?? [];
        queueSkillVisualEffects(committed.skillVisualEffects);
        locallyAuditedVersionsRef.current.add(expectedVersion);
        client.makeMove({
          userId,
          matchId,
          expectedVersion: serverWire.version,
          move: payload,
        });
        setSelectedCell(null);
        setSelectedDropPieceCode(null);
        setLegalTargets([]);
        setPendingPromotion(null);
        clearSkillUiState();
      } catch (error) {
        setMoveError(error instanceof Error ? error.message : '着手の送信に失敗しました');
        const authoritativeGame = authoritativeServerGameRef.current ?? getAuthoritativeMatchGame();
        if (authoritativeGame) {
          applyServerGame(matchId, role, authoritativeGame);
        }
      }
    },
    [
      applyServerGame,
      clearSkillUiState,
      client,
      matchId,
      playMoveAudio,
      playSkillAudio,
      pieceCatalog,
      queueSkillVisualEffects,
      refreshLocalFromRegistry,
      role,
      userId,
    ],
  );

  const executeTimeoutMove = useCallback(() => {
    if (!matchId || session.winnerSide || timeoutMoveInFlightRef.current) return;
    const battleRecord = getOnlineBattleGame(matchId);
    if (!battleRecord || !isMyTurnInCanonical(battleRecord.myRole, battleRecord.position)) {
      return;
    }

    timeoutMoveInFlightRef.current = true;
    try {
      let move: BattleMove | null = null;

      if (pendingPromotion) {
        move = Math.random() < 0.5 ? pendingPromotion.promoteMove : pendingPromotion.nonPromoteMove;
      } else if (pendingSatoriEnemyPick && pendingSatoriEnemyPick.length > 0) {
        move =
          pendingSatoriEnemyPick[Math.floor(Math.random() * pendingSatoriEnemyPick.length)] ?? null;
      } else if (pendingHeartAllyPick && pendingHeartAllyPick.length > 0) {
        move =
          pendingHeartAllyPick[Math.floor(Math.random() * pendingHeartAllyPick.length)] ?? null;
      } else if (pendingHouseSkillCell) {
        const piece = findPieceAt(pieces, pendingHouseSkillCell.row, pendingHouseSkillCell.col);
        if (piece) {
          move = buildHouseSkillOnlyMove(pendingHouseSkillCell, piece);
        }
      } else if (pendingTimeActionCell) {
        const piece = findPieceAt(pieces, pendingTimeActionCell.row, pendingTimeActionCell.col);
        if (piece) {
          const origin = legalMoveOriginCellForPiece(
            piece,
            pendingTimeActionCell.row,
            pendingTimeActionCell.col,
          );
          const aligned = buildAlignedPlayerLegalMoves(pieces);
          const physical = filterActionableMoves(
            legalMovesForBoardPiece(aligned, origin.row, origin.col),
          ).filter(isPhysicalBattleMove);
          move =
            physical[Math.floor(Math.random() * physical.length)] ??
            buildTimeSkillOnlyMove(pendingTimeActionCell, piece);
        }
      } else {
        move = pickRandomTimeoutBattleMove(buildAlignedPlayerLegalMoves(pieces));
      }

      if (!move) {
        appendLog('時間切れですが自動着手できる手がありませんでした');
        return;
      }

      setPendingPromotion(null);
      clearSkillUiState();
      setSelectedCell(null);
      setSelectedDropPieceCode(null);
      setLegalTargets([]);
      appendLog('時間切れのため自動着手しました');
      commitMove(move);
    } finally {
      timeoutMoveInFlightRef.current = false;
    }
  }, [
    appendLog,
    buildAlignedPlayerLegalMoves,
    clearSkillUiState,
    commitMove,
    matchId,
    pendingHeartAllyPick,
    pendingHouseSkillCell,
    pendingPromotion,
    pendingSatoriEnemyPick,
    pendingTimeActionCell,
    pieces,
    session.winnerSide,
  ]);

  useEffect(() => {
    if (session.winnerSide || !game) {
      turnTimerDeadlineRef.current = null;
      return;
    }
    turnTimerDeadlineRef.current = Date.now() + ONLINE_PVP_TURN_SECONDS * 1000;
    timeoutFiredForVersionRef.current = null;
    setTurnSecondsLeft(ONLINE_PVP_TURN_SECONDS);
  }, [game?.version, session.winnerSide]);

  useEffect(() => {
    if (session.winnerSide || !game) return;

    const tick = () => {
      const deadline = turnTimerDeadlineRef.current;
      if (!deadline) return;
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTurnSecondsLeft(left);
      if (left > 0) return;
      if (timeoutFiredForVersionRef.current === game.version) return;
      timeoutFiredForVersionRef.current = game.version;
      if (!session.isMyTurn) return;
      executeTimeoutMove();
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [executeTimeoutMove, game, session.isMyTurn, session.winnerSide]);

  const beginSatoriEnemySelectionIfNeeded = useCallback(
    (actionableMoves: BattleMove[]): boolean => {
      const pick = resolveSatoriEnemyPick(actionableMoves);
      if (!pick) return false;
      setPendingSatoriEnemyPick(pick.moves);
      setPendingHeartAllyPick(null);
      setSelectedCell(null);
      setSelectedDropPieceCode(null);
      setLegalTargets([]);
      setEnemyPreviewTargets(pick.targetCells);
      setPendingHouseSkillCell(null);
      setPendingTimeActionCell(null);
      setTimeActionMode(null);
      return true;
    },
    [],
  );

  const beginHeartAllySelectionIfNeeded = useCallback((actionableMoves: BattleMove[]): boolean => {
    const pick = resolveHeartAllyPick(actionableMoves);
    if (!pick) return false;
    setPendingHeartAllyPick(pick.moves);
    setPendingSatoriEnemyPick(null);
    setSelectedCell(null);
    setSelectedDropPieceCode(null);
    setLegalTargets(pick.targetCells);
    setEnemyPreviewTargets([]);
    setPendingHouseSkillCell(null);
    setPendingTimeActionCell(null);
    setTimeActionMode(null);
    return true;
  }, []);

  const handleCellPress = useCallback(
    (viewRow: number, viewCol: number) => {
      if (!role) return;
      const myTurn = record && isMyTurnInCanonical(record.myRole, record.position);
      if (!myTurn || session.winnerSide || pendingPromotion) return;

      const { row, col } = fromViewCoord(viewRow, viewCol, role);
      const tapped = { row, col };

      if (pendingSatoriEnemyPick && pendingSatoriEnemyPick.length > 0) {
        const enemyHere = findPieceAt(pieces, row, col);
        if (enemyHere?.side === 'enemy') {
          const matched = findSatoriMoveAt(pendingSatoriEnemyPick, row, col);
          if (matched) {
            setPendingSatoriEnemyPick(null);
            setEnemyPreviewTargets([]);
            void commitMove(matched);
          }
        } else {
          setPendingSatoriEnemyPick(null);
          setEnemyPreviewTargets([]);
        }
        return;
      }

      if (pendingHeartAllyPick && pendingHeartAllyPick.length > 0) {
        const allyHere = findPieceAt(pieces, row, col);
        if (allyHere?.side === 'player') {
          const matched = findHeartMoveAt(pendingHeartAllyPick, row, col);
          if (matched) {
            setPendingHeartAllyPick(null);
            setLegalTargets([]);
            void commitMove(matched);
          }
        } else {
          setPendingHeartAllyPick(null);
          setLegalTargets([]);
        }
        return;
      }

      if (!canInteract) return;

      if (selectedDropPieceCode) {
        const alignedForDrop = buildAlignedPlayerLegalMoves(pieces);
        const dropMoves = legalMovesToTarget(
          legalMovesForDropPiece(alignedForDrop, selectedDropPieceCode, pieceCatalog),
          tapped,
        );
        const dropCandidates = filterActionableMoves(dropMoves);
        if (dropCandidates.length > 0) {
          if (beginSatoriEnemySelectionIfNeeded(dropCandidates)) return;
          if (beginHeartAllySelectionIfNeeded(dropCandidates)) return;
          void commitMove(dropCandidates[0]!);
          return;
        }
        const tappedPiece = findPieceAt(pieces, row, col);
        if (!tappedPiece || tappedPiece.side !== 'player') return;
        setSelectedDropPieceCode(null);
        setLegalTargets([]);
        setTimeActionMode(null);
        return;
      }

      const alignedLegalMoves = buildAlignedPlayerLegalMoves(pieces);

      if (selectedCell) {
        const selectedPiece = findPieceAt(pieces, selectedCell.row, selectedCell.col);
        const selectedOrigin = selectedPiece
          ? legalMoveOriginCellForPiece(selectedPiece, selectedCell.row, selectedCell.col)
          : selectedCell;
        const targetMoves = legalMovesToTarget(
          legalMovesForBoardPiece(alignedLegalMoves, selectedOrigin.row, selectedOrigin.col),
          tapped,
        );
        const actionableMoves = filterActionableMoves(targetMoves);
        const sameCellHouseSkillOnly =
          targetMoves.length > 0 &&
          actionableMoves.length === 0 &&
          selectedOrigin.row === tapped.row &&
          selectedOrigin.col === tapped.col;
        if (sameCellHouseSkillOnly) {
          const selectedPiece = findPieceAt(pieces, selectedCell.row, selectedCell.col);
          if (
            selectedPiece &&
            countPeopleOnBoardUi(pieces, pieceDefsByChar) < 5 &&
            isPlayerHousePieceForSkillUi(selectedPiece, pieceDefsByChar)
          ) {
            setPendingHouseSkillCell({ row: tapped.row, col: tapped.col });
            setSelectedCell(null);
            setLegalTargets([]);
            setEnemyPreviewTargets([]);
            setPendingTimeActionCell(null);
            setTimeActionMode(null);
            return;
          }
        }
        if (actionableMoves.length > 0) {
          const selectedPiece = findPieceAt(pieces, selectedCell.row, selectedCell.col);
          const isTimeSelected = selectedPiece?.side === 'player' && isTimePiece(selectedPiece);
          const withTime = (m: BattleMove) =>
            applyTimeActionNotation(m, timeActionMode, isTimeSelected);
          const promoteMove = actionableMoves.find((m) => m.promote);
          const nonPromoteMove = actionableMoves.find((m) => !m.promote);
          if (promoteMove && nonPromoteMove) {
            setPendingPromotion({
              promoteMove: withTime(promoteMove),
              nonPromoteMove: withTime(nonPromoteMove),
            });
            setSelectedCell(null);
            setLegalTargets([]);
            setEnemyPreviewTargets([]);
            return;
          }
          if (beginSatoriEnemySelectionIfNeeded(actionableMoves)) return;
          if (beginHeartAllySelectionIfNeeded(actionableMoves)) return;
          void commitMove(withTime(promoteMove ?? nonPromoteMove ?? actionableMoves[0]!));
          return;
        }
      }

      const piece = findPieceAt(pieces, row, col);
      if (!piece || piece.side !== 'player') {
        setSelectedCell(null);
        setLegalTargets([]);
        setEnemyPreviewTargets([]);
        setPendingTimeActionCell(null);
        setTimeActionMode(null);
        return;
      }

      if (isFixedHouseFieldPieceForUi(piece) && piece.char === '畑') {
        setSelectedCell(null);
        setSelectedDropPieceCode(null);
        setLegalTargets([]);
        setEnemyPreviewTargets([]);
        return;
      }

      if (isTimePiece(piece) && !selectedCell) {
        if (hasAdjacentEnemyPiece(pieces, row, col)) {
          setPendingTimeActionCell({ row, col });
          setSelectedCell(null);
          setLegalTargets([]);
          setEnemyPreviewTargets([]);
          return;
        }
        setTimeActionMode('normal');
      }

      const origin = legalMoveOriginCellForPiece(piece, row, col);
      const legalForCell = legalMovesForBoardPieceAt(alignedLegalMoves, pieces, row, col);
      if (!selectedDropPieceCode && isPlayerHousePieceForSkillUi(piece, pieceDefsByChar)) {
        if (countPeopleOnBoardUi(pieces, pieceDefsByChar) < 5) {
          setPendingHouseSkillCell({ row, col });
          setSelectedCell(null);
          setLegalTargets([]);
          setEnemyPreviewTargets([]);
          setPendingTimeActionCell(null);
          setTimeActionMode(null);
          return;
        }
      }

      const targets = uniqueTargetsFromMoves(
        legalForCell.filter((m) => m.notation !== 'house_skill_only'),
        origin,
      );
      if (targets.length === 0) {
        setSelectedCell({ row: origin.row, col: origin.col });
        setSelectedDropPieceCode(null);
        setLegalTargets([]);
        setEnemyPreviewTargets([]);
        return;
      }

      setSelectedDropPieceCode(null);
      setSelectedCell({ row: origin.row, col: origin.col });
      setLegalTargets(targets);
      setEnemyPreviewTargets([]);
      setPendingTimeActionCell(null);
    },
    [
      beginHeartAllySelectionIfNeeded,
      beginSatoriEnemySelectionIfNeeded,
      buildAlignedPlayerLegalMoves,
      canInteract,
      commitMove,
      pieceCatalog,
      pieceDefsByChar,
      pieces,
      pendingHeartAllyPick,
      pendingPromotion,
      pendingSatoriEnemyPick,
      record,
      role,
      selectedCell,
      selectedDropPieceCode,
      session.winnerSide,
      timeActionMode,
    ],
  );

  const confirmTimeAction = useCallback(
    (mode: TimeActionMode) => {
      const cell = pendingTimeActionCell;
      if (!cell) return;
      const piece = findPieceAt(pieces, cell.row, cell.col);
      if (!piece || piece.side !== 'player') {
        setPendingTimeActionCell(null);
        setTimeActionMode(null);
        return;
      }
      const origin = legalMoveOriginCellForPiece(piece, cell.row, cell.col);
      const alignedLegalMoves = buildAlignedPlayerLegalMoves(pieces);
      const targets = uniqueTargetsFromMoves(
        legalMovesForBoardPiece(alignedLegalMoves, origin.row, origin.col),
        origin,
      );
      if (targets.length === 0) {
        setPendingTimeActionCell(null);
        setTimeActionMode(null);
        return;
      }
      if (mode === 'skill') {
        void commitMove(buildTimeSkillOnlyMove(cell, piece));
        setPendingTimeActionCell(null);
        return;
      }
      setTimeActionMode(mode);
      setSelectedDropPieceCode(null);
      setSelectedCell(origin);
      setLegalTargets(targets);
      setEnemyPreviewTargets([]);
      setPendingTimeActionCell(null);
    },
    [buildAlignedPlayerLegalMoves, commitMove, pendingTimeActionCell, pieces],
  );

  const confirmHouseSkill = useCallback(() => {
    const cell = pendingHouseSkillCell;
    if (!cell) return;
    const piece = findPieceAt(pieces, cell.row, cell.col);
    if (!piece || piece.side !== 'player') {
      setPendingHouseSkillCell(null);
      return;
    }
    const origin = legalMoveOriginCellForPiece(piece, cell.row, cell.col);
    const alignedLegalMoves = buildAlignedPlayerLegalMoves(pieces);
    const okLegal = alignedLegalMoves.some(
      (m) =>
        m.notation === 'house_skill_only' && m.fromRow === origin.row && m.fromCol === origin.col,
    );
    const okHeuristic =
      countPeopleOnBoardUi(pieces, pieceDefsByChar) < 5 &&
      isPlayerHousePieceForSkillUi(piece, pieceDefsByChar);
    if (!okLegal && !okHeuristic) {
      setPendingHouseSkillCell(null);
      return;
    }
    void commitMove(buildHouseSkillOnlyMove(cell, piece));
    setPendingHouseSkillCell(null);
  }, [buildAlignedPlayerLegalMoves, commitMove, pendingHouseSkillCell, pieceDefsByChar, pieces]);

  const cancelTimeAction = useCallback(() => {
    setPendingTimeActionCell(null);
    setTimeActionMode(null);
  }, []);

  const cancelHouseSkill = useCallback(() => {
    setPendingHouseSkillCell(null);
  }, []);

  const handleHandPiecePress = useCallback(
    (pieceCode: string) => {
      if (!canInteract) return;
      const code = pieceCode.toUpperCase();
      setSelectedDropPieceCode(code);
      setSelectedCell(null);
      setEnemyPreviewTargets([]);
      setPendingSatoriEnemyPick(null);
      setPendingHeartAllyPick(null);
      setLegalTargets(
        uniqueTargetsFromMoves(
          legalMovesForDropPiece(buildAlignedPlayerLegalMoves(pieces), code, pieceCatalog),
        ),
      );
    },
    [buildAlignedPlayerLegalMoves, canInteract, pieceCatalog, pieces],
  );

  const handleCellLongPress = useCallback(
    (viewRow: number, viewCol: number) => {
      if (!role) return;
      const { row, col } = fromViewCoord(viewRow, viewCol, role);
      const target = findPieceAt(pieces, row, col);
      if (!target) return;
      setInspectingPiece(
        resolveInspectingPieceState({
          target,
          pieceDefsByChar,
          pieceDefsByCode,
        }),
      );
    },
    [pieceDefsByChar, pieceDefsByCode, pieces, role],
  );

  const handleHandPieceLongPress = useCallback(
    (pieceCode: string, side: Side) => {
      const codeKey = handKeyToDisplayPieceCode(pieceCode, pieceCatalog).toUpperCase();
      if (getHandCount(hands, side, codeKey) <= 0) return;
      setInspectingPiece(
        resolveInspectingPieceState({
          target: buildHandInspectTarget({
            pieceCode: codeKey,
            side,
            imageSignedUrl: pieceDefsByCode[codeKey]?.imageSignedUrl ?? null,
          }),
          pieceDefsByChar,
          pieceDefsByCode,
        }),
      );
    },
    [hands, pieceCatalog, pieceDefsByChar, pieceDefsByCode],
  );

  const closeInspectingPiece = useCallback(() => {
    setInspectingPiece(null);
  }, []);

  const resign = useCallback(() => {
    if (!userId || !matchId) return;
    client.resign(userId, matchId);
    appendLog('投了を送信しました');
  }, [appendLog, client, matchId, userId]);

  const disconnect = useCallback(() => {
    if (userId && matchId && !session.winnerSide) {
      try {
        client.resign(userId, matchId);
      } catch {
        // Fall back to the websocket close path; the server treats active disconnect as a loss.
      }
    }
    client.disconnect();
  }, [client, matchId, session.winnerSide, userId]);

  return {
    session,
    isLoading: isLoading || pieceCatalog.length === 0,
    resign,
    disconnect,
    pieces,
    hands,
    poisonHazardCells,
    rockObstacleCells,
    batsuHazardCells,
    thornHazardCells,
    safeRoomHazardCells,
    role,
    pieceCatalog,
    pieceDefsByCode,
    promotedPieceDefsByCode,
    pieceSfenMapping,
    selectedCell,
    selectedDropPieceCode,
    legalTargets,
    enemyPreviewTargets,
    pendingPromotion,
    pendingTimeActionCell,
    pendingHouseSkillCell,
    pendingSatoriEnemyPick,
    pendingHeartAllyPick,
    moveError,
    turnSecondsLeft,
    isTurnTimerVisible: Boolean(game) && !session.winnerSide,
    canInteract,
    handleCellPress,
    handleCellLongPress,
    handleHandPiecePress,
    handleHandPieceLongPress,
    closeInspectingPiece,
    inspectingPiece,
    commitMove,
    setPendingPromotion,
    confirmTimeAction,
    cancelTimeAction,
    confirmHouseSkill,
    cancelHouseSkill,
    skillVisualEffects,
    handleSkillVisualEffectFinished,
  };
}
