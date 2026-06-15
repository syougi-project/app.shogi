import { Image } from 'expo-image';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';

import { CurrencyChip } from '@/components/atom/currency-chip';
import { stageShogiBattleAssets } from '@/constants/stage-shogi-battle-assets';
import type { Side } from '@/features/stage-shogi/domain/game-rules';
import {
  hasStageClearCurrencyGrant,
  type StageClearGrantedCurrency,
} from '@/lib/stage/stage-clear-currency-reward';

const pawnPieceCoinIcon = require('../../../../../assets/home/ui/hoPieceCoin.png');
const goldPieceCoinIcon = require('../../../../../assets/home/ui/KinPieceCoin.png');

type Props = {
  /** ローカルプレイヤー視点の勝敗（`player`＝あなたの勝ち → 勝利画像） */
  winner: Side;
  /** ステージクリア報酬（勝利時のみ表示） */
  clearReward?: StageClearGrantedCurrency | null;
  /** 指定時はオーバーレイ全体タップでコールバック（オンライン対戦のホーム戻り等） */
  onPress?: () => void;
};

export function BattleEndResultOverlay({ winner, clearReward, onPress }: Props) {
  const { width, height } = useWindowDimensions();
  const source =
    winner === 'player' ? stageShogiBattleAssets.victory : stageShogiBattleAssets.defeat;
  const imgW = Math.min(width * 0.92, 560);
  const imgH = Math.min(height * 0.58, 520);
  const showClearReward =
    winner === 'player' && clearReward != null && hasStageClearCurrencyGrant(clearReward);

  const overlayClassName = 'absolute inset-0 z-[600] items-center justify-center bg-black/50 px-4';

  const content = (
    <View className="items-center">
      <Image
        source={source}
        contentFit="contain"
        style={{ width: imgW, height: imgH }}
        accessibilityLabel={winner === 'player' ? '勝利' : '敗北'}
      />
      {showClearReward ? (
        <View className="mt-3 w-full max-w-sm items-center rounded-xl border border-yellow-500/40 bg-black/65 px-4 py-3">
          <Text className="text-sm font-black text-yellow-200">獲得した通貨</Text>
          <View className="mt-2 flex-row flex-wrap items-center justify-center gap-3">
            {clearReward.pawn > 0 ? (
              <CurrencyChip
                iconSource={pawnPieceCoinIcon}
                value={clearReward.pawn}
                valueClassName="text-base font-black text-white"
              />
            ) : null}
            {clearReward.gold > 0 ? (
              <CurrencyChip
                iconSource={goldPieceCoinIcon}
                value={clearReward.gold}
                valueClassName="text-base font-black text-white"
              />
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        className={overlayClassName}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="ホームに戻る"
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View className={overlayClassName} pointerEvents="box-none">
      {content}
    </View>
  );
}
