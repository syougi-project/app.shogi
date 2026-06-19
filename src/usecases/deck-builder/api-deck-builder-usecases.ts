import { DeckBuilderApiDataSource } from '@/infra/datasources/deck-builder-datasource';
import type { DeckBuilderSnapshot } from '@/domain/models/deck-builder';
import type {
  ActiveDeckSummary,
  LoadActiveDeckSummaryUseCase,
} from '@/usecases/deck-builder/load-active-deck-summary-usecase';
import type { LoadDeckBuilderUseCase } from '@/usecases/deck-builder/load-deck-builder-usecase';

export class ApiLoadDeckBuilderUseCase implements LoadDeckBuilderUseCase {
  private readonly dataSource: DeckBuilderApiDataSource;

  constructor(token: string) {
    this.dataSource = new DeckBuilderApiDataSource(token);
  }

  async execute(): Promise<DeckBuilderSnapshot> {
    return this.dataSource.getSnapshot();
  }
}

export class ApiLoadActiveDeckSummaryUseCase implements LoadActiveDeckSummaryUseCase {
  private readonly dataSource: DeckBuilderApiDataSource;

  constructor(token: string) {
    this.dataSource = new DeckBuilderApiDataSource(token);
  }

  async execute(): Promise<ActiveDeckSummary> {
    return this.dataSource.getActiveSummary();
  }
}
