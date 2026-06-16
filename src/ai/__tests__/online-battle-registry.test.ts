import {
  applyOnlineBattleMove,
  createOnlineBattleGame,
  getDisplayBoardPieces,
  getMyLegalMoves,
  getOnlineBattleGame,
  removeOnlineBattleGame,
  setOnlineBattlePieceCatalog,
  syncFromServerWire,
} from '@/ai/online-battle-registry';
import type { MatchingGameState } from '@/domain/matching-server/protocol';
import { batsuHazardCellsForDisplay } from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
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

  it('generates diagonal one-step legal moves for yama with forward-only catalog vectors', () => {
    const wire: MatchingGameState = {
      version: 1,
      turn: 'black',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '5e': 'black:YAMA',
      },
      hands: { black: {}, white: {} },
    };
    const catalog = [
      {
        ...catalogItem('YAMA', '山'),
        moveVectors: [{ dx: 0, dy: -1, maxStep: 1 }],
      },
      catalogItem('OU', '王'),
    ];

    createOnlineBattleGame({
      matchId: 'match-display',
      myRole: 'black',
      wire,
      pieceCatalog: catalog,
    });

    const moves = getMyLegalMoves('match-display').filter(
      (move) => move.fromRow === 4 && move.fromCol === 4,
    );
    expect(moves.some((move) => move.toRow === 3 && move.toCol === 3)).toBe(true);
    expect(moves.some((move) => move.toRow === 3 && move.toCol === 5)).toBe(true);
    expect(moves.some((move) => move.toRow === 5 && move.toCol === 3)).toBe(true);
    expect(moves.some((move) => move.toRow === 5 && move.toCol === 5)).toBe(true);
    expect(moves.some((move) => move.toRow === 3 && move.toCol === 4)).toBe(false);
  });

  it('keeps bird ally transport from server wire instead of optimistic local skill', () => {
    const initialWire: MatchingGameState = {
      version: 1,
      turn: 'black',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '5e': 'black:PIECE_29ECAB1EF3C3',
        '3e': 'black:FU',
      },
      hands: { black: {}, white: {} },
    };
    const catalog = [
      catalogItem('PIECE_29ECAB1EF3C3', '禽'),
      catalogItem('FU', '歩'),
      catalogItem('OU', '王'),
    ];

    createOnlineBattleGame({
      matchId: 'match-display',
      myRole: 'black',
      wire: initialWire,
      pieceCatalog: catalog,
    });

    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    applyOnlineBattleMove({
      matchId: 'match-display',
      move: {
        fromRow: 4,
        fromCol: 4,
        toRow: 5,
        toCol: 4,
        pieceCode: 'PIECE_29ECAB1EF3C3',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
      serverWire: initialWire,
    });
    randomSpy.mockRestore();

    const optimisticPieces = getDisplayBoardPieces('match-display');
    const optimisticFu = optimisticPieces.find((piece) => piece.char === '歩');
    expect(optimisticFu?.row).toBe(4);
    expect(optimisticFu?.col).toBe(6);

    const serverWire: MatchingGameState = {
      version: 2,
      turn: 'white',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '5f': 'black:PIECE_29ECAB1EF3C3',
        '5g': 'black:FU',
      },
      hands: { black: {}, white: {} },
      lastSkillTriggered: true,
    };
    syncFromServerWire({
      matchId: 'match-display',
      myRole: 'black',
      wire: serverWire,
      pieceCatalog: catalog,
    });

    const syncedPieces = getDisplayBoardPieces('match-display');
    const syncedFu = syncedPieces.find((piece) => piece.char === '歩');
    expect(syncedFu?.row).toBe(6);
    expect(syncedFu?.col).toBe(4);
    const syncedBird = syncedPieces.find((piece) => piece.char === '禽');
    expect(syncedBird?.row).toBe(5);
    expect(syncedBird?.col).toBe(4);
  });

  it('keeps sou pit_cell hazards from server wire for display across sync', () => {
    const catalog = [catalogItem('GACHA_SOU', '艸'), catalogItem('OU', '王')];
    const wire: MatchingGameState = {
      version: 3,
      turn: 'white',
      board: {
        '5i': 'black:OU',
        '5a': 'white:OU',
        '5d': 'black:GACHA_SOU',
      },
      hands: { black: {}, white: {} },
      skillState: {
        board_hazards: [
          {
            row: 3,
            col: 3,
            hazard_type: 'pit_cell',
            affects_side: 'white',
            remaining_turns: 1,
          },
          {
            row: 3,
            col: 5,
            hazard_type: 'pit_cell',
            affects_side: 'white',
            remaining_turns: 2,
          },
        ],
      },
      canonicalState: {
        sideToMove: 'enemy',
        turnNumber: 2,
        moveCount: 1,
        sfen: '',
        stateHash: null,
        boardState: { board_hazards: [] },
        hands: { player: {}, enemy: {} },
      },
    };

    createOnlineBattleGame({
      matchId: 'match-display',
      myRole: 'black',
      wire,
      pieceCatalog: catalog,
    });

    const record = getOnlineBattleGame('match-display');
    expect(record).not.toBeNull();
    const batsu = batsuHazardCellsForDisplay(record!.position);
    expect(batsu).toEqual(
      expect.arrayContaining([
        { row: 3, col: 3 },
        { row: 3, col: 5 },
      ]),
    );
    expect(batsu).toHaveLength(2);
  });
});
