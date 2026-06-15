/**
 * matching_server から subprocess で呼び出し、app.shogi 本番エンジンで着手を検証する。
 * stdin: JSON { position, pieceCatalog, movePayload, actorRole: 'black'|'white' }
 * stdout: JSON { ok, nextPosition?, game?, code?, message?, skillTriggered? }
 */
import { applyMove, generateLegalMoves } from '@/ai/engine';
import { assembleSkillDefinitionsV2ForSession } from '@/ai/engine/session-skill-definitions-v2';
import type { MovePayload, PlayerSide } from '@/domain/matching-server/protocol';
import {
  normalizeBattleGameStatus,
  normalizeBattlePosition,
  normalizePieceCatalog,
} from '@/ai/model';
import type { AiBattlePosition } from '@/ai/model';
import { toBasePieceCode } from '@/ai/model/move';
import { matchingWireToCanonicalPosition } from '@/lib/matching-server/canonical-game';
import { canonicalToMatchingWire } from '@/lib/matching-server/canonical-game';
import type { MatchingGameState } from '@/domain/matching-server/protocol';
import { parseMatchingSquare } from '@/lib/matching-server/square';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';
import { preparePieceCatalogForBattleAndDisplay } from '@/features/piece-info/lib/piece-catalog-display';
import type { PieceCatalogItem } from '@/usecases/piece-info/load-piece-catalog-usecase';

type ValidatorInput = {
  op?: 'validate';
  position: AiBattlePosition;
  pieceCatalog: PieceCatalogItem[];
  movePayload: MovePayload;
  actorRole: PlayerSide;
};

type SyncInput = {
  op: 'sync';
  wire: MatchingGameState;
  pieceCatalog: PieceCatalogItem[];
};

type NormalizeCatalogInput = {
  op: 'normalizeCatalog';
  pieceCatalog: PieceCatalogItem[];
};

type ValidatorRequest = ValidatorInput | SyncInput | NormalizeCatalogInput;

type ValidatorOutput =
  | {
      ok: true;
      nextPosition: AiBattlePosition;
      nextWire?: MatchingGameState;
      game: {
        status: 'in_progress' | 'finished' | 'aborted';
        winnerSide: 'player' | 'enemy' | null;
      };
      skillTriggered: boolean;
    }
  | { ok: true; position: AiBattlePosition; wire: MatchingGameState }
  | { ok: false; code: string; message: string };

function actorRoleToSide(role: PlayerSide): 'player' | 'enemy' {
  return role === 'black' ? 'player' : 'enemy';
}

function movePayloadToBattleMove(payload: MovePayload): BattleMove {
  const piece = toBasePieceCode(payload.piece) ?? payload.piece.toUpperCase();
  const isDrop = payload.drop === true || payload.from == null || payload.from === '';
  if (isDrop) {
    const { row, col } = parseMatchingSquare(payload.to);
    return {
      fromRow: null,
      fromCol: null,
      toRow: row,
      toCol: col,
      pieceCode: piece,
      promote: false,
      dropPieceCode: piece,
      capturedPieceCode: null,
      notation: null,
    };
  }
  const to = parseMatchingSquare(payload.to);
  const from = payload.from ? parseMatchingSquare(payload.from) : null;
  return {
    fromRow: from?.row ?? null,
    fromCol: from?.col ?? null,
    toRow: to.row,
    toCol: to.col,
    pieceCode: piece,
    promote: payload.promote === true,
    dropPieceCode: null,
    capturedPieceCode: null,
    notation: null,
  };
}

function catalogDefsByCode(catalog: PieceCatalogItem[]): Record<string, PieceCatalogItem> {
  const out: Record<string, PieceCatalogItem> = {};
  for (const item of catalog) {
    const code = (item.pieceCode ?? '').toUpperCase();
    if (!code) continue;
    out[code] = item;
  }
  return out;
}

