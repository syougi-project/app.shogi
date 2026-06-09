import { buildPieceLookups, normalizePieceCatalog } from '@/ai/model/piece';

describe('ai model piece', () => {
  it('normalizes catalog codes and builds lookups', () => {
    const catalog = normalizePieceCatalog([
      {
        pieceCode: 'fu',
        canonicalCode: 'fu',
        sfenCode: 'p',
        char: '歩',
        name: '歩',
        unlock: 'default',
        desc: '',
        skill: '',
        move: '',
        moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
        isRepeatable: true,
      },
      {
        pieceCode: 'to',
        canonicalCode: 'fu',
        sfenCode: '+p',
        char: 'と',
        name: 'と',
        unlock: 'default',
        desc: '',
        skill: '',
        move: '',
        moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
        isRepeatable: true,
        isPromoted: true,
      },
    ]);

    const lookups = buildPieceLookups(catalog);

    expect(catalog[0]?.pieceCode).toBe('FU');
    expect(lookups.pieceDefsByCode.FU?.char).toBe('と');
    expect(lookups.promotedPieceDefsByCode.FU?.char).toBe('と');
    expect(lookups.pieceDefsByChar['歩']?.pieceCode).toBe('FU');
  });

  it('synthesizes gold-like promoted defs when catalog lacks explicit promoted rows', () => {
    const catalog = normalizePieceCatalog([
      {
        pieceCode: 'FU',
        canonicalCode: 'FU',
        sfenCode: 'P',
        char: '歩',
        name: '歩',
        unlock: 'default',
        desc: '',
        skill: '',
        move: '',
        moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
        isRepeatable: true,
      },
      {
        pieceCode: 'KI',
        canonicalCode: 'KI',
        sfenCode: 'G',
        char: '金',
        name: '金',
        unlock: 'default',
        desc: '',
        skill: '',
        move: '',
        moveVectors: [
          { dx: -1, dy: -1, maxStep: 1 },
          { dx: 0, dy: -1, maxStep: 1 },
          { dx: 1, dy: -1, maxStep: 1 },
          { dx: -1, dy: 0, maxStep: 1 },
          { dx: 1, dy: 0, maxStep: 1 },
          { dx: 0, dy: 1, maxStep: 1 },
        ],
        isRepeatable: true,
      },
    ]);

    const lookups = buildPieceLookups(catalog);

    expect(lookups.promotedPieceDefsByCode.FU?.char).toBe('と');
    expect(lookups.promotedPieceDefsByCode.FU?.moveVectors.length).toBeGreaterThan(1);
  });
});
