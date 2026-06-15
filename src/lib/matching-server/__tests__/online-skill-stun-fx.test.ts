import { buildStunSkillFxFromWireSkillStateDiff } from '@/lib/matching-server/online-skill-stun-fx';
import type { MatchingGameState } from '@/domain/matching-server/protocol';

describe('online-skill-stun-fx', () => {
  it('builds board FX for newly stunned cells after tin move', () => {
    const before: MatchingGameState['skillState'] = {
      piece_statuses: [],
    };
    const after: MatchingGameState['skillState'] = {
      piece_statuses: [
        { row: 4, col: 3, side: 'white', status_type: 'stun', remaining_turns: 1 },
        { row: 2, col: 3, side: 'white', status_type: 'stun', remaining_turns: 1 },
      ],
    };

    const fx = buildStunSkillFxFromWireSkillStateDiff({
      before,
      after,
      moveCount: 3,
      lastMovePieceCode: 'TIN',
    });

    expect(fx).toHaveLength(1);
    expect(fx[0]?.pieceChar).toBe('錫');
    expect(fx[0]?.placements).toHaveLength(2);
  });

  it('builds board FX for newly stunned cells after electric move', () => {
    const fx = buildStunSkillFxFromWireSkillStateDiff({
      before: { piece_statuses: [] },
      after: {
        piece_statuses: [
          { row: 4, col: 5, side: 'white', status_type: 'stun', remaining_turns: 1 },
        ],
      },
      moveCount: 4,
      lastMovePieceCode: 'ELECTRIC',
    });

    expect(fx).toHaveLength(1);
    expect(fx[0]?.pieceChar).toBe('電');
  });

  it('returns empty FX for non-stun skills', () => {
    const fx = buildStunSkillFxFromWireSkillStateDiff({
      before: { piece_statuses: [] },
      after: { piece_statuses: [] },
      moveCount: 1,
      lastMovePieceCode: 'FIR',
    });
    expect(fx).toEqual([]);
  });
});
