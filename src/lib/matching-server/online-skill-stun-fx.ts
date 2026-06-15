import type { SkillVisualEffect } from '@/domain/battle/skill-visual-effect';
import { appendBoardSkillVisualEffects } from '@/domain/battle/skill-visual-fx';
import type { MatchingGameState } from '@/domain/matching-server/protocol';
import { normalizeSkillPieceCode } from '@/lib/matching-server/skill-piece-code';

type StunFxSpec = {
  pieceChar: string;
  match: (code: string) => boolean;
};

const STUN_FX_SPECS: readonly StunFxSpec[] = [
  {
    pieceChar: '錫',
    match: (code) => code === 'TIN',
  },
  {
    pieceChar: '電',
    match: (code) => code === 'ELECTRIC',
  },
  {
    pieceChar: '氷',
    match: (code) => code === 'ICE',
  },
  {
    pieceChar: '魚',
    match: (code) => code === 'FISH',
  },
  {
    pieceChar: '時',
    match: (code) => code === 'TIME',
  },
  {
    pieceChar: '獣',
    match: (code) => code === 'BEAST',
  },
];

function stunStatusKey(entry: Record<string, unknown>): string | null {
  const statusType = String(entry.status_type ?? entry.statusType ?? '').trim();
  if (statusType !== 'stun') return null;
  const row = Number(entry.row);
  const col = Number(entry.col);
  const side = String(entry.side ?? '').trim();
  if (!Number.isFinite(row) || !Number.isFinite(col) || !side) return null;
  return `${side}:${row}:${col}`;
}

function stunCellFromEntry(entry: Record<string, unknown>): { row: number; col: number } | null {
  const row = Number(entry.row);
  const col = Number(entry.col);
  if (!Number.isFinite(row) || !Number.isFinite(col)) return null;
  return { row, col };
}

function resolveStunFxSpec(pieceCode: string): StunFxSpec | null {
  const normalized = normalizeSkillPieceCode(pieceCode.trim().toUpperCase());
  return STUN_FX_SPECS.find((spec) => spec.match(normalized)) ?? null;
}

/** スタンスキルで追加された piece_statuses 差分から盤面 FX を生成する。 */
export function buildStunSkillFxFromWireSkillStateDiff(input: {
  before?: MatchingGameState['skillState'];
  after?: MatchingGameState['skillState'];
  moveCount: number;
  lastMovePieceCode: string;
}): SkillVisualEffect[] {
  const spec = resolveStunFxSpec(input.lastMovePieceCode);
  if (!spec) return [];

  const beforeKeys = new Set<string>();
  for (const raw of input.before?.piece_statuses ?? []) {
    const key = stunStatusKey(raw);
    if (key) beforeKeys.add(key);
  }

  const newCells: { row: number; col: number }[] = [];
  const seen = new Set<string>();
  for (const raw of input.after?.piece_statuses ?? []) {
    const key = stunStatusKey(raw);
    if (!key || beforeKeys.has(key) || seen.has(key)) continue;
    const cell = stunCellFromEntry(raw);
    if (!cell) continue;
    seen.add(key);
    newCells.push(cell);
  }
  if (newCells.length === 0) return [];

  const bucket: SkillVisualEffect[] = [];
  appendBoardSkillVisualEffects(bucket, {
    idPrefix: `wire-stun${input.moveCount}`,
    seq: 0,
    pieceChar: spec.pieceChar,
    cells: newCells,
  });
  return bucket;
}
