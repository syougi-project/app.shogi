import type {
  AiBattleMove,
  AiBattlePosition,
  AiBoardPiece,
  BoardPieceIndex,
  AiPieceDefinition,
  Side,
} from '@/ai/model';
import type { BattleAiTurn } from '@/usecases/stage-battle/game-move-contract';
import type { StageAiConfig } from '@/constants/stage-ai-config';
import {
  buildBoardPieceIndex,
  getBoardPieceAt,
  normalizeBattlePosition,
  piecesFromBoardState,
  toBasePieceCode,
} from '@/ai/model';
import { PIECE_VALUES } from '@/ai/engine/shared';
import { applyMove } from '@/ai/engine/apply-move';
import {
  ensureShinTurnMimicForBattle,
  generateLegalMoves,
  type GenerateLegalMovesOptions,
} from '@/ai/engine/legal-moves';
import {
  deckBuilderCostForBoardPiece,
  deckBuilderCostForHandPieceCode,
} from '@/ai/engine/piece-deck-cost';
import { normalizeStageAiConfig } from '@/constants/stage-ai-config';
import { yieldToMainThread } from '@/lib/async/yield-to-main-thread';

export type ComputeAiMoveInput = {
  position: AiBattlePosition;
  pieceCatalog: AiPieceDefinition[];
  config?: Partial<StageAiConfig>;
  recentEnemyMoves?: AiBattleMove[];
  random?: () => number;
  legalMoveOptions?: GenerateLegalMovesOptions;
};

const PROMOTED_BOARD_PIECE_VALUES: Readonly<Record<string, number>> = {
  FU: 420,
  KY: 630,
  KE: 640,
  GI: 670,
  KA: 1150,
  HI: 1300,
};

const HAND_PIECE_VALUES: Readonly<Record<string, number>> = {
  FU: 115,
  KY: 480,
  KE: 510,
  GI: 720,
  KI: 780,
  KA: 1110,
  HI: 1270,
};

function basePieceValue(
  pieceCode: string | null | undefined,
  fallbackChar?: string | null,
): number {
  const base = toBasePieceCode(pieceCode);
  if (base && PIECE_VALUES[base] != null) return PIECE_VALUES[base]!;
  const deckCost =
    fallbackChar != null
      ? deckBuilderCostForBoardPiece({ char: fallbackChar, pieceCode: base ?? pieceCode ?? null })
      : base
        ? deckBuilderCostForHandPieceCode(base)
        : 0;
  if (deckCost > 0) return deckCost * 100;
  return 150;
}

function boardPieceValue(piece: AiBoardPiece | null | undefined): number {
  if (!piece) return 0;
  const base = toBasePieceCode(piece.pieceCode);
  if (piece.promoted && base && PROMOTED_BOARD_PIECE_VALUES[base] != null) {
    return PROMOTED_BOARD_PIECE_VALUES[base]!;
  }
  return basePieceValue(piece.pieceCode, piece.char);
}

function handPieceValue(
  pieceCode: string | null | undefined,
  fallbackChar?: string | null,
): number {
  const base = toBasePieceCode(pieceCode);
  if (base && HAND_PIECE_VALUES[base] != null) return HAND_PIECE_VALUES[base]!;
  return basePieceValue(base ?? pieceCode, fallbackChar);
}

function captureGainValue(
  capturedPiece: AiBoardPiece | null,
  capturedPieceCode: string | null,
): number {
  if (!capturedPiece && !capturedPieceCode) return 0;
  const boardValue = capturedPiece
    ? boardPieceValue(capturedPiece)
    : basePieceValue(capturedPieceCode);
  const handValue = handPieceValue(
    capturedPiece?.pieceCode ?? capturedPieceCode,
    capturedPiece?.char ?? null,
  );
  const baseValue = basePieceValue(
    capturedPiece?.pieceCode ?? capturedPieceCode,
    capturedPiece?.char,
  );
  return boardValue + Math.max(0, handValue - baseValue);
}

