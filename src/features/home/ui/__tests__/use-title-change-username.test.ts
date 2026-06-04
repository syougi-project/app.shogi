import { act, renderHook, waitFor } from '@testing-library/react-native';

const mockGetDisplayName = jest.fn();
const mockUpdateDisplayName = jest.fn();

jest.mock('@/infra/datasources/player-api-datasource', () => ({
  PlayerApiDataSource: jest.fn().mockImplementation(() => ({
    getDisplayName: (...args: unknown[]) => mockGetDisplayName(...args),
    updateDisplayName: (...args: unknown[]) => mockUpdateDisplayName(...args),
  })),
}));

import { useTitleChangeUsername } from '../use-title-change-username';

describe('useTitleChangeUsername', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDisplayName.mockResolvedValue('将棋太郎');
    mockUpdateDisplayName.mockResolvedValue(undefined);
  });

  it('loads current display name on open', async () => {
    const { result } = renderHook(() => useTitleChangeUsername('token-1'));

    await act(async () => {
      await result.current.open();
    });

    await waitFor(() => {
      expect(result.current.username).toBe('将棋太郎');
      expect(result.current.isOpen).toBe(true);
    });
    expect(mockGetDisplayName).toHaveBeenCalledWith('token-1');
  });

  it('saves username via setupUsername path', async () => {
    const { result } = renderHook(() => useTitleChangeUsername('token-1'));

    await act(async () => {
      await result.current.open();
    });

    act(() => {
      result.current.setUsername('新しい名前');
    });

    await act(async () => {
      await result.current.submit();
    });

    await waitFor(() => {
      expect(result.current.savedMessage).toBe('ユーザー名を変更しました');
    });
    expect(mockUpdateDisplayName).toHaveBeenCalledWith('token-1', '新しい名前');
  });
});
