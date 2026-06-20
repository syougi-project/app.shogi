import {
  HI_HEN_GACHA_LINEUP,
  KANKEN1_GACHA_LINEUP,
  SHINNYO_GACHA_LINEUP,
  UKANMURI_GACHA_LINEUP,
} from '@/constants/gacha-lineup-catalog';
import { isGachaCollectibleChar } from '@/constants/gacha-piece-metadata';
import { formatPieceRateTextFromLineup } from '@/features/gacha-room/lib/gacha-lineup-rates';
import {
  addGachaMockCurrency,
  getGachaMockWallet,
  grantDuplicateGoldReward,
  grantGachaCollectible,
  spendGachaRollCost,
} from '@/features/gacha-room/lib/gacha-mock-store';
import { canRollGachaWithAd, normalizeAdGachaCode } from '@/features/gacha-room/lib/daily-ad-gacha';
import {
  getDailyAdGachaStatus,
  markDailyAdGachaUsed,
} from '@/features/gacha-room/lib/daily-ad-gacha-store';
import {
  gachaCurrencyRewardAmount,
  lineupToGachaRollPieces,
  type GachaRollPiece,
} from '@/features/gacha-room/lib/gacha-roll-pieces';
import { effectiveGachaPieceWeight } from '@/lib/gacha/gacha-ball-piece-rate';
import { ApiClientError } from '@/infra/http/api-client';
import {
  GachaLobbySnapshot,
  LoadGachaLobbyUseCase,
} from '@/usecases/gacha-room/load-gacha-lobby-usecase';
import {
  RollGachaInput,
  RollGachaResult,
  RollGachaUseCase,
} from '@/usecases/gacha-room/roll-gacha-usecase';

export const banners: GachaLobbySnapshot['banners'] = [
  {
    key: 'ukanmuri',
    name: 'うかんむりガチャ',
    rareRateText: 'UR 3% / SR 7%',
    pieceRateText: formatPieceRateTextFromLineup(UKANMURI_GACHA_LINEUP),
    description: '室・定・安・宋・歩・金のいずれかがランダムで排出されます。',
    lineup: UKANMURI_GACHA_LINEUP,
    pawnCost: 10,
    goldCost: 0,
  },
  {
    key: 'hiHen',
    name: 'ひへんガチャ',
    rareRateText: 'UR 4% / SSR 10%',
    pieceRateText: formatPieceRateTextFromLineup(HI_HEN_GACHA_LINEUP),
    description: '歩・金・爆・煽・灯のいずれかがランダムで排出されます。',
    lineup: HI_HEN_GACHA_LINEUP,
    pawnCost: 10,
    goldCost: 0,
  },
  {
    key: 'shinnyo',
    name: 'しんにょうガチャ',
    rareRateText: 'UR 3% / SSR 9%',
    pieceRateText: formatPieceRateTextFromLineup(SHINNYO_GACHA_LINEUP),
    description: '歩・金・辺・逸・進・逃のいずれかがランダムで排出されます。',
    lineup: SHINNYO_GACHA_LINEUP,
    pawnCost: 10,
    goldCost: 0,
  },
  {
    key: 'kanken1',
    name: '漢検１級ガチャ',
    rareRateText: '艸3% / 閹3% / 膠3%',
    pieceRateText: formatPieceRateTextFromLineup(KANKEN1_GACHA_LINEUP),
    description: '歩・金・艸・閹・膠のいずれかがランダムで排出されます。',
    lineup: KANKEN1_GACHA_LINEUP,
    usesGold: true,
    pawnCost: 0,
    goldCost: 2,
  },
];

type GachaConfig = {
  /** HTML 版同様 1 = 毎回排出テーブルから抽選（表示の排出率と一致） */
  hitRate: number;
  goldFailRate: number;
  pawnFailReward: number;
  goldFailReward: number;
  pieces: GachaRollPiece[];
};

const HI_HEN_GACHA_CONFIG: GachaConfig = {
  hitRate: 1,
  goldFailRate: 0.25,
  pawnFailReward: 6,
  goldFailReward: 1,
  pieces: lineupToGachaRollPieces(HI_HEN_GACHA_LINEUP),
};

const GACHA_CONFIGS: Record<string, GachaConfig> = {
  hihen: HI_HEN_GACHA_CONFIG,
  hiHen: HI_HEN_GACHA_CONFIG,
  ukanmuri: {
    hitRate: 1,
    goldFailRate: 0.2,
    pawnFailReward: 5,
    goldFailReward: 1,
    pieces: lineupToGachaRollPieces(UKANMURI_GACHA_LINEUP),
  },
  shinnyo: {
    hitRate: 1,
    goldFailRate: 0.22,
    pawnFailReward: 7,
    goldFailReward: 1,
    pieces: lineupToGachaRollPieces(SHINNYO_GACHA_LINEUP),
  },
  kanken1: {
    hitRate: 1,
    goldFailRate: 0.35,
    pawnFailReward: 10,
    goldFailReward: 2,
    pieces: lineupToGachaRollPieces(KANKEN1_GACHA_LINEUP),
  },
};

