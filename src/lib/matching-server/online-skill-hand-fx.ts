import type { SkillVisualEffect } from '@/domain/battle/skill-visual-effect';
import {
  appendHandSkillVisualEffects,
  handSlotIndexBeforeRemoval,
} from '@/domain/battle/skill-visual-fx';
import type { MatchingGameState, PlayerSide } from '@/domain/matching-server/protocol';
import { normalizeHandsStateKeys } from '@/features/stage-shogi/domain/game-rules';
import { handKeyToDisplayPieceCode } from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';
import { normalizeSkillPieceCode } from '@/lib/matching-server/skill-piece-code';
import { serverSideToCanonicalSide } from '@/lib/matching-server/canonical-game';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

function mergeHandBagToDisplayCodes(
  bag: Record<string, number>,
  catalog: readonly PieceCatalogItem[],
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [rawKey, count] of Object.entries(bag)) {
    if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) continue;
    const display = handKeyToDisplayPieceCode(rawKey, catalog).toUpperCase();
    out[display] = (out[display] ?? 0) + Math.floor(count);
  }
  return out;
}

function isFireMovePieceCode(pieceCode: string): boolean {
  const normalized = normalizeSkillPieceCode(pieceCode.trim().toUpperCase());
  return normalized === 'FIR' || normalized === 'FIRE';
}

/** 火スキルで消えた手駒の FX を、サーバー確定前後の wire.hands 差分から生成する。 */
export function buildFireHandSkillFxFromWireHandsDiff(input: {
  before: MatchingGameState['hands'];
  after: MatchingGameState['hands'];
  /** 着手後の手番（= 火で手駒を失った側） */
  victimServerSide: PlayerSide;
  moveCount: number;
  lastMovePieceCode: string;
  pieceCatalog: readonly PieceCatalogItem[];
}): SkillVisualEffect[] {
  if (!isFireMovePieceCode(input.lastMovePieceCode)) return [];

  const beforeBag = input.before[input.victimServerSide] ?? {};
  const afterBag = input.after[input.victimServerSide] ?? {};
  const mergedBefore = mergeHandBagToDisplayCodes(beforeBag, input.pieceCatalog);
  const mergedAfter = mergeHandBagToDisplayCodes(afterBag, input.pieceCatalog);

  const removedCodes: string[] = [];
  for (const [code, beforeCount] of Object.entries(mergedBefore)) {
    const delta = beforeCount - (mergedAfter[code] ?? 0);
    for (let i = 0; i < delta; i += 1) {
      removedCodes.push(code);
    }
  }
  if (removedCodes.length === 0) return [];

  const victimCanonicalSide = serverSideToCanonicalSide(input.victimServerSide);
  const handsForSlot = normalizeHandsStateKeys({
    player: victimCanonicalSide === 'player' ? beforeBag : {},
    enemy: victimCanonicalSide === 'enemy' ? beforeBag : {},
  });
  const bucket: SkillVisualEffect[] = [];
  let seq = 0;
  for (const pieceCode of removedCodes) {
    const slotIndex = handSlotIndexBeforeRemoval(handsForSlot, victimCanonicalSide, pieceCode);
    seq = appendHandSkillVisualEffects(bucket, {
      idPrefix: `wire${input.moveCount}`,
      seq,
      pieceChar: '火',
      entries: [{ side: victimCanonicalSide, pieceCode, slotIndex }],
    });
  }
  return bucket;
}
