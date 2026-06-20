export const pieceShopAssets = {
  background: require('../../assets/piece-shop/pieceShop.png'),
  backButton: require('../../assets/bundled/0192-piece-shop-5616db2518.png'),
  pieces: {
    走: require('../../assets/piece-shop/piece-so.png'),
    種: require('../../assets/piece-shop/piece-tane.png'),
    麒: require('../../assets/piece-shop/piece-kirin.png'),
    舞: require('../../assets/piece-shop/piece-mai.png'),
    P: require('../../assets/piece-shop/piece-p.png'),
    鳴: require('../../assets/piece-shop/piece-naku.png'),
  },
} as const;

export const pieceShopPreloadTargets = [
  pieceShopAssets.background,
  pieceShopAssets.backButton,
  ...Object.values(pieceShopAssets.pieces),
] as const;
