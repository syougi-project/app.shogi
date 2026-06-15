import { resolveWirePieceChar } from '@/lib/matching-server/piece-display';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

describe('resolveWirePieceChar', () => {
  const glueCatalog: PieceCatalogItem = {
    pieceId: 127,
    pieceCode: 'PIECE_GACHA_KO',
    canonicalCode: 'GACHA_KOU',
    char: '膠',
    name: '膠',
    unlock: 'test',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [],
    isRepeatable: false,
  };

  it('resolves display char from catalog by wire piece code', () => {
    expect(
      resolveWirePieceChar('PIECE_GACHA_KO', 'player', false, {
        PIECE_GACHA_KO: glueCatalog,
        GACHA_KOU: glueCatalog,
      }),
    ).toBe('膠');
  });

  it('maps legacy client setup codes to BFF master', () => {
    expect(
      resolveWirePieceChar('PIECE_GACHA_KOU', 'player', false, {
        PIECE_GACHA_KO: glueCatalog,
      }),
    ).toBe('膠');
  });

  it('maps legacy RY wire code to small dragon 竜 when catalog defines RYU', () => {
    const ryuCatalog: PieceCatalogItem = {
      pieceId: 1,
      pieceCode: 'RYU',
      canonicalCode: 'RYU',
      char: '竜',
      name: '小竜',
      unlock: 'test',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [],
      isRepeatable: false,
    };
    expect(
      resolveWirePieceChar('RY', 'player', false, {
        RYU: ryuCatalog,
      }),
    ).toBe('竜');
  });
});
