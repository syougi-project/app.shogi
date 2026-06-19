import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuthSession } from '@/hooks/common/auth-session-context';
import {
  loadHomeSnapshot,
  resetHomeSnapshotForAccountChange,
} from '@/hooks/common/home-snapshot-store';
import { supabase } from '@/lib/supabase/supabase-client';
import { setupUsername } from '@/usecases/player/setup-username-usecase';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string') return msg;
  }
  return '登録に失敗しました';
}

function shouldRetryWithFreshSession(error: unknown): boolean {
  const message = errorMessage(error).toLowerCase();
  return message.includes('unauthorized');
}

async function refreshAnonymousSession(): Promise<string> {
  await supabase.auth.signOut({ scope: 'local' });

  const { data, error } = await supabase.auth.signInAnonymously();
  const token = data.session?.access_token;
  if (error || !data.user || !token) {
    throw new Error(error?.message ?? '匿名ログインの再作成に失敗しました');
  }

  return token;
}

export function useUsernameSetupScreen() {
  const router = useRouter();
  const { accessToken, reinitializeSession } = useAuthSession();
  const [token, setToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(accessToken);
    setIsInitializing(false);
  }, [accessToken]);

  const handleSubmit = async () => {
    if (!token) return;
    setIsSubmitting(true);
    setError(null);

    const refreshHomeAfterUsernameSetup = async () => {
      resetHomeSnapshotForAccountChange();
      await reinitializeSession();
      await loadHomeSnapshot(true).catch(() => undefined);
    };

    try {
      await setupUsername(token, username);
      await refreshHomeAfterUsernameSetup();
      router.replace('/');
      return;
    } catch (e) {
      if (shouldRetryWithFreshSession(e)) {
        try {
          const refreshedToken = await refreshAnonymousSession();
          setToken(refreshedToken);
          await setupUsername(refreshedToken, username);
          await refreshHomeAfterUsernameSetup();
          router.replace('/');
          return;
        } catch (retryError) {
          setError(errorMessage(retryError));
          setIsSubmitting(false);
          return;
        }
      }

      setError(errorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  return { username, setUsername, isInitializing, isSubmitting, error, handleSubmit };
}
