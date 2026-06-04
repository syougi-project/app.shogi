import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
import { catalogDefsByCode, fromViewCoord } from '@/lib/matching-server/game-bridge';
import { canonicalToMatchingWire, isMyTurnInCanonical } from '@/lib/matching-server/canonical-game';
import {
  formatMatchPlayerLabel,
  getActiveMatchProfile,
} from '@/lib/matching-server/match-profile-store';
import {
  getActiveMatchSession,
  setActiveMatchSession,
  updateActiveMatchGame,
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
  type BoardPiece,
  type HandsState,
  type Side,
} from '@/features/stage-shogi/domain/game-rules';
import { createPieceSfenMapping } from '@/features/stage-shogi/domain/piece-conversion';
import {
  findPieceAt,
  legalMovesForBoardPiece,
  legalMovesForDropPiece,
  legalMovesToTarget,
  uniqueTargetsFromMoves,
} from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import { createLoadPieceCatalogUseCase } from '@/usecases/piece-info/create-piece-info-usecases';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';
import type { OnlineBattleSession } from '@/usecases/online-battle/load-online-battle-session-usecase';
import {
  applyTimeActionNotation,
  buildHouseSkillOnlyMove,
  buildTimeSkillOnlyMove,
  countPeopleOnBoardUi,
  filterActionableMoves,
  findHeartMoveAt,
  findSatoriMoveAt,
  hasAdjacentEnemyPiece,
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
  type BattleAudioCatalog,
} from '@/lib/battle/battle-move-audio';

