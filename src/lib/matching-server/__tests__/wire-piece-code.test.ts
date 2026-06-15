import {
  decodeEncodedBoardPiece,
  decodeWirePieceCodePart,
  encodeWirePieceCodeBody,
} from '@/lib/matching-server/wire-piece-code';

describe('wire-piece-code stage45 suffixes', () => {
  it('decodes cow charge suffix from wire board cell', () => {
    expect(decodeEncodedBoardPiece('black:COW@1')).toEqual({
      serverSide: 'black',
      code: 'COW',
      promoted: false,
      cowChargeCount: 1,
    });
  });

  it('decodes promoted piece without cow suffix', () => {
    expect(decodeWirePieceCodePart('FU+')).toEqual({
      code: 'FU',
      promoted: true,
      cowChargeCount: 0,
    });
  });

  it('decodes pig inherited suffix', () => {
    expect(decodeWirePieceCodePart('PIG>FU+')).toEqual({
      code: 'PIG',
      promoted: false,
      cowChargeCount: 0,
      pigInheritedPieceCode: 'FU',
      pigInheritedPromoted: true,
    });
  });

  it('round-trips cow charge through encode', () => {
    expect(
      encodeWirePieceCodeBody({
        pieceCode: 'COW',
        promoted: false,
        cowChargeCount: 2,
      }),
    ).toBe('COW@2');
  });
});
