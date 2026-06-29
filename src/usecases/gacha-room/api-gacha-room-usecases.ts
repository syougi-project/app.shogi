import { GachaApiDataSource } from '@/infra/datasources/gacha-api-datasource';
import { resolveGachaPieceDisplayRarity } from '@/constants/gacha-piece-metadata';
import type { RollGachaResult } from '@/domain/models/gacha';
import {
  GachaLobbySnapshot,
  LoadGachaLobbyUseCase,
} from '@/usecases/gacha-room/load-gacha-lobby-usecase';
import { RollGachaInput, RollGachaUseCase } from '@/usecases/gacha-room/roll-gacha-usecase';

function normalizeRollGachaResultRarity(result: RollGachaResult): RollGachaResult {
  if (result.type !== 'hit') return result;
  return {
    ...result,
    piece: {
      ...result.piece,
      rarity: resolveGachaPieceDisplayRarity(result.piece.char, result.piece.rarity),
    },
  };
}

export class ApiLoadGachaLobbyUseCase implements LoadGachaLobbyUseCase {
  constructor(private readonly dataSource = new GachaApiDataSource()) {}

  async execute(): Promise<GachaLobbySnapshot> {
    return this.dataSource.getLobby();
  }
}

export class ApiRollGachaUseCase implements RollGachaUseCase {
  constructor(private readonly dataSource = new GachaApiDataSource()) {}

  async execute(input: RollGachaInput): Promise<RollGachaResult> {
    const result = await this.dataSource.roll({
      gachaId: input.gachaId,
      gachaBallColorIndex: input.gachaBallColorIndex,
      adFreeRoll: input.adFreeRoll,
    });
    return normalizeRollGachaResultRarity(result);
  }
}
