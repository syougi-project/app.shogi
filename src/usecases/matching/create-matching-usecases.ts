import { isApiDataSource } from '@/lib/config/data-source';
import {
  ApiCancelMatchingUseCase,
  ApiStartMatchingUseCase,
} from '@/usecases/matching/api-matching-usecases';
import {
  MockCancelMatchingUseCase,
  MockStartMatchingUseCase,
} from '@/usecases/matching/mock-matching-usecases';
import type { CancelMatchingUseCase } from '@/usecases/matching/cancel-matching-usecase';
import type { StartMatchingUseCase } from '@/usecases/matching/start-matching-usecase';

export function createStartMatchingUseCase(token?: string): StartMatchingUseCase {
  return isApiDataSource() && token
    ? new ApiStartMatchingUseCase(token)
    : new MockStartMatchingUseCase();
}

export function createCancelMatchingUseCase(): CancelMatchingUseCase {
  return isApiDataSource() ? new ApiCancelMatchingUseCase() : new MockCancelMatchingUseCase();
}
