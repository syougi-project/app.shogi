export type BgmTrack =
  | 'title'
  | 'home'
  | 'dungeonSelect'
  | 'battle'
  | 'deckBuilder'
  | 'catalog'
  | 'shop'
  | 'gacha'
  | 'matching'
  | 'onlineBattle'
  | 'specialDungeon';
export type SeTrack =
  | 'tap'
  | 'confirm'
  | 'cancel'
  /** 対局: 駒の移動・打ち（マスが変わる着手・成り以外） */
  | 'battlePieceMove'
  /** 対局: 成り */
  | 'battlePromote'
  /** 対局: スキル発動 */
  | 'battleSkill';

export const bgmSources: Record<BgmTrack, number | null> = {
  title: require('../../assets/audio/bgm/title.mp3'),
  home: require('../../assets/audio/bgm/home.mp3'),
  dungeonSelect: require('../../assets/audio/bgm/dungeon-select.mp3'),
  battle: require('../../assets/audio/bgm/battle.mp3'),
  deckBuilder: require('../../assets/audio/bgm/deck-builder.mp3'),
  catalog: require('../../assets/audio/bgm/catalog.mp3'),
  shop: require('../../assets/audio/bgm/shop.mp3'),
  gacha: require('../../assets/audio/bgm/gacha.mp3'),
  matching: require('../../assets/audio/bgm/matching.mp3'),
  onlineBattle: require('../../assets/audio/bgm/online-battle.mp3'),
  specialDungeon: require('../../assets/audio/bgm/special-dungeon.mp3'),
};

export const seSources: Record<SeTrack, number | null> = {
  tap: require('../../assets/audio/se/tap.wav'),
  confirm: require('../../assets/audio/se/confirm.wav'),
  cancel: require('../../assets/audio/se/cancel.wav'),
  battlePieceMove: require('../../assets/bundled/0083-audio-se-battle-e0b112f8f3.mp3'),
  battlePromote: require('../../assets/bundled/0082-audio-se-battle-b96d36b0bc.mp3'),
  battleSkill: require('../../assets/audio/se/battle/battle-skill.wav'),
};
