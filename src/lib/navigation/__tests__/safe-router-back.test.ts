import { navigateBackOrReplace } from '@/lib/navigation/safe-router-back';

describe('navigateBackOrReplace', () => {
  it('dismisses when stack can pop', () => {
    const dismiss = jest.fn();
    const replace = jest.fn();
    navigateBackOrReplace(
      {
        canDismiss: () => true,
        dismiss,
        replace,
      },
      '/home',
    );
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it('replaces when stack cannot pop', () => {
    const dismiss = jest.fn();
    const replace = jest.fn();
    navigateBackOrReplace(
      {
        canDismiss: () => false,
        dismiss,
        replace,
      },
      '/stage-select',
    );
    expect(dismiss).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/stage-select');
  });
});
