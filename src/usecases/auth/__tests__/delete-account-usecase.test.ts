import { deleteAccount } from '../delete-account-usecase';

const mockSignOut = jest.fn();

jest.mock('@/lib/supabase/supabase-client', () => ({
  supabase: {
    auth: {
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  },
}));

describe('deleteAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSignOut.mockResolvedValue({ error: null });
  });

  it('calls API then signs out locally', async () => {
    let apiCalled = false;
    await deleteAccount('token-1', {
      deleteAccount: async (token) => {
        apiCalled = true;
        expect(token).toBe('token-1');
      },
    });

    expect(apiCalled).toBe(true);
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
