export type StageAiConfig = {
  /** 取れる駒の価値に掛ける倍率。高いほど駒得を優先する。 */
  captureValueWeight: number;
  /** 成る手への固定加点。 */
  promotionBonus: number;
  /** 前進度に掛ける倍率。高いほど攻め上がる。 */
  forwardProgressWeight: number;
  /** 動かす駒の価値を活動量として加点するときの価値上限。 */
  activityPieceValueCap: number;
  /** 動かす駒の価値を活動量へ変換するときの除数。大きいほど活動量加点が弱い。 */
  activityScoreDivisor: number;
  /** 王を動かす手への固定減点。王ばかり動くのを抑える。 */
  kingMovePenalty: number;
  /**
   * 最高評価からこの点差以内の手だけを候補に残す。
   * 小さいほど最善手寄り、大きいほど手がばらける。
   */
  candidateScoreTolerance: number;
  /**
   * 候補選択の温度。0 に近いほど最善手固定、高いほど低評価手も選ばれやすい。
   */
  temperature: number;
  /** 同一の from/to/drop/promote の繰り返しに対する減点。 */
  repeatMovePenalty: number;
  /** 同じ盤上駒を短い間隔で動かすことへの減点。 */
  samePiecePenalty: number;
  /** 直前にいたマスへ戻る往復手への減点。 */
  returnMovePenalty: number;
  /** 繰り返し判定に使う直近AI手数。 */
  recentMoveWindow: number;
  /** 温度選択に入れる最大候補数。 */
  maxCandidatePool: number;
  /**
   * 探索深さ。現エンジンは1手読みのみ実装済みだが、ステージ設定として先に外出しする。
   */
  searchDepth: number;
  /** 2手読みで、プレイヤー最善応手の損害をどれだけ重く見るか。 */
  opponentReplyPenaltyWeight: number;
  /** 自玉が次に取られる局面への固定減点。 */
  kingInDangerPenalty: number;
  /** 自玉周辺の敵利き1つあたりの減点。 */
  kingAdjacentAttackPenalty: number;
  /** 自玉の安全な逃げ道1つあたりの加点。 */
  kingEscapeSquareBonus: number;
  /** 着手後に高価値駒が取られそうな場合の減点倍率。 */
  hangingPiecePenaltyWeight: number;
  /** 中央支配への加点倍率。 */
  centerControlBonusWeight: number;
  /** 敵陣支配への加点倍率。 */
  enemyCampControlBonusWeight: number;
  /** 敵玉周辺支配への加点倍率。 */
  enemyKingPressureBonusWeight: number;
};

export const DEFAULT_STAGE_AI_CONFIG: StageAiConfig = {
  captureValueWeight: 10,
  promotionBonus: 120,
  forwardProgressWeight: 4,
  activityPieceValueCap: 600,
  activityScoreDivisor: 20,
  kingMovePenalty: 80,
  candidateScoreTolerance: 30,
  temperature: 18,
  repeatMovePenalty: 90,
  samePiecePenalty: 18,
  returnMovePenalty: 70,
  recentMoveWindow: 4,
  maxCandidatePool: 4,
  searchDepth: 1,
  opponentReplyPenaltyWeight: 0,
  kingInDangerPenalty: 0,
  kingAdjacentAttackPenalty: 0,
  kingEscapeSquareBonus: 0,
  hangingPiecePenaltyWeight: 0,
  centerControlBonusWeight: 0,
  enemyCampControlBonusWeight: 0,
  enemyKingPressureBonusWeight: 0,
};

export const STAGE_AI_CONFIG_BY_STAGE: Readonly<Record<number, Partial<StageAiConfig>>> = {
  1: {
    searchDepth: 1,
    candidateScoreTolerance: 90,
    temperature: 45,
    repeatMovePenalty: 120,
    samePiecePenalty: 30,
    returnMovePenalty: 100,
    maxCandidatePool: 6,
  },
  2: {
    searchDepth: 2,
    candidateScoreTolerance: 75,
    temperature: 38,
    repeatMovePenalty: 115,
    samePiecePenalty: 28,
    returnMovePenalty: 95,
    maxCandidatePool: 6,
  },
  3: {
    searchDepth: 2,
    candidateScoreTolerance: 60,
    temperature: 32,
    repeatMovePenalty: 110,
    samePiecePenalty: 24,
    returnMovePenalty: 90,
    maxCandidatePool: 5,
  },
  10: {
    searchDepth: 3,
    candidateScoreTolerance: 35,
    temperature: 20,
    maxCandidatePool: 4,
  },
  20: {
    searchDepth: 4,
    candidateScoreTolerance: 24,
    temperature: 14,
    repeatMovePenalty: 80,
    samePiecePenalty: 12,
    returnMovePenalty: 60,
    maxCandidatePool: 3,
    opponentReplyPenaltyWeight: 0.45,
    kingInDangerPenalty: 8000,
    kingAdjacentAttackPenalty: 45,
    kingEscapeSquareBonus: 12,
    hangingPiecePenaltyWeight: 0.35,
    centerControlBonusWeight: 2,
    enemyCampControlBonusWeight: 3,
    enemyKingPressureBonusWeight: 5,
  },
  30: {
    searchDepth: 5,
    candidateScoreTolerance: 16,
    temperature: 8,
    repeatMovePenalty: 60,
    samePiecePenalty: 8,
    returnMovePenalty: 45,
    maxCandidatePool: 2,
    opponentReplyPenaltyWeight: 0.65,
    kingInDangerPenalty: 10000,
    kingAdjacentAttackPenalty: 65,
    kingEscapeSquareBonus: 18,
    hangingPiecePenaltyWeight: 0.5,
    centerControlBonusWeight: 3,
    enemyCampControlBonusWeight: 4,
    enemyKingPressureBonusWeight: 8,
  },
  40: {
    searchDepth: 6,
    candidateScoreTolerance: 10,
    temperature: 4,
    repeatMovePenalty: 45,
    samePiecePenalty: 5,
    returnMovePenalty: 30,
    maxCandidatePool: 2,
    opponentReplyPenaltyWeight: 0.85,
    kingInDangerPenalty: 12000,
    kingAdjacentAttackPenalty: 85,
    kingEscapeSquareBonus: 24,
    hangingPiecePenaltyWeight: 0.7,
    centerControlBonusWeight: 4,
    enemyCampControlBonusWeight: 5,
    enemyKingPressureBonusWeight: 10,
  },
};

