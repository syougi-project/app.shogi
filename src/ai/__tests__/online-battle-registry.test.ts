import {
  createOnlineBattleGame,
  getDisplayBoardPieces,
  removeOnlineBattleGame,
} from '@/ai/online-battle-registry';
import type { MatchingGameState } from '@/domain/matching-server/protocol';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

function catalogItem(pieceCode: string, char: string): PieceCatalogItem {
  return {
    pieceId: 1,
    pieceCode,
    char,
    name: char,
    unlock: 'test',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [],
    isRepeatable: false,
    canJump: false,
    moveConstraints: null,
    moveRules: [],
    imageSignedUrl: null,
  };
}

describe('online-battle-registry display pieces', () => {
  afterEach(() => {
    removeOnlineBattleGame('match-display');
  });

  it('normalizes server piece codes through the same display identity as stage battle', () => {
    const wire: MatchingGameState = {
      version: 1,
      turn: 'black',
      board: {
        '7g': 'black:WATER',
        '6g': 'black:IRON',
        '5g': 'black:RAINBOW',
        '4g': 'black:POISON',
        '3g': 'black:GACHA_KO',
      },
      hands: { black: {}, white: {} },
    };

    createOnlineBattleGame({
      matchId: 'match-display',
      myRole: 'black',
      wire,
      pieceCatalog: [
        catalogItem('WATER', '水'),
        catalogItem('IRON', '鉄'),
        catalogItem('RAINBOW', '虹'),
        catalogItem('POISON', '毒'),
        catalogItem('GACHA_KO', '膠'),
      ],
    });

    const pieces = getDisplayBoardPieces('match-display');

    expect(pieces.map((piece) => [piece.pieceCode, piece.char])).toEqual([
      ['SUI', '水'],
      ['IRON', '鉄'],
      ['RAINBOW', '虹'],
      ['POISON', '毒'],
      ['GACHA_KOU', '膠'],
    ]);
  });
});
