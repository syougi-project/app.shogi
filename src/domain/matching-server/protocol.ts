/** matching_server.shogi の WebSocket 契約（クライアント側コピー） */

export type PlayerSide = 'black' | 'white';

export type MovePayload = {
  from?: string;
  to: string;
  piece: string;
  promote?: boolean;
  drop?: boolean;
  notation?: string;
};

export type MatchPlayerProfile = {
  userId: string;
  displayName: string;
  rating: number;
};

export type EnterQueueMessage = {
  action: 'enter_queue';
  requestId: string;
  userId: string;
  rating: number;
  displayName?: string;
  region?: string;
  battleSetupId?: string;
};

export type CancelQueueMessage = {
  action: 'cancel_queue';
  requestId: string;
  userId: string;
};

export type MakeMoveMessage = {
  action: 'make_move';
  requestId: string;
  userId: string;
  matchId: string;
  expectedVersion: number;
  move: MovePayload;
};

export type ResignMessage = {
  action: 'resign';
  requestId: string;
  userId: string;
  matchId: string;
};

export type SignalBattleReadyMessage = {
  action: 'signal_battle_ready';
  requestId: string;
  userId: string;
  matchId: string;
};

export type WebSocketClientMessage =
  | EnterQueueMessage
  | CancelQueueMessage
  | MakeMoveMessage
  | ResignMessage
  | SignalBattleReadyMessage;

/** app.shogi 正典局面（先手=black→player, 後手=white→enemy）。スキル状態を含む */
export type MatchingCanonicalState = {
  sideToMove: 'player' | 'enemy';
  turnNumber: number;
  moveCount: number;
  sfen: string;
  stateHash: string | null;
  boardState: Record<string, unknown>;
  hands: {
    player: Partial<Record<string, number>>;
    enemy: Partial<Record<string, number>>;
  };
};

export type MatchingGameState = {
  version: number;
  turn: PlayerSide;
  board: Record<string, string>;
  hands: Record<PlayerSide, Record<string, number>>;
  skillState?: {
    board_hazards?: Record<string, unknown>[];
    board_arrow_tiles?: Record<string, unknown>[];
    movement_modifiers?: Record<string, unknown>[];
    piece_statuses?: Record<string, unknown>[];
    piece_defenses?: Record<string, unknown>[];
    last_player_moved_piece?: Record<string, unknown>;
    last_enemy_moved_piece?: Record<string, unknown>;
  };
  lastMove?: MovePayload;
  /** 直前の着手でスキルが発動したか（相手着手の効果音用） */
  lastSkillTriggered?: boolean;
  canonicalState?: MatchingCanonicalState;
};

export type WebSocketServerMessage =
  | {
      type: 'queue_entered';
      requestId: string;
      status: 'waiting';
      queueEntryId: string;
      ratingBucket: number;
    }
  | {
      type: 'queue_cancelled';
      requestId: string;
      status: 'cancelled';
    }
  | {
      type: 'match_found';
      matchId: string;
      role: PlayerSide;
      self: MatchPlayerProfile;
      opponent: MatchPlayerProfile;
    }
  | {
      type: 'game_started';
      matchId: string;
      status: 'started';
      initialState: MatchingGameState;
    }
  | ({
      type: 'game_state_updated';
      matchId: string;
    } & MatchingGameState)
  | {
      type: 'game_finished';
      matchId: string;
      status: 'finished' | 'aborted';
      winnerUserId: string | null;
      reason: string;
    }
  | {
      type: 'state_resync_required';
      matchId: string;
      code: 'VERSION_MISMATCH';
      currentVersion: number;
    }
  | {
      type: 'opponent_disconnected';
      matchId: string;
      reconnectDeadlineAt: string;
    }
  | {
      type: 'opponent_reconnected';
      matchId: string;
    }
  | {
      type: 'battle_ready_ack';
      matchId: string;
      requestId: string;
      clockStarted: boolean;
    }
  | {
      type: 'battle_clock_started';
      matchId: string;
      gameVersion: number;
      turnSeconds: number;
    }
  | {
      type: 'error';
      requestId?: string;
      code: string;
      message: string;
    };

export function createRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
