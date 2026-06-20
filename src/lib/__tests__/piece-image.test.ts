import { resolvePieceImageSource } from '@/lib/piece-image';

describe('resolvePieceImageSource', () => {
  it('resolves shop piece 走 from assets/pieces via char', () => {
    expect(resolvePieceImageSource({ char: '走', pieceId: 99999 })).toBe(
      require('../../../assets/bundled/0201-pieces-3c3e0ff595.png'),
    );
  });

  it('resolves shop piece 走 from assets/pieces via piece_code', () => {
    expect(resolvePieceImageSource({ pieceCode: 'piece_shop_so' })).toBe(
      require('../../../assets/bundled/0201-pieces-3c3e0ff595.png'),
    );
  });

  it('resolves shop piece 種 via canonical code', () => {
    expect(resolvePieceImageSource({ pieceCode: 'TANE' })).toBe(
      require('../../../assets/bundled/0197-pieces-729478a77f.png'),
    );
  });

  it('resolves gacha special pieces via canonical code', () => {
    expect(resolvePieceImageSource({ pieceCode: 'GACHA_BAKU' })).toBe(
      require('../../../assets/pieces/0114-piece_gacha_baku.png'),
    );
    expect(resolvePieceImageSource({ pieceCode: 'GACHA_SHITSU' })).toBe(
      require('../../../assets/bundled/0193-pieces-f2dbf3d29f.png'),
    );
    expect(resolvePieceImageSource({ pieceCode: 'GACHA_SO' })).toBe(
      require('../../../assets/pieces/0119-piece_gacha_so.png'),
    );
  });

  it('resolves online battle alias codes used by matching snapshots', () => {
    expect(resolvePieceImageSource({ pieceCode: 'WATER' })).toBe(
      require('../../../assets/pieces/0016-piece_shogi_sui.png'),
    );
    expect(resolvePieceImageSource({ pieceCode: 'IRON' })).toBe(
      require('../../../assets/pieces/0025-piece_788aa9f49675.png'),
    );
    expect(resolvePieceImageSource({ pieceCode: 'RAINBOW' })).toBe(
      require('../../../assets/pieces/0039-piece_74a3ad14ddbc.png'),
    );
    expect(resolvePieceImageSource({ pieceCode: 'POISON' })).toBe(
      require('../../../assets/pieces/0040-piece_cbb2ff2e126b.png'),
    );
    expect(resolvePieceImageSource({ pieceCode: 'GACHA_KO' })).toBe(
      require('../../../assets/bundled/0198-pieces-6b34dfd1b1.png'),
    );
  });
});