function pickWeightedRandom<T extends { weight: number; char: string }>(
  items: T[],
  colorIndex: number,
): T {
  const total = items.reduce(
    (sum, item) => sum + effectiveGachaPieceWeight(item.char, item.weight, colorIndex),
    0,
  );
  let r = Math.random() * total;
  for (const item of items) {
    r -= effectiveGachaPieceWeight(item.char, item.weight, colorIndex);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

export class MockLoadGachaLobbyUseCase implements LoadGachaLobbyUseCase {
  async execute(): Promise<GachaLobbySnapshot> {
    const [{ pawnCurrency, goldCurrency }, dailyAdGacha] = await Promise.all([
      Promise.resolve(getGachaMockWallet()),
      getDailyAdGachaStatus(),
    ]);
    return {
      banners,
      pawnCurrency,
      goldCurrency,
      history: [],
      dailyAdGacha,
    };
  }
}

export class MockRollGachaUseCase implements RollGachaUseCase {
  async execute(input: RollGachaInput): Promise<RollGachaResult> {
    const config = GACHA_CONFIGS[input.gachaId];
    if (!config) {
      const wallet = addGachaMockCurrency({ pawn: 5 });
      return {
        type: 'miss',
        currency: 'pawn',
        amount: 5,
        pawnCurrency: wallet.pawnCurrency,
        goldCurrency: wallet.goldCurrency,
      };
    }

    if (input.adFreeRoll) {
      const status = await getDailyAdGachaStatus();
      if (!canRollGachaWithAd(input.gachaId, status)) {
        throw new ApiClientError({
          code: 'AD_GACHA_UNAVAILABLE',
          message: '本日の広告無償ガチャは利用できません',
        });
      }
      if (normalizeAdGachaCode(input.gachaId) == null) {
        throw new ApiClientError({
          code: 'AD_GACHA_UNAVAILABLE',
          message: 'このガチャは広告無償の対象外です',
        });
      }
    } else {
      const spent = spendGachaRollCost(input.gachaId);
      if (!spent.ok) {
        throw new ApiClientError({
          code: 'INSUFFICIENT_CURRENCY',
          message: '通貨が足りません',
        });
      }
    }

    const finalize = async (result: RollGachaResult): Promise<RollGachaResult> => {
      if (input.adFreeRoll) {
        await markDailyAdGachaUsed();
      }
      return result;
    };

    const colorIndex = input.gachaBallColorIndex ?? 0;

    if (Math.random() < config.hitRate) {
      const picked = pickWeightedRandom(config.pieces, colorIndex);
      if (picked.isCurrency && picked.currencyType) {
        const amount = gachaCurrencyRewardAmount(input.gachaId, picked.currencyType);
        const wallet = addGachaMockCurrency(
          picked.currencyType === 'pawn' ? { pawn: amount } : { gold: amount },
        );
        return finalize({
          type: 'miss',
          currency: picked.currencyType,
          amount,
          pawnCurrency: wallet.pawnCurrency,
          goldCurrency: wallet.goldCurrency,
        });
      }

      const piece = {
        char: picked.char,
        name: picked.name,
        rarity: picked.rarity,
        description: picked.description ?? '',
      };

      if (isGachaCollectibleChar(picked.char)) {
        const isNew = grantGachaCollectible(picked.char);
        if (!isNew) {
          const wallet = grantDuplicateGoldReward();
          return finalize({
            type: 'hit',
            piece,
            alreadyOwned: true,
            duplicateGoldGranted: 1,
            pawnCurrency: wallet.pawnCurrency,
            goldCurrency: wallet.goldCurrency,
          });
        }
        const wallet = getGachaMockWallet();
        return finalize({
          type: 'hit',
          piece,
          alreadyOwned: false,
          pawnCurrency: wallet.pawnCurrency,
          goldCurrency: wallet.goldCurrency,
        });
      }
    }

    const isGold = Math.random() < config.goldFailRate;
    const amount = isGold ? config.goldFailReward : config.pawnFailReward;
    const wallet = addGachaMockCurrency(isGold ? { gold: amount } : { pawn: amount });
    return finalize({
      type: 'miss',
      currency: isGold ? 'gold' : 'pawn',
      amount,
      pawnCurrency: wallet.pawnCurrency,
      goldCurrency: wallet.goldCurrency,
    });
  }
}
