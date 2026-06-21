import type { SkillVisualEffect } from '@/domain/battle/skill-visual-effect';
import { parseSkillVisualEffects } from '@/domain/battle/skill-visual-effect';

export type BattleMove = {
  fromRow: number | null;
  fromCol: number | null;
  toRow: number;
  toCol: number;
  pieceCode: string;
  promote: boolean;
  dropPieceCode: string | null;
  capturedPieceCode: string | null;
  notation: string | null;
};

export type BattleCanonicalPosition = {
  sideToMove: 'player' | 'enemy';
  turnNumber: number;
  moveCount: number;
  sfen: string;
  stateHash: string | null;
  boardState: Record<string, unknown>;
  hands: {
    player: Record<string, number>;
    enemy: Record<string, number>;
  };
};

export type BattleGameStatus = {
  status: 'in_progress' | 'finished' | 'aborted';
  result: 'player_win' | 'enemy_win' | 'draw' | 'abort' | null;
  winnerSide: 'player' | 'enemy' | null;
};

export type BattleCommittedMove = {
  moveNo: number;
  actorSide: 'player' | 'enemy';
  move: BattleMove;
  skillTriggered: boolean;
  /** 盤面に重ねるスキル演出（炎の燃焼など） */
  skillVisualEffects?: SkillVisualEffect[];
  /** false のとき着手後も手数・手番が進んでいない。クライアントエンジンでは通常 true（盾で取りが無効化されても攻撃側の手番は終了する）。 */
  turnConsumed: boolean;
  position: BattleCanonicalPosition;
  game: BattleGameStatus;
};

export type BattleAiTurn = {
  selectedMove: BattleMove | null;
  skillTriggered: boolean;
  skillVisualEffects?: SkillVisualEffect[];
  turnConsumed: boolean;
  meta: {
    engineVersion: string;
    thinkMs: number;
    searchedNodes: number;
    searchDepth: number;
    evalCp: number;
    candidateCount: number;
    configApplied: Record<string, unknown>;
  } | null;
  position: BattleCanonicalPosition;
  game: BattleGameStatus;
};