function movingPieceActivityScore(
  pieceValue: number,
  isKing: boolean,
  config: StageAiConfig,
): number {
  if (isKing) return -config.kingMovePenalty;
  return (
    Math.min(Math.max(pieceValue, 0), config.activityPieceValueCap) / config.activityScoreDivisor
  );
}

function moveScore(
  move: AiBattleMove,
  side: Side,
  config: StageAiConfig,
  pieceIndex?: BoardPieceIndex,
): number {
  const movingPiece =
    move.fromRow == null || move.fromCol == null
      ? null
      : pieceIndex
        ? getBoardPieceAt(pieceIndex, move.fromRow, move.fromCol)
        : null;
  const capturedPiece =
    move.capturedPieceCode == null
      ? null
      : pieceIndex
        ? getBoardPieceAt(pieceIndex, move.toRow, move.toCol)
        : null;
  const pieceCode = toBasePieceCode(move.dropPieceCode ?? move.pieceCode) ?? 'FU';
  const forward = side === 'enemy' ? move.toRow : 8 - move.toRow;
  const captureValue = captureGainValue(capturedPiece, move.capturedPieceCode);
  const movingValue = movingPiece
    ? boardPieceValue(movingPiece)
    : handPieceValue(move.dropPieceCode ?? pieceCode);
  const activityScore = movingPieceActivityScore(movingValue, pieceCode === 'OU', config);
  const promotionBonus = move.promote ? config.promotionBonus : 0;
  return (
    captureValue * config.captureValueWeight +
    promotionBonus +
    activityScore +
    forward * config.forwardProgressWeight
  );
}

function opponentOf(side: Side): Side {
  return side === 'enemy' ? 'player' : 'enemy';
}

function findKing(pieceIndex: BoardPieceIndex, side: Side): AiBoardPiece | null {
  return (
    pieceIndex.bySide[side].find((piece) => {
      const code = toBasePieceCode(piece.pieceCode);
      return code === 'OU' || piece.char === '王' || piece.char === '玉';
    }) ?? null
  );
}

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function inBoard(row: number, col: number): boolean {
  return row >= 0 && row < 9 && col >= 0 && col < 9;
}

function legalMovesForSide(input: {
  position: AiBattlePosition;
  side: Side;
  pieceCatalog: AiPieceDefinition[];
}): AiBattleMove[] {
  return generateLegalMoves({
    position: {
      ...input.position,
      sideToMove: input.side,
    },
    pieceCatalog: input.pieceCatalog,
  }).legalMoves;
}

function evaluateKingSafety(input: {
  position: AiBattlePosition;
  side: Side;
  pieceCatalog: AiPieceDefinition[];
  config: StageAiConfig;
  attackerMoves?: AiBattleMove[];
  pieces?: AiBoardPiece[];
  pieceIndex?: BoardPieceIndex;
}): { score: number; kingInDanger: boolean } {
  const pieces = input.pieces ?? piecesFromBoardState(input.position);
  const pieceIndex = input.pieceIndex ?? buildBoardPieceIndex(pieces);
  const king = findKing(pieceIndex, input.side);
  if (!king) {
    return {
      score: -input.config.kingInDangerPenalty,
      kingInDanger: true,
    };
  }

  const attacker = opponentOf(input.side);
  const attackerMoves =
    input.attackerMoves ??
    legalMovesForSide({
      position: input.position,
      side: attacker,
      pieceCatalog: input.pieceCatalog,
    });
  const attackedTargets = new Set(attackerMoves.map((move) => cellKey(move.toRow, move.toCol)));
  const kingKey = cellKey(king.row, king.col);
  const kingInDanger =
    attackedTargets.has(kingKey) ||
    attackerMoves.some((move) => toBasePieceCode(move.capturedPieceCode) === 'OU');

  let attackedAroundKing = 0;
  let safeEscapeSquares = 0;
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const row = king.row + dr;
      const col = king.col + dc;
      if (!inBoard(row, col)) continue;
      const key = cellKey(row, col);
      const occupant = getBoardPieceAt(pieceIndex, row, col);
      const attacked = attackedTargets.has(key);
      if (attacked) attackedAroundKing += 1;
      if (occupant?.side === input.side) continue;
      if (!attacked) safeEscapeSquares += 1;
    }
  }

  return {
    score:
      (kingInDanger ? -input.config.kingInDangerPenalty : 0) -
      attackedAroundKing * input.config.kingAdjacentAttackPenalty +
      safeEscapeSquares * input.config.kingEscapeSquareBonus,
    kingInDanger,
  };
}

