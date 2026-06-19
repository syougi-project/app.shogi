export type MatchmakingTicket = {
  ticket: string;
  expiresAt: string;
  user: {
    userId: string;
    displayName: string;
    rating: number;
  };
};

export interface IssueMatchmakingTicketUseCase {
  execute(): Promise<MatchmakingTicket>;
}
