/**
 * tutorial.html と同じ画像アセット（app.shogi/assets/tutorial/ に配置）
 */
export const tutorialAssets = {
  background: require('../../assets/bundled/0221-tutorial-6fcf26d0e6.png'),
  character: require('../../assets/bundled/0224-tutorial-da67eeb7fa.png'),
  bubble: require('../../assets/bundled/0219-tutorial-f94977121e.png'),
  buttons: {
    next: require('../../assets/bundled/0228-tutorial-1472c270e6.png'),
    prev: require('../../assets/bundled/0227-tutorial-d5404affeb.png'),
  },
  overlays: {
    board: require('../../assets/bundled/0226-tutorial-6081d850e6.png'),
    stage: require('../../assets/bundled/0216-tutorial-7165f7ed6e.jpg'),
    light: require('../../assets/bundled/0218-tutorial-fd5e449f53.jpg'),
    specialSquare: require('../../assets/bundled/0220-tutorial-a8a54e6ff3.png'),
    ukanmuri: require('../../assets/bundled/0212-tutorial-a2dcc699b1.png'),
    gacha: require('../../assets/bundled/0214-tutorial-6a7591cb38.png'),
    gachaBall: require('../../assets/bundled/0213-tutorial-90b91b1c61.png'),
    shop: require('../../assets/bundled/0222-tutorial-2e0f47bde7.jpg'),
    currency: require('../../assets/bundled/0229-tutorial-189aad6f12.jpg'),
    deckbuilder: require('../../assets/bundled/0217-tutorial-be366fe81d.jpg'),
    cost: require('../../assets/bundled/0215-tutorial-e791d79a93.jpg'),
    book: require('../../assets/bundled/0223-tutorial-9db2d75960.jpg'),
    versus: require('../../assets/bundled/0225-tutorial-babd82a618.png'),
  },
} as const;