type StageAiConfigRange = {
  from: number;
  to?: number;
  config: Partial<StageAiConfig>;
};

export const STAGE_AI_CONFIG_RANGES: readonly StageAiConfigRange[] = [
  { from: 1, to: 1, config: { searchDepth: 1 } },
  { from: 2, to: 5, config: { searchDepth: 2 } },
  { from: 6, to: 10, config: { searchDepth: 3 } },
  { from: 11, to: 20, config: { searchDepth: 4 } },
  { from: 21, to: 30, config: { searchDepth: 5 } },
  { from: 31, config: { searchDepth: 6 } },
];

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeStageAiConfig(input: Partial<StageAiConfig> = {}): StageAiConfig {
  const merged = { ...DEFAULT_STAGE_AI_CONFIG, ...input };
  return {
    captureValueWeight: clampNumber(merged.captureValueWeight, 0, 1000),
    promotionBonus: clampNumber(merged.promotionBonus, -100000, 100000),
    forwardProgressWeight: clampNumber(merged.forwardProgressWeight, -1000, 1000),
    activityPieceValueCap: clampNumber(merged.activityPieceValueCap, 0, 100000),
    activityScoreDivisor: Math.max(1, clampNumber(merged.activityScoreDivisor, 1, 100000)),
    kingMovePenalty: clampNumber(merged.kingMovePenalty, 0, 100000),
    candidateScoreTolerance: clampNumber(merged.candidateScoreTolerance, 0, 10000),
    temperature: clampNumber(merged.temperature, 0, 10000),
    repeatMovePenalty: clampNumber(merged.repeatMovePenalty, 0, 100000),
    samePiecePenalty: clampNumber(merged.samePiecePenalty, 0, 100000),
    returnMovePenalty: clampNumber(merged.returnMovePenalty, 0, 100000),
    recentMoveWindow: Math.floor(clampNumber(merged.recentMoveWindow, 0, 50)),
    maxCandidatePool: Math.max(1, Math.floor(clampNumber(merged.maxCandidatePool, 1, 200))),
    searchDepth: Math.max(1, Math.floor(clampNumber(merged.searchDepth, 1, 6))),
    opponentReplyPenaltyWeight: clampNumber(merged.opponentReplyPenaltyWeight, 0, 1000),
    kingInDangerPenalty: clampNumber(merged.kingInDangerPenalty, 0, 100000),
    kingAdjacentAttackPenalty: clampNumber(merged.kingAdjacentAttackPenalty, 0, 100000),
    kingEscapeSquareBonus: clampNumber(merged.kingEscapeSquareBonus, 0, 100000),
    hangingPiecePenaltyWeight: clampNumber(merged.hangingPiecePenaltyWeight, 0, 1000),
    centerControlBonusWeight: clampNumber(merged.centerControlBonusWeight, 0, 1000),
    enemyCampControlBonusWeight: clampNumber(merged.enemyCampControlBonusWeight, 0, 1000),
    enemyKingPressureBonusWeight: clampNumber(merged.enemyKingPressureBonusWeight, 0, 1000),
  };
}

function resolveStageAiRangeConfig(stageNo?: number): Partial<StageAiConfig> {
  if (stageNo == null || !Number.isInteger(stageNo)) return {};
  return (
    STAGE_AI_CONFIG_RANGES.find(
      (range) => stageNo >= range.from && (range.to == null || stageNo <= range.to),
    )?.config ?? {}
  );
}

export function resolveStageAiConfig(
  stageNo?: number,
  override: Partial<StageAiConfig> = {},
): StageAiConfig {
  const stageConfig =
    stageNo != null && Number.isInteger(stageNo) ? STAGE_AI_CONFIG_BY_STAGE[stageNo] : undefined;
  return normalizeStageAiConfig({
    ...resolveStageAiRangeConfig(stageNo),
    ...stageConfig,
    ...override,
  });
}
