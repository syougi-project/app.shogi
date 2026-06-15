import {
  createOnlineBattleGame,
  getDisplayBoardPieces,
  getOnlineBattleGame,
  removeOnlineBattleGame,
  setOnlineBattlePieceCatalog,
  syncFromServerWire,
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

  it('keeps skill_definitions_v2 and skill_state when syncing server wire updates', () => {
    const wire: MatchingGameState = {
      version: 2,
      turn: 'white',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '5e': 'black:RAINBOW',
      },
      hands: { black: {}, white: {} },
      skillState: {
        movement_modifiers: [
          {
            row: 4,
            col: 4,
            side: 'black',
            movement_rule: 'orthogonal_step_only',
            remaining_turns: 1,
          },
        ],
      },
    };
    const catalog = [catalogItem('RAINBOW', '虹')];

    createOnlineBattleGame({
      matchId: 'match-display',
      myRole: 'black',
      wire,
      pieceCatalog: catalog,
    });
    syncFromServerWire({
      matchId: 'match-display',
      myRole: 'black',
      wire,
      pieceCatalog: catalog,
    });

    const record = getOnlineBattleGame('match-display');
    const boardState = record?.position.boardState as {
      skill_definitions_v2?: { definitions?: unknown[] };
      skill_state?: MatchingGameState['skillState'];
    };

    expect(boardState.skill_definitions_v2?.definitions?.length).toBeGreaterThan(0);
    expect(boardState.skill_state?.movement_modifiers?.[0]?.side).toBe('player');
  });

  it('re-injects skill definitions when the piece catalog loads after game start', () => {
    const wire: MatchingGameState = {
      version: 1,
      turn: 'black',
      board: { '5e': 'black:GACHA_BAKU' },
      hands: { black: {}, white: {} },
    };

    createOnlineBattleGame({
      matchId: 'match-display',
      myRole: 'black',
      wire,
      pieceCatalog: [],
    });
    setOnlineBattlePieceCatalog([catalogItem('GACHA_BAKU', '爆')]);

    const boardState = getOnlineBattleGame('match-display')?.position.boardState as {
      skill_definitions_v2?: { definitions?: Record<string, unknown>[] };
    };
    const definitions = boardState.skill_definitions_v2?.definitions ?? [];
    expect(definitions.some((def) => Number(def.skillId) > 0)).toBe(true);
  });

  it('marks dark_blind enemies with darkVeiled for online board display', () => {
    const wire: MatchingGameState = {
      version: 2,
      turn: 'white',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '5d': 'black:YAM',
        '4e': 'white:FU',
      },
      hands: { black: {}, white: {} },
      skillState: {
        piece_statuses: [
          { row: 4, col: 5, side: 'white', status_type: 'dark_blind', remaining_turns: 1 },
        ],
      },
    };
    const catalog = [catalogItem('YAM', '闇'), catalogItem('FU', '歩'), catalogItem('OU', '王')];

    createOnlineBattleGame({
      matchId: 'match-display',
      myRole: 'white',
      wire,
      pieceCatalog: catalog,
    });

    const pieces = getDisplayBoardPieces('match-display');
    const veiled = pieces.find((piece) => piece.row === 4 && piece.col === 5);
    expect(veiled?.darkVeiled).toBe(true);
  });
});