function tacticalReplyPenalty(input: {
  position: AiBattlePosition;
  pieceCatalog: AiPieceDefinition[];
  config: StageAiConfig;
  replies?: AiBattleMove[];
  pieceIndex?: BoardPieceIndex;
}): number {
  if (input.config.searchDepth < 2 || input.config.opponentReplyPenaltyWeight <= 0) return 0;
  const replies =
    input.replies ??
    legalMovesForSide({
      position: input.position,
      side: 'player',
      pieceCatalog: input.pieceCatalog,
    });
  if (replies.length === 0) return 0;
  const pieceIndex = input.pieceIndex ?? buildBoardPieceIndex(piecesFromBoardState(input.position));
  let bestReplyScore = 0;
  for (const reply of replies) {
    bestReplyScore = Math.max(bestReplyScore, moveScore(reply, 'player', input.config, pieceIndex));
  }
  return Math.max(0, bestReplyScore) * input.config.opponentReplyPenaltyWeight;
}

function hangingPiecePenalty(input: {
  position: AiBattlePosition;
  pieceCatalog: AiPieceDefinition[];
  side: Side;
  config: StageAiConfig;
  attackerMoves?: AiBattleMove[];
  pieces?: AiBoardPiece[];
  pieceIndex?: BoardPieceIndex;
}): number {
  if (input.config.hangingPiecePenaltyWeight <= 0) return 0;
  const pieces = input.pieces ?? piecesFromBoardState(input.position);
  const pieceIndex = input.pieceIndex ?? buildBoardPieceIndex(pieces);
  const attackerMoves =
    input.attackerMoves ??
    legalMovesForSide({
      position: input.position,
      side: opponentOf(input.side),
      pieceCatalog: input.pieceCatalog,
    });
  let worstLoss = 0;
  for (const move of attackerMoves) {
    const target = getBoardPieceAt(pieceIndex, move.toRow, move.toCol);
    if (!target || target.side !== input.side) continue;
    if (toBasePieceCode(target.pieceCode) === 'OU') continue;
    worstLoss = Math.max(worstLoss, boardPieceValue(target));
  }
  return worstLoss * input.config.hangingPiecePenaltyWeight;
}

function evaluateCandidateMove(input: {
  position: AiBattlePosition;
  pieceCatalog: AiPieceDefinition[];
  move: AiBattleMove;
  config: StageAiConfig;
  beforeEnemySafety: { kingInDanger: boolean };
  beforePieceIndex: BoardPieceIndex;
}): number {
  let score = moveScore(input.move, 'enemy', input.config, input.beforePieceIndex);
  if (input.beforeEnemySafety.kingInDanger && toBasePieceCode(input.move.pieceCode) === 'OU') {
    score += input.config.kingMovePenalty * 0.6;
  }

  const needsHeavyEval = needsKingSafetyEval(input.config);
  if (!needsHeavyEval) return score;

  try {
    const committed = applyMove({
      position: input.position,
      pieceCatalog: input.pieceCatalog,
      move: input.move,
      options: {
        trustedLegalMove: true,
        suppressRandomSkillProcs: true,
        skipGameEndCheck: true,
      },
    });
    const afterPosition = normalizeBattlePosition(committed.position);
    const afterPieces = piecesFromBoardState(afterPosition);
    const afterPieceIndex = buildBoardPieceIndex(afterPieces);
    const playerReplies = legalMovesForSide({
      position: afterPosition,
      side: 'player',
      pieceCatalog: input.pieceCatalog,
    });
    score += evaluateKingSafety({
      position: afterPosition,
      side: 'enemy',
      pieceCatalog: input.pieceCatalog,
      config: input.config,
      attackerMoves: playerReplies,
      pieces: afterPieces,
      pieceIndex: afterPieceIndex,
    }).score;
    score -= tacticalReplyPenalty({
      position: afterPosition,
      pieceCatalog: input.pieceCatalog,
      config: input.config,
      replies: playerReplies,
      pieceIndex: afterPieceIndex,
    });
    score -= hangingPiecePenalty({
      position: afterPosition,
      pieceCatalog: input.pieceCatalog,
      side: 'enemy',
      config: input.config,
      attackerMoves: playerReplies,
      pieces: afterPieces,
      pieceIndex: afterPieceIndex,
    });
  } catch {
    score -= input.config.kingInDangerPenalty;
  }

  return score;
}

