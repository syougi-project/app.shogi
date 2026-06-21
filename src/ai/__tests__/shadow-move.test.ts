import { generateLegalMoves } from '@/ai/engine/legal-moves';
import type { AiBattlePosition, AiPieceDefinition } from '@/ai/model';

function catalogWithShadowVectors(): AiPieceDefinition[] {
  return [
    {
      char: '影',
      name: '影武者',
      unlock: 'Stage 2',
      desc: '',
      skill: 'なし',
      move: 'shadow',
      pieceCode: 'piece_fafac6d4ed97',
      canonicalCode: 'shadow',
      moveVectors: [
        { dx: -1, dy: -1, maxStep: 2 },
        { dx: 1, dy: -1, maxStep: 2 },
        { dx: -1, dy: 0, maxStep: 1 },
        { dx: 1, dy: 0, maxStep: 1 },
        { dx: -1, dy: 1, maxStep: 2 },
        { dx: 1, dy: 1, maxStep: 2 },
        { dx: 0, dy: -1, maxStep: 1 },
      ],
      isRepeatable: false,
    },
    {
      char: '歩',
      name: '歩',
      unlock: '',
      desc: '',
      skill: '',
      move: '',
      pieceCode: 'FU',
      moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
      isRepeatable: false,
    },
  ];
}

function shadowTargets(side: 'player' | 'enemy', row: number, col: number): string[] {
  const position: AiBattlePosition = {
    sideToMove: side,
    turnNumber: 1,
    moveCount: 0,
    sfen: 'seed',
    stateHash: 'seed',
    boardState: {
      pieces: [
        { side, row, col, pieceCode: 'piece_fafac6d4ed97', char: '影', promoted: false },
        {
          side: side === 'player' ? 'enemy' : 'player',
          row: side === 'player' ? row - 1 : row + 1,
          col,
          pieceCode: 'FU',
          char: '歩',
          promoted: false,
        },
      ],
    },
    hands: { player: {}, enemy: {} },
  };
  const legal = generateLegalMoves({
    position,
    pieceCatalog: catalogWithShadowVectors(),
  });
  return legal.legalMoves
    .filter((m) => m.fromRow === row && m.fromCol === col)
    .map((m) => `${m.toRow}:${m.toCol}`)
    .sort();
}

describe('影 斜め2マス+左右1マス', () => {
  it('プレイヤー影は前方直進1マスに進めない（誤ベクトル混入時も除外）', () => {
    expect(shadowTargets('player', 4, 4)).not.toContain('3:4');
  });

  it('敵影は前方直進1マスに進めない（誤ベクトル混入時も除外）', () => {
    expect(shadowTargets('enemy', 4, 4)).not.toContain('5:4');
  });

  it('プレイヤー影は斜め2マスと左右1マスに進める', () => {
    expect(shadowTargets('player', 4, 4)).toEqual(
      ['2:2', '2:6', '3:3', '3:5', '4:3', '4:5', '5:3', '5:5', '6:2', '6:6'].sort(),
    );
  });
});
