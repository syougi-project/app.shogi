import {
  resolveOnlineMatchPieceCode,
  resolveOnlineMatchPieceCodeFromPlacement,
} from '@/lib/online-match/resolve-online-match-piece-code';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

describe('resolveOnlineMatchPieceCode', () => {
  it('maps gacha char 膠 to BFF piece code', () => {
    expect(resolveOnlineMatchPieceCode('膠')).toBe('PIECE_GACHA_KO');
  });

  it('maps standard char 歩 to FU', () => {
    expect(resolveOnlineMatchPieceCode('歩')).toBe('FU');
  });

  it('prefers catalog pieceCode when pieceId is known', () => {
    const catalog = new Map<number, PieceCatalogItem>([
      [
        127,
        {
          pieceId: 127,
          pieceCode: 'piece_gacha_ko',
          char: '膠',
          name: '膠',
          unlock: 'test',
          desc: '',
          skill: '',
          move: '',
          moveVectors: [],
          isRepeatable: false,
        },
      ],
    ]);
    expect(resolveOnlineMatchPieceCodeFromPlacement({ pieceId: 127, char: '膠' }, catalog)).toBe(
      'PIECE_GACHA_KO',
    );
  });
});
