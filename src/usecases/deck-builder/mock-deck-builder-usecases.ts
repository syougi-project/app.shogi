import type { DeckBuilderSnapshot } from '@/domain/models/deck-builder';
import {
  getGachaMockOwnedPiecesForDeckBuilder,
  hydrateGachaMockOwnedChars,
} from '@/features/gacha-room/lib/gacha-mock-store';
import { getPieceShopMockOwnedPiecesForDeckBuilder } from '@/features/piece-shop/lib/piece-shop-mock-store';
import { filterOwnedPiecesForDeckBuilder } from '@/features/deck-builder/lib/deck-builder-excluded-pieces';
import { sortOwnedPiecesForDeckBuilder } from '@/features/piece-shop/lib/sort-owned-pieces-for-deck-builder';
import type {
  ActiveDeckSummary,
  LoadActiveDeckSummaryUseCase,
} from '@/usecases/deck-builder/load-active-deck-summary-usecase';
import type { LoadDeckBuilderUseCase } from '@/usecases/deck-builder/load-deck-builder-usecase';

export class MockLoadDeckBuilderUseCase implements LoadDeckBuilderUseCase {
  async execute(): Promise<DeckBuilderSnapshot> {
    await hydrateGachaMockOwnedChars();
    const baseOwnedPieces = [
      {
        char: '忍',
        name: '忍者',
        desc: '機動力に優れる特殊駒。',
        skill: '桂馬と銀将の複合移動',
        move: '桂+銀の複合',
      },
      {
        char: '影',
        name: '影武者',
        desc: '相手の駒を一時的にコピーする。',
        skill: '影分身：隣接する敵駒1つの能力をコピー',
        move: '前後左右1マス',
      },
      {
        char: '砲',
        name: '大砲',
        desc: '遠距離攻撃が可能な駒。',
        skill: '砲撃：直線上の駒を2マス先まで攻撃',
        move: '前後左右2マス',
      },
      {
        char: '泉',
        name: '泉',
        desc: '竜を覚醒させる。',
        skill: '味方の「竜」駒を覚醒させる。',
        move: '上下左右1マス',
      },
      {
        char: '竜',
        name: '小竜',
        desc: '覚醒前の竜駒。',
        skill: '味方に泉が盤にいる間、辰として行動する。',
        move: '前後左右2マス',
      },
      {
        char: '辰',
        name: '辰神',
        desc: '泉により覚醒した竜。',
        skill: '移動時10％の確率で周囲8マスの敵駒を1つ消滅させる。',
        move: '前後左右3マス',
      },
      {
        char: '鳳',
        name: '鳳凰',
        desc: '強力な特殊スキルを持つ。',
        skill: '蘇生：味方駒を1体復活させる',
        move: '全方向2マス',
      },
      {
        char: '炎',
        name: '炎将',
        desc: '炎を操る攻撃駒。',
        skill: '炎上：前方3マスに炎上付与',
        move: '斜め前方3マス',
      },
      {
        char: '火',
        name: '火術師',
        desc: '火属性の呪文を使う。',
        skill: '火球：前方1マスに大ダメージ',
        move: '前方2マス+斜め前1マス',
      },
      {
        char: '水',
        name: '水術師',
        desc: '水属性の呪文を使う。',
        skill: '水流：横方向2マスに攻撃',
        move: '横方向2マス+前後1マス',
      },
      {
        char: '波',
        name: '波乗り',
        desc: '波を操る海の駒。',
        skill: '大波：前後2列を同時攻撃',
        move: '前後左右1マス',
      },
      {
        char: '木',
        name: '木霊',
        desc: '自然の力を持つ駒。',
        skill: '回復：隣接する味方を回復',
        move: '斜め4方向+前後',
      },
      {
        char: '葉',
        name: '葉隠',
        desc: '隠密行動に長けた駒。',
        skill: '透明化：1ターン攻撃対象にならない',
        move: '全方向1マス',
      },
    ];
    const shopOwnedPieces = getPieceShopMockOwnedPiecesForDeckBuilder();
    const gachaOwnedPieces = getGachaMockOwnedPiecesForDeckBuilder();

    return {
      ownedPieces: sortOwnedPiecesForDeckBuilder(
        filterOwnedPiecesForDeckBuilder([
          ...gachaOwnedPieces,
          ...shopOwnedPieces,
          ...baseOwnedPieces,
        ]),
      ),
      savedDecks: [
        {
          id: 'deck-1',
          name: '攻撃型デッキ',
          pieces: ['忍', '砲', '炎', '火', '竜'],
          savedAt: '2026-03-01 12:00',
        },
        {
          id: 'deck-2',
          name: 'バランス型',
          pieces: ['影', '水', '波', '木', '葉'],
          savedAt: '2026-03-05 18:30',
        },
      ],
    };
  }
}

export class MockLoadActiveDeckSummaryUseCase implements LoadActiveDeckSummaryUseCase {
  async execute(): Promise<ActiveDeckSummary> {
    return {
      deckId: null,
      name: null,
      placements: [],
    };
  }
}
