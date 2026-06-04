import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeCommonHeader } from '@/components/organism/home-common-header';
import { useHomeHudSnapshot } from '@/hooks/common/use-home-hud-snapshot';

type GlobalHomeHudProps = {
  pawnCurrency?: number;
  goldCurrency?: number;
};

export function GlobalHomeHud({ pawnCurrency, goldCurrency }: GlobalHomeHudProps) {
  const snapshot = useHomeHudSnapshot();

  return (
    <>
      <SafeAreaView edges={['top']} />
      <HomeCommonHeader
        userName={snapshot.playerName}
        rating={snapshot.rating}
        pawnCurrency={pawnCurrency ?? snapshot.pawnCurrency}
        goldCurrency={goldCurrency ?? snapshot.goldCurrency}
        stamina={snapshot.stamina}
        maxStamina={snapshot.maxStamina}
        nextRecoveryAt={snapshot.nextRecoveryAt}
      />
    </>
  );
}
