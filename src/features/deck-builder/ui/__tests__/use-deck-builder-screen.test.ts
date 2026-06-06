import { act, renderHook, waitFor } from '@testing-library/react-native';

import { DECK_REQUIRED_UI_CELLS } from '@/features/deck-builder/lib/deck-builder-required-cells';
import { useDeckBuilderScreen } from '@/features/deck-builder/ui/use-deck-builder-screen';

const standardDeckOwnedPieces = [
  { pieceId: 101, char: '歩', name: '歩', imageSignedUrl: null },
  { pieceId: 102, char: '香', name: '香', imageSignedUrl: null },
  { pieceId: 103, char: '桂', name: '桂', imageSignedUrl: null },
  { pieceId: 104, char: '銀', name: '銀', imageSignedUrl: null },
  { pieceId: 105, char: '金', name: '金', imageSignedUrl: null },
  { pieceId: 106, char: '王', name: '王', imageSignedUrl: null },
  { pieceId: 107, char: '角', name: '角', imageSignedUrl: null },
  { pieceId: 108, char: '飛', name: '飛', imageSignedUrl: null },
];

const mockLoadExecute = jest.fn();
const mockSaveExecute = jest.fn();
const mockDeleteExecute = jest.fn();
const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();

jest.mock('@/usecases/deck-builder/create-deck-builder-usecases', () => ({
  createLoadDeckBuilderUseCase: () => ({
    execute: (...args: unknown[]) => mockLoadExecute(...args),
  }),
  createSaveDeckUseCase: () => ({
    execute: (...args: unknown[]) => mockSaveExecute(...args),
  }),
  createDeleteDeckUseCase: () => ({
    execute: (...args: unknown[]) => mockDeleteExecute(...args),
  }),
}));

jest.mock('@/lib/supabase/supabase-client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
  },
}));

const mockLoadPieceCatalogExecute = jest.fn();

jest.mock('@/usecases/piece-info/create-piece-info-usecases', () => ({
  createLoadPieceCatalogUseCase: () => ({
    execute: (...args: unknown[]) => mockLoadPieceCatalogExecute(...args),
  }),
}));

jest.mock('@/hooks/common/auth-session-context', () => ({
  useAuthSession: () => ({
    accessToken: null,
    isReady: true,
    reinitializeSession: jest.fn(),
  }),
}));

