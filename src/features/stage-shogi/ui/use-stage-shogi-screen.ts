import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import type { SkillVisualEffect } from '@/domain/battle/skill-visual-effect';
import { generateLegalMoves } from '@/ai/engine';
import { passiveAuraImmobilizedCellKeys } from '@/ai/engine/skill-runtime';
import type { AiBattlePosition } from '@/ai/model';
import { getLocalBattleGame, setLocalBattlePieceCatalog } from '@/ai/local-battle-registry';
import { normalizePieceCatalog } from '@/ai/model';
import { toBasePieceCode as toAiBasePieceCode } from '@/ai/model/move';
import {
  addHandPiece,
  BoardCell,
  createEmptyHandsState,
  getHandCount,
  getLegalTargetsFromVectors,
  HandsState,
  Side,
} from '@/features/stage-shogi/domain/game-rules';
import {
  CHAR_TO_CODE,
  CODE_TO_CHAR,
  PROMOTED_CODE_TO_CHAR,
  createPieceSfenMapping,
} from '@/features/stage-shogi/domain/piece-conversion';
import type { PromotionImageFlash } from '@/features/stage-shogi/ui/components/stage-shogi-board';
import {
  normalizePieceCatalogItemForDisplay,
  preparePieceCatalogForBattleAndDisplay,
} from '@/features/piece-info/lib/piece-catalog-display';
import { useStageBattleScreen } from '@/features/stage-shogi/ui/use-stage-battle-screen';
import {
  InspectingPieceState,
  isRecoverableMoveSyncError,
  normalizeSkillName,
  resolveInspectMoveDescription,
  resolveInspectSkillDescription,
  toUserFacingBattleError,
} from '@/features/stage-shogi/ui/stage-shogi-screen.presenters';
import { isGiantPieceForEngine } from '@/ai/engine/giant-piece';
import {
  type ArrowCellDisplay,
  BOARD_SIZE,
  BoardPiece,
  PERSISTENT_SYNC_GUARD_CHARS,
  PreservedMovedPiece,
  TrustedBoardEndpoints,
  applyMovementRuleToTargets,
  alignLegalMovesToBoardPieces,
  buildBoardPiecesFromSnapshotPlacements,
  buildBoardState,
  buildPreservedMovedPieceForPlayer,
  buildSfen,
  collectStandardBaseCodesForLocalPromotedImage,
  computePiecesAfterOptimisticMove,
  enforcePersistentHazardCells,
  findPieceAt,
  getDisplayChar,
  getPieceImageSource,
  handKeyToDisplayPieceCode,
  hasAdjacentEnemyPiece,
  isGameAlreadyFinishedError,
  isSelfCaptureLikeMove,
  legalMovesForBoardPieceAt,
  legalMoveOriginCellForPiece,
  legalMovesForDropPiece,
  legalMovesToTarget,
  localPromotedModuleFromBaseCodeCandidates,
  mergePeopleFieldDiagonalMoveVectors,
  applyAdjacentMedicineMoveRangeBuff,
  appendRockObstacleVirtualPiecesForPreview,
  isFixedHouseFieldPieceForUi,
  patchHandsForStarReturnSkill,
  pieceCodeFromPlacement,
  pieceCharFromCode,
  resolveBattleMovePlacements,
  syncCanonicalState,
  uniqueTargetsFromMoves,
  applyKirinImmunityShieldMarkToPieces,
  arrowCellsForDisplay,
  batsuHazardCellsForDisplay,
  henEdgeHighlightCellsForDisplay,
  poisonHazardCellsForDisplay,
  positionWithStageFixedBoardTiles,
  rockObstacleCellsForDisplay,
  safeRoomHazardCellsForDisplay,
  thornHazardCellsForDisplay,
} from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import { createLoadPieceCatalogUseCase } from '@/usecases/piece-info/create-piece-info-usecases';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';
import { patchHomeSnapshotCurrency } from '@/hooks/common/home-snapshot-store';
import type { StageClearGrantedCurrency } from '@/lib/stage/stage-clear-currency-reward';
import { createClaimStageClearRewardUseCase } from '@/usecases/stage-battle/create-stage-battle-usecases';
import { CommitGameMoveUseCase } from '@/usecases/stage-battle/commit-game-move-usecase';
import { CreateGameUseCase } from '@/usecases/stage-battle/create-game-usecase';
import {
  BattleCanonicalPosition,
  BattleGameStatus,
  BattleMove,
} from '@/usecases/stage-battle/game-move-contract';
import { LoadGameLegalMovesUseCase } from '@/usecases/stage-battle/load-game-legal-moves-usecase';
import { LoadGameStateUseCase } from '@/usecases/stage-battle/load-game-state-usecase';
import { RequestAiMoveUseCase } from '@/usecases/stage-battle/request-ai-move-usecase';
import { BATTLE_PIECE_EFFECT_SOUND_MODULES } from '@/constants/battle-piece-effect-sound-modules.generated';
import {
  playBattlePieceEffectSound,
  playBattlePieceEffectSoundFirstMatch,
  playSe,
} from '@/lib/audio/audio-manager';

export type PendingPromotion = {
  promoteMove: BattleMove;
  nonPromoteMove: BattleMove;
  boardFromRow: number;
  boardFromCol: number;
  boardToRow: number;
  boardToCol: number;
};

export type TimeActionMode = 'skill' | 'normal';

const RECOVERED_MOVE_SYNC_MESSAGE = '局面を自動更新しました。対局を続行します。';

/** マスが変わる移動・打ち（同一マスでのスキルのみ着手は除く） */
function isPhysicalBattleMove(move: BattleMove): boolean {
  const notation = typeof move.notation === 'string' ? move.notation : '';
  if (notation === 'time_skill_only' || notation === 'house_skill_only') return false;
  if (move.dropPieceCode) return true;
  if (move.fromRow == null || move.fromCol == null) return false;
  return move.fromRow !== move.toRow || move.fromCol !== move.toCol;
}

function normalizeKanjiForBattleAudioKey(s: string): string {
  const t = s.trim();
  try {
    return t.normalize('NFKC');
  } catch {
    return t;
  }
}

function resolveKanjiForBattleMoveSound(
  move: BattleMove,
  actorSide: Side,
  board: BoardPiece[],
): string | null {
  if (move.dropPieceCode) {
    const code = move.dropPieceCode.toUpperCase();
    const ch = pieceCharFromCode(code, actorSide, false);
    return ch && ch !== '?' ? normalizeKanjiForBattleAudioKey(ch) : null;
  }
  // 着手後の盤では移動先に着手駒があることが多いので、移動元より先に解決する。
  const atTo = findPieceAt(board, move.toRow, move.toCol);
  if (atTo?.side === actorSide && atTo.char && !/^piece_/i.test(atTo.char)) {
    return normalizeKanjiForBattleAudioKey(getDisplayChar(atTo));
  }
  if (move.fromRow != null && move.fromCol != null) {
    const atFrom = findPieceAt(board, move.fromRow, move.fromCol);
    if (atFrom?.side === actorSide && atFrom.char && !/^piece_/i.test(atFrom.char)) {
      return normalizeKanjiForBattleAudioKey(getDisplayChar(atFrom));
    }
  }
  const rawPc = (move.pieceCode ?? '').toUpperCase();
  const base = (toAiBasePieceCode(move.pieceCode ?? null) ?? rawPc).toUpperCase();
  const ch = pieceCharFromCode(base, actorSide, move.promote === true);
  return ch && ch !== '?' ? normalizeKanjiForBattleAudioKey(ch) : null;
}

function pieceDefForBattleAudio(
  move: BattleMove,
  kanji: string | null,
  pieceDefsByCode: Record<string, PieceCatalogItem>,
  pieceDefsByChar: Record<string, PieceCatalogItem>,
  promotedPieceDefsByCode: Record<string, PieceCatalogItem>,
): PieceCatalogItem | undefined {
  const rawCode = (move.pieceCode ?? '').toUpperCase();
  const baseRaw = toAiBasePieceCode(move.pieceCode ?? null);
  const base = (baseRaw ?? rawCode).toUpperCase();
  if (move.promote) {
    return (
      promotedPieceDefsByCode[base] ??
      promotedPieceDefsByCode[rawCode] ??
      pieceDefsByCode[base] ??
      pieceDefsByCode[rawCode]
    );
  }
  if (kanji && pieceDefsByChar[kanji]) return pieceDefsByChar[kanji];
  return pieceDefsByCode[base] ?? pieceDefsByCode[rawCode];
}

/** カタログにスキル文があっても、移動時は必ず「◯効果音」を鳴らす駒（マップにファイルがある場合のみ）。 */
const PIECE_CHARS_ALWAYS_USE_EFFECT_SOUND_ON_MOVE = new Set<string>(['鳳']);

function shouldUsePieceEffectInsteadOfGenericMove(
  move: BattleMove,
  kanji: string | null,
  pieceDefsByCode: Record<string, PieceCatalogItem>,
  pieceDefsByChar: Record<string, PieceCatalogItem>,
  promotedPieceDefsByCode: Record<string, PieceCatalogItem>,
  modules: Partial<Record<string, number>>,
): boolean {
  if (move.promote) return false;
  const key = kanji ? normalizeKanjiForBattleAudioKey(kanji) : '';
  if (!key || modules[key] == null) return false;
  if (PIECE_CHARS_ALWAYS_USE_EFFECT_SOUND_ON_MOVE.has(key)) return true;
  const def = pieceDefForBattleAudio(
    move,
    kanji,
    pieceDefsByCode,
    pieceDefsByChar,
    promotedPieceDefsByCode,
  );
  if (!def) return true;
  return normalizeSkillName(def.skill) == null;
}

function playBattleMoveOrPromoteSe(
  move: BattleMove,
  actorSide: Side,
  board: BoardPiece[],
  pieceDefsByCode: Record<string, PieceCatalogItem>,
  pieceDefsByChar: Record<string, PieceCatalogItem>,
  promotedPieceDefsByCode: Record<string, PieceCatalogItem>,
): void {
  if (move.promote) {
    void playSe('battlePromote');
    return;
  }
  if (!isPhysicalBattleMove(move)) return;
  const kanji = resolveKanjiForBattleMoveSound(move, actorSide, board);
  if (
    shouldUsePieceEffectInsteadOfGenericMove(
      move,
      kanji,
      pieceDefsByCode,
      pieceDefsByChar,
      promotedPieceDefsByCode,
      BATTLE_PIECE_EFFECT_SOUND_MODULES,
    )
  ) {
    void playBattlePieceEffectSound(kanji, 'battlePieceMove');
    return;
  }
  void playSe('battlePieceMove');
}

function normalizeKanjiForSkillId(ch: string): string {
  if (!ch) return ch;
  try {
    return ch.normalize('NFKC');
  } catch {
    return ch;
  }
}