function moveKey(move: AiBattleMove): string {
  return [
    move.pieceCode,
    move.dropPieceCode ?? '',
    move.fromRow ?? '',
    move.fromCol ?? '',
    move.toRow,
    move.toCol,
    move.promote ? '1' : '0',
  ].join(':');
}

function movedPieceKey(move: AiBattleMove): string {
  if (move.dropPieceCode) return `drop:${move.dropPieceCode}`;
  return `${move.pieceCode}:${move.fromRow ?? ''}:${move.fromCol ?? ''}`;
}

function isReturnMove(move: AiBattleMove, previous: AiBattleMove): boolean {
  if (
    move.dropPieceCode ||
    previous.dropPieceCode ||
    move.fromRow == null ||
    move.fromCol == null ||
    previous.fromRow == null ||
    previous.fromCol == null
  ) {
    return false;
  }
  return (
    move.pieceCode === previous.pieceCode &&
    move.fromRow === previous.toRow &&
    move.fromCol === previous.toCol &&
    move.toRow === previous.fromRow &&
    move.toCol === previous.fromCol
  );
}

function repetitionPenalty(
  move: AiBattleMove,
  recentEnemyMoves: AiBattleMove[],
  config: StageAiConfig,
): number {
  if (config.recentMoveWindow <= 0 || recentEnemyMoves.length === 0) return 0;
  const recent = recentEnemyMoves.slice(-config.recentMoveWindow);
  const key = moveKey(move);
  const pieceKey = movedPieceKey(move);
  let penalty = 0;

  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const previous = recent[i]!;
    const recencyWeight = (i + 1) / recent.length;
    if (moveKey(previous) === key) {
      penalty += config.repeatMovePenalty * recencyWeight;
    }
    if (!move.dropPieceCode && !previous.dropPieceCode && movedPieceKey(previous) === pieceKey) {
      penalty += config.samePiecePenalty * recencyWeight;
    }
    if (isReturnMove(move, previous)) {
      penalty += config.returnMovePenalty * recencyWeight;
    }
  }

  return penalty;
}

/** 重い applyMove + 利き評価を行う候補の上限（速度優先） */
const FULL_EVAL_CANDIDATE_LIMIT = 6;
/** 非同期思考中にUIへ制御を返す詳細評価の間隔 */
const HEAVY_EVALS_PER_YIELD = 3;

type RankedItem<T> = { item: T; rankIndex: number };

function topKByScore<T extends { score: number }>(items: T[], limit: number): T[] {
  if (limit <= 0 || items.length === 0) return [];
  const top: RankedItem<T>[] = [];
  for (let rankIndex = 0; rankIndex < items.length; rankIndex += 1) {
    const ranked = { item: items[rankIndex]!, rankIndex };
    let insertAt = top.length;
    while (
      insertAt > 0 &&
      (ranked.item.score > top[insertAt - 1]!.item.score ||
        (ranked.item.score === top[insertAt - 1]!.item.score &&
          ranked.rankIndex < top[insertAt - 1]!.rankIndex))
    ) {
      insertAt -= 1;
    }
    if (insertAt < limit) {
      top.splice(insertAt, 0, ranked);
      if (top.length > limit) top.pop();
    }
  }
  return top.map((ranked) => ranked.item);
}

function prioritizeTopQuickMoves(
  items: { move: AiBattleMove; quickScore: number }[],
  limit: number,
): { move: AiBattleMove; quickScore: number }[] {
  const ranked = topKByScore(
    items.map((item) => ({ ...item, score: item.quickScore })),
    limit,
  );
  const selectedMoves = new Set(ranked.map((item) => item.move));
  return [
    ...ranked.map(({ score: _score, ...item }) => item),
    ...items.filter((item) => !selectedMoves.has(item.move)),
  ];
}

