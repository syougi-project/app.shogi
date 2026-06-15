import { GACHA_PIECE_SKILL_BINDINGS } from '@/ai/engine/gacha-piece-skill-definitions';
import type { PieceCatalogItem } from '@/domain/models/piece';

/**
 * ステージ開始時に boardState.skill_definitions_v2 へ載せる定義。
 * BFF が駒マスタに structured skill を載せていない場合でも、幻・霧のクライアント挙動を成立させる。
 * 刀(52)・銃(54) は BFF の古い定義より常にここで上書きし、実処理は将棋エンジン（apply-move / legal-moves）
 * と skill-runtime の二重実行ガードに合わせる。
 */
const CANONICAL_FALLBACK_DEFINITIONS: readonly Record<string, unknown>[] = [
  {
    skillId: 38,
    pieceChars: ['幻'],
    trigger: { type: 'continuous_rule' },
    conditions: [{ type: 'chance_roll', params: { procChance: 0.5 } }],
    effects: [
      {
        type: 'defense_or_immunity',
        target: { group: 'self', selector: 'self_piece' },
        params: { mode: 'evade_capture' },
      },
    ],
  },
  {
    skillId: 39,
    pieceChars: ['霧'],
    trigger: { type: 'after_move' },
    conditions: [{ type: 'chance_roll', params: { procChance: 0.3 } }],
    effects: [
      {
        type: 'send_to_hand',
        target: { group: 'adjacent', selector: 'adjacent_enemy' },
        params: { handOwner: 'target_owner' },
      },
    ],
  },
  {
    skillId: 52,
    pieceChars: ['刀'],
    trigger: { group: 'event_capture', type: 'after_capture' },
    conditions: [],
    effects: [
      {
        type: 'multi_capture',
        target: { group: 'adjacent', selector: 'adjacent_enemy' },
        params: { captureMode: 'adjacent_after_capture' },
      },
    ],
    source: {
      skillText:
        '前方ちょうど1マスで敵駒を取ったとき、着地点の左右1マスにいる敵駒もまとめて取る（鎧は除く）。実装は apply-move。',
      sourceKind: 'manual',
      sourceFile: 'session-skill-definitions-v2',
      sourceFunction: 'CANONICAL_KATANA',
    },
    classification: { implementationKind: 'primitive', tags: ['capture_trigger', 'multi_capture'] },
    scriptHook: null,
    notes: 'canonical-engine-parity',
  },
  {
    skillId: 54,
    pieceChars: ['銃'],
    trigger: { group: 'continuous', type: 'continuous_rule' },
    conditions: [],
    effects: [
      {
        type: 'multi_capture',
        target: { group: 'line', selector: 'front_enemy' },
        params: { captureMode: 'forward_chain' },
      },
    ],
    source: {
      skillText:
        '前方ちょうど2マスまたは斜め後ろ2マスへの貫通取り。実装は apply-move（skill-runtime は銃で二重実行しない）。',
      sourceKind: 'manual',
      sourceFile: 'session-skill-definitions-v2',
      sourceFunction: 'CANONICAL_GUN',
    },
    classification: { implementationKind: 'primitive', tags: ['continuous_rule', 'multi_capture'] },
    scriptHook: null,
    notes: 'canonical-engine-parity',
  },
  {
    skillId: 72,
    pieceChars: ['獣'],
    trigger: { group: 'event_move', type: 'after_move' },
    conditions: [{ type: 'orthogonal_adjacent_enemy_exists', params: {} }],
    effects: [
      {
        type: 'apply_status',
        target: { group: 'adjacent', selector: 'adjacent_enemy' },
        params: {
          statusType: 'stun',
          durationTurns: 2,
          adjacency: 'orthogonal',
        },
      },
    ],
    source: {
      skillText: 'この駒の前後左右1マスの敵駒を行動不能にする。',
      sourceKind: 'manual',
      sourceFile: 'session-skill-definitions-v2',
      sourceFunction: 'CANONICAL_BEAST',
    },
    classification: {
      implementationKind: 'primitive',
      tags: ['move_trigger', 'enemy_debuff', 'apply_status'],
    },
    scriptHook: null,
    notes: 'canonical-engine-parity',
  },
  {
    skillId: 73,
    pieceChars: ['禽'],
    trigger: { group: 'event_move', type: 'after_move' },
    conditions: [],
    effects: [],
    source: {
      skillText: '移動時、ランダムな味方駒を後ろ1マスに運ぶ。',
      sourceKind: 'manual',
      sourceFile: 'session-skill-definitions-v2',
      sourceFunction: 'CANONICAL_BIRD',
    },
    classification: {
      implementationKind: 'primitive',
      tags: ['move_trigger', 'relocate_ally'],
    },
    scriptHook: null,
    notes: 'canonical-engine-parity',
  },
  {
    skillId: 74,
    pieceChars: ['菊'],
    trigger: { group: 'event_move', type: 'after_move' },
    conditions: [],
    effects: [],
    source: {
      skillText:
        '移動後、周囲8マスにいる味方駒1体（玉除く）に2ターンの復活効果を付与する。復活中は敵に取られても元の陣営の手駒に戻る。実装は skill-runtime + apply-move。',
      sourceKind: 'manual',
      sourceFile: 'session-skill-definitions-v2',
      sourceFunction: 'CANONICAL_CHRYSANTHEMUM',
    },
    classification: {
      implementationKind: 'primitive',
      tags: ['move_trigger', 'ally_buff', 'revival'],
    },
    scriptHook: null,
    notes: 'canonical-engine-parity',
  },
];

