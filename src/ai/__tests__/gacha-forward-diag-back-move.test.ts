import { generateLegalMoves } from '@/ai/engine/legal-moves';
import type { AiBattlePosition, AiPieceDefinition } from '@/ai/model';

function catalogFor(chars: { char: string; code: string }[]): AiPieceDefinition[] {
  return chars.map(({ char, code }) => ({
    char,
    name: char,
    unlock: '',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [],
    isRepeatable: false,
    pieceCode: code,
  }));
}

function movesFrom(char: string, code: string, row: number, col: number): string[] {
  const position: AiBattlePosition = {
    sideToMove: 'player',
    turnNumber: 1,
    moveCount: 0,
    sfen: 'seed',
    stateHash: 'seed',
    boardState: {
      pieces: [{ side: 'player', row, col, pieceCode: code, char, promoted: false }],
    },
    hands: { player: {}, enemy: {} },
  };
  const legal = generateLegalMoves({
    position,
    pieceCatalog: catalogFor([{ char, code }]),
  });
  return legal.legalMoves
    .filter((m) => m.fromRow === row && m.fromCol === col)
    .map((m) => `${m.toRow}:${m.toCol}`)
    .sort();
}

describe('ガチャ 前斜め前斜め後ろ1マス（膠）', () => {
  it('膠は前斜め2+後1のみ（後斜めなし）', () => {
    expect(movesFrom('膠', 'piece_gacha_kou', 4, 4)).toEqual(['3:3', '3:5', '5:4'].sort());
  });

  it('PIECE_GACHA_KO でも前斜め2+後1', () => {
    expect(movesFrom('膠', 'PIECE_GACHA_KO', 4, 4)).toEqual(['3:3', '3:5', '5:4'].sort());
  });
});
