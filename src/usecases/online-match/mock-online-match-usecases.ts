import { saveCurrentBattleSetupId } from '@/lib/online-match/current-battle-setup';
import type {
  IssueMatchmakingTicketUseCase,
  MatchmakingTicket,
} from '@/usecases/online-match/issue-matchmaking-ticket-usecase';
import type { SaveOnlineMatchSetupUseCase } from '@/usecases/online-match/save-online-match-setup-usecase';

export class MockSaveOnlineMatchSetupUseCase implements SaveOnlineMatchSetupUseCase {
  async execute() {
    const battleSetupId = `mock_bsetup_${Math.random().toString(36).slice(2, 8)}`;
    await saveCurrentBattleSetupId(battleSetupId);
    return {
      battleSetupId,
      status: 'validated' as const,
    };
  }
}

export class MockIssueMatchmakingTicketUseCase implements IssueMatchmakingTicketUseCase {
  async execute(): Promise<MatchmakingTicket> {
    return {
      ticket: 'mock-ticket',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      user: {
        userId: 'mock-user',
        displayName: 'プレイヤー',
        rating: 1500,
      },
    };
  }
}
