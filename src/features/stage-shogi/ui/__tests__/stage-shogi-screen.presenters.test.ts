import { ApiClientError } from '@/infra/http/api-client';
import {
  isGuardrailMoveError,
  isRecoverableMoveSyncError,
} from '@/features/stage-shogi/ui/stage-shogi-screen.presenters';

describe('stage-shogi-screen.presenters move sync errors', () => {
  it('detects guardrail rejection messages', () => {
    expect(
      isGuardrailMoveError(
        new Error('guardrail rejected move: move is outside session catalog legal range'),
      ),
    ).toBe(true);
    expect(isGuardrailMoveError(new Error('stateHash does not match current position'))).toBe(
      false,
    );
  });

  it('treats guardrail and illegal move as recoverable sync errors', () => {
    expect(
      isRecoverableMoveSyncError(
        new Error('guardrail rejected move: skill annotation does not match legal move'),
      ),
    ).toBe(true);
    expect(
      isRecoverableMoveSyncError(
        new ApiClientError({ code: 'ILLEGAL_MOVE', message: 'illegal move' }),
      ),
    ).toBe(true);
    expect(isRecoverableMoveSyncError(new Error('network timeout'))).toBe(false);
  });
});
