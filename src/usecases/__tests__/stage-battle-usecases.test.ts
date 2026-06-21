import { ApiClientError } from '@/infra/http/api-client';
import { resetMockStaminaState } from '@/lib/stamina/spend-stage-stamina';
import {
  MockClaimStageClearRewardUseCase,
  MockPrepareStageBattleUseCase,
  resetMockPreparedStageId,
  resetMockStageClearRewards,
} from '@/usecases/stage-battle/mock-stage-battle-usecases';

const mockSnapshot = {
  playerName: 'Test',
  rating: 0,
  pawnCurrency: 0,
  goldCurrency: 0,
  playerRank: 1,
  playerExp: 0,
  stamina: 50,
  maxStamina: 50,
  nextRecoveryAt: null as string | null,
};

jest.mock('@/hooks/common/home-snapshot-store', () => ({
  getHomeSnapshotState: () => ({ snapshot: mockSnapshot, isLoading: false, error: null }),
  patchHomeSnapshotStamina: (next: { stamina: number; nextRecoveryAt: string | null }) => {
    mockSnapshot.stamina = next.stamina;
    mockSnapshot.nextRecoveryAt = next.nextRecoveryAt;
  },
}));

describe('MockPrepareStageBattleUseCase stamina', () => {
  beforeEach(() => {
    resetMockPreparedStageId();
    resetMockStaminaState(50);
    mockSnapshot.stamina = 50;
    mockSnapshot.nextRecoveryAt = null;
  });

  it('throws when stamina is insufficient', async () => {
    resetMockStaminaState(2);
    mockSnapshot.stamina = 2;
    const usecase = new MockPrepareStageBattleUseCase();
    await expect(usecase.execute({ stageId: '1' })).rejects.toBeInstanceOf(ApiClientError);
  });

  it('does not spend stamina twice for the same stage', async () => {
    resetMockStaminaState(10);
    mockSnapshot.stamina = 10;
    const usecase = new MockPrepareStageBattleUseCase();
    await usecase.execute({ stageId: '2' });
    await usecase.execute({ stageId: '2' });
    expect(mockSnapshot.stamina).toBe(5);
  });
});

describe('MockPrepareStageBattleUseCase', () => {
  beforeEach(() => {
    resetMockPreparedStageId();
    resetMockStaminaState(50);
    mockSnapshot.stamina = 50;
    mockSnapshot.nextRecoveryAt = null;
  });

  it('returns generic stage label when stage id is not provided', async () => {
    const usecase = new MockPrepareStageBattleUseCase();
    const snapshot = await usecase.execute({});

    expect(snapshot.stageLabel).toBe('STAGE');
    expect(snapshot.turnLabel).toBe('TURN 12 / 99');
    expect(snapshot.handLabel).toBe('歩 x2 / 桂 x1 / 角 x1');
  });

  it('returns stage-specific label when stage id is provided', async () => {
    const usecase = new MockPrepareStageBattleUseCase();
    const snapshot = await usecase.execute({ stageId: '3' });

    expect(snapshot.stageLabel).toBe('STAGE 3');
  });
});

describe('MockClaimStageClearRewardUseCase', () => {
  beforeEach(() => {
    resetMockStageClearRewards();
  });

  it('returns rewards for a cleared stage', async () => {
    const usecase = new MockClaimStageClearRewardUseCase();
    const result = await usecase.execute({ stageId: '3', result: 'cleared' });

    expect(result?.stageNo).toBe(3);
    expect(result?.firstClear).toBe(true);
    expect(result?.granted).toEqual({ pawn: 5, gold: 0, pieces: [] });
  });

  it('2回目以降は歩のみ floor(stageNo/5)+2', async () => {
    const usecase = new MockClaimStageClearRewardUseCase();
    await usecase.execute({ stageId: '10', result: 'cleared' });
    const repeat = await usecase.execute({ stageId: '10', result: 'cleared' });

    expect(repeat?.firstClear).toBe(false);
    expect(repeat?.clearCount).toBe(2);
    expect(repeat?.granted).toEqual({ pawn: 4, gold: 0, pieces: [] });
  });

  it('returns null for failed result', async () => {
    const usecase = new MockClaimStageClearRewardUseCase();
    await expect(usecase.execute({ stageId: '3', result: 'failed' })).resolves.toBeNull();
  });
});
