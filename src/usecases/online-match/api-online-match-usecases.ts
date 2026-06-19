import { OnlineMatchApiDataSource } from '@/infra/datasources/online-match-datasource';
import { saveCurrentBattleSetupId } from '@/lib/online-match/current-battle-setup';
import type { MatchingSnapshot } from '@/domain/models/online-match';
import type {
  IssueMatchmakingTicketUseCase,
  MatchmakingTicket,
} from '@/usecases/online-match/issue-matchmaking-ticket-usecase';
import type { SaveOnlineMatchSetupUseCase } from '@/usecases/online-match/save-online-match-setup-usecase';

export class ApiSaveOnlineMatchSetupUseCase implements SaveOnlineMatchSetupUseCase {
  private readonly dataSource: OnlineMatchApiDataSource;

  constructor(token: string) {
    this.dataSource = new OnlineMatchApiDataSource(token);
  }

  async execute(input: Parameters<SaveOnlineMatchSetupUseCase['execute']>[0]) {
    const result = await this.dataSource.saveBattleSetup(input);
    await saveCurrentBattleSetupId(result.battleSetupId);
    return result;
  }
}

export class ApiIssueMatchmakingTicketUseCase implements IssueMatchmakingTicketUseCase {
  private readonly dataSource: OnlineMatchApiDataSource;

  constructor(token: string) {
    this.dataSource = new OnlineMatchApiDataSource(token);
  }

  async execute(): Promise<MatchmakingTicket> {
    return this.dataSource.issueMatchmakingTicket();
  }
}

export type MatchingStartedSession = {
  matchId: string;
  role: 'black' | 'white';
};

export interface StartMatchingUseCase {
  execute(): Promise<MatchingSnapshot>;
  subscribe(listener: (snapshot: MatchingSnapshot) => void): () => void;
  subscribeMatchStarted(listener: (session: MatchingStartedSession) => void): () => void;
  cancel(): Promise<void>;
}
