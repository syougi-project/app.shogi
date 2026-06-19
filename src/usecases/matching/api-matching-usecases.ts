import { OnlineMatchApiDataSource } from '@/infra/datasources/online-match-datasource';
import {
  getMatchingServerClient,
  type MatchingServerClient,
} from '@/infra/matching-server/matching-server-client';
import type { MatchingSnapshot } from '@/domain/models/online-match';
import type { WebSocketServerMessage } from '@/domain/matching-server/protocol';
import type {
  CancelMatchingInput,
  CancelMatchingUseCase,
} from '@/usecases/matching/cancel-matching-usecase';
import type {
  StartMatchingInput,
  StartMatchingUseCase,
} from '@/usecases/matching/start-matching-usecase';

export class ApiStartMatchingUseCase implements StartMatchingUseCase {
  constructor(
    private readonly token: string,
    private readonly client: MatchingServerClient = getMatchingServerClient(),
    private readonly dataSource = new OnlineMatchApiDataSource(token),
  ) {}

  subscribe(listener: (payload: WebSocketServerMessage) => void): () => void {
    return this.client.subscribe(listener);
  }

  getLastError(): string | null {
    return this.client.getLastError();
  }

  async execute(input: StartMatchingInput): Promise<MatchingSnapshot> {
    const ticket = await this.dataSource.issueMatchmakingTicket();
    await this.client.connect(input.userId, { ticket: ticket.ticket });
    this.client.enterQueue({
      userId: input.userId,
      rating: ticket.user.rating || input.selfRating,
      displayName: ticket.user.displayName || input.selfName,
      battleSetupId: input.battleSetupId,
    });

    return {
      title: 'オンライン対戦',
      status: '対戦相手を探しています',
      progress: 35,
      self: {
        displayName: ticket.user.displayName || input.selfName,
        rating: ticket.user.rating || input.selfRating,
      },
    };
  }
}

export class ApiCancelMatchingUseCase implements CancelMatchingUseCase {
  constructor(private readonly client: MatchingServerClient = getMatchingServerClient()) {}

  async execute(input: CancelMatchingInput): Promise<void> {
    if (input.userId) {
      this.client.cancelQueue(input.userId);
      return;
    }
    this.client.disconnect();
  }
}