function needsKingSafetyEval(config: StageAiConfig): boolean {
  return (
    config.kingInDangerPenalty > 0 ||
    config.kingAdjacentAttackPenalty > 0 ||
    config.kingEscapeSquareBonus > 0 ||
    config.opponentReplyPenaltyWeight > 0 ||
    config.hangingPiecePenaltyWeight > 0
  );
}

function pickWeightedMove(
  scoredMoves: { move: AiBattleMove; score: number }[],
  config: StageAiConfig,
  random: () => number,
): { move: AiBattleMove; score: number } {
  const best = scoredMoves[0]!;
  const pool = scoredMoves
    .filter((item) => item.score >= best.score - config.candidateScoreTolerance)
    .slice(0, config.maxCandidatePool);

  if (pool.length <= 1 || config.temperature <= 0) return pool[0] ?? best;

  const weights = pool.map((item) => Math.exp((item.score - best.score) / config.temperature));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random() * total;

  for (let i = 0; i < pool.length; i += 1) {
    cursor -= weights[i]!;
    if (cursor <= 0) return pool[i]!;
  }

  return pool[pool.length - 1] ?? best;
}

export function computeAiMove(input: ComputeAiMoveInput): BattleAiTurn {
  return computeAiMoveInternal(input);
}

/**
 * UI スレッドへ描画機会を返しながら思考する（ノーマルダンジョン向け）。
 */
export async function computeAiMoveAsync(input: ComputeAiMoveInput): Promise<BattleAiTurn> {
  const startedAt = Date.now();
  const config = normalizeStageAiConfig(input.config);
  const random = input.random ?? Math.random;
  await yieldToMainThread();
  const position = normalizeBattlePosition(input.position);
  ensureShinTurnMimicForBattle(position, input.pieceCatalog);
  const workingPosition: AiBattlePosition = {
    ...input.position,
    boardState: position.boardState,
  };
  const legalMoves = generateLegalMoves({
    position: workingPosition,
    pieceCatalog: input.pieceCatalog,
    options: input.legalMoveOptions,
  }).legalMoves;
  if (legalMoves.length === 0) {
    return {
      selectedMove: null,
      skillTriggered: false,
      turnConsumed: true,
      meta: null,
      position: workingPosition,
      game: { status: 'finished', result: 'player_win', winnerSide: 'player' as const },
    };
  }
  await yieldToMainThread();
  const turn = await computeAiMoveInternalAsync(input, {
    startedAt,
    config,
    random,
    position,
    workingPosition,
    legalMoves,
  });
  return turn;
}

type ComputeAiMoveRuntime = {
  startedAt: number;
  config: StageAiConfig;
  random: () => number;
  position: AiBattlePosition;
  workingPosition: AiBattlePosition;
  legalMoves: AiBattleMove[];
};

async function computeAiMoveInternalAsync(
  input: ComputeAiMoveInput,
  runtime?: Partial<ComputeAiMoveRuntime>,
): Promise<BattleAiTurn> {
  return scoreAndCommitAiMove(input, runtime, yieldToMainThread);
}

function computeAiMoveInternal(
  input: ComputeAiMoveInput,
  runtime?: Partial<ComputeAiMoveRuntime>,
): BattleAiTurn {
  return scoreAndCommitAiMoveSync(input, runtime);
}

function scoreQuickScoredMoves(input: {
  quickScored: { move: AiBattleMove; quickScore: number }[];
  useKingSafety: boolean;
  position: AiBattlePosition;
  pieceCatalog: AiPieceDefinition[];
  config: StageAiConfig;
  beforeEnemySafety: { kingInDanger: boolean };
  recentEnemyMoves: AiBattleMove[];
  pieceIndex: BoardPieceIndex;
}): { move: AiBattleMove; score: number }[] {
  return input.quickScored.map(({ move, quickScore }, index) => {
    if (!input.useKingSafety || index >= FULL_EVAL_CANDIDATE_LIMIT) {
      return { move, score: quickScore };
    }
    return {
      move,
      score:
        evaluateCandidateMove({
          position: input.position,
          pieceCatalog: input.pieceCatalog,
          move,
          config: input.config,
          beforeEnemySafety: input.beforeEnemySafety,
          beforePieceIndex: input.pieceIndex,
        }) - repetitionPenalty(move, input.recentEnemyMoves, input.config),
    };
  });
}