type PieceCatalogItemWithSkillJson = PieceCatalogItem & {
  skillDefinitionsV2?: unknown;
  skill_definitions_v2?: unknown;
};

function definitionsFromCatalogItem(item: PieceCatalogItemWithSkillJson): unknown[] {
  const raw = item.skillDefinitionsV2 ?? item.skill_definitions_v2;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const defs = (raw as { definitions?: unknown }).definitions;
    if (Array.isArray(defs)) return defs;
  }
  return [];
}

export function assembleSkillDefinitionsV2ForSession(
  pieceDefsByCode: Partial<Record<string, PieceCatalogItem>>,
): { definitions: Record<string, unknown>[] } {
  const bySkillId = new Map<number, Record<string, unknown>>();
  const extras: Record<string, unknown>[] = [];

  for (const item of Object.values(pieceDefsByCode)) {
    if (!item) continue;
    for (const entry of definitionsFromCatalogItem(item as PieceCatalogItemWithSkillJson)) {
      if (!entry || typeof entry !== 'object') continue;
      const rec = entry as Record<string, unknown>;
      const sid = Number(rec.skillId);
      if (Number.isFinite(sid)) {
        bySkillId.set(sid, rec);
      } else {
        extras.push(rec);
      }
    }
  }

  for (const def of CANONICAL_FALLBACK_DEFINITIONS) {
    const id = Number(def.skillId);
    if (!Number.isFinite(id)) {
      extras.push({ ...def });
      continue;
    }
    if (!bySkillId.has(id)) {
      bySkillId.set(id, { ...def });
    }
  }

  // 刀(52)・銃(54)・獣(72)・禽(73): カタログ／BFF の不整合より正典（上のフォールバック）を常に優先。
  for (const def of CANONICAL_FALLBACK_DEFINITIONS) {
    const id = Number(def.skillId);
    if (id === 52 || id === 54 || id === 72 || id === 73) {
      if (Number.isFinite(id)) {
        bySkillId.set(id, { ...def });
      }
    }
  }

  // ガチャ駒: 盤上にいるときはクライアント正典を優先（Supabase 駒マスタ未整備でも動作確認可）
  for (const binding of GACHA_PIECE_SKILL_BINDINGS) {
    const id = binding.skillId;
    bySkillId.set(id, { ...binding.definition });
  }

  return { definitions: [...bySkillId.values(), ...extras] };
}
