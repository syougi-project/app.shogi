import {
  getHomeSnapshotState,
  pinHomeSnapshotRating,
  prepareHomeSnapshotAfterOnlineBattle,
  resetHomeSnapshotForAccountChange,
} from '@/hooks/common/home-snapshot-store';

describe('home-snapshot pvp rating pin', () => {
  beforeEach(() => {
    resetHomeSnapshotForAccountChange();
  });

  it('keeps pinned rating in snapshot after pinHomeSnapshotRating', () => {
    pinHomeSnapshotRating(1516);
    expect(getHomeSnapshotState().snapshot.rating).toBe(1516);
  });

  it('clears pin on account reset', () => {
    pinHomeSnapshotRating(1516);
    resetHomeSnapshotForAccountChange();
    expect(getHomeSnapshotState().snapshot.rating).toBe(0);
  });

  it('prepareHomeSnapshotAfterOnlineBattle pins latest rating for home HUD', () => {
    prepareHomeSnapshotAfterOnlineBattle(1520);
    expect(getHomeSnapshotState().snapshot.rating).toBe(1520);
  });
});
