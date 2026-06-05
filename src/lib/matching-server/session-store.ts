import type { MatchingGameState, PlayerSide } from '@/domain/matching-server/protocol';

export type ActiveMatchSession = {
  matchId: string;
  role: PlayerSide;
  userId: string;
  game: MatchingGameState;
  /** サーバー確定の盤面（楽観更新で game だけが先に変わってもここは維持） */
  authoritativeGame: MatchingGameState;
};

let activeSession: ActiveMatchSession | null = null;

export function setActiveMatchSession(
  session: Omit<ActiveMatchSession, 'authoritativeGame'> & {
    authoritativeGame?: MatchingGameState;
  },
): void {
  activeSession = {
    ...session,
    authoritativeGame: session.authoritativeGame ?? session.game,
  };
}

export function updateActiveMatchGame(game: MatchingGameState): void {
  if (!activeSession) return;
  activeSession = { ...activeSession, game };
}

/** サーバーから game_started / game_state_updated を受けたときだけ呼ぶ */
export function updateAuthoritativeMatchGame(game: MatchingGameState): void {
  if (!activeSession) return;
  activeSession = { ...activeSession, game, authoritativeGame: game };
}

export function getAuthoritativeMatchGame(): MatchingGameState | null {
  return activeSession?.authoritativeGame ?? null;
}

export function getActiveMatchSession(): ActiveMatchSession | null {
  return activeSession;
}

export function clearActiveMatchSession(): void {
  activeSession = null;
}
