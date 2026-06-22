import {
  getMatchingServerClient,
  type MatchingServerClient,
} from '@/infra/matching-server/matching-server-client';

export type OnlineBattleConnection = Pick<
  MatchingServerClient,
  | 'connect'
  | 'disconnect'
  | 'getConnectionState'
  | 'getLastError'
  | 'getRole'
  | 'makeMove'
  | 'resign'
  | 'signalBattleReady'
  | 'subscribe'
>;

export function createOnlineBattleConnection(): OnlineBattleConnection {
  return getMatchingServerClient();
}
