export type TutorialDialogue = {
  name: string;
  text: string;
  video?: string;
};

export const tutorialDialogues: TutorialDialogue[] = [
  {
    name: 'シン',
    text: '真名仮名の世界へようこそ                                 　　　俺の名前は瑪師だ',
  },
  {
    name: 'シン',
    text: 'これからあなたは集めた漢字駒を用いて将棋盤の上で戦う',
  },
  {
    name: 'シン',
    text: '駒の集め方は主に3つ',
  },
  {
    name: 'シン',
    text: '1つ目はダンジョンのクリア',
  },
  {
    name: 'シン',
    text: 'ダンジョンをクリアすると敵として出現した駒を獲得できる',
  },
  {
    name: 'シン',
    text: '特殊能力をもつ駒や特殊効果が発動するマスには気をつけろ',
  },
  {
    name: 'シン',
    text: '2つ目は駒ガチャ',
  },
  {
    name: 'シン',
    text: '運が良ければ強力な駒を獲得できる',
  },
  {
    name: 'シン',
    text: '当たり駒の出やすさはガチャ玉の色を見て確認できる　　　　　　　　　　　　　当たる確率が低い色から白青赤金黒だ',
  },
  {
    name: 'シン',
    text: '3つ目は駒ショップ',
  },
  {
    name: 'シン',
    text: '「歩」や「金」を通貨として強力な駒を購入できる',
  },
  {
    name: 'シン',
    text: '駒を集めたらデッキビルダーで将棋デッキを作成',
  },
  {
    name: 'シン',
    text: 'デッキには上限コストがあり強力な駒はコストが大きい',
  },
  {
    name: 'シン',
    text: '各駒には特殊能力やスキルがある',
  },
  {
    name: 'シン',
    text: '各駒の移動範囲やスキルの情報は駒図鑑から参照できる',
  },
  {
    name: 'シン',
    text: '漢字駒を集めて自分だけのデッキを作ったら対人対戦だ',
  },
  {
    name: 'シン',
    text: '対人対戦に勝てばレートが上がる',
  },
  {
    name: 'シン',
    text: 'レート上位者には称号が与えられる',
  },
  {
    name: 'シン',
    text: '真名仮名の名人の称号を手に入れろ',
  },
];

export type { TutorialOverlayLayout } from '@/features/tutorial/data/tutorial-layout';
export { getTutorialOverlayForIndex } from '@/features/tutorial/data/tutorial-layout';
