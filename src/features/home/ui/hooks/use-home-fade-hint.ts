import { useCallback, useRef, useState } from 'react';
import { Animated } from 'react-native';

const DEFAULT_FADE_IN_MS = 400;
const DEFAULT_FADE_HOLD_MS = 900;
const DEFAULT_FADE_OUT_MS = 400;
const DEFAULT_POP_IN_SCALE = 0.86;
const DEFAULT_POP_HOLD_SCALE = 1.04;
const DEFAULT_FLOAT_IN_Y = 8;

type UseHomeFadeHintOptions = {
  fadeInMs?: number;
  fadeHoldMs?: number;
  fadeOutMs?: number;
};

export function useHomeFadeHint(options?: UseHomeFadeHintOptions) {
  const fadeInMs = options?.fadeInMs ?? DEFAULT_FADE_IN_MS;
  const fadeHoldMs = options?.fadeHoldMs ?? DEFAULT_FADE_HOLD_MS;
  const fadeOutMs = options?.fadeOutMs ?? DEFAULT_FADE_OUT_MS;

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(DEFAULT_POP_IN_SCALE)).current;
  const translateY = useRef(new Animated.Value(DEFAULT_FLOAT_IN_Y)).current;
  const [visible, setVisible] = useState(false);
  const runningRef = useRef(false);

  const show = useCallback(() => {
    if (runningRef.current) {
      opacity.stopAnimation();
      scale.stopAnimation();
      translateY.stopAnimation();
    }
    runningRef.current = true;
    setVisible(true);
    opacity.setValue(0);
    scale.setValue(DEFAULT_POP_IN_SCALE);
    translateY.setValue(DEFAULT_FLOAT_IN_Y);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: fadeInMs,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: DEFAULT_POP_HOLD_SCALE,
          duration: fadeInMs,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: fadeInMs,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(fadeHoldMs),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: fadeOutMs,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: fadeOutMs,
          useNativeDriver: true,
        }),
      ]),
    ]).start(({ finished }) => {
      runningRef.current = false;
      if (finished) {
        setVisible(false);
      }
    });
  }, [fadeHoldMs, fadeInMs, fadeOutMs, opacity, scale, translateY]);

  return { opacity, scale, translateY, visible, show };
}
