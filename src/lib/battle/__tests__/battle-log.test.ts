import { formatOnlineBattleMoveLogLine } from '@/lib/battle/battle-log';
import type { BattleAudioCatalog } from '@/lib/battle/battle-move-audio';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

function catalogFromItems(items: PieceCatalogItem[]): BattleAudioCatalog {
  const pieceDefsByCode: Record<string, PieceCatalogItem> = {};
  const pieceDefsByChar: Record<string, PieceCatalogItem> = {};
  for (const item of items) {
    const code = item.pieceCode?.toUpperCase();
    if (code) pieceDefsByCode[code] = item;
    if (item.char) pieceDefsByChar[item.char] = item;
  }
  return { pieceDefsByCode, pieceDefsByChar, promotedPieceDefsByCode: {} };
}

describe('formatOnlineBattleMoveLogLine', () => {
  const catalog = catalogFromItems([
    {
      pieceId: 1,
      pieceCode: 'FU',
      canonicalCode: 'pawn',
      char: '歩',
      name: 'Pawn',
      unlock: '',
      desc: '',
      skill: '',
      move: '',
      moveVectors: [],
      isRepeatable: false,
    },
    {
      pieceId: 2,
      pieceCode: 'FIR',
      canonicalCode: 'FIR',
      char: '火',
      name: 'Fire',
      unlock: '',
      desc: '',
      skill: '火炎',
      move: '',
      moveVectors: [],
      isRepeatable: false,
    },
    {
      pieceId: 3,
      pieceCode: 'SATORI',
      canonicalCode: 'SATORI',
      char: '悟',
      name: 'Satori',
      unlock: '',
      desc: '',
      skill: '悟り',
      move: '',
      moveVectors: [],
      isRepeatable: false,
    },
  ]);

  it('shows moved piece name instead of wire code', () => {
    expect(
      formatOnlineBattleMoveLogLine({
        lastMove: { from: '7g', to: '7f', piece: 'FU', promote: false, drop: false },
        turnAfterMove: 'white',
        myRole: 'black',
        catalog,
      }),
    ).toBe('あなた: 歩 7G→7F');
  });

  it('shows opponent label and drop notation', () => {
    expect(
      formatOnlineBattleMoveLogLine({
        lastMove: { to: '5e', piece: 'FU', drop: true },
        turnAfterMove: 'black',
        myRole: 'black',
        catalog,
      }),
    ).toBe('相手: 歩 打 5E');
  });

  it('appends skill activator piece name when skill triggered', () => {
    expect(
      formatOnlineBattleMoveLogLine({
        lastMove: { from: '5e', to: '5f', piece: 'FIR', promote: false, drop: false },
        turnAfterMove: 'white',
        lastSkillTriggered: true,
        myRole: 'black',
        catalog,
        skillVisualEffects: [
          {
            id: 'fx1',
            pieceChar: '火',
            placements: [{ type: 'hand', side: 'enemy', pieceCode: 'FU', slotIndex: 0 }],
          },
        ],
      }),
    ).toBe('あなた: 火 5E→5F / スキル: 火');
  });

  it('resolves satori skill piece from notation', () => {
    expect(
      formatOnlineBattleMoveLogLine({
        lastMove: {
          from: '4e',
          to: '4f',
          piece: 'FU',
          promote: false,
          drop: false,
          notation: 'satori_stun:2:3',
        },
        turnAfterMove: 'white',
        lastSkillTriggered: true,
        myRole: 'black',
        catalog,
      }),
    ).toBe('あなた: 歩 4E→4F / スキル: 悟');
  });
});
