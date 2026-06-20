import { Alert, Platform } from 'react-native';

export type RewardedAdResult = {
  ok: boolean;
  cancelled?: boolean;
};

/**
 * リワード広告視聴。SDK 未導入の間は開発向けダイアログで代用する。
 * 本番 SDK 導入時はこの関数内だけ差し替える。
 */
export function showRewardedAd(): Promise<RewardedAdResult> {
  if (Platform.OS === 'web') {
    return Promise.resolve({ ok: true });
  }

  return new Promise((resolve) => {
    Alert.alert(
      '広告視聴',
      '動画広告を最後まで視聴すると、本日の対象ガチャを1回無料で引けます。',
      [
        {
          text: 'キャンセル',
          style: 'cancel',
          onPress: () => resolve({ ok: false, cancelled: true }),
        },
        {
          text: '視聴完了',
          onPress: () => resolve({ ok: true }),
        },
      ],
      { cancelable: true, onDismiss: () => resolve({ ok: false, cancelled: true }) },
    );
  });
}
