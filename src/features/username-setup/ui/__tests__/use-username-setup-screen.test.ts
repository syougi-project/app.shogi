import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useUsernameSetupScreen } from '@/features/username-setup/ui/use-username-setup-screen';

const mockReplace = jest.fn();
const mockSignOut = jest.fn();
const mockSignInAnonymously = jest.fn();
const mockSetupUsername = jest.fn();
const mockUseAuthSession = jest.fn();
const mockReinitializeSession = jest.fn();
const mockResetHomeSnapshotForAccountChange = jest.fn();
const mockLoadHomeSnapshot = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: (...args: unknown[]) => mockReplace(...args),
  }),
}));

jest.mock('@/hooks/common/auth-session-context', () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

jest.mock('@/hooks/common/home-snapshot-store', () => ({
  resetHomeSnapshotForAccountChange: (...args: unknown[]) =>
    mockResetHomeSnapshotForAccountChange(...args),
  loadHomeSnapshot: (...args: unknown[]) => mockLoadHomeSnapshot(...args),
}));

jest.mock('@/lib/supabase/supabase-client', () => ({
  supabase: {
    auth: {
      signOut: (...args: unknown[]) => mockSignOut(...args),
      signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
    },
  },
}));

jest.mock('@/usecases/player/setup-username-usecase', () => ({
  setupUsername: (...args: unknown[]) => mockSetupUsername(...args),
}));

describe('useUsernameSetupScreen', () => {
  const currentToken = 'token-current';
  const refreshedToken = 'token-refreshed';

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthSession.mockReturnValue({
      isReady: true,
      userId: 'user-current',
      accessToken: currentToken,
      needsUsernameSetup: true,
      error: null,
      reinitializeSession: mockReinitializeSession,
    });
    mockReinitializeSession.mockResolvedValue(undefined);
    mockLoadHomeSnapshot.mockResolvedValue(undefined);
    mockSignOut.mockResolvedValue({ error: null });
    mockSignInAnonymously.mockResolvedValue({
      data: { user: { id: 'user-refreshed' }, session: { access_token: refreshedToken } },
      error: null,
    });
  });

  it('初期化で session.access_token を読み取り、成功時はトップへ遷移する', async () => {
    mockSetupUsername.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useUsernameSetupScreen());

    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    act(() => {
      result.current.setUsername('将棋太郎');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockSetupUsername).toHaveBeenCalledWith(currentToken, '将棋太郎');
    expect(mockResetHomeSnapshotForAccountChange).toHaveBeenCalledTimes(1);
    expect(mockReinitializeSession).toHaveBeenCalledTimes(1);
    expect(mockLoadHomeSnapshot).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(result.current.error).toBeNull();
  });

  it('token が取得できない場合は送信しても何もしない', async () => {
    mockUseAuthSession.mockReturnValue({
      isReady: true,
      userId: null,
      accessToken: null,
      needsUsernameSetup: true,
      error: null,
      reinitializeSession: mockReinitializeSession,
    });

    const { result } = renderHook(() => useUsernameSetupScreen());

    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    act(() => {
      result.current.setUsername('名前');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockSetupUsername).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('通常エラー時はエラーメッセージを保持し遷移しない', async () => {
    mockSetupUsername.mockRejectedValueOnce(new Error('登録失敗'));

    const { result } = renderHook(() => useUsernameSetupScreen());
    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    act(() => {
      result.current.setUsername('名前');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.error).toBe('登録失敗');
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('UNAUTHORIZED時は匿名セッション再作成後に再試行して遷移する', async () => {
    mockSetupUsername
      .mockRejectedValueOnce(new Error('UNAUTHORIZED'))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useUsernameSetupScreen());
    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    act(() => {
      result.current.setUsername('再試行ユーザー');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mockSignInAnonymously).toHaveBeenCalledTimes(1);
    expect(mockSetupUsername).toHaveBeenNthCalledWith(1, currentToken, '再試行ユーザー');
    expect(mockSetupUsername).toHaveBeenNthCalledWith(2, refreshedToken, '再試行ユーザー');
    expect(mockResetHomeSnapshotForAccountChange).toHaveBeenCalledTimes(1);
    expect(mockReinitializeSession).toHaveBeenCalledTimes(1);
    expect(mockLoadHomeSnapshot).toHaveBeenCalledWith(true);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('再試行も失敗した場合はエラー表示し遷移しない', async () => {
    mockSetupUsername
      .mockRejectedValueOnce(new Error('UNAUTHORIZED'))
      .mockRejectedValueOnce(new Error('再試行失敗'));

    const { result } = renderHook(() => useUsernameSetupScreen());
    await waitFor(() => expect(result.current.isInitializing).toBe(false));

    act(() => {
      result.current.setUsername('再試行ユーザー');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.error).toBe('再試行失敗');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
