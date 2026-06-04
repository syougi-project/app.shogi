import { useCallback, useState } from 'react';

import { PlayerApiDataSource } from '@/infra/datasources/player-api-datasource';
import { setupUsername } from '@/usecases/player/setup-username-usecase';

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === 'string') return msg;
  }
  return 'ユーザー名の変更に失敗しました';
}

export function useTitleChangeUsername(accessToken: string | null) {
  const [isOpen, setIsOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setError(null);
    setSavedMessage(null);
  }, []);

  const open = useCallback(async () => {
    if (!accessToken) {
      setError('ログイン情報を取得できませんでした');
      setIsOpen(true);
      return;
    }

    setIsOpen(true);
    setError(null);
    setSavedMessage(null);
    setIsLoading(true);

    try {
      const dataSource = new PlayerApiDataSource();
      const current = await dataSource.getDisplayName(accessToken);
      setUsername(current ?? '');
    } catch (e) {
      setUsername('');
      setError(errorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  const submit = useCallback(async () => {
    if (!accessToken) return;
    setIsSubmitting(true);
    setError(null);
    setSavedMessage(null);

    try {
      await setupUsername(accessToken, username);
      setSavedMessage('ユーザー名を変更しました');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setIsSubmitting(false);
    }
  }, [accessToken, username]);

  return {
    isOpen,
    username,
    setUsername,
    isLoading,
    isSubmitting,
    error,
    savedMessage,
    open,
    close,
    submit,
  };
}
