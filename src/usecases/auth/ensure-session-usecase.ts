import { supabase } from '@/lib/supabase/supabase-client';
import { PlayerApiDataSource } from '@/infra/datasources/player-api-datasource';
import { ApiClientError } from '@/infra/http/api-client';

export type EnsureSessionResult = {
  userId: string;
  accessToken: string;
  isNewUser: boolean;
  needsUsernameSetup: boolean;
};

export type EnsureSessionRetryState = {
  operation: 'anonymous-sign-in';
  nextAttempt: number;
  maxAttempts: number;
  delayMs: number;
};

export type EnsureSessionOptions = {
  maxAuthAttempts?: number;
  authRetryBaseDelayMs?: number;
  authRetryMaxDelayMs?: number;
  onRetry?: (state: EnsureSessionRetryState) => void;
};

const playerDataSource = new PlayerApiDataSource();
const DEFAULT_MAX_AUTH_ATTEMPTS = 8;
const DEFAULT_AUTH_RETRY_BASE_DELAY_MS = 1_500;
const DEFAULT_AUTH_RETRY_MAX_DELAY_MS = 15_000;

export class AuthRetryLimitError extends Error {
  readonly userMessage = '接続が混み合っています。時間をおいてもう一度お試しください。';

  constructor(cause: unknown) {
    const message =
      cause instanceof Error ? cause.message : 'Authentication temporarily unavailable';
    super(message);
    this.name = 'AuthRetryLimitError';
  }
}

function isUnauthorized(error: unknown): boolean {
  return (
    typeof ApiClientError === 'function' &&
    error instanceof ApiClientError &&
    (error.code === 'UNAUTHORIZED' || error.status === 401)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return String(error);
}

function isRetryableAuthError(error: unknown): boolean {
  return /rate limit|too many requests/i.test(errorMessage(error));
}

async function signInAnonymousOnce() {
  const { data, error } = await supabase.auth.signInAnonymously();
  const user = data.user;
  const accessToken = data.session?.access_token;
  if (error || !user || !accessToken) {
    throw new Error(error?.message ?? 'Anonymous sign-in failed');
  }
  return { userId: user.id, accessToken };
}

async function signInAnonymousOrThrow(options: EnsureSessionOptions = {}) {
  const maxAttempts = Math.max(1, Math.floor(options.maxAuthAttempts ?? DEFAULT_MAX_AUTH_ATTEMPTS));
  const baseDelayMs = Math.max(
    0,
    Math.floor(options.authRetryBaseDelayMs ?? DEFAULT_AUTH_RETRY_BASE_DELAY_MS),
  );
  const maxDelayMs = Math.max(
    baseDelayMs,
    Math.floor(options.authRetryMaxDelayMs ?? DEFAULT_AUTH_RETRY_MAX_DELAY_MS),
  );

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await signInAnonymousOnce();
    } catch (error) {
      lastError = error;
      if (!isRetryableAuthError(error)) throw error;
      if (attempt >= maxAttempts) throw new AuthRetryLimitError(error);

      const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      options.onRetry?.({
        operation: 'anonymous-sign-in',
        nextAttempt: attempt + 1,
        maxAttempts,
        delayMs,
      });
      await sleep(delayMs);
    }
  }

  throw new AuthRetryLimitError(lastError);
}

export async function ensureSession(
  options: EnsureSessionOptions = {},
): Promise<EnsureSessionResult> {
  const { data: sessionData } = await supabase.auth.getSession();

  let userId: string;
  let token: string;
  let isNewUser: boolean;

  const currentSession = sessionData.session;

  if (currentSession) {
    userId = currentSession.user.id;
    token = currentSession.access_token;
    isNewUser = false;
  } else {
    const data = await signInAnonymousOrThrow(options);
    userId = data.userId;
    token = data.accessToken;
    isNewUser = true;
  }

  let displayName: string | null;
  try {
    displayName = await playerDataSource.getDisplayName(token);
  } catch (error) {
    if (!isUnauthorized(error)) throw error;

    await supabase.auth.signOut({ scope: 'local' });
    const data = await signInAnonymousOrThrow(options);
    userId = data.userId;
    token = data.accessToken;
    isNewUser = true;
    displayName = await playerDataSource.getDisplayName(token);
  }

  return { userId, accessToken: token, isNewUser, needsUsernameSetup: displayName === null };
}
