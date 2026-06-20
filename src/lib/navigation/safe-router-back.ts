import { type Href, useRouter } from 'expo-router';
import { useCallback } from 'react';

type RouterBackApi = {
  canDismiss: () => boolean;
  dismiss: () => void;
  replace: (href: Href) => void;
};

/**
 * expo-router では `canGoBack` / `back` が GO_BACK 未処理エラーを起こすことがある。
 * スタックを pop できるときだけ dismiss し、それ以外は replace で戻る。
 */
export function navigateBackOrReplace(router: RouterBackApi, fallback: Href): void {
  if (router.canDismiss()) {
    router.dismiss();
    return;
  }
  router.replace(fallback);
}

export function useSafeRouterBack(fallback: Href): () => void {
  const router = useRouter();
  return useCallback(() => {
    navigateBackOrReplace(router, fallback);
  }, [router, fallback]);
}
