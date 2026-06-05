import type {
  PlayerSide,
  WebSocketClientMessage,
  WebSocketServerMessage,
} from '@/domain/matching-server/protocol';
import { createRequestId } from '@/domain/matching-server/protocol';
import { getMatchingServerWsBaseUrl } from '@/lib/config/online-match';
import {
  clearActiveMatchProfile,
  setActiveMatchProfile,
} from '@/lib/matching-server/match-profile-store';
import {
  clearActiveMatchSession,
  setActiveMatchSession,
  updateAuthoritativeMatchGame,
} from '@/lib/matching-server/session-store';

export type MatchingServerConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'closed';

type Listener = (message: WebSocketServerMessage) => void;

let singleton: MatchingServerClient | null = null;

export function getMatchingServerClient(): MatchingServerClient {
  if (!singleton) {
    singleton = new MatchingServerClient();
  }
  return singleton;
}

export function resetMatchingServerClientForTests(): void {
  singleton?.disconnect();
  singleton = null;
}

export class MatchingServerClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private connectionState: MatchingServerConnectionState = 'idle';
  private userId: string | null = null;
  private matchId: string | null = null;
  private role: PlayerSide | null = null;
  private lastError: string | null = null;

  getConnectionState(): MatchingServerConnectionState {
    return this.connectionState;
  }

  getMatchId(): string | null {
    return this.matchId;
  }

  getRole(): PlayerSide | null {
    return this.role;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  connect(userId: string, options?: { matchId?: string; ticket?: string }): Promise<void> {
    const wsBaseUrl = getMatchingServerWsBaseUrl();
    if (!wsBaseUrl) {
      return Promise.reject(new Error('EXPO_PUBLIC_MATCHING_SERVER_WS_URL が未設定です'));
    }

    const nextMatchId = options?.matchId ?? null;
    if (
      this.ws &&
      this.userId === userId &&
      this.matchId === nextMatchId &&
      this.connectionState === 'connected'
    ) {
      return Promise.resolve();
    }

    this.disconnect();
    this.userId = userId;
    this.matchId = options?.matchId ?? null;
    this.connectionState = 'connecting';
    this.lastError = null;

    const url = new URL(wsBaseUrl);
    if (options?.ticket) {
      url.searchParams.set('ticket', options.ticket);
    } else {
      url.searchParams.set('userId', userId);
    }
    if (options?.matchId) {
      url.searchParams.set('matchId', options.matchId);
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url.toString());
      this.ws = ws;

      const onOpen = () => {
        this.connectionState = 'connected';
        ws.removeEventListener('error', onError);
        resolve();
      };

      const onError = () => {
        this.connectionState = 'error';
        this.lastError = 'WebSocket 接続に失敗しました';
        reject(new Error(this.lastError));
      };

      ws.addEventListener('open', onOpen, { once: true });
      ws.addEventListener('error', onError, { once: true });

      ws.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as WebSocketServerMessage;
          this.handleServerMessage(payload);
          for (const listener of this.listeners) {
            listener(payload);
          }
        } catch {
          this.emitSyntheticError('INVALID_JSON', 'サーバー応答の解析に失敗しました');
        }
      });

      ws.addEventListener('close', () => {
        if (this.connectionState !== 'error') {
          this.connectionState = 'closed';
        }
        this.ws = null;
      });
    });
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.connectionState = 'idle';
    this.userId = null;
    this.matchId = null;
    this.role = null;
    this.lastError = null;
    clearActiveMatchSession();
    clearActiveMatchProfile();
  }

  enterQueue(input: {
    userId: string;
    rating: number;
    displayName: string;
    battleSetupId: string;
  }): void {
    this.send({
      action: 'enter_queue',
      requestId: createRequestId(),
      userId: input.userId,
      rating: input.rating,
      displayName: input.displayName,
      battleSetupId: input.battleSetupId,
    });
  }

  cancelQueue(userId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        action: 'cancel_queue',
        requestId: createRequestId(),
        userId,
      });
    }
    this.disconnect();
  }

  makeMove(input: {
    userId: string;
    matchId: string;
    expectedVersion: number;
    move: import('@/domain/matching-server/protocol').MovePayload;
  }): void {
    this.send({
      action: 'make_move',
      requestId: createRequestId(),
      userId: input.userId,
      matchId: input.matchId,
      expectedVersion: input.expectedVersion,
      move: input.move,
    });
  }

  resign(userId: string, matchId: string): void {
    this.send({
      action: 'resign',
      requestId: createRequestId(),
      userId,
      matchId,
    });
  }

  private send(message: WebSocketClientMessage): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket が接続されていません');
    }
    this.ws.send(JSON.stringify(message));
  }

  private handleServerMessage(message: WebSocketServerMessage): void {
    switch (message.type) {
      case 'match_found':
        this.matchId = message.matchId;
        this.role = message.role;
        setActiveMatchProfile({ self: message.self, opponent: message.opponent });
        return;
      case 'game_started':
        this.matchId = message.matchId;
        if (this.userId && this.role) {
          setActiveMatchSession({
            matchId: message.matchId,
            role: this.role,
            userId: this.userId,
            game: message.initialState,
          });
        }
        return;
      case 'game_state_updated':
        this.matchId = message.matchId;
        updateAuthoritativeMatchGame({
          version: message.version,
          turn: message.turn,
          board: message.board,
          hands: message.hands,
          skillState: message.skillState,
          lastMove: message.lastMove,
          lastSkillTriggered: message.lastSkillTriggered,
          canonicalState: message.canonicalState,
        });
        return;
      case 'game_finished':
        return;
      case 'error':
        this.lastError = message.message;
        return;
      default:
        return;
    }
  }

  private emitSyntheticError(code: string, message: string): void {
    const payload: WebSocketServerMessage = { type: 'error', code, message };
    for (const listener of this.listeners) {
      listener(payload);
    }
  }
}