async function scoreQuickScoredMovesAsync(
  input: Parameters<typeof scoreQuickScoredMoves>[0],
  yieldBetweenHeavyEval: () => Promise<void>,
): Promise<{ move: AiBattleMove; score: number }[]> {
  const scoredMoves: { move: AiBattleMove; score: number }[] = [];
  for (let index = 0; index < input.quickScored.length; index += 1) {
    const { move, quickScore } = input.quickScored[index]!;
    if (!input.useKingSafety || index >= FULL_EVAL_CANDIDATE_LIMIT) {
      scoredMoves.push({ move, score: quickScore });
      continue;
    }
    if (index > 0 && index % HEAVY_EVALS_PER_YIELD === 0) {
      await yieldBetweenHeavyEval();
    }
    scoredMoves.push({
      move,
      score:
        evaluateCandidateMove({
          position: input.position,
          pieceCatalog: input.pieceCatalog,
          move,
          config: input.config,
          beforeEnemySafety: input.beforeEnemySafety,
          beforePieceIndex: input.pieceIndex,
        }) - repetitionPenalty(move, input.recentEnemyMoves, input.config),
    });
  }
  return scoredMoves;
}

function prepareAiScoringContext(
  input: ComputeAiMoveInput,
  runtime?: Partial<ComputeAiMoveRuntime>,
):
  | { emptyTurn: BattleAiTurn }
  | {
      startedAt: number;
      config: StageAiConfig;
      random: () => number;
      position: AiBattlePosition;
      workingPosition: AiBattlePosition;
      legalMoves: AiBattleMove[];
      useKingSafety: boolean;
      beforeEnemySafety: { kingInDanger: boolean };
      recentEnemyMoves: AiBattleMove[];
      quickScored: { move: AiBattleMove; quickScore: number }[];
      pieceIndex: BoardPieceIndex;
    } {
  const startedAt = runtime?.startedAt ?? Date.now();
  const config = runtime?.config ?? normalizeStageAiConfig(input.config);
  const random = runtime?.random ?? input.random ?? Math.random;
  const position = runtime?.position ?? normalizeBattlePosition(input.position);
  if (runtime?.position == null) {
    ensureShinTurnMimicForBattle(position, input.pieceCatalog);
  }
  const workingPosition: AiBattlePosition = runtime?.workingPosition ?? {
    ...input.position,
    boardState: position.boardState,
  };
  const legalMoves =
    runtime?.legalMoves ??
    generateLegalMoves({
      position: workingPosition,
      pieceCatalog: input.pieceCatalog,
      options: input.legalMoveOptions,
    }).legalMoves;
  if (legalMoves.length === 0) {
    return {
      emptyTurn: {
        selectedMove: null,
        skillTriggered: false,
        turnConsumed: true,
        meta: null,
        position: workingPosition,
        game: { status: 'finished', result: 'player_win', winnerSide: 'player' as const },
      },
    };
  }

  const useKingSafety = needsKingSafetyEval(config);
  const playerAttackerMoves = useKingSafety
    ? legalMovesForSide({
        position,
        side: 'player',
        pieceCatalog: input.pieceCatalog,
      })
    : null;
  const beforeEnemySafety = useKingSafety
    ? evaluateKingSafety({
        position,
        side: 'enemy',
        pieceCatalog: input.pieceCatalog,
        config,
        attackerMoves: playerAttackerMoves ?? undefined,
      })
    : { score: 0, kingInDanger: false };
  const recentEnemyMoves = input.recentEnemyMoves ?? [];
  const pieces = piecesFromBoardState(position);
  const pieceIndex = buildBoardPieceIndex(pieces);
  const quickScored = prioritizeTopQuickMoves(
    legalMoves.map((move) => ({
      move,
      quickScore:
        moveScore(move, 'enemy', config, pieceIndex) -
        repetitionPenalty(move, recentEnemyMoves, config),
    })),
    FULL_EVAL_CANDIDATE_LIMIT,
  );

  return {
    startedAt,
    config,
    random,
    position,
    workingPosition,
    legalMoves,
    useKingSafety,
    beforeEnemySafety,
    recentEnemyMoves,
    quickScored,
    pieceIndex,
  };
}

