import { generateLegalMoves } from '@/ai/engine/legal-moves';
import type { AiBattlePosition, AiPieceDefinition } from '@/ai/model';

const GOLD_LIKE_VECTORS: AiPieceDefinition['moveVectors'] = [
  { dx: -1, dy: -1, maxStep: 1 },
  { dx: 0, dy: -1, maxStep: 1 },
  { dx: 1, dy: -1, maxStep: 1 },
  { dx: -1, dy: 0, maxStep: 1 },
  { dx: 1, dy: 0, maxStep: 1 },
  { dx: 0, dy: 1, maxStep: 1 },
];

function catalogEntry(char: string, pieceCode: string, name = char): AiPieceDefinition {
  return {
    char,
    name,
    unlock: '',
    desc: '',
    skill: '',
    move: '',
    moveVectors: GOLD_LIKE_VECTORS,
    isRepeatable: false,
    pieceCode,
  };
}

const baseCatalog: AiPieceDefinition[] = [
  catalogEntry('王', 'OU'),
  catalogEntry('火', 'FIRE'),
  catalogEntry('星', 'HOS'),
  catalogEntry('電', 'ELECTRIC'),
  catalogEntry('雷', 'THUNDER'),
  catalogEntry('滝', 'WATERFALL'),
  catalogEntry('鉛', 'LEAD'),
  catalogEntry('牢', 'PRISON'),
  catalogEntry('刀', 'KATANA'),
  catalogEntry('鳳', 'HOO'),
];

function legalTargets(position: AiBattlePosition, fromRow: number, fromCol: number): string[] {
  const legal = generateLegalMoves({ position, pieceCatalog: baseCatalog });
  return legal.legalMoves
    .filter((m) => m.fromRow === fromRow && m.fromCol === fromCol)
    .map((m) => `${m.toRow}:${m.toCol}`)
    .sort();
}

describe('ported slide move vectors', () => {
  it('火は金相当カタログでも縦横にスライドできる', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'seed',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'player', row: 4, col: 4, pieceCode: 'FIRE', char: '火', promoted: false },
          { side: 'player', row: 8, col: 0, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const targets = legalTargets(position, 4, 4);
    expect(targets).toContain('0:4');
    expect(targets).toContain('7:4');
    expect(targets).toContain('4:0');
    expect(targets).toContain('4:8');
  });

  it('星は金相当カタログでも縦横にスライドできる', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'seed',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'player', row: 5, col: 4, pieceCode: 'HOS', char: '星', promoted: false },
          { side: 'player', row: 8, col: 0, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const targets = legalTargets(position, 5, 4);
    expect(targets).toContain('0:4');
    expect(targets).toContain('5:0');
  });

  it('雷は金相当カタログでも斜めにスライドできる', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'seed',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'player', row: 4, col: 4, pieceCode: 'THUNDER', char: '雷', promoted: false },
          { side: 'player', row: 8, col: 0, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const targets = legalTargets(position, 4, 4);
    expect(targets).toContain('0:0');
    expect(targets).toContain('0:8');
    expect(targets).not.toContain('4:0');
  });

  it('鉛は桂馬飛びと前方スライドが使える', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'seed',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'player', row: 4, col: 4, pieceCode: 'LEAD', char: '鉛', promoted: false },
          { side: 'player', row: 8, col: 0, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const targets = legalTargets(position, 4, 4);
    expect(targets).toContain('0:4');
    expect(targets).toContain('2:3');
    expect(targets).toContain('2:5');
    expect(targets).not.toContain('4:3');
  });

  it('滝は前方スライドと左右1マスが使える', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'seed',
      stateHash: 'seed',
      boardState: {
        pieces: [
          {
            side: 'player',
            row: 4,
            col: 4,
            pieceCode: 'WATERFALL',
            char: '滝',
            promoted: false,
          },
          { side: 'player', row: 8, col: 0, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const targets = legalTargets(position, 4, 4);
    expect(targets).toContain('0:4');
    expect(targets).toContain('4:3');
    expect(targets).toContain('4:5');
    expect(targets).not.toContain('4:0');
    expect(targets).not.toContain('8:4');
  });

  it('牢は縦横スライドと斜め1マスが使える', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'seed',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'player', row: 4, col: 4, pieceCode: 'PRISON', char: '牢', promoted: false },
          { side: 'player', row: 8, col: 0, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const targets = legalTargets(position, 4, 4);
    expect(targets).toContain('0:4');
    expect(targets).toContain('3:3');
    expect(targets).toContain('3:5');
  });

  it('刀は前方1マスのまま', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'seed',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'player', row: 4, col: 4, pieceCode: 'KATANA', char: '刀', promoted: false },
          { side: 'player', row: 8, col: 0, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const targets = legalTargets(position, 4, 4);
    expect(targets).toEqual(['3:4']);
  });

  it('鳳は金相当カタログでも前後左右にスライドし斜め1マス進める', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'seed',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'player', row: 4, col: 4, pieceCode: 'HOO', char: '鳳', promoted: false },
          { side: 'player', row: 8, col: 0, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const targets = legalTargets(position, 4, 4);
    expect(targets).toContain('0:4');
    expect(targets).toContain('7:4');
    expect(targets).toContain('4:0');
    expect(targets).toContain('4:8');
    expect(targets).toContain('3:3');
    expect(targets).toContain('3:5');
    expect(targets).not.toContain('0:0');
  });

  it('鳳は opaque piece_id + 前進1マスカタログでも前方スライドできる', () => {
    const position: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'seed',
      stateHash: 'seed',
      boardState: {
        pieces: [
          {
            side: 'player',
            row: 4,
            col: 4,
            pieceCode: 'piece_4c5084de2fad',
            char: '鳳',
            promoted: false,
          },
          { side: 'player', row: 8, col: 0, pieceCode: 'OU', char: '王', promoted: false },
        ],
      },
      hands: { player: {}, enemy: {} },
    };
    const targets = legalTargets(position, 4, 4);
    expect(targets).toContain('0:4');
    expect(targets).toContain('7:4');
    expect(targets).toContain('4:0');
    expect(targets).toContain('4:8');
  });
});
