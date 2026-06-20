import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ExpProgressBar } from '@/components/atom/exp-progress-bar';
import { HeaderLabel } from '@/components/atom/header-label';
import { homeAssets } from '@/constants/home-assets';
import {
  HOME_SETTINGS_BUTTON_HEIGHT,
  HOME_SETTINGS_BUTTON_WIDTH,
} from '@/features/home/ui/home-layout';

type PlayerStatusProps = {
  userName: string;
  onUserNamePress?: () => void;
  onPressSettings?: () => void;
  rating: number;
  stamina?: number;
  maxStamina?: number;
  nextRecoveryAt?: string | null;
};

function useCountdown(nextRecoveryAt?: string | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!nextRecoveryAt) {
      setLabel(null);
      return;
    }

    function tick() {
      const diff = new Date(nextRecoveryAt!).getTime() - Date.now();
      if (diff <= 0) {
        setLabel('00:00');
        return;
      }
      const totalSec = Math.ceil(diff / 1000);
      const m = Math.floor(totalSec / 60);
      const s = totalSec % 60;
      setLabel(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextRecoveryAt]);

  return label;
}

export function PlayerStatus({
  userName,
  onUserNamePress,
  onPressSettings,
  rating,
  stamina = 50,
  maxStamina = 50,
  nextRecoveryAt,
}: PlayerStatusProps) {
  const displayRating = Math.max(0, Math.floor(rating));
  const staminaCurrent = Math.max(0, stamina);
  const staminaMax = Math.max(1, maxStamina);
  const staminaProgress = staminaCurrent / staminaMax;
  const countdown = useCountdown(staminaCurrent < staminaMax ? nextRecoveryAt : null);

  return (
    <View className="mr-3 flex-1 pr-2">
      <View className="max-w-full flex-row items-center gap-1 self-start">
        <View className="min-w-0 shrink">
          <HeaderLabel text={userName} onPress={onUserNamePress} />
        </View>
        {onPressSettings ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="設定を開く"
            onPress={onPressSettings}
            className="shrink-0 active:scale-95"
          >
            <Image
              source={homeAssets.settingsButton}
              contentFit="contain"
              style={{ width: HOME_SETTINGS_BUTTON_WIDTH, height: HOME_SETTINGS_BUTTON_HEIGHT }}
            />
          </Pressable>
        ) : null}
      </View>
      <View className="mt-2 flex-row items-center">
        <View className="flex-1 gap-1">
          <View className="flex-row items-center">
            <Text className="text-[15px] font-black text-[#4b2e1f]">{`◆レート${displayRating}`}</Text>
          </View>
          <View className="flex-row items-center">
            <View className="w-36">
              <ExpProgressBar progress={staminaProgress} fillClassName="bg-[#6bb6ff]" />
            </View>
            <Text className="ml-2 text-[10px] font-black text-[#4b2e1f]">{`スタミナ ${staminaCurrent}/${staminaMax}`}</Text>
            {countdown !== null && (
              <Text className="ml-1 text-[9px] font-black text-[#7a5c3a]">{`+1 ${countdown}`}</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
