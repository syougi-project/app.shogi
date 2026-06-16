import { applyMove } from '@/ai/engine/apply-move';
import { generateLegalMoves } from '@/ai/engine/legal-moves';
import { tickSkillStateDurations } from '@/ai/engine/skill-runtime';
import { skillDefinitionsV2ForGachaChar } from '@/ai/engine/gacha-piece-skill-definitions';
import { normalizeBattlePosition, type AiBattlePosition, type AiPieceDefinition } from '@/ai/model';

const pieceCatalog: AiPieceDefinition[] = [
  {
    char: '王',
    name: '王',
    unlock: '',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [],
    isRepeatable: false,
    pieceCode: 'OU',
  },
  {
    char: '艸',
    name: '艸',
    unlock: '',
    desc: '',
    skill: '',
    move: '',
    moveVectors: [],
    isRepeatable: false,
    pieceCode: 'piece_gacha_sou',
    skillDefinitionsV2: skillDefinitionsV2ForGachaChar('艸'),
  },
];

function pitCellsFromPosition(position: AiBattlePosition): { row: number; col: number }[] {
  const skillState = (position.boardState as { skill_state?: { board_hazards?: unknown[] } })
    .skill_state;
  const hazards = skillState?.board_hazards ?? [];
  return hazards
    .filter((h) => (h as { hazard_type?: string }).hazard_type === 'pit_cell')
    .map((h) => ({
      row: Number((h as { row: number }).row),
      col: Number((h as { col: number }).col),
    }));
}

describe('艸 ×マス', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('moves forward up to 2, sideways and back 1', () => {
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
            row: 5,
            col: 4,
            pieceCode: 'piece_gacha_sou',
            char: '艸',
            promoted: false,
          },
          { side: 'player', row: 8, col: 0, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: skillDefinitionsV2ForGachaChar('艸'),
      },
      hands: { player: {}, enemy: {} },
    };
    const legal = generateLegalMoves({ position, pieceCatalog });
    const fromSou = legal.legalMoves.filter((m) => m.fromRow === 5 && m.fromCol === 4);
    const targets = fromSou.map((m) => `${m.toRow}:${m.toCol}`).sort();
    expect(targets).toEqual(['3:4', '4:4', '5:3', '5:5', '6:4'].sort());
  });

  it('marks up to 3 random adjacent empty cells as pit_cell on move', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const start: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 1,
      moveCount: 0,
      sfen: 'seed',
      stateHash: 'seed',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          {
            side: 'player',
            row: 5,
            col: 4,
            pieceCode: 'piece_gacha_sou',
            char: '艸',
            promoted: false,
          },
          { side: 'player', row: 8, col: 4, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_definitions_v2: skillDefinitionsV2ForGachaChar('艸'),
      },
      hands: { player: {}, enemy: {} },
    };

    const committed = applyMove({
      position: start,
      pieceCatalog,
      move: {
        fromRow: 5,
        fromCol: 4,
        toRow: 4,
        toCol: 4,
        pieceCode: 'piece_gacha_sou',
        promote: false,
        dropPieceCode: null,
        capturedPieceCode: null,
        notation: null,
      },
    });

    const pits = pitCellsFromPosition(normalizeBattlePosition(committed.position));
    expect(pits.length).toBeGreaterThan(0);
    expect(pits.length).toBeLessThanOrEqual(3);
    for (const pit of pits) {
      expect(Math.max(Math.abs(pit.row - 4), Math.abs(pit.col - 4))).toBe(1);
    }
  });

  it('blocks moving onto pit_cell', () => {
    const withPit: AiBattlePosition = {
      sideToMove: 'player',
      turnNumber: 2,
      moveCount: 1,
      sfen: 'seed',
      stateHash: 'seed2',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          {
            side: 'player',
            row: 4,
            col: 4,
            pieceCode: 'piece_gacha_sou',
            char: '艸',
            promoted: false,
          },
          { side: 'player', row: 8, col: 0, pieceCode: 'OU', char: '王', promoted: false },
        ],
        skill_state: {
          board_hazards: [
            {
              row: 3,
              col: 4,
              hazard_type: 'pit_cell',
              affects_side: 'enemy',
              remaining_turns: 1,
            },
          ],
        },
        skill_definitions_v2: skillDefinitionsV2ForGachaChar('艸'),
      },
      hands: { player: {}, enemy: {} },
    };

    const legal = generateLegalMoves({ position: withPit, pieceCatalog });
    const toPit = legal.legalMoves.some(
      (m) => m.fromRow === 4 && m.fromCol === 4 && m.toRow === 3 && m.toCol === 4,
    );
    expect(toPit).toBe(false);
  });

  it('clears pit_cell after two turn duration ticks', () => {
    const position: AiBattlePosition = {
      sideToMove: 'enemy',
      turnNumber: 2,
      moveCount: 1,
      sfen: 'seed',
      stateHash: 'seed2',
      boardState: {
        pieces: [
          { side: 'enemy', row: 0, col: 4, pieceCode: 'OU', char: '王', promoted: false },
          {
            side: 'player',
            row: 4,
            col: 4,
            pieceCode: 'piece_gacha_sou',
            char: '艸',
            promoted: false,
          },
        ],
        skill_state: {
          board_hazards: [
            {
              row: 3,
              col: 4,
              hazard_type: 'pit_cell',
              affects_side: 'enemy',
              remaining_turns: 2,
            },
          ],
        },
      },
      hands: { player: {}, enemy: {} },
    };
    tickSkillStateDurations(position);
    expect(pitCellsFromPosition(position)).toHaveLength(1);
    tickSkillStateDurations(position);
    expect(pitCellsFromPosition(position)).toHaveLength(0);
  });
});