function finalizeAiTurn(
  context: Exclude<ReturnType<typeof prepareAiScoringContext>, { emptyTurn: BattleAiTurn }>,
  scoredMoves: { move: AiBattleMove; score: number }[],
  input: ComputeAiMoveInput,
): BattleAiTurn {
  const topScoredMoves = topKByScore(scoredMoves, context.config.maxCandidatePool);
  const selected = pickWeightedMove(topScoredMoves, context.config, context.random);
  const committed = applyMove({
    position: context.workingPosition,
    pieceCatalog: input.pieceCatalog,
    move: selected.move,
    options: {
      trustedLegalMove: true,
      legalMoveOptions: input.legalMoveOptions,
    },
  });

  return {
    selectedMove: committed.move,
    skillTriggered: committed.skillTriggered,
    skillVisualEffects: committed.skillVisualEffects,
    turnConsumed: committed.turnConsumed,
    meta: {
      engineVersion: 'local-ts',
      thinkMs: Date.now() - context.startedAt,
      searchedNodes: context.legalMoves.length,
      searchDepth: context.config.searchDepth,
      evalCp: selected.score,
      candidateCount: context.legalMoves.length,
      configApplied: context.config,
    },
    position: committed.position,
    game: committed.game,
  };
}

function scoreAndCommitAiMoveSync(
  input: ComputeAiMoveInput,
  runtime?: Partial<ComputeAiMoveRuntime>,
): BattleAiTurn {
  const prepared = prepareAiScoringContext(input, runtime);
  if ('emptyTurn' in prepared) return prepared.emptyTurn;
  const scoredMoves = scoreQuickScoredMoves({
    quickScored: prepared.quickScored,
    useKingSafety: prepared.useKingSafety,
    position: prepared.position,
    pieceCatalog: input.pieceCatalog,
    config: prepared.config,
    beforeEnemySafety: prepared.beforeEnemySafety,
    recentEnemyMoves: prepared.recentEnemyMoves,
    pieceIndex: prepared.pieceIndex,
  });
  return finalizeAiTurn(prepared, scoredMoves, input);
}

async function scoreAndCommitAiMove(
  input: ComputeAiMoveInput,
  runtime?: Partial<ComputeAiMoveRuntime>,
  yieldBetweenHeavyEval?: () => Promise<void>,
): Promise<BattleAiTurn> {
  const prepared = prepareAiScoringContext(input, runtime);
  if ('emptyTurn' in prepared) return prepared.emptyTurn;
  const scoredMoves = yieldBetweenHeavyEval
    ? await scoreQuickScoredMovesAsync(
        {
          quickScored: prepared.quickScored,
          useKingSafety: prepared.useKingSafety,
          position: prepared.position,
          pieceCatalog: input.pieceCatalog,
          config: prepared.config,
          beforeEnemySafety: prepared.beforeEnemySafety,
          recentEnemyMoves: prepared.recentEnemyMoves,
          pieceIndex: prepared.pieceIndex,
        },
        yieldBetweenHeavyEval,
      )
    : scoreQuickScoredMoves({
        quickScored: prepared.quickScored,
        useKingSafety: prepared.useKingSafety,
        position: prepared.position,
        pieceCatalog: input.pieceCatalog,
        config: prepared.config,
        beforeEnemySafety: prepared.beforeEnemySafety,
        recentEnemyMoves: prepared.recentEnemyMoves,
        pieceIndex: prepared.pieceIndex,
      });
  return finalizeAiTurn(prepared, scoredMoves, input);
}
