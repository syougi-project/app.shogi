import { CancelMatchingUseCase } from '@/usecases/matching/cancel-matching-usecase';
import { MatchingSnapshot, StartMatchingUseCase } from '@/usecases/matching/start-matching-usecase';

export class MockStartMatchingUseCase implements StartMatchingUseCase {
  async execute(): Promise<MatchingSnapshot> {
    return {
      title: 'オンライン対戦',
      status: '対戦相手を探しています',
      progress: 62,
    };
  }

  subscribe(): () => void {
    return () => undefined;
  }

  getLastError(): string | null {
    return null;
  }
}

export class MockCancelMatchingUseCase implements CancelMatchingUseCase {
  async execute(): Promise<void> {
    return;
  }
}
