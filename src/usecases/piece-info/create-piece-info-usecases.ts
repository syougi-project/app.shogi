import { isApiDataSource } from '@/lib/config/data-source';
import {
  ApiLoadPieceCatalogUseCase,
  ApiLoadRawPieceCatalogUseCase,
} from '@/usecases/piece-info/api-piece-info-usecases';
import { LoadPieceCatalogUseCase } from '@/usecases/piece-info/load-piece-catalog-usecase';
import { MockLoadPieceCatalogUseCase } from '@/usecases/piece-info/mock-piece-info-usecases';

export function createLoadPieceCatalogUseCase(): LoadPieceCatalogUseCase {
  return isApiDataSource() ? new ApiLoadPieceCatalogUseCase() : new MockLoadPieceCatalogUseCase();
}

/** オンライン対戦の合法手は matching_server と同じ BFF カタログ基準で生成する */
export function createLoadRawPieceCatalogUseCase(): LoadPieceCatalogUseCase {
  return isApiDataSource()
    ? new ApiLoadRawPieceCatalogUseCase()
    : new MockLoadPieceCatalogUseCase();
}
