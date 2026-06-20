import type { ImageSourcePropType } from 'react-native';

import type { SkillVisualEffect } from '@/domain/battle/skill-visual-effect';

/**
 * スキル発動パーティクル画像の登録表。
 *
 * 画像の置き場所: `assets/battle/skill-particles/`
 * ファイル名: `piece-{駒の漢字}.png`
 */
export const SKILL_PARTICLE_BY_PIECE_CHAR: Partial<Record<string, ImageSourcePropType>> = {
  時: require('../../assets/bundled/0091-battle-skill-particles-da5f92e0bb.png'),
  水: require('../../assets/bundled/0092-battle-skill-particles-2999c72a8f.png'),
  波: require('../../assets/bundled/0093-battle-skill-particles-24f1691022.png'),
  火: require('../../assets/bundled/0094-battle-skill-particles-85b0abb603.png'),
  炎: require('../../assets/bundled/0095-battle-skill-particles-dd8d740470.png'),
  煽: require('../../assets/bundled/0096-battle-skill-particles-7f0996bb79.png'),
  爆: require('../../assets/bundled/0097-battle-skill-particles-4cb63884d7.png'),
  盾: require('../../assets/bundled/0098-battle-skill-particles-445e47e88a.png'),
  鉄: require('../../assets/bundled/0099-battle-skill-particles-a24b79ea3b.png'),
  雷: require('../../assets/bundled/0100-battle-skill-particles-fa20eec5b0.png'),
  電: require('../../assets/bundled/0101-battle-skill-particles-f9b9a78059.png'),
  風: require('../../assets/bundled/0102-battle-skill-particles-eae3b94181.png'),
  魔: require('../../assets/bundled/0103-battle-skill-particles-11788baf6e.png'),
};

export function resolveSkillParticleForPieceChar(
  pieceChar?: string | null,
): ImageSourcePropType | null {
  if (!pieceChar) return null;
  const trimmed = pieceChar.trim();
  return SKILL_PARTICLE_BY_PIECE_CHAR[trimmed] ?? null;
}

export function resolveSkillParticleForVisualEffect(
  effect: SkillVisualEffect,
): ImageSourcePropType | null {
  return resolveSkillParticleForPieceChar(effect.pieceChar);
}

export const skillParticleAssetPreloadTargets: ImageSourcePropType[] = Object.values(
  SKILL_PARTICLE_BY_PIECE_CHAR,
).filter((source): source is ImageSourcePropType => source != null);
