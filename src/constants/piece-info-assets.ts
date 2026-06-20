export const pieceInfoAssets = {
  background: require('../../assets/piece-info/piece-info-bg.png'),
  backButton: require('../../assets/bundled/0191-piece-info-26e8b3b587.png'),
  pieces: {
    香: require('../../assets/bundled/0190-piece-info-pieces-f51842ca99.png'),
    桂: require('../../assets/bundled/0187-piece-info-pieces-2ca8d6158b.png'),
    銀: require('../../assets/bundled/0189-piece-info-pieces-fb7d19e5af.png'),
    忍: require('../../assets/bundled/0186-piece-info-pieces-d4cc0e6e83.png'),
    竜: require('../../assets/bundled/0188-piece-info-pieces-ac77a2c9a5.png'),
  },
} as const;

export const pieceInfoPreloadTargets = [
  pieceInfoAssets.background,
  pieceInfoAssets.backButton,
  ...Object.values(pieceInfoAssets.pieces),
] as const;
