import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useGachaRoomScreen } from '@/features/gacha-room/ui/use-gacha-room-screen';

const mockLoadExecute = jest.fn();
const mockRollExecute = jest.fn();
const mockShowRewardedAd = jest.fn();

jest.mock('@/usecases/gacha-room/create-gacha-room-usecases', () => ({
  createLoadGachaLobbyUseCase: () => ({
    execute: (...args: unknown[]) => mockLoadExecute(...args),
  }),
  createRollGachaUseCase: () => ({
    execute: (...args: unknown[]) => mockRollExecute(...args),
  }),
}));

jest.mock('@/lib/ads/show-rewarded-ad', () => ({
  showRewardedAd: (...args: unknown[]) => mockShowRewardedAd(...args),
}));

const banner = {
  key: 'ukanmuri',
  name: 'うかんむりガチャ',
  rareRateText: '',
  pieceRateText: '',
  description: null,
  lineup: [],
  pawnCost: 10,
  goldCost: 0,
};

const lobby = {
  banners: [banner],
  pawnCurrency: 100,
  goldCurrency: 10,
  history: [],
  dailyAdGacha: {
    dayKey: '2026-06-25',
    featuredGachaKey: 'ukanmuri',
    used: false,
  },
};

const rollResult = {
  type: 'miss' as const,
  currency: 'pawn' as const,
  amount: 5,
  pawnCurrency: 105,
  goldCurrency: 10,
};

describe('useGachaRoomScreen rollWithAd', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadExecute.mockResolvedValue(lobby);
    mockRollExecute.mockResolvedValue(rollResult);
  });

  it('広告報酬を獲得した場合は本日の無料枠で1回引く', async () => {
    mockShowRewardedAd.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useGachaRoomScreen());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.rollWithAd('ukanmuri');
    });

    expect(mockRollExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        gachaId: 'ukanmuri',
        adFreeRoll: true,
      }),
    );
    expect(result.current.noticeMessage).toBeNull();
    expect(result.current.dailyAdGacha?.used).toBe(true);
  });

  it('広告がロード・表示できない場合は案内を表示して本日の無料枠で1回引く', async () => {
    mockShowRewardedAd.mockResolvedValue({ ok: false });
    const { result } = renderHook(() => useGachaRoomScreen());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.rollWithAd('ukanmuri');
    });

    expect(mockRollExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        gachaId: 'ukanmuri',
        adFreeRoll: true,
      }),
    );
    expect(result.current.noticeMessage).toBe(
      '現在広告を読み込めませんでした。今回は広告なしで実行します。',
    );
    expect(result.current.dailyAdGacha?.used).toBe(true);
  });

  it('ユーザーが広告をキャンセルした場合は無料枠を使わない', async () => {
    mockShowRewardedAd.mockResolvedValue({ ok: false, cancelled: true });
    const { result } = renderHook(() => useGachaRoomScreen());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await act(async () => {
      await result.current.rollWithAd('ukanmuri');
    });

    expect(mockRollExecute).not.toHaveBeenCalled();
    expect(result.current.dailyAdGacha?.used).toBe(false);
  });
});
