import type { AiBattleMove, AiBattlePosition, AiPieceDefinition, Side } from '@/ai/model';
import type { BattleAiTurn } from '@/usecases/stage-battle/game-move-contract';
import type { StageAiConfig } from '@/constants/stage-ai-config';
import { normalizeBattlePosition, toBasePieceCode } from '@/ai/model';
import { assertMoveAllowedBySessionCatalog } from '@/ai/engine/guardrails';
import { PIECE_VALUES } from '@/ai/engine/shared';
import { applyMove } from '@/ai/engine/apply-move';
import { ensureShinTurnMimicForBattle, generateLegalMoves } from '@/ai/engine/legal-moves';
import { normalizeStageAiConfig } from '@/constants/stage-ai-config';

function movingPieceActivityScore(pieceCode: string): number {
  if (pieceCode === 'OU') return -80;
  return Math.min(PIECE_VALUES[pieceCode] ?? 100, 600) / 20;
}

function moveScore(move: AiBattleMove, side: Side): number {
  const captured = toBasePieceCode(move.capturedPieceCode);
  const pieceCode = toBasePieceCode(move.pieceCode) ?? 'FU';
  const forward = side === 'enemy' ? move.toRow : 8 - move.toRow;
  const captureValue = captured ? (PIECE_VALUES[captured] ?? 150) : 0;
  const activityScore = movingPieceActivityScore(pieceCode);
  const promotionBonus = move.promote ? 120 : 0;
  return captureValue * 10 + promotionBonus + activityScore + forward * 4;
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

  const scoredMoves = legal.legalMoves
    .map((move) => ({
      move,
      score:
        moveScore(move, 'enemy') - repetitionPenalty(move, input.recentEnemyMoves ?? [], config),
    }))
    .sort((a, b) => b.score - a.score);
  const selected = pickWeightedMove(scoredMoves, config, random);
  const selectedMove = selected.move;
  const bestScore = selected.score;
  assertMoveAllowedBySessionCatalog({
    position: input.position,
    pieceCatalog: input.pieceCatalog,
    move: selectedMove,
    actor: 'enemy',
  });
  const committed = applyMove({
    position: input.position,
    pieceCatalog: input.pieceCatalog,
    move: selectedMove,
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
