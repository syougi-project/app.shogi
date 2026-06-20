export const deckBuilderAssets = {
  bg: require('../../assets/deck-builder/deck-bg.png'),
  backButton: require('../../assets/bundled/0115-deck-builder-c66059edc7.png'),
  helpButton: require('../../assets/bundled/0114-deck-builder-3a02b79b65.png'),
} as const;

export const deckBuilderPreloadTargets = [
  deckBuilderAssets.bg,
  deckBuilderAssets.backButton,
  deckBuilderAssets.helpButton,
] as const;