describe('useDeckBuilderScreen', () => {
  const originalDataSource = process.env.EXPO_PUBLIC_DATA_SOURCE;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_DATA_SOURCE = 'mock';
    mockLoadPieceCatalogExecute.mockResolvedValue([]);

    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    });
    mockSaveExecute.mockResolvedValue({ savedDeckId: '1' });
    mockDeleteExecute.mockResolvedValue(undefined);
  });

  afterAll(() => {
    if (originalDataSource === undefined) {
      delete process.env.EXPO_PUBLIC_DATA_SOURCE;
      return;
    }
    process.env.EXPO_PUBLIC_DATA_SOURCE = originalDataSource;
  });

  it('ロードしたマイデッキ配置を盤面下段(6..8行)に反映する', async () => {
    mockLoadExecute.mockResolvedValue({
      ownedPieces: [{ pieceId: 101, char: '角', name: '角行', imageSignedUrl: null }],
      savedDecks: [
        {
          id: 'other',
          name: '別デッキ',
          pieces: ['歩'],
          placements: [{ rowNo: 0, colNo: 0, pieceId: 999, char: '歩', name: '歩兵' }],
          savedAt: '2026-03-10 22:00',
        },
        {
          id: 'my',
          name: 'マイデッキ',
          pieces: ['角'],
          placements: [{ rowNo: 0, colNo: 1, pieceId: 101, char: '角', name: '角行' }],
          savedAt: '2026-03-10 22:01',
        },
      ],
    });

    const { result } = renderHook(() => useDeckBuilderScreen());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.boardPlacements).toEqual([
      {
        row: 6,
        col: 1,
        piece: expect.objectContaining({
          pieceId: 101,
          char: '角',
          name: '角行',
        }),
      },
    ]);
  });

  it('保存時に盤面下段の座標をAPI座標(0..2)へ逆変換する', async () => {
    mockLoadExecute.mockResolvedValue({
      ownedPieces: standardDeckOwnedPieces,
      savedDecks: [],
    });

    const { result } = renderHook(() => useDeckBuilderScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.loadDefault();
      result.current.setDeckName('マイデッキ');
    });
    expect(result.current.isDeckFormationIncomplete).toBe(false);
    expect(result.current.emptyRequiredDeckCells).toEqual([]);

    await act(async () => {
      result.current.saveDeck();
    });

    expect(mockSaveExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'マイデッキ',
        placements: expect.arrayContaining([
          { rowNo: 1, colNo: 7, pieceId: 108 },
          { rowNo: 2, colNo: 4, pieceId: 106 },
        ]),
      }),
    );
    expect(mockSaveExecute.mock.calls[0]?.[0].placements).toHaveLength(20);
  }, 20_000);

  it('必須マスが空のときは反映・保存できない', async () => {
    mockLoadExecute.mockResolvedValue({
      ownedPieces: [{ pieceId: 201, char: '飛', name: '飛', imageSignedUrl: null }],
      savedDecks: [],
    });

    const { result } = renderHook(() => useDeckBuilderScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.emptyRequiredDeckCells.length).toBeGreaterThanOrEqual(
      DECK_REQUIRED_UI_CELLS.length - 1,
    );

    let applied = true;
    await act(async () => {
      applied = await result.current.applyAsBattleDeck();
    });
    expect(applied).toBe(false);
    expect(mockSaveExecute).not.toHaveBeenCalled();

    act(() => {
      result.current.setDeckName('未完成');
    });
    await act(async () => {
      result.current.saveDeck();
    });
    expect(mockSaveExecute).not.toHaveBeenCalled();
  }, 15_000);

  it('HTML版準拠で所持数では配置を制限せず、残数表示は無限扱いになる', async () => {
    const pawn = {
      pieceId: 301,
      char: '歩',
      name: '歩兵',
      imageSignedUrl: null,
      quantity: 2,
      desc: '',
      skill: '',
      move: '',
    };

    mockLoadExecute.mockResolvedValue({
      ownedPieces: [pawn],
      savedDecks: [],
    });

    const { result } = renderHook(() => useDeckBuilderScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.getRemainingCount(pawn)).toBe(Infinity);

    act(() => {
      result.current.selectPieceForPlacement(pawn);
    });
    act(() => {
      result.current.placeSelectedPieceAt(6, 0);
      result.current.placeSelectedPieceAt(6, 1);
      result.current.placeSelectedPieceAt(6, 2);
    });

    expect(result.current.boardPlacements).toHaveLength(9);
    expect(result.current.getRemainingCount(pawn)).toBe(Infinity);
  });

  it('removePieceAt で盤上の駒をデッキから外せる', async () => {
    const rook = {
      pieceId: 201,
      char: '飛',
      name: '飛車',
      imageSignedUrl: null,
      desc: '',
      skill: '',
      move: '',
    };
    mockLoadExecute.mockResolvedValue({
      ownedPieces: [rook, { pieceId: 202, char: '王', name: '王将', imageSignedUrl: null }],
      savedDecks: [],
    });

    const { result } = renderHook(() => useDeckBuilderScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.selectPieceForPlacement(rook);
      result.current.placeSelectedPieceAt(6, 7);
    });
    expect(result.current.boardPlacements.some((p) => p.row === 7 && p.col === 7)).toBe(true);

    act(() => {
      result.current.removePieceAt(7, 7);
    });
    expect(result.current.boardPlacements.some((p) => p.row === 7 && p.col === 7)).toBe(false);
  });

  it('駒未選択の placeSelectedPieceAt は盤面を変更しない', async () => {
    const rook = {
      pieceId: 201,
      char: '飛',
      name: '飛車',
      imageSignedUrl: null,
      desc: '',
      skill: '',
      move: '',
    };
    mockLoadExecute.mockResolvedValue({
      ownedPieces: [rook, { pieceId: 202, char: '王', name: '王将', imageSignedUrl: null }],
      savedDecks: [],
    });

    const { result } = renderHook(() => useDeckBuilderScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.selectPieceForPlacement(rook);
      result.current.placeSelectedPieceAt(6, 7);
    });
    const countBefore = result.current.boardPlacements.length;

    act(() => {
      result.current.selectPieceForPlacement({
        pieceId: 999,
        char: 'K',
        name: 'ボス',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      });
    });
    expect(result.current.selectedPieceForPlacement).toBeNull();

    act(() => {
      result.current.placeSelectedPieceAt(7, 7);
    });
    expect(result.current.boardPlacements.length).toBe(countBefore);
  });

  it('特殊駒はHTML版の許可マスにしか配置できない', async () => {
    const piece = {
      pieceId: 401,
      char: '竜',
      name: '竜王',
      imageSignedUrl: null,
      quantity: 30,
      desc: '',
      skill: '',
      move: '',
    };

    mockLoadExecute.mockResolvedValue({
      ownedPieces: [piece],
      savedDecks: [],
    });

    const { result } = renderHook(() => useDeckBuilderScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.selectPieceForPlacement(piece);
    });
    act(() => {
      for (let i = 0; i < 21; i++) {
        const row = 6 + Math.floor(i / 9);
        const col = i % 9;
        result.current.placeSelectedPieceAt(row, col);
      }
    });

    expect(result.current.boardPlacements).toHaveLength(1);
    expect(result.current.boardPlacements).toEqual(
      expect.arrayContaining([expect.objectContaining({ row: 7, col: 1 })]),
    );
    expect(result.current.deckTotalCost).toBe(7);
    expect(result.current.deckSpecialPieceCount).toBe(1);
  });

  it('char が HIK でも光として許可マス(9,2)(9,8)に配置できる', async () => {
    const ownedPieces = [
      {
        pieceId: 301,
        char: '歩',
        name: '歩兵',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 302,
        char: '香',
        name: '香車',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 303,
        char: '桂',
        name: '桂馬',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 304,
        char: '銀',
        name: '銀将',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 305,
        char: '金',
        name: '金将',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 306,
        char: '角',
        name: '角行',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 307,
        char: '飛',
        name: '飛車',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 308,
        char: '玉',
        name: '玉将',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 309,
        char: 'HIK',
        name: '光神',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
    ];
    mockLoadExecute.mockResolvedValue({ ownedPieces, savedDecks: [] });

    const { result } = renderHook(() => useDeckBuilderScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const light = ownedPieces[8]!;
    act(() => {
      result.current.selectPieceForPlacement(light);
    });

    expect(result.current.isValidPlacementAt(8, 1)).toBe(true);
    expect(result.current.isValidPlacementAt(8, 7)).toBe(true);
    expect(result.current.isValidPlacementAt(6, 0)).toBe(false);
  });

  it('char が標準駒でも名前が光神なら光の許可マスに配置できる', async () => {
    const ownedPieces = [
      {
        pieceId: 301,
        char: '歩',
        name: '歩兵',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 302,
        char: '香',
        name: '香車',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 303,
        char: '桂',
        name: '桂馬',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 304,
        char: '銀',
        name: '銀将',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 305,
        char: '金',
        name: '金将',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 306,
        char: '角',
        name: '角行',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 307,
        char: '飛',
        name: '飛車',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 308,
        char: '玉',
        name: '玉将',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 309,
        char: '歩',
        name: '光神',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
    ];
    mockLoadExecute.mockResolvedValue({ ownedPieces, savedDecks: [] });

    const { result } = renderHook(() => useDeckBuilderScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const light = ownedPieces[8]!;
    act(() => {
      result.current.selectPieceForPlacement(light);
    });

    expect(result.current.isValidPlacementAt(8, 1)).toBe(true);
    expect(result.current.isValidPlacementAt(8, 7)).toBe(true);
    expect(result.current.isValidPlacementAt(6, 0)).toBe(false);
  });

  it('char が歩でも名前が闇神なら闇の許可マスに配置できる', async () => {
    const ownedPieces = [
      {
        pieceId: 301,
        char: '歩',
        name: '歩兵',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 302,
        char: '香',
        name: '香車',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 303,
        char: '桂',
        name: '桂馬',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 304,
        char: '銀',
        name: '銀将',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 305,
        char: '金',
        name: '金将',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 306,
        char: '角',
        name: '角行',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 307,
        char: '飛',
        name: '飛車',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 308,
        char: '玉',
        name: '玉将',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 310,
        char: '歩',
        name: '闇神',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
    ];
    mockLoadExecute.mockResolvedValue({ ownedPieces, savedDecks: [] });

    const { result } = renderHook(() => useDeckBuilderScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const dark = ownedPieces[8]!;
    act(() => {
      result.current.selectPieceForPlacement(dark);
    });

    expect(result.current.isValidPlacementAt(8, 1)).toBe(true);
    expect(result.current.isValidPlacementAt(8, 7)).toBe(true);
    expect(result.current.isValidPlacementAt(6, 0)).toBe(false);
  });

  it('岩は(9,2)と(9,8)のみに配置できる', async () => {
    const ownedPieces = [
      {
        pieceId: 401,
        char: '歩',
        name: '歩兵',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 402,
        char: '香',
        name: '香車',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 403,
        char: '桂',
        name: '桂馬',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 404,
        char: '銀',
        name: '銀将',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 405,
        char: '金',
        name: '金将',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 406,
        char: '角',
        name: '角行',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 407,
        char: '飛',
        name: '飛車',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 408,
        char: '玉',
        name: '玉将',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
      {
        pieceId: 409,
        char: '岩',
        name: '岩山',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
    ];
    mockLoadExecute.mockResolvedValue({ ownedPieces, savedDecks: [] });

    const { result } = renderHook(() => useDeckBuilderScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const rock = ownedPieces[8]!;
    act(() => {
      result.current.selectPieceForPlacement(rock);
    });

    expect(result.current.isValidPlacementAt(8, 1)).toBe(true);
    expect(result.current.isValidPlacementAt(8, 7)).toBe(true);
    expect(result.current.isValidPlacementAt(8, 4)).toBe(false);
  });

  it('麒は(8,2)と(8,8)のみに配置できる', async () => {
    const ownedPieces = [
      {
        pieceId: 9003,
        char: '麒',
        name: '麒',
        imageSignedUrl: null,
        desc: '',
        skill: '',
        move: '',
      },
    ];
    mockLoadExecute.mockResolvedValue({ ownedPieces, savedDecks: [] });

    const { result } = renderHook(() => useDeckBuilderScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.selectPieceForPlacement(ownedPieces[0]!);
    });

    expect(result.current.isValidPlacementAt(8, 1)).toBe(true);
    expect(result.current.isValidPlacementAt(8, 7)).toBe(true);
    expect(result.current.isValidPlacementAt(8, 4)).toBe(false);
  });

  it('読み込み時も上限なしで反映される', async () => {
    const placements = Array.from({ length: 21 }, (_, i) => ({
      rowNo: Math.floor(i / 9),
      colNo: i % 9,
      pieceId: 501,
      char: '歩',
      name: '歩兵',
    }));

    mockLoadExecute.mockResolvedValue({
      ownedPieces: [{ pieceId: 501, char: '歩', name: '歩兵', imageSignedUrl: null }],
      savedDecks: [
        {
          id: 'my',
          name: 'マイデッキ',
          pieces: Array.from({ length: 21 }, () => '歩'),
          placements,
          savedAt: '2026-03-10 22:01',
        },
      ],
    });

    const { result } = renderHook(() => useDeckBuilderScreen());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.boardPlacements).toHaveLength(21);
    expect(result.current.deckTotalCost).toBe(21);
    expect(result.current.deckSpecialPieceCount).toBe(0);
  });
});
