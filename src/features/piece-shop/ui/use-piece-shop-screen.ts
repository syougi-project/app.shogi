import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert } from 'react-native';

import { ShopItem } from '@/domain/models/shop';
import { ApiClientError } from '@/infra/http/api-client';
import { loadHomeSnapshot } from '@/hooks/common/home-snapshot-store';
import { useModalState } from '@/hooks/common/use-modal-state';
import {
  createLoadShopCatalogUseCase,
  createPurchaseShopItemUseCase,
} from '@/usecases/piece-shop/create-piece-shop-usecases';

export type PieceShopVM = {
  isLoading: boolean;
  items: ShopItem[];
  pawnCurrency: number;
  goldCurrency: number;
  owned: ShopItem['key'][];
  detailPiece: ShopItem | null;
  confirmPiece: ShopItem | null;
  openDetail: (piece: ShopItem) => void;
  openConfirm: (piece: ShopItem) => void;
  closeDetail: () => void;
  closeConfirm: () => void;
  purchase: () => Promise<void>;
};

export function usePieceShopScreen(): PieceShopVM {
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [pawnCurrency, setPawnCurrency] = useState(0);
  const [goldCurrency, setGoldCurrency] = useState(0);
  const [owned, setOwned] = useState<ShopItem['key'][]>([]);

  const detail = useModalState<ShopItem>();
  const confirm = useModalState<ShopItem>();

  const loadUseCase = useMemo(() => createLoadShopCatalogUseCase(), []);
  const purchaseUseCase = useMemo(() => createPurchaseShopItemUseCase(), []);

  const applyWallet = useCallback((shopPawn: number, shopGold: number) => {
    setPawnCurrency(shopPawn);
    setGoldCurrency(shopGold);
  }, []);

  const reloadCatalog = useCallback(async () => {
    const snapshot = await loadUseCase.execute();
    setItems(snapshot.items);
    applyWallet(snapshot.pawnCurrency, snapshot.goldCurrency);
    setOwned(snapshot.owned);
    return snapshot;
  }, [applyWallet, loadUseCase]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setIsLoading(true);
      void loadHomeSnapshot(true)
        .catch(() => undefined)
        .then(() => reloadCatalog())
        .finally(() => {
          if (active) {
            setIsLoading(false);
          }
        });
      return () => {
        active = false;
      };
    }, [reloadCatalog]),
  );

  async function purchase() {
    if (!confirm.payload) {
      return;
    }

    const target = confirm.payload;
    setIsLoading(true);
    try {
      const result = await purchaseUseCase.execute({ item: target });
      if (result.success) {
        setPawnCurrency(result.pawnCurrency);
        setGoldCurrency(result.goldCurrency);
        setOwned(result.owned);
        await loadHomeSnapshot(true).catch(() => undefined);
        confirm.close();
      } else {
        Alert.alert('購入できません', '通貨が足りないか、すでに購入済みです。');
      }
    } catch (error: unknown) {
      if (error instanceof ApiClientError) {
        if (error.code === 'INSUFFICIENT_CURRENCY') {
          Alert.alert('購入できません', '通貨が足りません。');
        } else if (error.code === 'ALREADY_OWNED') {
          Alert.alert('購入できません', 'すでに購入済みです。');
        } else if (error.code === 'UNAUTHORIZED') {
          Alert.alert('購入できません', 'ログインが必要です。');
        } else if (error.code === 'ITEM_NOT_FOUND') {
          Alert.alert(
            '購入できません',
            'ショップの駒データが未登録です。サーバー管理者にマスタ登録を確認してください。',
          );
        } else {
          Alert.alert('購入できません', error.message);
        }
      } else {
        Alert.alert('購入できません', 'しばらくしてから再度お試しください。');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return {
    isLoading,
    items,
    pawnCurrency,
    goldCurrency,
    owned,
    detailPiece: detail.payload,
    confirmPiece: confirm.payload,
    openDetail: detail.open,
    openConfirm: confirm.open,
    closeDetail: detail.close,
    closeConfirm: confirm.close,
    purchase,
  };
}
