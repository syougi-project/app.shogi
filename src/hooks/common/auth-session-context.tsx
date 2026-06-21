import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ensureSession } from '@/usecases/auth/ensure-session-usecase';
import { ApiClientError } from '@/infra/http/api-client';

const AUTH_RETRY_MESSAGE = 'サーバーの応答に時間がかかっています';
const AUTH_CONNECTION_MESSAGE =
  'サーバーに接続できません。BFF が起動しているか、EXPO_PUBLIC_API_BASE_URL を確認してください。';

type AuthSessionState = {
  isReady: boolean;
  userId: string | null;
  accessToken: string | null;
  needsUsernameSetup: boolean;
  error: Error | null;
  statusMessage: string | null;
  reinitializeSession: () => Promise<void>;
};

const initialState: AuthSessionState = {
  isReady: false,
  userId: null,
  accessToken: null,
  needsUsernameSetup: false,
  error: null,
  statusMessage: null,
  reinitializeSession: async () => {},
};

const AuthSessionContext = createContext<AuthSessionState>(initialState);

function normalizeUnknownError(error: unknown): Error {
  if (error instanceof ApiClientError) {
    if (error.code === 'NETWORK_TIMEOUT') {
      return Object.assign(new Error(error.message), { userMessage: AUTH_CONNECTION_MESSAGE });
    }
  }

  if (error instanceof Error) {
    if (/timed out|network request failed|failed to fetch/i.test(error.message)) {
      return Object.assign(error, { userMessage: AUTH_CONNECTION_MESSAGE });
    }
    return error;
  }
  if (typeof error === 'string') return new Error(error);

  if (error && typeof error === 'object') {
    const maybe = error as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
    const message = typeof maybe.message === 'string' ? maybe.message : 'Unknown auth error';
    const extras = [maybe.code, maybe.details, maybe.hint].filter((v) => typeof v === 'string');
    return new Error(extras.length > 0 ? `${message} (${extras.join(' | ')})` : message);
  }

  return new Error(String(error));
}

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthSessionState>(initialState);

  const reinitializeSession = useCallback(async () => {
    setState((current) => ({
      ...current,
      isReady: false,
      error: null,
      statusMessage: null,
    }));

    try {
      const { userId, accessToken, needsUsernameSetup } = await ensureSession({
        onRetry: ({ nextAttempt }) => {
          if (nextAttempt < 2) return;
          setState((current) => ({
            ...current,
            statusMessage: AUTH_RETRY_MESSAGE,
          }));
        },
      });
      setState((current) => ({
        ...current,
        isReady: true,
        userId,
        accessToken,
        needsUsernameSetup,
        error: null,
        statusMessage: null,
      }));
    } catch (error: unknown) {
      setState((current) => ({
        ...current,
        isReady: true,
        userId: null,
        accessToken: null,
        needsUsernameSetup: false,
        error: normalizeUnknownError(error),
        statusMessage: null,
      }));
    }
  }, []);

  useEffect(() => {
    void reinitializeSession();
  }, [reinitializeSession]);

  const value = useMemo(
    () => ({
      ...state,
      reinitializeSession,
    }),
    [state, reinitializeSession],
  );
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionState {
  return useContext(AuthSessionContext);
}
