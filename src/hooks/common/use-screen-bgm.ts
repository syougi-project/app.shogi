import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { BgmTrack } from '@/constants/audio-assets';
import { isBgmPlaying, playBgm, stopBgm } from '@/lib/audio/audio-manager';

const BGM_RETRY_DELAY_MS = 400;
const BGM_RETRY_LIMIT = 5;
const BGM_RECOVERY_CHECK_MS = 5000;

export function useScreenBgm(track: BgmTrack) {
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let retryTimer: ReturnType<typeof setTimeout> | null = null;
      let recoveryTimer: ReturnType<typeof setInterval> | null = null;

      const tryPlay = async (attempt: number) => {
        try {
          await playBgm(track);
        } catch (error) {
          if (cancelled || attempt >= BGM_RETRY_LIMIT) {
            console.error('[Audio] BGM playback failed', { track, attempt, error });
            return;
          }
          retryTimer = setTimeout(() => {
            void tryPlay(attempt + 1);
          }, BGM_RETRY_DELAY_MS);
        }
      };

      const ensurePlaying = () => {
        if (cancelled || isBgmPlaying(track)) {
          return;
        }
        void tryPlay(0);
      };

      ensurePlaying();
      recoveryTimer = setInterval(ensurePlaying, BGM_RECOVERY_CHECK_MS);

      return () => {
        cancelled = true;
        if (retryTimer) {
          clearTimeout(retryTimer);
          retryTimer = null;
        }
        if (recoveryTimer) {
          clearInterval(recoveryTimer);
          recoveryTimer = null;
        }
        stopBgm(track);
      };
    }, [track]),
  );
}
