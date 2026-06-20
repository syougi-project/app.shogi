import { ImageBackground, View } from 'react-native';

import { CurrencyStack } from '@/components/molecule/currency-stack';
import { PlayerStatus } from '@/components/molecule/player-status';
import { homeAssets } from '@/constants/home-assets';

type HomeCommonHeaderProps = {
  userName: string;
  onUserNamePress?: () => void;
  onPressSettings?: () => void;
  rating?: number;
  pawnCurrency?: number;
  goldCurrency?: number;
  stamina?: number;
  maxStamina?: number;
  nextRecoveryAt?: string | null;
};
/** ユーザーバー.png のみ（ヘッダー枠とは別指定） */
const USER_BAR_IMAGE_SCALE_X = 1.4;
const USER_BAR_IMAGE_SCALE_Y = 4.0;
const USER_BAR_IMAGE_OFFSET_X = -20;
const USER_BAR_IMAGE_OFFSET_Y = 4;

export function HomeCommonHeader({
  userName,
  onUserNamePress,
  onPressSettings,
  rating = 0,
  pawnCurrency = 0,
  goldCurrency = 0,
  stamina = 50,
  maxStamina = 50,
  nextRecoveryAt,
}: HomeCommonHeaderProps) {
  return (
    <View className="w-full">
      <ImageBackground
        source={homeAssets.userBar}
        resizeMode="stretch"
        className="w-full overflow-visible"
        imageStyle={{
          borderRadius: 0,
          transform: [
            { scaleX: USER_BAR_IMAGE_SCALE_X },
            { scaleY: USER_BAR_IMAGE_SCALE_Y },
            { translateX: USER_BAR_IMAGE_OFFSET_X },
            { translateY: USER_BAR_IMAGE_OFFSET_Y },
          ],
        }}
      >
        <View
          className="relative h-[140px] flex-row items-center justify-between overflow-visible border-y-2 border-[#b88a3b] bg-[#e5cfa7]/35 px-4 py-2"
          style={{
            shadowColor: 'rgba(49,27,17,0.28)',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 1,
            shadowRadius: 14,
            elevation: 7,
          }}
        >
          <View className="absolute inset-[4px] border border-[rgba(120,80,30,0.28)]" />
          <View className="absolute bottom-[-7px] left-1/2 h-[14px] w-[14px] -translate-x-1/2 rotate-45 border-b border-r border-[#8e6428] bg-[#d2a860]" />

          <PlayerStatus
            userName={userName}
            onUserNamePress={onUserNamePress}
            onPressSettings={onPressSettings}
            rating={rating}
            stamina={stamina}
            maxStamina={maxStamina}
            nextRecoveryAt={nextRecoveryAt}
          />
          <CurrencyStack pawnCurrency={pawnCurrency} goldCurrency={goldCurrency} />
        </View>
      </ImageBackground>
    </View>
  );
}
