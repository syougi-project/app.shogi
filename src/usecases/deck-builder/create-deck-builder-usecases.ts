import { isApiDataSource } from '@/lib/config/data-source';
import {
  ApiDeleteDeckUseCase,
  ApiSaveDeckUseCase,
} from '@/usecases/deck-builder/api-deck-builder-mutation-usecases';
import {
  ApiLoadActiveDeckSummaryUseCase,
  ApiLoadDeckBuilderUseCase,
} from '@/usecases/deck-builder/api-deck-builder-usecases';
import { DeleteDeckUseCase } from '@/usecases/deck-builder/delete-deck-usecase';
import type { LoadActiveDeckSummaryUseCase } from '@/usecases/deck-builder/load-active-deck-summary-usecase';
import { LoadDeckBuilderUseCase } from '@/usecases/deck-builder/load-deck-builder-usecase';
import {
  MockDeleteDeckUseCase,
  MockSaveDeckUseCase,
} from '@/usecases/deck-builder/mock-deck-builder-mutation-usecases';
import {
  MockLoadActiveDeckSummaryUseCase,
  MockLoadDeckBuilderUseCase,
} from '@/usecases/deck-builder/mock-deck-builder-usecases';
import { SaveDeckUseCase } from '@/usecases/deck-builder/save-deck-usecase';

export function createLoadDeckBuilderUseCase(token?: string): LoadDeckBuilderUseCase {
  return isApiDataSource() && token
    ? new ApiLoadDeckBuilderUseCase(token)
    : new MockLoadDeckBuilderUseCase();
}

export function createLoadActiveDeckSummaryUseCase(token?: string): LoadActiveDeckSummaryUseCase {
  return isApiDataSource() && token
    ? new ApiLoadActiveDeckSummaryUseCase(token)
    : new MockLoadActiveDeckSummaryUseCase();
}

export function createSaveDeckUseCase(token?: string): SaveDeckUseCase {
  return isApiDataSource() && token ? new ApiSaveDeckUseCase(token) : new MockSaveDeckUseCase();
}

export function createDeleteDeckUseCase(token?: string): DeleteDeckUseCase {
  return isApiDataSource() && token ? new ApiDeleteDeckUseCase(token) : new MockDeleteDeckUseCase();
}
