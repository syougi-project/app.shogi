import { PieceRepository } from '@/domain/repositories/piece-repository';
import { preparePieceCatalogForBattleAndDisplay } from '@/features/piece-info/lib/piece-catalog-display';
import { ApiPieceRepository } from '@/infra/repositories/piece-repository';
import {
  LoadPieceCatalogUseCase,
  PieceCatalogItem,
} from '@/usecases/piece-info/load-piece-catalog-usecase';

export class ApiLoadPieceCatalogUseCase implements LoadPieceCatalogUseCase {
  constructor(private readonly repository: PieceRepository = new ApiPieceRepository()) {}

  async execute(): Promise<PieceCatalogItem[]> {
    return preparePieceCatalogForBattleAndDisplay(await this.repository.listCatalog());
  }
}

/** マッチングサーバーと同じ BFF 生カタログ（合法手生成・着手検証用） */
export class ApiLoadRawPieceCatalogUseCase implements LoadPieceCatalogUseCase {
  constructor(private readonly repository: PieceRepository = new ApiPieceRepository()) {}

  async execute(): Promise<PieceCatalogItem[]> {
    return this.repository.listCatalog();
  }
}