export type BattleLegalMoves = {
  sideToMove: 'player' | 'enemy';
  moveNo: number;
  stateHash: string | null;
  legalMoves: BattleMove[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function normalizePieceMoveCode(value: unknown): string | null {
  const s = asString(value);
  return s ? s.toUpperCase() : null;
}

function parseMove(raw: unknown): BattleMove {
  const obj = asRecord(raw);
  if (!obj) {
    throw new Error('move is not an object');
  }

  const toRow = asNumber(obj.toRow ?? obj.to_row);
  const toCol = asNumber(obj.toCol ?? obj.to_col);
  const pieceCode = normalizePieceMoveCode(obj.pieceCode ?? obj.piece_code);
  const fromRow = obj.fromRow ?? obj.from_row ?? null;
  const fromCol = obj.fromCol ?? obj.from_col ?? null;
  if (
    toRow === null ||
    toCol === null ||
    !pieceCode ||
    (fromRow !== null && typeof fromRow !== 'number') ||
    (fromCol !== null && typeof fromCol !== 'number')
  ) {
    throw new Error('move payload is invalid');
  }

  return {
    fromRow: fromRow as number | null,
    fromCol: fromCol as number | null,
    toRow,
    toCol,
    pieceCode,
    promote: Boolean(obj.promote ?? false),
    dropPieceCode: normalizePieceMoveCode(obj.dropPieceCode ?? obj.drop_piece_code),
    capturedPieceCode: normalizePieceMoveCode(obj.capturedPieceCode ?? obj.captured_piece_code),
    notation: (obj.notation ?? null) as string | null,
  };
}

function sanitizeHandsRecord(raw: unknown): Record<string, number> {
  const obj = asRecord(raw) ?? {};
  const hands: Record<string, number> = {};
  for (const [pieceCode, count] of Object.entries(obj)) {
    if (typeof count === 'number' && Number.isFinite(count)) {
      hands[pieceCode] = count;
    }
  }
  return hands;
}

function parseHands(raw: unknown): BattleCanonicalPosition['hands'] {
  const obj = asRecord(raw) ?? {};
  return {
    player: sanitizeHandsRecord(obj.player),
    enemy: sanitizeHandsRecord(obj.enemy),
  };
}

function parsePosition(raw: unknown): BattleCanonicalPosition {
  const obj = asRecord(raw);
  if (!obj) {
    throw new Error('position is not an object');
  }

  const sideToMove = (obj.sideToMove ?? obj.side_to_move) === 'enemy' ? 'enemy' : 'player';
  const turnNumber = asNumber(obj.turnNumber ?? obj.turn_number);
  const moveCount = asNumber(obj.moveCount ?? obj.move_count);
  const sfen = asString(obj.sfen);

  if (turnNumber === null || moveCount === null || !sfen) {
    throw new Error('position payload is invalid');
  }

  return {
    sideToMove,
    turnNumber,
    moveCount,
    sfen,
    stateHash: (obj.stateHash ?? obj.state_hash ?? null) as string | null,
    boardState: (asRecord(obj.boardState ?? obj.board_state) ?? {}) as Record<string, unknown>,
    hands: parseHands(obj.hands),
  };
}

function parseGame(raw: unknown): BattleGameStatus {
  const obj = asRecord(raw);
  if (!obj) {
    throw new Error('game status is not an object');
  }

  const status = asString(obj.status);
  if (status !== 'in_progress' && status !== 'finished' && status !== 'aborted') {
    throw new Error('game status is invalid');
  }

  return {
    status,
    result: (obj.result ?? null) as BattleGameStatus['result'],
    winnerSide: (obj.winnerSide ?? obj.winner_side ?? null) as BattleGameStatus['winnerSide'],
  };
}

export function parseBattleCommittedMove(raw: unknown): BattleCommittedMove {
  const obj = asRecord(raw);
  if (!obj) {
    throw new Error('committed move response is not an object');
  }

  const moveNo = asNumber(obj.moveNo ?? obj.move_no);
  const actorSide = (obj.actorSide ?? obj.actor_side) === 'enemy' ? 'enemy' : 'player';
  if (moveNo === null) {
    throw new Error('moveNo is invalid');
  }

  const turnConsumedRaw = asBoolean(obj.turnConsumed ?? obj.turn_consumed);

  return {
    moveNo,
    actorSide,
    move: parseMove(obj.move),
    skillTriggered: parseSkillTriggered(obj.skillTriggered ?? obj.skill_triggered, obj.move),
    skillVisualEffects: parseSkillVisualEffects(obj.skillVisualEffects ?? obj.skill_visual_effects),
    turnConsumed: turnConsumedRaw !== false,
    position: parsePosition(obj.position),
    game: parseGame(obj.game),
  };
}

export function parseBattleAiTurn(raw: unknown): BattleAiTurn {
  const obj = asRecord(raw);
  if (!obj) {
    throw new Error('ai turn response is not an object');
  }
  const meta = asRecord(obj.meta) ?? null;

  const rawMove = obj.selectedMove ?? obj.selected_move;
  const turnConsumedRaw = asBoolean(obj.turnConsumed ?? obj.turn_consumed);
  return {
    selectedMove: rawMove != null ? parseMove(rawMove) : null,
    skillTriggered: parseSkillTriggered(obj.skillTriggered ?? obj.skill_triggered, rawMove),
    skillVisualEffects: parseSkillVisualEffects(obj.skillVisualEffects ?? obj.skill_visual_effects),
    turnConsumed: turnConsumedRaw !== false,
    meta: meta
      ? {
          engineVersion: asString(meta.engineVersion ?? meta.engine_version) ?? '',
          thinkMs: asNumber(meta.thinkMs ?? meta.think_ms) ?? 0,
          searchedNodes: asNumber(meta.searchedNodes ?? meta.searched_nodes) ?? 0,
          searchDepth: asNumber(meta.searchDepth ?? meta.search_depth) ?? 0,
          evalCp: asNumber(meta.evalCp ?? meta.eval_cp) ?? 0,
          candidateCount: asNumber(meta.candidateCount ?? meta.candidate_count) ?? 0,
          configApplied: (asRecord(meta.configApplied ?? meta.config_applied) ?? {}) as Record<
            string,
            unknown
          >,
        }
      : null,
    position: parsePosition(obj.position),
    game: parseGame(obj.game),
  };
}

function parseSkillTriggered(rawSkillTriggered: unknown, rawMove: unknown): boolean {
  const move = parseMove(rawMove);
  if (move.dropPieceCode) return false;
  const skillTriggered = asBoolean(rawSkillTriggered);
  if (skillTriggered !== null) return skillTriggered;
  if (!move.notation) return false;
  if (move.notation === 'time_normal') return false;
  if (move.notation.startsWith('satori_stun:')) return true;
  if (move.notation.startsWith('heart_protect:')) return true;
  if (move.notation === 'time_skill') return true;
  if (move.notation === 'house_skill_only') return true;
  if (/^[1-9][a-i][1-9][a-i]\+?$/i.test(move.notation)) return false;
  return true;
}

export function parseBattleLegalMoves(raw: unknown): BattleLegalMoves {
  const obj = asRecord(raw);
  if (!obj) {
    throw new Error('legal moves response is not an object');
  }

  const moveNo = asNumber(obj.moveNo ?? obj.move_no);
  if (moveNo === null) {
    throw new Error('legal moves moveNo is invalid');
  }

  const rawMoves = Array.isArray(obj.legalMoves ?? obj.legal_moves)
    ? ((obj.legalMoves ?? obj.legal_moves) as unknown[])
    : null;
  if (!rawMoves) {
    throw new Error('legal moves payload is invalid');
  }

  return {
    sideToMove: (obj.sideToMove ?? obj.side_to_move) === 'enemy' ? 'enemy' : 'player',
    moveNo,
    stateHash: (obj.stateHash ?? obj.state_hash ?? null) as string | null,
    legalMoves: rawMoves.map(parseMove),
  };
}
