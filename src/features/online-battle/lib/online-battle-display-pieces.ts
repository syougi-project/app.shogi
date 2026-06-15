import type { BattleCanonicalPosition } from '@/usecases/stage-battle/game-move-contract';
import {
  applyAbyssAuraEffectToPieces,
  applyATransformEffectToPieces,
  applyChrysanthemumRevivalMarkToPieces,
  applyDarkVeilFromSkillStateToPieces,
  applyDeathCurseEffectToPieces,
  applyKirinImmunityShieldMarkToPieces,
  applyLightProtectionAuraEffectToPieces,
  applyMaiDanceRestrictionMarkToPieces,
  applyPrisonChainEffectToPieces,
  applyStunAuraEffectToPieces,
  applyYinYangSkillAuraDisplayToPieces,
  movementRuleByCellFromCanonical,
  type BoardPiece,
} from '@/features/stage-shogi/ui/stage-shogi-screen.helpers';

/** ノーマルダンジョンと同じ skill_state 由来の盤面演出をオンライン表示用駒に付与する。 */
export function applyOnlineBattleSkillDisplayToPieces(
  pieces: BoardPiece[],
  position: BattleCanonicalPosition,
): BoardPiece[] {
  let next = applyDarkVeilFromSkillStateToPieces(pieces, position);
  next = applyATransformEffectToPieces(next, position);
  next = applyPrisonChainEffectToPieces(next, position);
  next = applyStunAuraEffectToPieces(next, position);
  next = applyAbyssAuraEffectToPieces(next, position);
  next = applyChrysanthemumRevivalMarkToPieces(next, position);
  next = applyLightProtectionAuraEffectToPieces(next, position);
  next = applyDeathCurseEffectToPieces(next, position);
  next = applyMaiDanceRestrictionMarkToPieces(next, movementRuleByCellFromCanonical(position));
  next = applyKirinImmunityShieldMarkToPieces(next);
  next = applyYinYangSkillAuraDisplayToPieces(next);
  return next;
}
