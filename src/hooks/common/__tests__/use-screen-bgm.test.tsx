import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useScreenBgm } from '@/hooks/common/use-screen-bgm';
import { playBgm, stopBgm } from '@/lib/audio/audio-manager';

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (effect: () => void | (() => void)) => {
    const React = jest.requireActual('react') as typeof import('react');
    React.useEffect(() => effect(), [effect]);
  },
}));

jest.mock('@/lib/audio/audio-manager', () => ({
  playBgm: jest.fn().mockResolvedValue(undefined),
  isBgmPlaying: jest.fn(() => false),
  stopBgm: jest.fn(),
}));

describe('useScreenBgm', () => {
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('plays BGM on mount and stops on unmount', async () => {
    const { unmount } = renderHook(() => useScreenBgm('home'));

    await waitFor(() => {
      expect(playBgm).toHaveBeenCalledWith('home');
    });

    unmount();

    expect(stopBgm).toHaveBeenCalledWith('home');
  });

  it('retries BGM playback when the first attempt fails', async () => {
    jest.useFakeTimers();
    (playBgm as jest.Mock)
      .mockRejectedValueOnce(new Error('audio mode init failed'))
      .mockResolvedValue(undefined);

    renderHook(() => useScreenBgm('home'));

    await waitFor(() => {
      expect(playBgm).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    await waitFor(() => {
      expect(playBgm).toHaveBeenCalledTimes(2);
      expect(playBgm).toHaveBeenLastCalledWith('home');
    });
  });

  it('checks whether BGM stopped and resumes it on the next watchdog tick', async () => {
    jest.useFakeTimers();

    renderHook(() => useScreenBgm('home'));

    await waitFor(() => {
      expect(playBgm).toHaveBeenCalledWith('home');
    });

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(playBgm).toHaveBeenCalledTimes(2);
    });
  });
});
