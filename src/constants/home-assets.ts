export const homeAssets = {
  titleBackground: require('../../assets/home/ui/真名仮名.png'),
  /** タイトル画面左上「お知らせ」 */
  informationButton: require('../../assets/home/ui/information.png'),
  /** タイトル画面左上「設定」 */
  settingsButton: require('../../assets/home/ui/option.png'),
  /** タイトル画面右下「チュートリアル」 */
  tutorialButton: require('../../assets/home/ui/チュートリアル.png'),
  loadingImage: require('../../assets/home/ui/読み込み中.png'),
  /** 未実装機能タップ時の「準備中」表示 */
  comingSoon: require('../../assets/home/ui/準備中.png'),
  background: require('../../assets/home/background/home-bg.png'),
  userBar: require('../../assets/home/ui/ユーザーバー.png'),
  pvpBadge: require('../../assets/home/ui/pvp-badge.png'),
  /** ホーム右上「オンライン対戦」エントリー（対人対戦.png） */
  onlineBattleButton: require('../../assets/online-battle/対人対戦.png'),
  /** ホーム左上のガチャ玉装飾・色確認ボタン用 */
  gachaBallIcon: require('../../assets/gacha-ball/ガチャ玉アイコン.png'),
  gachaBallColors: {
    white: require('../../assets/gacha-ball/ガチャ玉白.png'),
    blue: require('../../assets/gacha-ball/ガチャ玉青.png'),
    red: require('../../assets/gacha-ball/ガチャ玉赤.png'),
    gold: require('../../assets/gacha-ball/ガチャ玉金.png'),
    black: require('../../assets/gacha-ball/ガチャ玉黒.png'),
  },
  /** ガチャ玉ビューア右下のヘルプボタン */
  gachaBallHelpButton: require('../../assets/gacha-ball/ヘルプ.png'),
  /** ホーム右上「タイトルへ」 */
  titleBackButton: require('../../assets/home/buttons/タイトルへ.png'),
  buttons: {
    normalDungeon: require('../../assets/home/buttons/normalDangeon_botton.png'),
    specialDungeon: require('../../assets/home/buttons/specialDangeon_botton.png'),
    deckBuilder: require('../../assets/home/buttons/deckBuilder_botton.png'),
    pieceCatalog: require('../../assets/home/buttons/pieceInfo_botton.png'),
    gacha: require('../../assets/home/buttons/pieceGacha_botton.png'),
    pieceShop: require('../../assets/home/buttons/pieceShop_botton.png'),
  },
  preloadTargets: [
    require('../../assets/home/ui/information.png'),
    require('../../assets/home/ui/option.png'),
    require('../../assets/home/ui/チュートリアル.png'),
    require('../../assets/home/ui/準備中.png'),
    require('../../assets/home/background/home-bg.png'),
    require('../../assets/home/ui/ユーザーバー.png'),
    require('../../assets/home/ui/pvp-badge.png'),
    require('../../assets/online-battle/対人対戦.png'),
    require('../../assets/gacha-ball/ガチャ玉アイコン.png'),
    require('../../assets/gacha-ball/ガチャ玉白.png'),
    require('../../assets/gacha-ball/ガチャ玉青.png'),
    require('../../assets/gacha-ball/ガチャ玉赤.png'),
    require('../../assets/gacha-ball/ガチャ玉金.png'),
    require('../../assets/gacha-ball/ガチャ玉黒.png'),
    require('../../assets/gacha-ball/ヘルプ.png'),
    require('../../assets/home/buttons/タイトルへ.png'),
    require('../../assets/home/buttons/normalDangeon_botton.png'),
    require('../../assets/home/buttons/specialDangeon_botton.png'),
    require('../../assets/home/buttons/deckBuilder_botton.png'),
    require('../../assets/home/buttons/pieceInfo_botton.png'),
    require('../../assets/home/buttons/pieceGacha_botton.png'),
    require('../../assets/home/buttons/pieceShop_botton.png'),
  ],
} as const;
