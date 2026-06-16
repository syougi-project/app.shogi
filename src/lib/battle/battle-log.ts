import type { SkillVisualEffect } from '@/domain/battle/skill-visual-effect';
import type { MovePayload, PlayerSide } from '@/domain/matching-server/protocol';
import type { Side } from '@/features/stage-shogi/domain/game-rules';
import { movePayloadToBattleMove, type BattleAudioCatalog } from '@/lib/battle/battle-move-audio';
import { serverSideToCanonicalSide } from '@/lib/matching-server/canonical-game';
import { resolveWirePieceChar } from '@/lib/matching-server/piece-display';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';

function moverServerSide(turnAfterMove: PlayerSide): PlayerSide {
  return turnAfterMove === 'black' ? 'white' : 'black';
}

function actorLabel(moverSide: PlayerSide, myRole: PlayerSide): string {
  return moverSide === myRole ? 'あなた' : '相手';
}

function resolveMovedPieceName(
  payload: MovePayload,
  moverCanonicalSide: Side,
  catalog: BattleAudioCatalog,
): string {
  const promoted = payload.promote === true;
  const fromWire = resolveWirePieceChar(
    payload.piece,
    moverCanonicalSide,
    promoted,
    catalog.pieceDefsByCode,
  );
  if (fromWire !== '?') return fromWire;

  const move = movePayloadToBattleMove(payload);
  const code = (move.pieceCode ?? move.dropPieceCode ?? payload.piece).toUpperCase();
  return catalog.pieceDefsByCode[code]?.char?.trim() ?? code;
}

function resolveSkillActivatorName(
  move: BattleMove,
  skillVisualEffects: SkillVisualEffect[],
  moverCanonicalSide: Side,
  catalog: BattleAudioCatalog,
  movedPieceName: string,
): string {
  const fxNames = [
    ...new Set(skillVisualEffects.map((effect) => effect.pieceChar.trim()).filter(Boolean)),
  ];
  if (fxNames.length === 1) return fxNames[0]!;
  if (fxNames.length > 1) return fxNames.join('・');

  const notation = (move.notation ?? '').trim();
  if (notation === 'time_skill_only' || notation === 'time_skill') return '時';
  if (notation === 'house_skill_only') return '畑';
  if (/^satori_stun:/i.test(notation)) return '悟';
  if (/^heart_protect:/i.test(notation)) return '心';

  const rawCode = (move.pieceCode ?? move.dropPieceCode ?? '').trim();
  if (rawCode) {
    const fromCode = resolveWirePieceChar(
      rawCode,
      moverCanonicalSide,
      move.promote === true,
      catalog.pieceDefsByCode,
    );
    if (fromCode !== '?') return fromCode;
  }

  return movedPieceName;
}

function formatMoveSquares(payload: MovePayload): string {
  if (payload.drop === true || !payload.from?.trim()) {
    return `打 ${payload.to.trim().toUpperCase()}`;
  }
  return `${payload.from.trim().toUpperCase()}→${payload.to.trim().toUpperCase()}`;
}

/** オンライン対戦ログ: 着手駒名とスキル発動駒名を含む1行テキスト */
export function formatOnlineBattleMoveLogLine(input: {
  lastMove: MovePayload;
  turnAfterMove: PlayerSide;
  lastSkillTriggered?: boolean;
  myRole: PlayerSide;
  catalog: BattleAudioCatalog;
  skillVisualEffects?: SkillVisualEffect[];
}): string {
  const moverSide = moverServerSide(input.turnAfterMove);
  const moverCanonicalSide = serverSideToCanonicalSide(moverSide);
  const movedPieceName = resolveMovedPieceName(input.lastMove, moverCanonicalSide, input.catalog);
  const squares = formatMoveSquares(input.lastMove);
  const actor = actorLabel(moverSide, input.myRole);
  let line = `${actor}: ${movedPieceName} ${squares}`;

  if (input.lastSkillTriggered) {
    const move = movePayloadToBattleMove(input.lastMove);
    const skillPieceName = resolveSkillActivatorName(
      move,
      input.skillVisualEffects ?? [],
      moverCanonicalSide,
      input.catalog,
      movedPieceName,
    );
    line += ` / スキル: ${skillPieceName}`;
  }

  return line;
}
