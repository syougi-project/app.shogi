import type {
  AiBattleMove,
  AiBattlePosition,
  AiBoardPiece,
  AiPieceDefinition,
  Side,
} from '@/ai/model';
import type { BattleAiTurn } from '@/usecases/stage-battle/game-move-contract';
import type { StageAiConfig } from '@/constants/stage-ai-config';
import { normalizeBattlePosition, piecesFromBoardState, toBasePieceCode } from '@/ai/model';
import { PIECE_VALUES } from '@/ai/engine/shared';
import { applyMove } from '@/ai/engine/apply-move';
import { ensureShinTurnMimicForBattle, generateLegalMoves } from '@/ai/engine/legal-moves';
import { normalizeStageAiConfig } from '@/constants/stage-ai-config';

function movingPieceActivityScore(pieceCode: string, config: StageAiConfig): number {
  if (pieceCode === 'OU') return -config.kingMovePenalty;
  return (
    Math.min(PIECE_VALUES[pieceCode] ?? 100, config.activityPieceValueCap) /
    config.activityScoreDivisor
  );
}

function moveScore(move: AiBattleMove, side: Side, config: StageAiConfig): number {
  const captured = toBasePieceCode(move.capturedPieceCode);
  const pieceCode = toBasePieceCode(move.pieceCode) ?? 'FU';
  const forward = side === 'enemy' ? move.toRow : 8 - move.toRow;
  const captureValue = captured ? (PIECE_VALUES[captured] ?? 150) : 0;
  const activityScore = movingPieceActivityScore(pieceCode, config);
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

function findKing(pieces: AiBoardPiece[], side: Side): AiBoardPiece | null {
  return (
    pieces.find((piece) => {
      if (piece.side !== side) return false;
      const code = toBasePieceCode(piece.pieceCode);
      return code === 'OU' || piece.char === '王' || piece.char === '玉';
    }) ?? null
  );
}

function cellKey(row: number, col: number): string {
  return `${row}:${col}`;
}

function pieceAt(pieces: AiBoardPiece[], row: number, col: number): AiBoardPiece | null {
  return pieces.find((piece) => piece.row === row && piece.col === col) ?? null;
}

function inBoard(row: number, col: number): boolean {
  return row >= 0 && row < 9 && col >= 0 && col < 9;
}

function legalMovesForSide(input: {
  position: AiBattlePosition;
  side: Side;
  pieceCatalog: AiPieceDefinition[];
}): AiBattleMove[] {
  const position = normalizeBattlePosition({
    ...input.position,
    sideToMove: input.side,
  });
  ensureShinTurnMimicForBattle(position, input.pieceCatalog);
  return generateLegalMoves({
    position,
    pieceCatalog: input.pieceCatalog,
  }).legalMoves;
}

function evaluateKingSafety(input: {
  position: AiBattlePosition;
  side: Side;
  pieceCatalog: AiPieceDefinition[];
  config: StageAiConfig;
}): { score: number; kingInDanger: boolean } {
  const pieces = piecesFromBoardState(input.position);
  const king = findKing(pieces, input.side);
  if (!king) {
    return {
      score: -input.config.kingInDangerPenalty,
      kingInDanger: true,
    };
  }

  const attacker = opponentOf(input.side);
  const attackerMoves = legalMovesForSide({
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
      const occupant = pieceAt(pieces, row, col);
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
}): number {
  if (input.config.searchDepth < 2 || input.config.opponentReplyPenaltyWeight <= 0) return 0;
  const replies = legalMovesForSide({
    position: input.position,
    side: 'player',
    pieceCatalog: input.pieceCatalog,
  });
  if (replies.length === 0) return 0;
  const bestReplyScore = Math.max(
    ...replies.map((reply) => moveScore(reply, 'player', input.config)),
  );
  return Math.max(0, bestReplyScore) * input.config.opponentReplyPenaltyWeight;
}

function evaluateCandidateMove(input: {
  position: AiBattlePosition;
  pieceCatalog: AiPieceDefinition[];
  move: AiBattleMove;
  config: StageAiConfig;
  beforeEnemySafety: { kingInDanger: boolean };
}): number {
  let score = moveScore(input.move, 'enemy', input.config);
  if (input.beforeEnemySafety.kingInDanger && toBasePieceCode(input.move.pieceCode) === 'OU') {
    score += input.config.kingMovePenalty * 0.6;
  }

  const needsAfterPosition =
    input.config.kingInDangerPenalty > 0 ||
    input.config.kingAdjacentAttackPenalty > 0 ||
    input.config.kingEscapeSquareBonus > 0 ||
    input.config.opponentReplyPenaltyWeight > 0;
  if (!needsAfterPosition) return score;

  try {
    const committed = applyMove({
      position: input.position,
      pieceCatalog: input.pieceCatalog,
      move: input.move,
      options: { trustedLegalMove: true, suppressRandomSkillProcs: true },
    });
    const afterPosition = normalizeBattlePosition(committed.position);
    score += evaluateKingSafety({
      position: afterPosition,
      side: 'enemy',
      pieceCatalog: input.pieceCatalog,
      config: input.config,
    }).score;
    score -= tacticalReplyPenalty({
      position: afterPosition,
      pieceCatalog: input.pieceCatalog,
      config: input.config,
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

export function computeAiMove(input: {
  position: AiBattlePosition;
  pieceCatalog: AiPieceDefinition[];
  config?: Partial<StageAiConfig>;
  recentEnemyMoves?: AiBattleMove[];
  random?: () => number;
}): BattleAiTurn {
  const startedAt = Date.now();
  const config = normalizeStageAiConfig(input.config);
  const random = input.random ?? Math.random;
  const position = normalizeBattlePosition(input.position);
  ensureShinTurnMimicForBattle(position, input.pieceCatalog);
  input.position.boardState = position.boardState;
  const legal = generateLegalMoves({
    position: input.position,
    pieceCatalog: input.pieceCatalog,
  });
  if (legal.legalMoves.length === 0) {
    return {
      selectedMove: null,
      skillTriggered: false,
      turnConsumed: true,
      meta: null,
      position: input.position,
      game: { status: 'finished', result: 'player_win', winnerSide: 'player' as const },
    };
  }

  const beforeEnemySafety = evaluateKingSafety({
    position,
    side: 'enemy',
    pieceCatalog: input.pieceCatalog,
    config,
  });
  const scoredMoves = legal.legalMoves
    .map((move) => ({
      move,
      score:
        evaluateCandidateMove({
          position,
          pieceCatalog: input.pieceCatalog,
          move,
          config,
          beforeEnemySafety,
        }) - repetitionPenalty(move, input.recentEnemyMoves ?? [], config),
    }))
    .sort((a, b) => b.score - a.score);
  const selected = pickWeightedMove(scoredMoves, config, random);
  const selectedMove = selected.move;
  const bestScore = selected.score;
  const committed = applyMove({
    position: input.position,
    pieceCatalog: input.pieceCatalog,
    move: selectedMove,
    options: { trustedLegalMove: true },
  });

  return {
    selectedMove: committed.move,
    skillTriggered: committed.skillTriggered,
    skillVisualEffects: committed.skillVisualEffects,
    turnConsumed: committed.turnConsumed,
    meta: {
      engineVersion: 'local-ts',
      thinkMs: Date.now() - startedAt,
      searchedNodes: legal.legalMoves.length,
      searchDepth: config.searchDepth,
      evalCp: bestScore,
      candidateCount: legal.legalMoves.length,
      configApplied: config,
    },
    position: committed.position,
    game: committed.game,
  };
}
