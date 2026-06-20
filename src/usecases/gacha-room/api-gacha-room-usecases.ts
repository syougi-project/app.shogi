import { GachaApiDataSource } from '@/infra/datasources/gacha-api-datasource';
import {
  GachaLobbySnapshot,
  LoadGachaLobbyUseCase,
} from '@/usecases/gacha-room/load-gacha-lobby-usecase';
import {
  RollGachaInput,
  RollGachaResult,
  RollGachaUseCase,
} from '@/usecases/gacha-room/roll-gacha-usecase';

export class ApiLoadGachaLobbyUseCase implements LoadGachaLobbyUseCase {
  constructor(private readonly dataSource = new GachaApiDataSource()) {}

  async execute(): Promise<GachaLobbySnapshot> {
    return this.dataSource.getLobby();
  }
}

export class ApiRollGachaUseCase implements RollGachaUseCase {
  constructor(private readonly dataSource = new GachaApiDataSource()) {}

  async execute(input: RollGachaInput): Promise<RollGachaResult> {
    return this.dataSource.roll({
      gachaId: input.gachaId,
      gachaBallColorIndex: input.gachaBallColorIndex,
      adFreeRoll: input.adFreeRoll,
    });
  }
}
