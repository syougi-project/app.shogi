import type { MatchingSnapshot } from '@/domain/models/online-match';
import type { WebSocketServerMessage } from '@/domain/matching-server/protocol';

export type { MatchingSnapshot };

export type StartMatchingInput = {
  userId: string;
  battleSetupId: string;
  selfName: string;
  selfRating: number;
};

export interface StartMatchingUseCase {
  execute(input: StartMatchingInput): Promise<MatchingSnapshot>;
  subscribe(listener: (payload: WebSocketServerMessage) => void): () => void;
  getLastError(): string | null;
}
