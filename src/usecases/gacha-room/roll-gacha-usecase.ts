import type { RollGachaResult } from '@/domain/models/gacha';

export type RollGachaInput = {
  gachaId: string;
  /** 0=白, 1=青, 2=赤, 3=金, 4=黒 */
  gachaBallColorIndex?: number;
  /** 本日の広告視聴による無償1回 */
  adFreeRoll?: boolean;
};

export type { GachaPiece, RollGachaResult } from '@/domain/models/gacha';

export interface RollGachaUseCase {
  execute(input: RollGachaInput): Promise<RollGachaResult>;
}