function ensureSkillDefinitions(
  position: AiBattlePosition,
  catalog: PieceCatalogItem[],
): AiBattlePosition {
  const assembled = assembleSkillDefinitionsV2ForSession(catalogDefsByCode(catalog));
  const boardState = { ...(position.boardState as Record<string, unknown>) };
  boardState.skill_definitions_v2 = assembled;
  return { ...position, boardState };
}

function preparePvpPieceCatalog(catalog: PieceCatalogItem[]): PieceCatalogItem[] {
  return preparePieceCatalogForBattleAndDisplay(catalog);
}

function runNormalizeCatalog(input: NormalizeCatalogInput): {
  ok: true;
  pieceCatalog: PieceCatalogItem[];
} {
  return { ok: true, pieceCatalog: preparePvpPieceCatalog(input.pieceCatalog) };
}

function runSync(input: SyncInput): ValidatorOutput {
  const catalog = preparePvpPieceCatalog(input.pieceCatalog);
  const position = matchingWireToCanonicalPosition(input.wire, catalog);
  const wire = canonicalToMatchingWire(position);
  wire.canonicalState = {
    sideToMove: position.sideToMove,
    turnNumber: position.turnNumber,
    moveCount: position.moveCount,
    sfen: position.sfen,
    stateHash: position.stateHash,
    boardState: position.boardState as Record<string, unknown>,
    hands: position.hands,
  };
  return { ok: true, position, wire };
}

function runValidate(input: ValidatorInput): ValidatorOutput {
  const preparedCatalog = preparePvpPieceCatalog(input.pieceCatalog);
  const catalog = normalizePieceCatalog(preparedCatalog);
  const actorSide = actorRoleToSide(input.actorRole);
  let position = normalizeBattlePosition(input.position);
  position = ensureSkillDefinitions(position, preparedCatalog);

  if (position.sideToMove !== actorSide) {
    return { ok: false, code: 'NOT_YOUR_TURN', message: 'It is not your turn.' };
  }

  const move = movePayloadToBattleMove(input.movePayload);
  const legal = generateLegalMoves({ position, pieceCatalog: catalog });
  const matched = legal.legalMoves.some(
    (candidate) =>
      candidate.fromRow === move.fromRow &&
      candidate.fromCol === move.fromCol &&
      candidate.toRow === move.toRow &&
      candidate.toCol === move.toCol &&
      candidate.pieceCode === move.pieceCode &&
      candidate.dropPieceCode === move.dropPieceCode &&
      candidate.promote === move.promote,
  );
  if (!matched) {
    return {
      ok: false,
      code: 'ILLEGAL_MOVE',
      message: 'Move is not legal in the current position.',
    };
  }

  const committed = applyMove({ position, pieceCatalog: catalog, move });
  const nextPosition = ensureSkillDefinitions(
    normalizeBattlePosition(committed.position),
    preparedCatalog,
  );
  const game = normalizeBattleGameStatus(committed.game);

  const nextWire = canonicalToMatchingWire(nextPosition);
  nextWire.canonicalState = {
    sideToMove: nextPosition.sideToMove,
    turnNumber: nextPosition.turnNumber,
    moveCount: nextPosition.moveCount,
    sfen: nextPosition.sfen,
    stateHash: nextPosition.stateHash,
    boardState: nextPosition.boardState as Record<string, unknown>,
    hands: nextPosition.hands,
  };

  return {
    ok: true,
    nextPosition,
    nextWire,
    game: { status: game.status, winnerSide: game.winnerSide },
    skillTriggered: committed.skillTriggered,
  };
}

function run(
  input: ValidatorRequest,
): ValidatorOutput | { ok: true; pieceCatalog: PieceCatalogItem[] } {
  if ('op' in input && input.op === 'normalizeCatalog') {
    return runNormalizeCatalog(input);
  }
  if ('op' in input && input.op === 'sync') {
    return runSync(input);
  }
  return runValidate(input as ValidatorInput);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const raw = await readStdin();
  const input = JSON.parse(raw) as ValidatorRequest;
  const output = run(input);
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

void main();

export { run as validateOnlineMove };