function isPlayerHousePieceForSkillUi(
  piece: BoardPiece,
  pieceDefsByChar: Partial<Record<string, PieceCatalogItem>>,
): boolean {
  if (piece.side !== 'player') return false;
  const charN = normalizeKanjiForSkillId(piece.char);
  const resolved = pieceCodeFromPlacement(
    piece.pieceCode ?? null,
    piece.char,
    pieceDefsByChar,
  )?.toUpperCase();
  const pc = piece.pieceCode?.toUpperCase() ?? '';
  if (resolved === 'HOUSE' || pc === 'HOUSE') return true;
  if (piece.char === '家' || charN === '家') return true;
  if (CHAR_TO_CODE[piece.char] === 'HOUSE' || CHAR_TO_CODE[charN] === 'HOUSE') return true;
  if (normalizeKanjiForSkillId(getDisplayChar(piece)) === '家') return true;
  const stripped = (toAiBasePieceCode(pc) ?? pc).toUpperCase();
  if (stripped === 'HOUSE') return true;
  if (CODE_TO_CHAR[stripped] === '家') return true;
  return false;
}

function countPeopleOnBoardUi(
  board: BoardPiece[],
  pieceDefsByChar: Partial<Record<string, PieceCatalogItem>>,
): number {
  return board.filter((p) => {
    const c = pieceCodeFromPlacement(p.pieceCode ?? null, p.char, pieceDefsByChar)?.toUpperCase();
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

export function useStageShogiScreen(stageParam: string | undefined, userId?: string) {
  const { snapshot, isLoading, loadError } = useStageBattleScreen(stageParam, userId);
  const [failedImageKeys, setFailedImageKeys] = useState<Record<string, true>>({});
  const [pieces, setPieces] = useState<BoardPiece[]>([]);
  const piecesRenderRef = useRef<BoardPiece[]>([]);
  piecesRenderRef.current = pieces;
  const [boardSpriteEpoch, setBoardSpriteEpoch] = useState(0);
  const [sideToMove, setSideToMove] = useState<Side>('player');
  const [moveNo, setMoveNo] = useState(1);
  const [gameId, setGameId] = useState<string | null>(null);
  const [isCreatingGame, setIsCreatingGame] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<BoardCell | null>(null);
  const [selectedDropPieceCode, setSelectedDropPieceCode] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<BoardCell[]>([]);
  const [aiPreviewTarget, setAiPreviewTarget] = useState<BoardCell | null>(null);
  const [playerLegalMoves, setPlayerLegalMoves] = useState<BattleMove[]>([]);
  const [enemyPreviewTargets, setEnemyPreviewTargets] = useState<BoardCell[]>([]);
  const [poisonHazardCells, setPoisonHazardCells] = useState<BoardCell[]>([]);
  const [rockObstacleCells, setRockObstacleCells] = useState<BoardCell[]>([]);
  const [batsuHazardCells, setBatsuHazardCells] = useState<BoardCell[]>([]);
  const [arrowCells, setArrowCells] = useState<ArrowCellDisplay[]>([]);
  const [thornHazardCells, setThornHazardCells] = useState<BoardCell[]>([]);
  const [safeRoomHazardCells, setSafeRoomHazardCells] = useState<BoardCell[]>([]);
  const [henEdgeHighlightCells, setHenEdgeHighlightCells] = useState<BoardCell[]>([]);
  const [isLoadingPlayerLegalMoves, setIsLoadingPlayerLegalMoves] = useState(false);
  /** syncFromCanonical のたびに増やし、手番・moveNo が不変でも合法手を再取得する（盾で着手無効化など）。 */
  const [boardSyncEpoch, setBoardSyncEpoch] = useState(0);
  const [hands, setHands] = useState<HandsState>(createEmptyHandsState());
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [pendingTimeActionCell, setPendingTimeActionCell] = useState<BoardCell | null>(null);
  const [pendingHouseSkillCell, setPendingHouseSkillCell] = useState<BoardCell | null>(null);
  /** 悟: 着地マス決定後、スキル対象の敵駒マスを選ぶまで保留する合法手一覧 */
  const [pendingSatoriEnemyPick, setPendingSatoriEnemyPick] = useState<BattleMove[] | null>(null);
  /** 心: 着地後に護り対象の味方マスを選ぶまで保留 */
  const [pendingHeartAllyPick, setPendingHeartAllyPick] = useState<BattleMove[] | null>(null);
  const [timeActionMode, setTimeActionMode] = useState<TimeActionMode | null>(null);
  const [promotionImageFlash, setPromotionImageFlash] = useState<PromotionImageFlash | null>(null);
  const [stateHash, setStateHash] = useState<string | null>(null);
  const [pieceCatalog, setPieceCatalog] = useState<PieceCatalogItem[]>([]);
  const [winner, setWinner] = useState<Side | null>(null);
  const [clearReward, setClearReward] = useState<StageClearGrantedCurrency | null>(null);
  const [skillActivationText, setSkillActivationText] = useState<string | null>(null);
  const [skillVisualEffects, setSkillVisualEffects] = useState<SkillVisualEffect[]>([]);
  const [inspectingPiece, setInspectingPiece] = useState<InspectingPieceState>(null);
  const debugLogPieceMoveRanges = (
    label: string,
    side: Side,
    turn: number,
    moves: BattleMove[],
  ) => {
    void label;
    void side;
    void turn;
    void moves;
  };

  const loadPieceCatalogUseCase = useMemo(() => createLoadPieceCatalogUseCase(), []);
  const claimStageClearRewardUseCase = useMemo(() => createClaimStageClearRewardUseCase(), []);
  const createGameUseCase = useMemo(() => new CreateGameUseCase(), []);
  const commitGameMoveUseCase = useMemo(() => new CommitGameMoveUseCase(), []);
  const loadGameStateUseCase = useMemo(() => new LoadGameStateUseCase(), []);
  const loadGameLegalMovesUseCase = useMemo(() => new LoadGameLegalMovesUseCase(), []);
  const requestAiMoveUseCase = useMemo(() => new RequestAiMoveUseCase(), []);

  const resolvedStageNo = useMemo(() => {
    const n = Number(stageParam);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  }, [stageParam]);

  const isMountedRef = useRef(true);
  const piecesRef = useRef<BoardPiece[]>([]);
  const persistentHazardsRef = useRef<BoardPiece[]>([]);
  const latestMovementRuleByCellRef = useRef<Map<string, string>>(new Map());
  const latestImmobilizedByCellRef = useRef<Set<string>>(new Set());
  const piecesBeforePromotionDialogRef = useRef<BoardPiece[] | null>(null);
  const handsRef = useRef<HandsState>(createEmptyHandsState());
  const stateHashRef = useRef<string | null>(null);
  /** 直近の同期済み局面（敵駒プレビュー時に skill_state をマージするため） */
  const aiPositionRef = useRef<BattleCanonicalPosition | null>(null);
  const handleCellPressRef = useRef<(row: number, col: number) => void>(() => undefined);
  const hasEnteredBattleRef = useRef(false);
  const prevStageRef = useRef<string | undefined>(undefined);
  const aiThinkingRef = useRef(false);
  const inFlightAiKeyRef = useRef<string | null>(null);
  const lastSuccessfulAiKeyRef = useRef<string | null>(null);
  const clearRewardClaimedRef = useRef(false);
  const battleSessionSettledRef = useRef(false);
  const skillToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRecoveringFromIllegalMoveRef = useRef(false);
  const pendingAiResumeRef = useRef<{ moveNo: number; side: Side } | null>(null);
  const illegalRecoverSignatureRef = useRef<string | null>(null);
  const illegalRecoverAttemptsRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (skillToastTimeoutRef.current) {
        clearTimeout(skillToastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    piecesRef.current = pieces;
  }, [pieces]);

  useEffect(() => {
    handsRef.current = hands;
  }, [hands]);

  useEffect(() => {
    stateHashRef.current = stateHash;
  }, [stateHash]);

  useEffect(() => {
    if (!promotionImageFlash) return;
    const hit = pieces.find(
      (p) =>
        p.row === promotionImageFlash.row &&
        p.col === promotionImageFlash.col &&
        p.side === promotionImageFlash.side,
    );
    if (hit != null && getPieceImageSource(hit) != null) {
      setPromotionImageFlash(null);
      return;
    }
    const t = setTimeout(() => setPromotionImageFlash(null), 2500);
    return () => clearTimeout(t);
  }, [pieces, promotionImageFlash]);

  /** エンジン上書き（刀・銃など）を含む。長押し説明・SFEN 解決と将棋エンジンを揃える。 */
  const pieceCatalogNormalized = useMemo(
    () =>
      normalizePieceCatalog(pieceCatalog).map((item) => normalizePieceCatalogItemForDisplay(item)),
    [pieceCatalog],
  );

  const pieceDefsByChar = useMemo(
    () =>
      Object.fromEntries(pieceCatalogNormalized.map((item) => [item.char, item])) as Record<
        string,
        PieceCatalogItem
      >,
    [pieceCatalogNormalized],
  );

  const pieceDefsByCode = useMemo(() => {
    const map: Record<string, PieceCatalogItem> = {};
    for (const it of pieceCatalogNormalized) {
      if (it.pieceCode) {
        map[it.pieceCode.toUpperCase()] = it;
      }
      if (it.canonicalCode) {
        map[it.canonicalCode.toUpperCase()] = it;
        map[it.canonicalCode.toLowerCase()] = it;
      }
      const codeFromChar = CHAR_TO_CODE[it.char];
      if (codeFromChar) {
        map[codeFromChar.toUpperCase()] = it;
      }
    }
    for (const [code, char] of Object.entries(CODE_TO_CHAR)) {
      const item = pieceDefsByChar[char];
      if (item) {
        map[code] = item;
      }
    }
    return map;
  }, [pieceCatalogNormalized, pieceDefsByChar]);

  const promotedPieceDefsByCode = useMemo(() => {
    const map: Record<string, PieceCatalogItem> = {};
    for (const item of pieceCatalogNormalized) {
      if (!item.isPromoted) continue;
      const byPieceCode = item.pieceCode?.toUpperCase();
      if (byPieceCode) {
        map[byPieceCode] = item;
        continue;
      }
      const byChar = CHAR_TO_CODE[item.char]?.toUpperCase();
      if (byChar) {
        map[byChar] = item;
      }
    }
    for (const [code, char] of Object.entries(PROMOTED_CODE_TO_CHAR)) {
      if (map[code]) continue;
      const fallback = pieceDefsByChar[char];
      if (fallback) {
        map[code] = fallback;
      }
    }
    return map;
  }, [pieceCatalogNormalized, pieceDefsByChar]);

  const pieceSfenMapping = useMemo(
    () => createPieceSfenMapping(pieceCatalogNormalized),
    [pieceCatalogNormalized],
  );

  function resolveSkillName(move: BattleMove): string | null {
    const code = move.pieceCode || move.dropPieceCode;
    if (!code) return null;
    const base = normalizeSkillName(pieceDefsByCode[code]?.skill);
    const promoted = normalizeSkillName(promotedPieceDefsByCode[code]?.skill);
    return move.promote ? (promoted ?? base) : (base ?? promoted);
  }

  /** スキル発動時の「◯効果音」用キー（駒コード・カタログ・盤面の順で候補を積む） */
  function buildSkillActivationEffectSoundKeys(
    move: BattleMove,
    actorSide: Side,
    board: BoardPiece[],
  ): string[] {
    const keys: string[] = [];
    const push = (s: string | null | undefined) => {
      if (!s) return;
      let t = s.trim();
      if (!t) return;
      try {
        t = t.normalize('NFKC');
      } catch {
        /* ignore */
      }
      if (!keys.includes(t)) keys.push(t);
    };

    const rawCode = move.pieceCode ?? move.dropPieceCode;
    if (rawCode) {
      const upper = rawCode.toUpperCase();
      const base = (toAiBasePieceCode(rawCode) ?? upper).toUpperCase();
      push(pieceCharFromCode(upper, actorSide, move.promote === true));
      if (base !== upper) {
        push(pieceCharFromCode(base, actorSide, move.promote === true));
      }
      const c1 = CODE_TO_CHAR[upper];
      const c2 = CODE_TO_CHAR[base];
      if (typeof c1 === 'string') push(c1);
      if (typeof c2 === 'string') push(c2);
    }

    const kanji = resolveKanjiForBattleMoveSound(move, actorSide, board);
    const def = pieceDefForBattleAudio(
      move,
      kanji,
      pieceDefsByCode,
      pieceDefsByChar,
      promotedPieceDefsByCode,
    );
    if (def?.char) push(def.char);
    if (def?.name) push(def.name.replace(/\s+/g, ''));
    push(kanji);

    return keys;
  }

  const queueSkillVisualEffects = useCallback((effects: SkillVisualEffect[] | undefined) => {
    if (!effects?.length) return;
    setSkillVisualEffects(effects);
  }, []);

  const handleSkillVisualEffectFinished = useCallback((finished: SkillVisualEffect) => {
    setSkillVisualEffects((current) => current.filter((effect) => effect.id !== finished.id));
  }, []);

  function showSkillActivation(actor: Side, move: BattleMove, board: BoardPiece[]) {
    const keys = buildSkillActivationEffectSoundKeys(move, actor, board);
    void playBattlePieceEffectSoundFirstMatch(keys, 'battleSkill', 0.92);
    const actorLabel = actor === 'player' ? 'あなた' : 'CPU';
    const skillName = resolveSkillName(move);
    const message = skillName
      ? `${actorLabel} スキル発動: ${skillName}`
      : `${actorLabel} スキル発動`;
    setSkillActivationText(message);
    if (skillToastTimeoutRef.current) {
      clearTimeout(skillToastTimeoutRef.current);
    }
    skillToastTimeoutRef.current = setTimeout(() => {
      setSkillActivationText(null);
      skillToastTimeoutRef.current = null;
    }, 1400);
  }

  function syncFromCanonicalPosition(
    position: BattleCanonicalPosition,
    game: BattleGameStatus,
    preservedMovedPiece?: PreservedMovedPiece,
    optimisticBaseline?: BoardPiece[] | null,
  ): Side | null {
    const synced = syncCanonicalState({
      position,
      stageNo: resolvedStageNo,
      existingPieces: piecesRef.current,
      persistentHazards: persistentHazardsRef.current,
      pieceCatalog,
      pieceSfenMapping,
      pieceDefsByCode,
      promotedPieceDefsByCode,
      preservedMovedPiece,
      optimisticBaseline,
    });
    setPromotionImageFlash(null);
    piecesRef.current = synced.pieces;
    handsRef.current = synced.hands;
    setPieces(synced.pieces);
    persistentHazardsRef.current = synced.persistentHazards;
    setPoisonHazardCells(synced.poisonHazardCells);
    setRockObstacleCells(synced.rockObstacleCells);
    setBatsuHazardCells(synced.batsuHazardCells);
    setArrowCells(synced.arrowCells);
    setThornHazardCells(synced.thornHazardCells);
    setSafeRoomHazardCells(synced.safeRoomHazardCells);
    setHenEdgeHighlightCells(synced.henEdgeHighlightCells);
    setHands(synced.hands);
    setSideToMove(synced.sideToMove);
    setMoveNo(synced.moveNo);
    setSelectedCell(null);
    setSelectedDropPieceCode(null);
    setLegalTargets([]);
    setEnemyPreviewTargets([]);
    setAiPreviewTarget(null);
    setPlayerLegalMoves([]);
    setPendingPromotion(null);
    setPendingTimeActionCell(null);
    setTimeActionMode(null);
    setPendingHouseSkillCell(null);
    latestMovementRuleByCellRef.current = synced.movementRuleByCell;
    latestImmobilizedByCellRef.current = synced.immobilizedKeys;
    stateHashRef.current = synced.stateHash;
    setStateHash(synced.stateHash);
    aiPositionRef.current = position;

    if (game.status === 'finished') {
      const nextWinner = game.winnerSide ?? null;
      setWinner(nextWinner);
      return nextWinner;
    }

    setWinner(null);
    setBoardSyncEpoch((e) => e + 1);
    return null;
  }

  const isFinished = winner !== null;

  useEffect(() => {
    const next = buildBoardPiecesFromSnapshotPlacements(snapshot.placements, pieceDefsByChar);
    const snapshotPersistentHazards = next.filter((p) => PERSISTENT_SYNC_GUARD_CHARS.has(p.char));
    const stageChanged = prevStageRef.current !== stageParam;
    prevStageRef.current = stageParam;
    const shouldRefreshFromSnapshot = stageChanged || (!gameId && snapshot.placements.length > 0);
    if (!shouldRefreshFromSnapshot) {
      return;
    }

    setPieces(applyKirinImmunityShieldMarkToPieces(next));
    persistentHazardsRef.current = snapshotPersistentHazards;
    setSideToMove('player');
    setMoveNo(1);
    setGameId(null);
    setAiError((prev) => (prev === RECOVERED_MOVE_SYNC_MESSAGE ? prev : null));
    setSelectedCell(null);
    setSelectedDropPieceCode(null);
    setLegalTargets([]);
    setEnemyPreviewTargets([]);
    setPendingSatoriEnemyPick(null);
    setPendingHeartAllyPick(null);
    setPoisonHazardCells([]);
    setRockObstacleCells([]);
    setBatsuHazardCells([]);
    setArrowCells([]);
    setThornHazardCells([]);
    setSafeRoomHazardCells([]);
    setHenEdgeHighlightCells([]);
    setAiPreviewTarget(null);
    setPlayerLegalMoves([]);
    setHands(createEmptyHandsState());
    setPendingPromotion(null);
    setStateHash(null);
    aiPositionRef.current = null;
    setWinner(null);
    setClearReward(null);
    setSkillActivationText(null);
    if (skillToastTimeoutRef.current) {
      clearTimeout(skillToastTimeoutRef.current);
      skillToastTimeoutRef.current = null;
    }
    aiThinkingRef.current = false;
    inFlightAiKeyRef.current = null;
    lastSuccessfulAiKeyRef.current = null;
    clearRewardClaimedRef.current = false;
    battleSessionSettledRef.current = false;
    hasEnteredBattleRef.current = false;
    pendingAiResumeRef.current = null;
    illegalRecoverSignatureRef.current = null;
    illegalRecoverAttemptsRef.current = 0;
  }, [gameId, pieceDefsByChar, snapshot, stageParam]);

  useEffect(() => {
    let active = true;
    loadPieceCatalogUseCase
      .execute()
      .then((items) => {
        if (active) {
          const catalog = preparePieceCatalogForBattleAndDisplay(items);
          setPieceCatalog(catalog);
          setLocalBattlePieceCatalog(catalog);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setAiError(toUserFacingBattleError(error));
        }
      });
    return () => {
      active = false;
    };
  }, [loadPieceCatalogUseCase]);

  /** 1手目: syncFromCanonical 前にステージ固定の×・矢印マスを表示 */
  useEffect(() => {
    if (!gameId) return;
    let active = true;
    void loadGameStateUseCase.execute({ gameId }).then((latest) => {
      if (!active || !isMountedRef.current) return;
      const displayPosition = positionWithStageFixedBoardTiles(latest.position, resolvedStageNo);
      setBatsuHazardCells(batsuHazardCellsForDisplay(displayPosition));
      setArrowCells(arrowCellsForDisplay(displayPosition));
      setPoisonHazardCells(poisonHazardCellsForDisplay(displayPosition));
      setRockObstacleCells(rockObstacleCellsForDisplay(displayPosition));
      setThornHazardCells(thornHazardCellsForDisplay(displayPosition));
      setSafeRoomHazardCells(safeRoomHazardCellsForDisplay(displayPosition));
      setHenEdgeHighlightCells(henEdgeHighlightCellsForDisplay(displayPosition));
    });
    return () => {
      active = false;
    };
  }, [gameId, loadGameStateUseCase, resolvedStageNo]);

  useEffect(() => {
    if (!loadError) return;
    setAiError(toUserFacingBattleError(loadError));
    setGameId(null);
    setWinner(null);
    setIsCreatingGame(false);
    setIsAiThinking(false);
    setPlayerLegalMoves([]);
  }, [loadError]);

  useEffect(() => {
    if (isLoading || loadError || isCreatingGame || gameId || !userId) return;
    if (pieceCatalog.length === 0) return;
    if (Object.keys(pieceSfenMapping.codeToSfen).length === 0) return;
    if (snapshot.placements.length > 0 && pieces.length === 0) return;

    setIsCreatingGame(true);
    const stageNo = Number(stageParam);
    void createGameUseCase
      .execute({
        playerId: userId,
        stageNo: Number.isInteger(stageNo) && stageNo > 0 ? stageNo : undefined,
        initialPosition: {
          sideToMove,
          turnNumber: moveNo,
          moveCount: moveNo - 1,
          sfen: buildSfen(pieces, hands, sideToMove, moveNo, pieceSfenMapping, pieceDefsByChar),
          boardState: buildBoardState(pieces, pieceDefsByCode, pieceDefsByChar),
          hands,
        },
      })
      .then((res) => {
        if (isMountedRef.current) {
          setGameId(res.gameId);
        }
      })
      .catch((error: unknown) => {
        if (isMountedRef.current) {
          setAiError(toUserFacingBattleError(error));
        }
      })
      .finally(() => {
        if (isMountedRef.current) {
          setIsCreatingGame(false);
        }
      });
  }, [
    createGameUseCase,
    gameId,
    hands,
    isCreatingGame,
    isLoading,
    loadError,
    moveNo,
    pieceDefsByChar,
    pieceDefsByCode,
    pieceCatalog.length,
    pieceSfenMapping,
    pieces,
    sideToMove,
    snapshot,
    stageParam,
    userId,
  ]);

  useEffect(() => {
    if (!gameId || sideToMove !== 'player' || isCreatingGame || isFinished) {
      return;
    }

    let active = true;
    setAiError(null);
    setIsLoadingPlayerLegalMoves(true);

    loadGameLegalMovesUseCase
      .execute({ gameId })
      .then((result) => {
        if (!active) return;
        if (result.sideToMove !== 'player' || result.moveNo !== moveNo) {
          setPlayerLegalMoves((prev) => (prev.length === 0 ? prev : []));
          return;
        }
        setStateHash(result.stateHash);
        if (result.legalMoves.length === 0) {
          setWinner('enemy');
          return;
        }
        const aligned = alignLegalMovesToBoardPieces(piecesRef.current, result.legalMoves);
        setPlayerLegalMoves(aligned);
        debugLogPieceMoveRanges('loadGameLegalMoves', result.sideToMove, moveNo, aligned);
      })
      .catch((error: unknown) => {
        if (active) {
          setAiError(toUserFacingBattleError(error));
          setPlayerLegalMoves((prev) => (prev.length === 0 ? prev : []));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingPlayerLegalMoves(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    boardSyncEpoch,
    gameId,
    isCreatingGame,
    isFinished,
    loadGameLegalMovesUseCase,
    moveNo,
    sideToMove,
  ]);

  useEffect(() => {
    if (Object.keys(failedImageKeys).length === 0) {
      return;
    }
    setFailedImageKeys({});
  }, [failedImageKeys, pieces]);

  useEffect(() => {
    if (!selectedCell) return;
    const at = findPieceAt(pieces, selectedCell.row, selectedCell.col);
    if (at?.darkVeiled) {
      setLegalTargets([]);
      setEnemyPreviewTargets([]);
    }
  }, [pieces, selectedCell]);

  /** 合法手が非同期で届いたあと・盤面同期後も、選択中の自駒の緑ハイライトを最新の playerLegalMoves に追従させる */
  useEffect(() => {
    if (!selectedCell) return;
    if (sideToMove !== 'player' || isAiThinking || isCreatingGame || isFinished) return;
    if (selectedDropPieceCode) return;
    if (
      pendingPromotion !== null ||
      pendingTimeActionCell !== null ||
      pendingHouseSkillCell !== null ||
      pendingSatoriEnemyPick !== null ||
      pendingHeartAllyPick !== null
    ) {
      return;
    }
    const at = findPieceAt(pieces, selectedCell.row, selectedCell.col);
    if (!at || at.side !== 'player') {
      setLegalTargets([]);
      setEnemyPreviewTargets([]);
      return;
    }
    if (at.darkVeiled) {
      setLegalTargets([]);
      setEnemyPreviewTargets([]);
      return;
    }
    const legalForCell = legalMovesForBoardPieceAt(
      playerLegalMoves,
      pieces,
      selectedCell.row,
      selectedCell.col,
    );
    const origin = legalMoveOriginCellForPiece(at, selectedCell.row, selectedCell.col);
    setLegalTargets(
      uniqueTargetsFromMoves(
        legalForCell.filter((m) => m.notation !== 'house_skill_only'),
        origin,
      ),
    );
    setEnemyPreviewTargets([]);
  }, [
    isAiThinking,
    isCreatingGame,
    isFinished,
    pendingHouseSkillCell,
    pendingPromotion,
    pendingSatoriEnemyPick,
    pendingHeartAllyPick,
    pendingTimeActionCell,
    pieces,
    playerLegalMoves,
    selectedCell,
    selectedDropPieceCode,
    sideToMove,
  ]);

  async function claimStageClearRewardIfNeeded() {
    if (clearRewardClaimedRef.current) return;
    clearRewardClaimedRef.current = true;
    battleSessionSettledRef.current = true;
    try {
      const result = await claimStageClearRewardUseCase.execute({ stageId: stageParam });
      if (!result) return;
      if (isMountedRef.current) {
        setClearReward({
          pawn: result.granted.pawn,
          gold: result.granted.gold,
        });
      }
      patchHomeSnapshotCurrency(result.wallet);
    } catch (error: unknown) {
      battleSessionSettledRef.current = false;
      setAiError(toUserFacingBattleError(error));
    }
  }

  function applyOptimisticMove(actorSide: Side, move: BattleMove) {
    const nextPieces = enforcePersistentHazardCells(
      computePiecesAfterOptimisticMove(
        piecesRef.current,
        actorSide,
        move,
        pieceDefsByCode,
        pieceDefsByChar,
        promotedPieceDefsByCode,
      ),
      persistentHazardsRef.current,
    );
    piecesRef.current = nextPieces;
    setPieces(nextPieces);
    if (move.dropPieceCode) {
      const nextHands = addHandPiece(handsRef.current, actorSide, move.dropPieceCode!, -1);
      handsRef.current = nextHands;
      setHands(nextHands);
    }
  }

  async function waitForNextFrame() {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  async function sendCommittedPlayerMoveAfterPaint(
    move: BattleMove,
    optimisticBaseline: BoardPiece[],
    preservedMovedPiece: PreservedMovedPiece | undefined,
    rollbackSnapshot?: { pieces: BoardPiece[]; hands: HandsState },
  ) {
    if (process.env.NODE_ENV !== 'test') {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    }
    await sendCommittedPlayerMoveToServer(
      move,
      optimisticBaseline,
      preservedMovedPiece,
      rollbackSnapshot,
    );
  }

  async function waitForAiMoveVisualCommit() {
    await waitForNextFrame();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 120);
    });
  }

  async function handleAiMove(nextMoveNo: number, expectedSideToMove: Side = sideToMove) {
    if (
      !gameId ||
      expectedSideToMove !== 'enemy' ||
      isAiThinking ||
      isCreatingGame ||
      aiThinkingRef.current
    ) {
      return;
    }
    const requestKey = `${gameId}:${nextMoveNo}:${expectedSideToMove}`;
    if (inFlightAiKeyRef.current === requestKey) return;
    if (lastSuccessfulAiKeyRef.current === requestKey) return;
    aiThinkingRef.current = true;
    inFlightAiKeyRef.current = requestKey;
    setIsAiThinking(true);
    setAiError(null);

    try {
      const maxSameTurnAiRetries = 14;
      let nextWinner: Side | null = null;
      let aiSequenceFinished = false;

      for (let attempt = 0; attempt <= maxSameTurnAiRetries; attempt++) {
        const response = await requestAiMoveUseCase.execute({
          gameId,
          moveNo: nextMoveNo,
          stateHash: stateHashRef.current,
          engineConfig: {},
        });

        if (attempt === 0 && response.skillTriggered && response.selectedMove) {
          showSkillActivation('enemy', response.selectedMove, piecesRef.current);
        }
        if (attempt === 0) {
          queueSkillVisualEffects(response.skillVisualEffects);
        }
        const patchedAiPosition = patchHandsForStarReturnSkill(
          response.position,
          'enemy',
          response.selectedMove,
          response.skillTriggered,
          handsRef.current,
        );

        let preservedMovedPiece: PreservedMovedPiece | undefined;
        let optimisticBaseline: BoardPiece[] | undefined;
        const selectedMove = response.selectedMove;
        const invalidSelfCaptureResolved =
          selectedMove &&
          isSelfCaptureLikeMove(
            piecesRef.current,
            selectedMove,
            'enemy',
            persistentHazardsRef.current,
          )
            ? resolveBattleMovePlacements(piecesRef.current, selectedMove)
            : null;
        if (attempt === 0 && invalidSelfCaptureResolved) {
          setAiError('CPU の着手候補が不正なため、盤面同期のみ行いました。');
        }
        const selectedMoveForApply = invalidSelfCaptureResolved ? null : selectedMove;
        if (selectedMoveForApply?.fromRow != null && selectedMoveForApply?.fromCol != null) {
          const moved = findPieceAt(
            piecesRef.current,
            selectedMoveForApply.fromRow,
            selectedMoveForApply.fromCol,
          );
          if (moved && moved.side === 'enemy') {
            const resolvedPieceCode = pieceCodeFromPlacement(
              moved.pieceCode ?? null,
              moved.char,
              pieceDefsByChar,
            );
            const codeKey = (resolvedPieceCode ?? moved.pieceCode ?? '').toUpperCase();
            const promoted = selectedMoveForApply.promote ? true : (moved.promoted ?? false);
            const promotedDef = selectedMoveForApply.promote
              ? promotedPieceDefsByCode[codeKey]
              : null;
            const imageSignedUrl = promotedDef?.imageSignedUrl ?? moved.imageSignedUrl ?? null;
            const resolvedChar = resolvedPieceCode
              ? pieceCharFromCode(resolvedPieceCode, moved.side, promoted)
              : moved.char;
            const char =
              resolvedChar === '?' ||
              (resolvedPieceCode != null && resolvedChar === resolvedPieceCode)
                ? moved.char
                : resolvedChar;
            preservedMovedPiece = {
              side: moved.side,
              toRow: selectedMoveForApply.toRow,
              toCol: selectedMoveForApply.toCol,
              pieceCode: resolvedPieceCode ?? moved.pieceCode ?? null,
              char,
              imageSignedUrl,
              promoted,
            };
          }
        }

        const showCpuMoveAnimation = attempt === 0 && Boolean(selectedMoveForApply);
        if (showCpuMoveAnimation && selectedMoveForApply) {
          optimisticBaseline = computePiecesAfterOptimisticMove(
            piecesRef.current,
            'enemy',
            selectedMoveForApply,
            pieceDefsByCode,
            pieceDefsByChar,
            promotedPieceDefsByCode,
          );
          setAiPreviewTarget({ row: selectedMoveForApply.toRow, col: selectedMoveForApply.toCol });
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 1000);
          });
          setAiPreviewTarget(null);
          applyOptimisticMove('enemy', selectedMoveForApply);
          playBattleMoveOrPromoteSe(
            selectedMoveForApply,
            'enemy',
            piecesRef.current,
            pieceDefsByCode,
            pieceDefsByChar,
            promotedPieceDefsByCode,
          );
          await waitForAiMoveVisualCommit();
        }

        if (selectedMoveForApply) {
          const board = (patchedAiPosition.boardState ?? {}) as Record<string, unknown>;
          const skillStateRaw =
            (board.skill_state as Record<string, unknown> | undefined) ??
            (board.skillState as Record<string, unknown> | undefined) ??
            {};
          const skillState = { ...skillStateRaw };
          const movedBefore =
            selectedMoveForApply.fromRow != null && selectedMoveForApply.fromCol != null
              ? findPieceAt(
                  piecesRef.current,
                  selectedMoveForApply.fromRow,
                  selectedMoveForApply.fromCol,
                )
              : null;
          const movedNow = findPieceAt(
            piecesRef.current,
            selectedMoveForApply.toRow,
            selectedMoveForApply.toCol,
          );
          const movedCodeFromBoard = movedBefore
            ? pieceCodeFromPlacement(
                movedBefore.pieceCode ?? null,
                movedBefore.char,
                pieceDefsByChar,
              )
            : movedNow
              ? pieceCodeFromPlacement(movedNow.pieceCode ?? null, movedNow.char, pieceDefsByChar)
              : null;
          const rawMovedCode =
            (movedCodeFromBoard ?? selectedMoveForApply.pieceCode ?? '').toUpperCase() || null;
          const movedCodeFromChar = movedBefore?.char
            ? toAiBasePieceCode(CHAR_TO_CODE[movedBefore.char] ?? null)
            : movedNow?.char
              ? toAiBasePieceCode(CHAR_TO_CODE[movedNow.char] ?? null)
              : null;
          const movedCode =
            (rawMovedCode && !/^PIECE_[A-Z0-9_]+$/i.test(rawMovedCode)
              ? rawMovedCode
              : (movedCodeFromChar ?? rawMovedCode)) || null;
          const movedCharRaw =
            movedBefore?.char && !/^piece_[a-z0-9]+$/i.test(movedBefore.char)
              ? movedBefore.char
              : movedNow?.char && !/^piece_[a-z0-9]+$/i.test(movedNow.char)
                ? movedNow.char
                : movedCode
                  ? pieceCharFromCode(movedCode, 'enemy', selectedMoveForApply.promote === true)
                  : '?';
          const movedChar =
            movedCharRaw && movedCharRaw !== '?' && movedCharRaw !== movedCode
              ? movedCharRaw
              : null;
          const movedDef =
            (movedCode ? pieceDefsByCode[movedCode] : undefined) ??
            (movedChar ? pieceDefsByChar[movedChar] : undefined);
          const copiedMoveVectors = Array.isArray(movedDef?.moveVectors)
            ? movedDef.moveVectors.map((v) => ({
                dx: v.dx,
                dy: v.dy,
                maxStep: v.maxStep,
                ...(v.captureMode ? { captureMode: v.captureMode } : {}),
              }))
            : [];
          skillState.last_enemy_moved_piece = {
            side: 'enemy',
            row: selectedMoveForApply.toRow,
            col: selectedMoveForApply.toCol,
            pieceCode: movedCode,
            char: movedChar,
            promoted: selectedMoveForApply.promote === true,
            copiedMoveVectors,
          };
          board.skill_state = skillState;
          patchedAiPosition.boardState = board;
        }

        nextWinner = syncFromCanonicalPosition(
          patchedAiPosition,
          response.game,
          preservedMovedPiece,
          optimisticBaseline,
        );

        if (nextWinner === 'player') {
          lastSuccessfulAiKeyRef.current = requestKey;
          aiSequenceFinished = true;
          void claimStageClearRewardIfNeeded();
          break;
        }

        const stopCpuRetry =
          response.game.status === 'finished' ||
          response.position.sideToMove === 'player' ||
          response.turnConsumed !== false;

        if (stopCpuRetry) {
          lastSuccessfulAiKeyRef.current = requestKey;
          aiSequenceFinished = true;
          break;
        }
      }

      if (!aiSequenceFinished) {
        lastSuccessfulAiKeyRef.current = requestKey;
        setAiError('CPU の着手が盾などで繰り返し無効化されました。盤面を確認してください。');
      }
    } catch (error: unknown) {
      if (isGameAlreadyFinishedError(error)) {
        setWinner('player');
        setAiError(null);
        void claimStageClearRewardIfNeeded();
      } else {
        if (isRecoverableMoveSyncError(error)) {
          const recovered = await recoverFromIllegalMoveIfNeeded();
          if (recovered) {
            setAiError(RECOVERED_MOVE_SYNC_MESSAGE);
            return;
          }
          pendingAiResumeRef.current = null;
          setAiError(
            '同じ局面で自動更新を複数回試しましたが復旧できませんでした。画面を開き直してください。',
          );
          return;
        }
        setAiError(toUserFacingBattleError(error));
      }
    } finally {
      setAiPreviewTarget(null);
      aiThinkingRef.current = false;
      inFlightAiKeyRef.current = null;
      setIsAiThinking(false);
    }
  }

  useEffect(
    () => {
      const pending = pendingAiResumeRef.current;
      if (!pending) return;
      if (!gameId || isAiThinking || isCreatingGame || isFinished) return;
      if (sideToMove !== 'enemy') return;
      pendingAiResumeRef.current = null;
      void handleAiMove(pending.moveNo, pending.side);
    },
    // `handleAiMove` は局面状態を広く閉じ込めるため意図的に通常関数のままにしている。
    // 再開判定は `pendingAiResumeRef` と各種 guard で制御している。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gameId, isAiThinking, isCreatingGame, isFinished, moveNo, sideToMove],
  );

  useEffect(() => {
    if (winner !== 'enemy') return;
    if (battleSessionSettledRef.current) return;
    battleSessionSettledRef.current = true;
    void claimStageClearRewardUseCase
      .execute({ stageId: stageParam, result: 'failed' })
      .catch(() => {
        if (isMountedRef.current) {
          battleSessionSettledRef.current = false;
        }
      });
  }, [claimStageClearRewardUseCase, stageParam, winner]);

  async function recoverFromIllegalMoveIfNeeded(): Promise<boolean> {
    if (!gameId || isRecoveringFromIllegalMoveRef.current) return false;
    isRecoveringFromIllegalMoveRef.current = true;
    try {
      const latest = await loadGameStateUseCase.execute({ gameId });
      const recoverSignature = `${latest.position.turnNumber}:${latest.position.sideToMove}:${latest.position.stateHash ?? '-'}`;
      if (illegalRecoverSignatureRef.current !== recoverSignature) {
        illegalRecoverSignatureRef.current = recoverSignature;
        illegalRecoverAttemptsRef.current = 1;
      } else {
        illegalRecoverAttemptsRef.current += 1;
      }
      if (illegalRecoverAttemptsRef.current > 3) {
        pendingAiResumeRef.current = null;
        return false;
      }
      setStateHash(latest.position.stateHash ?? null);
      const nextWinner = syncFromCanonicalPosition(latest.position, latest.game);
      if (nextWinner) {
        illegalRecoverSignatureRef.current = null;
        illegalRecoverAttemptsRef.current = 0;
        return true;
      }

      if (latest.position.sideToMove === 'player') {
        try {
          const legal = await loadGameLegalMovesUseCase.execute({ gameId });
          setStateHash(legal.stateHash ?? latest.position.stateHash ?? null);
          const aligned = alignLegalMovesToBoardPieces(piecesRef.current, legal.legalMoves);
          setPlayerLegalMoves(aligned);
          debugLogPieceMoveRanges(
            'recover-loadGameLegalMoves',
            latest.position.sideToMove,
            latest.position.turnNumber,
            aligned,
          );
          illegalRecoverSignatureRef.current = null;
          illegalRecoverAttemptsRef.current = 0;
        } catch {
          setPlayerLegalMoves([]);
        }
      } else {
        setPlayerLegalMoves([]);
        pendingAiResumeRef.current = {
          moveNo: latest.position.moveCount + 1,
          side: latest.position.sideToMove,
        };
      }
      setAiError(null);
      return true;
    } catch {
      return false;
    } finally {
      isRecoveringFromIllegalMoveRef.current = false;
    }
  }

  async function sendCommittedPlayerMoveToServer(
    move: BattleMove,
    optimisticBaseline: BoardPiece[],
    preservedMovedPiece: PreservedMovedPiece | undefined,
    rollbackSnapshot?: { pieces: BoardPiece[]; hands: HandsState },
  ) {
    if (!gameId) return;
    try {
      const result = await commitGameMoveUseCase.execute({
        gameId,
        moveNo,
        actorSide: 'player',
        move,
        stateHash: stateHashRef.current,
      });

      if (result.skillTriggered) {
        showSkillActivation('player', result.move, optimisticBaseline);
      }
      queueSkillVisualEffects(result.skillVisualEffects);
      let patchedPlayerPosition = patchHandsForStarReturnSkill(
        result.position,
        'player',
        result.move,
        result.skillTriggered,
      );
      const capturedBefore = rollbackSnapshot
        ? findPieceAt(rollbackSnapshot.pieces, move.toRow, move.toCol)
        : null;
      const capturedCodeUpper = (capturedBefore?.pieceCode ?? '').toUpperCase();
      const capturedCharNorm = (() => {
        try {
          return (capturedBefore?.char ?? '').normalize('NFKC');
        } catch {
          return capturedBefore?.char ?? '';
        }
      })();
      const capturedBook =
        capturedBefore?.side === 'enemy' &&
        (capturedCharNorm === '書' ||
          capturedCharNorm === '書物' ||
          capturedCodeUpper.includes('BOOK') ||
          capturedCodeUpper.includes('5D848242A136'));
      if (capturedBook) {
        const handsRoot = {
          player: { ...(patchedPlayerPosition.hands?.player ?? {}) },
          enemy: { ...(patchedPlayerPosition.hands?.enemy ?? {}) },
        };
        const beforeCount = Math.max(
          0,
          Math.floor((rollbackSnapshot?.hands.player?.BOOK as number) ?? 0),
        );
        const afterCount = Math.max(0, Math.floor((handsRoot.player.BOOK as number) ?? 0));
        if (afterCount <= beforeCount) {
          handsRoot.player.BOOK = afterCount + 1;
          patchedPlayerPosition = {
            ...patchedPlayerPosition,
            hands: handsRoot,
          };
        }
        console.log('[book-capture-debug] client-post-commit-fix', {
          beforeCount,
          afterCount,
          fixedCount: handsRoot.player.BOOK ?? afterCount,
          capturedChar: capturedBefore?.char ?? null,
          capturedCode: capturedBefore?.pieceCode ?? null,
          resultCapturedCode: result.move.capturedPieceCode ?? null,
        });
      }
      if (move.fromRow != null && move.fromCol != null) {
        const movedAfter = findPieceAt(optimisticBaseline, move.toRow, move.toCol);
        const movedCodeFromBoard = movedAfter
          ? pieceCodeFromPlacement(movedAfter.pieceCode ?? null, movedAfter.char, pieceDefsByChar)
          : null;
        const rawMovedCode = (movedCodeFromBoard ?? move.pieceCode ?? '').toUpperCase() || null;
        const movedCodeFromChar = movedAfter?.char
          ? toAiBasePieceCode(CHAR_TO_CODE[movedAfter.char] ?? null)
          : null;
        const movedCode =
          (rawMovedCode && !/^PIECE_[A-Z0-9_]+$/i.test(rawMovedCode)
            ? rawMovedCode
            : (movedCodeFromChar ?? rawMovedCode)) || null;
        const movedCharRaw =
          movedAfter?.char && !/^piece_[a-z0-9]+$/i.test(movedAfter.char)
            ? movedAfter.char
            : movedCode
              ? pieceCharFromCode(movedCode, 'player', move.promote === true)
              : '?';
        const movedChar =
          movedCharRaw && movedCharRaw !== '?' && movedCharRaw !== movedCode ? movedCharRaw : null;
        const movedDef =
          (movedCode ? pieceDefsByCode[movedCode] : undefined) ??
          (movedChar ? pieceDefsByChar[movedChar] : undefined);
        const copiedMoveVectors = Array.isArray(movedDef?.moveVectors)
          ? movedDef.moveVectors.map((v) => ({
              dx: v.dx,
              dy: v.dy,
              maxStep: v.maxStep,
              ...(v.captureMode ? { captureMode: v.captureMode } : {}),
            }))
          : [];
        const board = (patchedPlayerPosition.boardState ?? {}) as Record<string, unknown>;
        const skillStateRaw =
          (board.skill_state as Record<string, unknown> | undefined) ??
          (board.skillState as Record<string, unknown> | undefined) ??
          {};
        board.skill_state = {
          ...skillStateRaw,
          last_player_moved_piece: {
            side: 'player',
            row: move.toRow,
            col: move.toCol,
            pieceCode: movedCode,
            char: movedChar,
            promoted: move.promote === true,
            copiedMoveVectors,
          },
        };
        patchedPlayerPosition = {
          ...patchedPlayerPosition,
          boardState: board,
        };
      }

      const nextWinner = syncFromCanonicalPosition(
        patchedPlayerPosition,
        result.game,
        preservedMovedPiece,
        optimisticBaseline,
      );
      if (nextWinner === 'player') {
        void claimStageClearRewardIfNeeded();
        return;
      }
      if (result.position.sideToMove === 'enemy') {
        void handleAiMove(result.position.moveCount + 1, result.position.sideToMove);
      }
    } catch (error: unknown) {
      if (isRecoverableMoveSyncError(error)) {
        const recovered = await recoverFromIllegalMoveIfNeeded();
        if (recovered) {
          setAiError(RECOVERED_MOVE_SYNC_MESSAGE);
          return;
        }
        pendingAiResumeRef.current = null;
        setAiError(
          '同じ局面で自動更新を複数回試しましたが復旧できませんでした。画面を開き直してください。',
        );
        return;
      }
      if (rollbackSnapshot) {
        piecesRef.current = rollbackSnapshot.pieces;
        handsRef.current = rollbackSnapshot.hands;
        setPieces(rollbackSnapshot.pieces);
        setHands(rollbackSnapshot.hands);
      }
      setAiError(toUserFacingBattleError(error));
    }
  }

  async function commitPlayerMove(move: BattleMove) {
    const rollbackSnapshot = {
      pieces: piecesRenderRef.current,
      hands: handsRef.current,
    };

    if (!gameId || isAiThinking || isCreatingGame) return;

    const preservedMovedPiece = buildPreservedMovedPieceForPlayer(
      pieces,
      move,
      pieceDefsByChar,
      promotedPieceDefsByCode,
    );
    const optimisticBaseline = computePiecesAfterOptimisticMove(
      pieces,
      'player',
      move,
      pieceDefsByCode,
      pieceDefsByChar,
      promotedPieceDefsByCode,
    );

    const applyBoardAndClearSelection = () => {
      piecesRef.current = optimisticBaseline;
      setPieces(optimisticBaseline);
      if (move.dropPieceCode) {
        setHands((prev) => addHandPiece(prev, 'player', move.dropPieceCode!, -1));
      }
      setSelectedCell(null);
      setSelectedDropPieceCode(null);
      setLegalTargets([]);
      setEnemyPreviewTargets([]);
      setPendingSatoriEnemyPick(null);
      setPendingHeartAllyPick(null);
      setPlayerLegalMoves([]);
      setPendingPromotion(null);
      setAiError(null);
    };

    try {
      flushSync(applyBoardAndClearSelection);
    } catch {
      applyBoardAndClearSelection();
    }

    playBattleMoveOrPromoteSe(
      move,
      'player',
      optimisticBaseline,
      pieceDefsByCode,
      pieceDefsByChar,
      promotedPieceDefsByCode,
    );

    await sendCommittedPlayerMoveAfterPaint(
      move,
      optimisticBaseline,
      preservedMovedPiece,
      rollbackSnapshot,
    );
    setTimeActionMode(null);
  }

  async function commitTimeSkillOnly(cell: BoardCell, piece: BoardPiece) {
    if (!gameId || isAiThinking || isCreatingGame || isFinished) return;
    const rollbackSnapshot = {
      pieces: piecesRenderRef.current,
      hands: handsRef.current,
    };
    const move: BattleMove = {
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
    setPendingTimeActionCell(null);
    setTimeActionMode(null);
    setSelectedCell(null);
    setSelectedDropPieceCode(null);
    setLegalTargets([]);
    setEnemyPreviewTargets([]);
    setPlayerLegalMoves([]);
    setPendingPromotion(null);
    setAiError(null);
    await sendCommittedPlayerMoveAfterPaint(
      move,
      piecesRenderRef.current,
      undefined,
      rollbackSnapshot,
    );
  }

  async function commitHouseSkillOnly(cell: BoardCell, piece: BoardPiece) {
    if (!gameId || isAiThinking || isCreatingGame || isFinished) return;
    const rollbackSnapshot = {
      pieces: piecesRenderRef.current,
      hands: handsRef.current,
    };
    const move: BattleMove = {
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
    setPendingHouseSkillCell(null);
    setSelectedCell(null);
    setSelectedDropPieceCode(null);
    setLegalTargets([]);
    setEnemyPreviewTargets([]);
    setPlayerLegalMoves([]);
    setPendingPromotion(null);
    setPendingTimeActionCell(null);
    setTimeActionMode(null);
    setAiError(null);
    await sendCommittedPlayerMoveAfterPaint(
      move,
      piecesRenderRef.current,
      undefined,
      rollbackSnapshot,
    );
  }

  function commitPromotionChoice(move: BattleMove, pending: PendingPromotion) {
    if (!gameId || isAiThinking || isCreatingGame) return;
    const preBoard = piecesRenderRef.current;
    const trusted: TrustedBoardEndpoints = {
      fromRow: pending.boardFromRow,
      fromCol: pending.boardFromCol,
      toRow: pending.boardToRow,
      toCol: pending.boardToCol,
    };

    if (move.promote) {
      const atDest = findPieceAt(preBoard, pending.boardToRow, pending.boardToCol);
      if (atDest && atDest.side === 'player') {
        const mod = localPromotedModuleFromBaseCodeCandidates(
          collectStandardBaseCodesForLocalPromotedImage(atDest),
        );
        if (mod != null) {
          setPromotionImageFlash({
            row: pending.boardToRow,
            col: pending.boardToCol,
            side: 'player',
            assetModule: mod,
            flashKey: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          });
        } else {
          setPromotionImageFlash(null);
        }
      } else {
        setPromotionImageFlash(null);
      }
    } else {
      setPromotionImageFlash(null);
    }

    const snapshotBeforeDialog = piecesBeforePromotionDialogRef.current;
    piecesBeforePromotionDialogRef.current = null;

    let optimisticBaseline: BoardPiece[];
    let preservedMovedPiece: PreservedMovedPiece | undefined;
    if (move.promote) {
      const baseForPromote =
        snapshotBeforeDialog && snapshotBeforeDialog.length > 0 ? snapshotBeforeDialog : preBoard;
      optimisticBaseline = computePiecesAfterOptimisticMove(
        baseForPromote,
        'player',
        move,
        pieceDefsByCode,
        pieceDefsByChar,
        promotedPieceDefsByCode,
        trusted,
      );
      preservedMovedPiece = buildPreservedMovedPieceForPlayer(
        snapshotBeforeDialog && snapshotBeforeDialog.length > 0
          ? snapshotBeforeDialog
          : baseForPromote,
        move,
        pieceDefsByChar,
        promotedPieceDefsByCode,
        trusted,
      );
    } else {
      optimisticBaseline = preBoard;
      preservedMovedPiece = buildPreservedMovedPieceForPlayer(
        preBoard,
        move,
        pieceDefsByChar,
        promotedPieceDefsByCode,
        trusted,
      );
    }

    piecesRef.current = optimisticBaseline;
    setPieces(optimisticBaseline);
    if (move.promote) {
      setBoardSpriteEpoch((e) => e + 1);
    }
    setSelectedCell(null);
    setSelectedDropPieceCode(null);
    setLegalTargets([]);
    setEnemyPreviewTargets([]);
    setPlayerLegalMoves([]);
    setPendingPromotion(null);
    setAiError(null);

    const rollbackSnapshot = {
      pieces:
        snapshotBeforeDialog && snapshotBeforeDialog.length > 0 ? snapshotBeforeDialog : preBoard,
      hands: handsRef.current,
    };

    playBattleMoveOrPromoteSe(
      move,
      'player',
      optimisticBaseline,
      pieceDefsByCode,
      pieceDefsByChar,
      promotedPieceDefsByCode,
    );

    void sendCommittedPlayerMoveAfterPaint(
      move,
      optimisticBaseline,
      preservedMovedPiece,
      rollbackSnapshot,
    );
  }

  function beginSatoriEnemySelectionIfNeeded(actionableMoves: BattleMove[]): boolean {
    const stunVariants = actionableMoves.filter(
      (m) => typeof m.notation === 'string' && /^satori_stun:\d+:\d+$/i.test(m.notation),
    );
    if (stunVariants.length <= 1) return false;
    const cells = stunVariants.map((mv) => {
      const matched = /^satori_stun:(\d+):(\d+)$/i.exec(mv.notation!);
      if (!matched) {
        return { row: mv.toRow, col: mv.toCol };
      }
      return { row: Number(matched[1]), col: Number(matched[2]) };
    });
    setPendingSatoriEnemyPick(stunVariants);
    setPendingHeartAllyPick(null);
    setSelectedCell(null);
    setSelectedDropPieceCode(null);
    setLegalTargets([]);
    setEnemyPreviewTargets(cells);
    setPendingHouseSkillCell(null);
    setPendingTimeActionCell(null);
    setTimeActionMode(null);
    return true;
  }

  function beginHeartAllySelectionIfNeeded(actionableMoves: BattleMove[]): boolean {
    const protectVariants = actionableMoves.filter(
      (m) => typeof m.notation === 'string' && /^heart_protect:\d+:\d+$/i.test(m.notation),
    );
    if (protectVariants.length <= 1) return false;
    const cells = protectVariants.map((mv) => {
      const matched = /^heart_protect:(\d+):(\d+)$/i.exec(mv.notation!);
      if (!matched) {
        return { row: mv.toRow, col: mv.toCol };
      }
      return { row: Number(matched[1]), col: Number(matched[2]) };
    });
    setPendingHeartAllyPick(protectVariants);
    setPendingSatoriEnemyPick(null);
    setSelectedCell(null);
    setSelectedDropPieceCode(null);
    setLegalTargets(cells);
    setEnemyPreviewTargets([]);
    setPendingHouseSkillCell(null);
    setPendingTimeActionCell(null);
    setTimeActionMode(null);
    return true;
  }

  function handleCellPress(row: number, col: number) {
    if (sideToMove !== 'player' || isAiThinking || isCreatingGame || isFinished) return;
    if (pendingPromotion) return;

    const tapped = { row, col };
    if (pendingSatoriEnemyPick && pendingSatoriEnemyPick.length > 0) {
      const enemyHere = findPieceAt(pieces, row, col);
      if (enemyHere?.side === 'enemy') {
        const matched = pendingSatoriEnemyPick.find((mv) => {
          const p = /^satori_stun:(\d+):(\d+)$/i.exec(mv.notation ?? '');
          return p != null && Number(p[1]) === row && Number(p[2]) === col;
        });
        if (matched) {
          setPendingSatoriEnemyPick(null);
          setEnemyPreviewTargets([]);
          void commitPlayerMove(matched);
        }
        return;
      }
      setPendingSatoriEnemyPick(null);
      setEnemyPreviewTargets([]);
      return;
    }

    if (pendingHeartAllyPick && pendingHeartAllyPick.length > 0) {
      const allyHere = findPieceAt(pieces, row, col);
      if (allyHere?.side === 'player') {
        const matched = pendingHeartAllyPick.find((mv) => {
          const p = /^heart_protect:(\d+):(\d+)$/i.exec(mv.notation ?? '');
          return p != null && Number(p[1]) === row && Number(p[2]) === col;
        });
        if (matched) {
          setPendingHeartAllyPick(null);
          setLegalTargets([]);
          void commitPlayerMove(matched);
        }
        return;
      }
      setPendingHeartAllyPick(null);
      setLegalTargets([]);
      return;
    }

    if (selectedDropPieceCode) {
      const dropMoves = legalMovesToTarget(
        legalMovesForDropPiece(playerLegalMoves, selectedDropPieceCode, pieceCatalog),
        tapped,
      );
      const dropCandidates = dropMoves.filter((m) => m.notation !== 'house_skill_only');
      if (dropCandidates.length > 0) {
        if (beginSatoriEnemySelectionIfNeeded(dropCandidates)) return;
        if (beginHeartAllySelectionIfNeeded(dropCandidates)) return;
        void commitPlayerMove(dropCandidates[0]!);
        return;
      }
      const tappedPiece = findPieceAt(pieces, row, col);
      if (!tappedPiece || tappedPiece.side !== 'player') {
        return;
      }
      setSelectedDropPieceCode(null);
      setLegalTargets([]);
      setTimeActionMode(null);
    }

    if (selectedCell) {
      const selectedPiece = findPieceAt(pieces, selectedCell.row, selectedCell.col);
      const selectedOrigin = selectedPiece
        ? legalMoveOriginCellForPiece(selectedPiece, selectedCell.row, selectedCell.col)
        : selectedCell;
      const targetMoves = legalMovesToTarget(
        legalMovesForBoardPieceAt(playerLegalMoves, pieces, selectedCell.row, selectedCell.col),
        tapped,
        selectedOrigin,
      );
      const actionableMoves = targetMoves.filter((m) => m.notation !== 'house_skill_only');
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
        const isTimeSelected =
          selectedPiece?.side === 'player' &&
          ((selectedPiece.pieceCode?.toUpperCase() ?? '') === 'TIME' ||
            selectedPiece.char === '時');
        const moveWithTimeAction = (m: BattleMove): BattleMove => {
          if (!isTimeSelected || !timeActionMode) return m;
          if (timeActionMode === 'normal') return { ...m, notation: null };
          return { ...m, notation: 'time_skill' };
        };
        const promoteMove = actionableMoves.find((move) => move.promote);
        const nonPromoteMove = actionableMoves.find((move) => !move.promote);
        if (promoteMove && nonPromoteMove) {
          setPromotionImageFlash(null);
          piecesBeforePromotionDialogRef.current = pieces.map((p) => ({ ...p }));
          const afterNonPromote = computePiecesAfterOptimisticMove(
            pieces,
            'player',
            nonPromoteMove,
            pieceDefsByCode,
            pieceDefsByChar,
            promotedPieceDefsByCode,
          );
          piecesRef.current = afterNonPromote;
          setPieces(afterNonPromote);
          setBoardSpriteEpoch((e) => e + 1);
          setSelectedCell(null);
          setLegalTargets([]);
          setEnemyPreviewTargets([]);
          setPendingPromotion({
            promoteMove: moveWithTimeAction(promoteMove),
            nonPromoteMove: moveWithTimeAction(nonPromoteMove),
            boardFromRow: selectedCell.row,
            boardFromCol: selectedCell.col,
            boardToRow: tapped.row,
            boardToCol: tapped.col,
          });
          return;
        }
        if (beginSatoriEnemySelectionIfNeeded(actionableMoves)) {
          return;
        }
        if (beginHeartAllySelectionIfNeeded(actionableMoves)) {
          return;
        }
        void commitPlayerMove(
          moveWithTimeAction(promoteMove ?? nonPromoteMove ?? actionableMoves[0]),
        );
        return;
      }
    }

    const piece = findPieceAt(pieces, row, col);
    if (piece?.side === 'enemy') {
      const pieceKey = `${piece.side}:${piece.row}:${piece.col}`;
      const immobilizedBySkill =
        !isGiantPieceForEngine(piece) && latestImmobilizedByCellRef.current.has(pieceKey);
      if (immobilizedBySkill) {
        setSelectedCell(null);
        setSelectedDropPieceCode(null);
        setLegalTargets([]);
        setEnemyPreviewTargets([{ row: piece.row, col: piece.col }]);
        return;
      }

      let previewTargets: BoardCell[] = [];
      if (gameId && pieceCatalog.length > 0) {
        try {
          const record = getLocalBattleGame(gameId);
          const built = buildBoardState(pieces, pieceDefsByCode, pieceDefsByChar) as Record<
            string,
            unknown
          >;
          const regBoard = record?.position?.boardState as Record<string, unknown> | undefined;
          const latestBoard = aiPositionRef.current?.boardState as
            | Record<string, unknown>
            | undefined;
          const mergedBoard: Record<string, unknown> = { ...built };
          const latestSkillState = latestBoard?.skill_state ?? latestBoard?.skillState ?? null;
          if (latestSkillState != null) {
            mergedBoard.skill_state = latestSkillState;
          }
          if (regBoard != null) {
            const skillState = regBoard.skill_state ?? regBoard.skillState;
            if (skillState != null && mergedBoard.skill_state == null) {
              mergedBoard.skill_state = skillState;
            }
          }
          const inspectPosition: BattleCanonicalPosition = {
            sideToMove: 'enemy',
            turnNumber: moveNo,
            moveCount: Math.max(0, moveNo - 1),
            sfen: buildSfen(pieces, hands, 'enemy', moveNo, pieceSfenMapping, pieceDefsByChar),
            stateHash: stateHashRef.current ?? stateHash,
            boardState: mergedBoard,
            hands: {
              player: { ...hands.player },
              enemy: { ...hands.enemy },
            },
          };
          const { legalMoves } = generateLegalMoves({
            position: inspectPosition as unknown as AiBattlePosition,
            pieceCatalog: normalizePieceCatalog(pieceCatalogNormalized),
          });
          previewTargets = uniqueTargetsFromMoves(
            legalMoves.filter(
              (m) =>
                m.dropPieceCode === null &&
                m.fromRow === piece.row &&
                m.fromCol === piece.col &&
                m.notation !== 'house_skill_only' &&
                m.notation !== 'time_skill_only' &&
                typeof m.notation === 'string' &&
                !m.notation.startsWith('satori_stun:') &&
                !m.notation.startsWith('heart_protect:'),
            ),
          );
        } catch {
          previewTargets = [];
        }
      }

      if (previewTargets.length === 0) {
        const immobilizedKey = `${piece.side}:${piece.row}:${piece.col}`;
        const auraImmobilized = passiveAuraImmobilizedCellKeys(
          pieces.map((p) => ({
            side: p.side,
            row: p.row,
            col: p.col,
            pieceCode: p.pieceCode ?? null,
            char: p.char,
            promoted: Boolean(p.promoted),
            imageSignedUrl: p.imageSignedUrl ?? null,
          })),
        );
        const immobilizedByAura =
          latestImmobilizedByCellRef.current.has(immobilizedKey) ||
          auraImmobilized.has(immobilizedKey);
        if (!immobilizedByAura) {
          const enemyPieceDef =
            piece.promoted && piece.pieceCode
              ? (promotedPieceDefsByCode[piece.pieceCode] ?? pieceDefsByCode[piece.pieceCode])
              : ((piece.pieceCode ? pieceDefsByCode[piece.pieceCode] : null) ??
                pieceDefsByChar[piece.char] ??
                null);
          const previewVectorsWithField = mergePeopleFieldDiagonalMoveVectors(
            piece,
            enemyPieceDef?.moveVectors ?? [],
            pieces,
          );
          const previewVectors = applyAdjacentMedicineMoveRangeBuff(
            piece,
            previewVectorsWithField,
            pieces,
          );
          const pathPieces = appendRockObstacleVirtualPiecesForPreview(
            pieces,
            rockObstacleCells,
            piece.side,
          );
          const rawTargets = previewVectors.length
            ? getLegalTargetsFromVectors(pathPieces, piece, previewVectors, BOARD_SIZE, {
                canJump: enemyPieceDef?.canJump === true,
              })
            : [];
          const movementRule =
            latestMovementRuleByCellRef.current.get(`${piece.side}:${piece.row}:${piece.col}`) ??
            null;
          previewTargets = applyMovementRuleToTargets(
            { row: piece.row, col: piece.col },
            rawTargets,
            movementRule,
            { movingPiece: piece, allPieces: pieces },
          );
        }
      }

      setSelectedCell(null);
      setSelectedDropPieceCode(null);
      setLegalTargets([]);
      setEnemyPreviewTargets(previewTargets);
      return;
    }

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
      setPendingTimeActionCell(null);
      setTimeActionMode(null);
      return;
    }

    const isTimePiece = (piece.pieceCode?.toUpperCase() ?? '') === 'TIME' || piece.char === '時';
    if (isTimePiece && !selectedCell) {
      if (hasAdjacentEnemyPiece(pieces, row, col)) {
        setPendingTimeActionCell({ row, col });
        return;
      }
      setTimeActionMode('normal');
    }

    const legalForCell = legalMovesForBoardPieceAt(playerLegalMoves, pieces, row, col);
    const origin = legalMoveOriginCellForPiece(piece, row, col);
    const isHousePieceTap =
      !selectedDropPieceCode && isPlayerHousePieceForSkillUi(piece, pieceDefsByChar);
    if (isHousePieceTap) {
      const peopleOnBoard = countPeopleOnBoardUi(pieces, pieceDefsByChar);
      if (peopleOnBoard < 5) {
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
    const pieceKey = `${piece.side}:${piece.row}:${piece.col}`;
    const movementRule = isGiantPieceForEngine(piece)
      ? null
      : (latestMovementRuleByCellRef.current.get(pieceKey) ?? null);
    const immobilizedBySkill =
      !isGiantPieceForEngine(piece) && latestImmobilizedByCellRef.current.has(pieceKey);
    const affectedBySkill = movementRule != null || immobilizedBySkill || Boolean(piece.darkVeiled);
    if (targets.length === 0) {
      if (affectedBySkill) {
        setSelectedDropPieceCode(null);
        setSelectedCell({ row, col });
        setLegalTargets([]);
        setEnemyPreviewTargets([{ row, col }]);
        setPendingTimeActionCell(null);
        setTimeActionMode(null);
        return;
      }
      setSelectedCell(null);
      setLegalTargets([]);
      setEnemyPreviewTargets([]);
      setPendingTimeActionCell(null);
      setTimeActionMode(null);
      return;
    }

    setSelectedDropPieceCode(null);
    setSelectedCell({ row: origin.row, col: origin.col });
    // 自駒の合法マスは常に legalTargets（緑枠）で示す。畑バフの斜めなどもここに載せる。
    setLegalTargets(piece.darkVeiled ? [] : targets);
    setEnemyPreviewTargets([]);
    setPendingTimeActionCell(null);
  }

  function confirmHouseSkill() {
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
    void commitHouseSkillOnly(cell, piece);
  }

  function confirmTimeAction(mode: TimeActionMode) {
    const cell = pendingTimeActionCell;
    if (!cell) return;
    const piece = findPieceAt(pieces, cell.row, cell.col);
    if (!piece || piece.side !== 'player') {
      setPendingTimeActionCell(null);
      setTimeActionMode(null);
      return;
    }
    const origin = legalMoveOriginCellForPiece(piece, cell.row, cell.col);
    const targets = uniqueTargetsFromMoves(
      legalMovesForBoardPieceAt(playerLegalMoves, pieces, cell.row, cell.col),
      origin,
    );
    if (targets.length === 0) {
      setPendingTimeActionCell(null);
      setTimeActionMode(null);
      return;
    }
    if (mode === 'skill') {
      void commitTimeSkillOnly(cell, piece);
      return;
    }
    setTimeActionMode(mode);
    setSelectedDropPieceCode(null);
    setSelectedCell(cell);
    setLegalTargets(piece.darkVeiled ? [] : targets);
    setEnemyPreviewTargets([]);
    setPendingTimeActionCell(null);
  }

  function openInspectingPieceFromPlacement(target: BoardPiece) {
    const lookupChar =
      target.promoted && target.pieceCode
        ? (PROMOTED_CODE_TO_CHAR[target.pieceCode] ?? target.char)
        : target.char;
    const resolvedChar =
      lookupChar === '?' && target.pieceCode
        ? pieceCharFromCode(target.pieceCode, target.side, target.promoted === true)
        : lookupChar;
    const opaqueBookCode =
      typeof target.pieceCode === 'string' && /5D848242A136/i.test(target.pieceCode);
    const opaqueSaintCode =
      typeof target.pieceCode === 'string' && /A3BAB6C13DC7/i.test(target.pieceCode);
    const opaqueBeastCode =
      typeof target.pieceCode === 'string' && /05E4EFB89DAE/i.test(target.pieceCode);
    const opaqueBirdCode =
      typeof target.pieceCode === 'string' && /29ECAB1EF3C3/i.test(target.pieceCode);
    const displayChar =
      resolvedChar && resolvedChar !== '?'
        ? resolvedChar
        : (target.pieceCode ?? '').toUpperCase() === 'BOOK'
          ? '書'
          : opaqueBookCode
            ? '書'
            : (target.pieceCode ?? '').toUpperCase() === 'SAINT'
              ? '聖'
              : opaqueSaintCode
                ? '聖'
                : (target.pieceCode ?? '').toUpperCase() === 'BEAST' || opaqueBeastCode
                  ? '獣'
                  : (target.pieceCode ?? '').toUpperCase() === 'BIRD' || opaqueBirdCode
                    ? '禽'
                    : lookupChar;
    const pieceCodeLookupKey =
      typeof target.pieceCode === 'string' ? target.pieceCode.toUpperCase() : '';
    const detail =
      pieceDefsByChar[displayChar] ??
      (pieceCodeLookupKey ? pieceDefsByCode[pieceCodeLookupKey] : undefined) ??
      null;
    const pieceCodeLower = (target.pieceCode ?? '').toLowerCase();
    const oniNameOverride =
      displayChar === '青鬼' || pieceCodeLower === 'blueoni'
        ? '青鬼'
        : displayChar === '黒鬼' || pieceCodeLower === 'blackoni'
          ? '黒鬼'
          : displayChar === '赤鬼' ||
              pieceCodeLower === 'redoni' ||
              pieceCodeLookupKey.includes('533B7FEC5456')
            ? '赤鬼'
            : null;

    const beastNameOverride =
      displayChar === '獣' || pieceCodeLower === 'beast' || opaqueBeastCode ? '獣神' : null;
    const birdNameOverride =
      displayChar === '禽' || pieceCodeLower === 'bird' || opaqueBirdCode ? '猛禽類' : null;

    setInspectingPiece({
      char: displayChar,
      pieceCode: target.pieceCode,
      name:
        (target.pieceCode ?? '').toUpperCase() === 'BOOK' || displayChar === '書'
          ? '書物'
          : (oniNameOverride ??
            beastNameOverride ??
            birdNameOverride ??
            detail?.name ??
            displayChar),
      skill:
        detail?.skill ??
        resolveInspectSkillDescription(displayChar, detail?.desc, target.pieceCode),
      move:
        detail?.move ?? resolveInspectMoveDescription(displayChar, detail?.move, target.pieceCode),
      imageSignedUrl: detail?.imageSignedUrl ?? target.imageSignedUrl ?? null,
    });
  }

  function handleCellLongPress(row: number, col: number) {
    const target = findPieceAt(pieces, row, col);
    if (!target) return;
    openInspectingPieceFromPlacement(target);
  }

  function handleHandPieceLongPress(pieceCode: string, side: Side) {
    const codeKey = handKeyToDisplayPieceCode(pieceCode, pieceCatalog).toUpperCase();
    if (getHandCount(hands, side, codeKey) <= 0) return;
    const char =
      CODE_TO_CHAR[codeKey] ??
      pieceDefsByCode[codeKey]?.char ??
      pieceCharFromCode(codeKey, side, false) ??
      '?';
    openInspectingPieceFromPlacement({
      side,
      row: 0,
      col: 0,
      pieceCode: codeKey,
      char,
      promoted: false,
      imageSignedUrl: pieceDefsByCode[codeKey]?.imageSignedUrl ?? null,
    });
  }

  function handleHandPiecePress(pieceCode: string) {
    if (sideToMove !== 'player' || isAiThinking || isCreatingGame || isFinished) return;
    if (pendingPromotion) return;
    if (getHandCount(hands, 'player', pieceCode) <= 0) return;

    const targets = uniqueTargetsFromMoves(
      legalMovesForDropPiece(playerLegalMoves, pieceCode, pieceCatalog),
    );
    setSelectedCell(null);
    setSelectedDropPieceCode(pieceCode);
    setLegalTargets(targets);
    setEnemyPreviewTargets([]);
  }

  handleCellPressRef.current = handleCellPress;

  const handleBoardCellPress = (row: number, col: number) => {
    handleCellPressRef.current(row, col);
  };

  const handlePieceImageError = (placementKey: string) => {
    setFailedImageKeys((prev) => (prev[placementKey] ? prev : { ...prev, [placementKey]: true }));
  };

  const shouldBootstrapBattle =
    !isLoading &&
    !loadError &&
    !!userId &&
    Object.keys(pieceSfenMapping.codeToSfen).length > 0 &&
    (snapshot.placements.length === 0 || pieces.length > 0) &&
    !gameId &&
    aiError === null &&
    !isFinished;

  const isWaitingForGameId =
    !isLoading && !loadError && !gameId && isCreatingGame && aiError === null;

  const isBootstrappingBattle =
    shouldBootstrapBattle ||
    isWaitingForGameId ||
    (!hasEnteredBattleRef.current &&
      gameId !== null &&
      sideToMove === 'player' &&
      playerLegalMoves.length === 0 &&
      isLoadingPlayerLegalMoves);

  if (
    !hasEnteredBattleRef.current &&
    gameId !== null &&
    !isCreatingGame &&
    sideToMove === 'player' &&
    playerLegalMoves.length > 0
  ) {
    hasEnteredBattleRef.current = true;
  }

  const boardDisplayPieces = useMemo(() => applyKirinImmunityShieldMarkToPieces(pieces), [pieces]);

  return {
    snapshot,
    isLoading,
    aiError,
    isFinished,
    isBootstrappingBattle,
    failedImageKeys,
    pieces: boardDisplayPieces,
    boardSpriteEpoch,
    sideToMove,
    moveNo,
    isCreatingGame,
    isAiThinking,
    selectedCell,
    selectedDropPieceCode,
    legalTargets,
    aiPreviewTarget,
    enemyPreviewTargets,
    poisonHazardCells,
    rockObstacleCells,
    batsuHazardCells,
    arrowCells,
    thornHazardCells,
    safeRoomHazardCells,
    henEdgeHighlightCells,
    hands,
    pendingPromotion,
    pendingTimeActionCell,
    pendingHouseSkillCell,
    pendingSatoriEnemyPick,
    pendingHeartAllyPick,
    promotionImageFlash,
    pieceCatalog,
    pieceDefsByCode,
    pieceSfenMapping,
    winner,
    clearReward,
    skillActivationText,
    skillVisualEffects,
    handleSkillVisualEffectFinished,
    inspectingPiece,
    handleBoardCellPress,
    handleCellLongPress,
    handleHandPieceLongPress,
    handleHandPiecePress,
    handlePieceImageError,
    confirmTimeAction,
    cancelTimeAction: () => {
      setPendingTimeActionCell(null);
      setTimeActionMode(null);
    },
    confirmHouseSkill,
    cancelHouseSkill: () => {
      setPendingHouseSkillCell(null);
    },
    commitPendingPromotion: (kind: 'promote' | 'nonPromote') => {
      const pending = pendingPromotion;
      if (!pending) return;
      commitPromotionChoice(
        kind === 'promote' ? pending.promoteMove : pending.nonPromoteMove,
        pending,
      );
    },
    closeInspectingPiece: () => {
      setInspectingPiece(null);
    },
  };
}
