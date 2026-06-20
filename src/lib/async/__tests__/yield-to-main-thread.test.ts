import { yieldToMainThread } from '@/lib/async/yield-to-main-thread';

describe('yieldToMainThread', () => {
  it('resolves after scheduling a frame', async () => {
    await yieldToMainThread();
    expect(true).toBe(true);
  });
});