export type PendingOnlinePromotion = {
  promoteMove: BattleMove;
  nonPromoteMove: BattleMove;
};

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
  const [playerLegalMoves, setPlayerLegalMoves] = useState<BattleMove[]>([]);
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
  const [skillVisualEffects, setSkillVisualEffects] = useState<SkillVisualEffect[]>([]);

  const queueSkillVisualEffects = useCallback((effects: SkillVisualEffect[] | undefined) => {
    if (!effects?.length) return;
    setSkillVisualEffects(effects);
  }, []);

  const handleSkillVisualEffectFinished = useCallback((finished: SkillVisualEffect) => {
    setSkillVisualEffects((current) => current.filter((effect) => effect.id !== finished.id));
  }, []);

  const client = useMemo(() => getMatchingServerClient(), []);
  const loadCatalogUseCase = useMemo(() => createLoadPieceCatalogUseCase(), []);
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
  const locallyAuditedVersionsRef = useRef<Set<number>>(new Set());
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
      options: { skillTriggered: boolean },
    ) => {
      if (locallyAuditedVersionsRef.current.delete(nextGame.version)) return;
      if (!nextGame.lastMove) return;
      const actorSide: Side = nextGame.turn === myRole ? 'enemy' : 'player';
      const move = movePayloadToBattleMove(nextGame.lastMove);
      playMoveAudio(move, actorSide, board);
      if (options.skillTriggered) {
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
    const wire = canonicalToMatchingWire(record.position);
    wire.canonicalState = {
      sideToMove: record.position.sideToMove,
      turnNumber: record.position.turnNumber,
      moveCount: record.position.moveCount,
      sfen: record.position.sfen,
      stateHash: record.position.stateHash,
      boardState: record.position.boardState as Record<string, unknown>,
      hands: record.position.hands,
    };
    setGame((current) => {
      if (
        current?.version === wire.version &&
        current?.canonicalState?.stateHash === wire.canonicalState?.stateHash
      ) {
        return current;
      }
      return wire;
    });
    setPieces(getDisplayBoardPieces(matchIdValue));
    setHands(getDisplayHands(matchIdValue));
    setPlayerLegalMoves(getMyLegalMoves(matchIdValue));
    setSession((current) =>
      buildSession(
        matchIdValue,
        record.myRole,
        wire,
        current.connectionStatus,
        current.logLines,
        record.game.winnerSide,
      ),
    );
  }, []);

  useEffect(() => {
    let active = true;
    void loadCatalogUseCase.execute().then((catalog) => {
      if (!active) return;
      setPieceCatalog(catalog);
      setOnlineBattlePieceCatalog(catalog);
    });
    return () => {
      active = false;
    };
  }, [loadCatalogUseCase]);

  const appendLog = useCallback((line: string) => {
    setSession((current) => ({
      ...current,
      logLines: [...current.logLines, line].slice(-20),
    }));
  }, []);

  const applyServerGame = useCallback(
    (matchIdValue: string, nextRole: PlayerSide, nextGame: MatchingGameState, logLine?: string) => {
      setActiveMatchSession({
        matchId: matchIdValue,
        role: nextRole,
        userId: userId ?? '',
        game: nextGame,
      });
      updateActiveMatchGame(nextGame);
      setGame(nextGame);
      setRole(nextRole);
      if (pieceCatalog.length > 0) {
        if (!getOnlineBattleGame(matchIdValue)) {
          createOnlineBattleGame({
            matchId: matchIdValue,
            myRole: nextRole,
            wire: nextGame,
            pieceCatalog,
          });
        } else {
          syncFromServerWire({
            matchId: matchIdValue,
            myRole: nextRole,
            wire: nextGame,
            pieceCatalog,
          });
        }
        refreshLocalFromRegistry(matchIdValue);
      }
      setSelectedCell(null);
      setSelectedDropPieceCode(null);
      setLegalTargets([]);
      setPendingPromotion(null);
      clearSkillUiState();
      setSession((current) =>
        buildSession(
          matchIdValue,
          nextRole,
          nextGame,
          '接続状態: 対局中',
          logLine ? [...current.logLines, logLine].slice(-20) : current.logLines,
          getOnlineBattleGame(matchIdValue)?.game.winnerSide ?? current.winnerSide,
        ),
      );
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
    if (!matchId || !role || !game || pieceCatalog.length === 0) return;
    const existing = getOnlineBattleGame(matchId);
    if (!existing) {
      createOnlineBattleGame({ matchId, myRole: role, wire: game, pieceCatalog });
    } else {
      syncFromServerWire({ matchId, myRole: role, wire: game, pieceCatalog });
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
      applyServerGameRef.current(matchId, stored.role, stored.game);
    }

    const handleMessage = (payload: WebSocketServerMessage) => {
      if (!active) return;
      switch (payload.type) {
        case 'game_started': {
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
            lastMove: payload.lastMove,
            lastSkillTriggered: payload.lastSkillTriggered,
            canonicalState: payload.canonicalState,
          };
          const moveText = payload.lastMove
            ? `着手: ${payload.lastMove.piece} ${payload.lastMove.from ?? '打'}→${payload.lastMove.to}`
            : '盤面が更新されました';
          setMoveError(null);
          const skipRemoteFx = locallyAuditedVersionsRef.current.delete(payload.version);
          if (!skipRemoteFx && payload.lastMove) {
            const record = getOnlineBattleGame(payload.matchId);
            if (record) {
              const move = movePayloadToBattleMove(payload.lastMove);
              const preview = applyMove({
                position: record.position,
                pieceCatalog: record.pieceCatalog,
                move,
              });
              queueSkillVisualEffectsRef.current(preview.skillVisualEffects);
            }
          }
          applyServerGameRef.current(payload.matchId, nextRole, nextGame, moveText);
          if (nextRole && payload.lastMove) {
            const board = getDisplayBoardPieces(payload.matchId);
            playRemoteLastMoveAudioRef.current(nextGame, nextRole, board, {
              skillTriggered: payload.lastSkillTriggered === true,
            });
          }
          return;
        }
        case 'opponent_disconnected':
          setSession((current) => ({
            ...current,
            connectionStatus: '接続状態: 相手切断（再接続待ち）',
            logLines: [...current.logLines, '相手が切断しました'].slice(-20),
          }));
          return;
        case 'opponent_reconnected':
          setSession((current) => ({
            ...current,
            connectionStatus: '接続状態: 対局中',
            logLines: [...current.logLines, '相手が再接続しました'].slice(-20),
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
            logLines: [...current.logLines, `対局終了: ${payload.reason}`].slice(-20),
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
          const activeGame = getActiveMatchSession()?.game;
          const activeRole = roleRef.current ?? getActiveMatchSession()?.role ?? stored?.role;
          if (matchId && activeRole && activeGame) {
            applyServerGameRef.current(matchId, activeRole, activeGame);
          }
          setSession((current) => ({
            ...current,
            connectionStatus: `接続状態: エラー（${payload.message}）`,
          }));
          setIsLoading(false);
      }
    };

    const unsubscribe = client.subscribe(handleMessage);

    void (async () => {
      try {
        const ticket = await new OnlineMatchApiDataSource(accessToken).issueMatchmakingTicket();
        await client.connect(userId, { matchId, ticket: ticket.ticket });
        if (!active) return;
        const nextRole = client.getRole() ?? getActiveMatchSession()?.role ?? stored?.role;
        const nextGame = getActiveMatchSession()?.game ?? stored?.game;
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
          logLines: [...current.logLines, client.getLastError() ?? '接続に失敗しました'].slice(-20),
        }));
        setIsLoading(false);
      }
    })();

    return () => {
      active = false;
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
      if (!userId || !matchId || !game || !role) return;
      setMoveError(null);
      try {
        const expectedVersion = game.version + 1;
        const { committed, payload, wire } = applyOnlineBattleMove({ matchId, move });
        updateActiveMatchGame(wire);
        refreshLocalFromRegistry(matchId);
        const boardAfter = getDisplayBoardPieces(matchId);
        playMoveAudio(move, 'player', boardAfter);
        if (committed.skillTriggered) {
          playSkillAudio(move, 'player', boardAfter);
        }
        queueSkillVisualEffects(committed.skillVisualEffects);
        locallyAuditedVersionsRef.current.add(expectedVersion);
        client.makeMove({
          userId,
          matchId,
          expectedVersion: game.version,
          move: payload,
        });
        setSelectedCell(null);
        setSelectedDropPieceCode(null);
        setLegalTargets([]);
        setPendingPromotion(null);
        clearSkillUiState();
      } catch (error) {
        setMoveError(error instanceof Error ? error.message : '着手の送信に失敗しました');
        const activeGame = getActiveMatchSession()?.game;
        if (activeGame) {
          applyServerGame(matchId, role, activeGame);
        }
      }
    },
    [
      applyServerGame,
      clearSkillUiState,
      client,
      game,
      matchId,
      playMoveAudio,
      playSkillAudio,
      queueSkillVisualEffects,
      refreshLocalFromRegistry,
      role,
      userId,
    ],
  );

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
        const dropMoves = legalMovesToTarget(
          legalMovesForDropPiece(playerLegalMoves, selectedDropPieceCode, pieceCatalog),
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

      if (selectedCell) {
        const targetMoves = legalMovesToTarget(
          legalMovesForBoardPiece(playerLegalMoves, selectedCell.row, selectedCell.col),
          tapped,
        );
        const actionableMoves = filterActionableMoves(targetMoves);
        const sameCellHouseSkillOnly =
          targetMoves.length > 0 &&
          actionableMoves.length === 0 &&
          selectedCell.row === tapped.row &&
          selectedCell.col === tapped.col;
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

      const legalForCell = legalMovesForBoardPiece(playerLegalMoves, row, col);
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
      );
      if (targets.length === 0) {
        setSelectedCell({ row, col });
        setSelectedDropPieceCode(null);
        setLegalTargets([]);
        setEnemyPreviewTargets([]);
        return;
      }

      setSelectedDropPieceCode(null);
      setSelectedCell({ row, col });
      setLegalTargets(targets);
      setEnemyPreviewTargets([]);
      setPendingTimeActionCell(null);
    },
    [
      beginHeartAllySelectionIfNeeded,
      beginSatoriEnemySelectionIfNeeded,
      canInteract,
      commitMove,
      pieceCatalog,
      pieceDefsByChar,
      pieces,
      playerLegalMoves,
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
      const targets = uniqueTargetsFromMoves(
        legalMovesForBoardPiece(playerLegalMoves, cell.row, cell.col),
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
      setSelectedCell(cell);
      setLegalTargets(targets);
      setEnemyPreviewTargets([]);
      setPendingTimeActionCell(null);
    },
    [commitMove, pendingTimeActionCell, pieces, playerLegalMoves],
  );

  const confirmHouseSkill = useCallback(() => {
    const cell = pendingHouseSkillCell;
    if (!cell) return;
    const piece = findPieceAt(pieces, cell.row, cell.col);
    if (!piece || piece.side !== 'player') {
      setPendingHouseSkillCell(null);
      return;
    }
    const okLegal = playerLegalMoves.some(
      (m) => m.notation === 'house_skill_only' && m.fromRow === cell.row && m.fromCol === cell.col,
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
  }, [commitMove, pendingHouseSkillCell, pieceDefsByChar, pieces, playerLegalMoves]);

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
        uniqueTargetsFromMoves(legalMovesForDropPiece(playerLegalMoves, code, pieceCatalog)),
      );
    },
    [canInteract, pieceCatalog, playerLegalMoves],
  );

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
    role,
    pieceCatalog,
    pieceDefsByCode,
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
    canInteract,
    handleCellPress,
    handleHandPiecePress,
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
