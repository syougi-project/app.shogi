import { isApiDataSource } from '@/lib/config/data-source';
import {
  ApiIssueMatchmakingTicketUseCase,
  ApiSaveOnlineMatchSetupUseCase,
} from '@/usecases/online-match/api-online-match-usecases';
import type { IssueMatchmakingTicketUseCase } from '@/usecases/online-match/issue-matchmaking-ticket-usecase';
import {
  MockIssueMatchmakingTicketUseCase,
  MockSaveOnlineMatchSetupUseCase,
} from '@/usecases/online-match/mock-online-match-usecases';
import type { SaveOnlineMatchSetupUseCase } from '@/usecases/online-match/save-online-match-setup-usecase';

export function createSaveOnlineMatchSetupUseCase(token?: string): SaveOnlineMatchSetupUseCase {
  return isApiDataSource() && token
    ? new ApiSaveOnlineMatchSetupUseCase(token)
    : new MockSaveOnlineMatchSetupUseCase();
}

export function createIssueMatchmakingTicketUseCase(token?: string): IssueMatchmakingTicketUseCase {
  return isApiDataSource() && token
    ? new ApiIssueMatchmakingTicketUseCase(token)
    : new MockIssueMatchmakingTicketUseCase();
}
