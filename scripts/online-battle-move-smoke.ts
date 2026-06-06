/**
 * インターネット対戦 E2E: 2 ユーザーでマッチ → app と同じ payload で複数手着手 → ILLEGAL_MOVE が出ないことを確認
 *
 * Usage:
 *   bun ./scripts/online-battle-move-smoke.ts
 *   MOVE_SMOKE_WS_URL=ws://127.0.0.1:3010/ws bun ./scripts/online-battle-move-smoke.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import type {
  MatchingGameState,
  MovePayload,
  PlayerSide,
  WebSocketServerMessage,
} from '@/domain/matching-server/protocol';
import { createRequestId } from '@/domain/matching-server/protocol';
import { formatMatchingSquare, parseMatchingSquare } from '@/lib/matching-server/square';
import type { BattleMove } from '@/usecases/stage-battle/game-move-contract';

type SupabaseScriptClient = any;

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

type BattleSetupPlacement = {
  row: number;
  col: number;
  pieceId: number;
  pieceCode: string;
};

type TicketResponse = {
  ticket: string;
  expiresAt: string;
  user: { userId: string; displayName: string; rating: number };
};

type PreparedUser = {
  userId: string;
  email: string;
  accessToken: string;
  battleSetupId: string;
  ticket: TicketResponse;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const bffRoot = path.resolve(appRoot, '../bff.shogi');

const createdUserIds: string[] = [];

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadLocalEnv(): void {
  for (const root of [bffRoot, appRoot]) {
    loadEnvFile(path.resolve(root, '.env'));
    loadEnvFile(path.resolve(root, '.env.local'));
  }
}

function env(name: string, fallback?: string): string {
  const value = process.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing ${name}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson<T>(
  baseUrl: string,
  pathName: string,
  token: string,
  body?: unknown,
): Promise<T> {
  const url = `${baseUrl.replace(/\/+$/, '')}${pathName}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = JSON.parse(await response.text()) as ApiEnvelope<T>;
  if (!response.ok || !json.ok) {
    const message = json.ok
      ? `HTTP ${response.status}`
      : `${json.error.code}: ${json.error.message}`;
    throw new Error(`${url} failed: ${message}`);
  }
  return json.data;
}

async function getJson<T>(baseUrl: string, pathName: string, token?: string): Promise<T> {
  const url = `${baseUrl.replace(/\/+$/, '')}${pathName}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const json = JSON.parse(await response.text()) as ApiEnvelope<T>;
  if (!response.ok || !json.ok) {
    throw new Error(`${url} failed`);
  }
  return json.data;
}

async function loadStandardBoardLayout(
  admin: SupabaseScriptClient,
): Promise<BattleSetupPlacement[]> {
  const { data, error } = await admin
    .schema('master')
    .from('m_piece')
    .select('piece_id,piece_code,kanji')
    .in('kanji', ['歩', '香', '桂', '銀', '金', '角', '飛', '王', '玉']);
  if (error) throw new Error(`Failed to load master pieces: ${error.message}`);

  const pieces = new Map<string, { piece_id: number; piece_code: string }>();
  for (const row of data ?? []) {
    pieces.set(String(row.kanji), {
      piece_id: Number(row.piece_id),
      piece_code: String(row.piece_code).toUpperCase(),
    });
  }
  const resolve = (kanji: string) => {
    const piece = pieces.get(kanji) ?? (kanji === '王' ? pieces.get('玉') : undefined);
    if (!piece) throw new Error(`Missing standard piece: ${kanji}`);
    return piece;
  };

  const cells: Array<{ row: number; col: number; kanji: string }> = [
    ...Array.from({ length: 9 }, (_, col) => ({ row: 6, col, kanji: '歩' })),
    { row: 7, col: 1, kanji: '角' },
    { row: 7, col: 7, kanji: '飛' },
    { row: 8, col: 0, kanji: '香' },
    { row: 8, col: 1, kanji: '桂' },
    { row: 8, col: 2, kanji: '銀' },
    { row: 8, col: 3, kanji: '金' },
    { row: 8, col: 4, kanji: '王' },
    { row: 8, col: 5, kanji: '金' },
    { row: 8, col: 6, kanji: '銀' },
    { row: 8, col: 7, kanji: '桂' },
    { row: 8, col: 8, kanji: '香' },
  ];

  return cells.map((cell) => {
    const piece = resolve(cell.kanji);
    return {
      row: cell.row,
      col: cell.col,
      pieceId: piece.piece_id,
      pieceCode: piece.piece_code,
    };
  });
}

async function createPreparedUser(input: {
  index: number;
  runId: string;
  admin: SupabaseScriptClient;
  userClient: SupabaseScriptClient;
  apiBaseUrl: string;
  boardLayout: BattleSetupPlacement[];
}): Promise<PreparedUser> {
  const email = `move-smoke-${input.runId}-${input.index}@example.com`;
  const password = `SmokeTest!${input.runId}${input.index}`;
  const displayName = `move-smoke-${input.index}`;

  const { data: created, error: createError } = await input.admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (createError || !created.user?.id) {
    throw new Error(`Failed to create user ${email}: ${createError?.message ?? 'no user id'}`);
  }
  const userId = created.user.id;
  createdUserIds.push(userId);

  const { data: session, error: signInError } = await input.userClient.auth.signInWithPassword({
    email,
    password,
  });
  const accessToken = session.session?.access_token;
  if (signInError || !accessToken) {
    throw new Error(`Failed to sign in ${email}: ${signInError?.message ?? 'no token'}`);
  }

  const createdSetup = await postJson<{ battleSetupId: string }>(
    input.apiBaseUrl,
    '/api/v1/online-match/battle-setup',
    accessToken,
    {
      name: `move-smoke-${input.runId}`,
      boardLayout: input.boardLayout,
      handsLayout: [],
      selectedPieceIds: input.boardLayout.map((piece) => piece.pieceId),
    },
  );
  await postJson(
    input.apiBaseUrl,
    `/api/v1/online-match/battle-setup/${encodeURIComponent(createdSetup.battleSetupId)}/validate`,
    accessToken,
    {},
  );
  const locked = await postJson<{ battleSetupId: string }>(
    input.apiBaseUrl,
    `/api/v1/online-match/battle-setup/${encodeURIComponent(createdSetup.battleSetupId)}/lock`,
    accessToken,
    {},
  );
  const ticket = await postJson<TicketResponse>(
    input.apiBaseUrl,
    '/api/v1/online-match/ticket',
    accessToken,
    {},
  );

  return {
    userId,
    email,
    accessToken,
    battleSetupId: locked.battleSetupId,
    ticket,
  };
}

class WsClient {
  readonly events: WebSocketServerMessage[] = [];
  private ws: WebSocket;

  constructor(
    readonly userId: string,
    ticket: string,
    wsUrl: string,
  ) {
    const url = new URL(wsUrl);
    url.searchParams.set('ticket', ticket);
    this.ws = new WebSocket(url.toString());
    this.ws.addEventListener('message', (event) => {
      this.events.push(JSON.parse(String(event.data)) as WebSocketServerMessage);
    });
  }

  async open(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`connect timeout: ${this.userId}`)),
        15_000,
      );
      this.ws.addEventListener(
        'open',
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
      this.ws.addEventListener('error', () => reject(new Error(`connect error: ${this.userId}`)), {
        once: true,
      });
    });
  }

  send(message: Record<string, unknown>): void {
    this.ws.send(JSON.stringify(message));
  }

  close(): void {
    if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
      this.ws.close();
    }
  }

  async waitFor<TType extends WebSocketServerMessage['type']>(
    type: TType,
    options?: { timeoutMs?: number; minVersion?: number },
  ): Promise<Extract<WebSocketServerMessage, { type: TType }>> {
    const timeoutMs = options?.timeoutMs ?? 60_000;
    const minVersion = options?.minVersion;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const index = this.events.findIndex((message) => {
        if (message.type !== type) return false;
        if (minVersion !== undefined && message.type === 'game_state_updated') {
          return message.version >= minVersion;
        }
        return true;
      });
      if (index >= 0) {
        const [message] = this.events.splice(index, 1);
        return message as Extract<WebSocketServerMessage, { type: TType }>;
      }
      const errorIndex = this.events.findIndex((message) => message.type === 'error');
      if (errorIndex >= 0) {
        const err = this.events.splice(errorIndex, 1)[0];
        if (err?.type === 'error') {
          throw new Error(`${this.userId} error: ${err.code} ${err.message}`);
        }
      }
      await sleep(25);
    }
    throw new Error(`${this.userId} timed out waiting for ${type}`);
  }
}

function decodeEncodedBoardPiece(encoded: string): {
  serverSide: PlayerSide;
  code: string;
  promoted: boolean;
} {
  const [sideRaw, restRaw] = encoded.split(':');
  const serverSide: PlayerSide = sideRaw === 'white' ? 'white' : 'black';
  const rest = restRaw ?? '';
  const promoted = rest.endsWith('+');
  const code = (promoted ? rest.slice(0, -1) : rest).trim().toUpperCase();
  return { serverSide, code, promoted };
}

function lookupWireBoardEncoded(board: Record<string, string>, square: string): string | undefined {
  const normalized = square.trim().toLowerCase();
  if (board[normalized]) return board[normalized];
  for (const [key, value] of Object.entries(board)) {
    if (key.trim().toLowerCase() === normalized) return value;
  }
  return undefined;
}

function battleMoveToServerPayload(
  move: BattleMove,
  myRole: PlayerSide,
  wire: Pick<MatchingGameState, 'board' | 'hands'>,
): MovePayload {
  let piece = (move.pieceCode ?? 'FU').trim().toUpperCase();
  if (move.fromRow != null && move.fromCol != null) {
    const square = formatMatchingSquare(move.fromRow, move.fromCol).toLowerCase();
    const encoded = lookupWireBoardEncoded(wire.board, square);
    if (encoded) piece = decodeEncodedBoardPiece(encoded).code;
  }
  const to = formatMatchingSquare(move.toRow, move.toCol).toLowerCase();
  if (move.dropPieceCode) {
    return { to, piece, drop: true, promote: false };
  }
  const from = formatMatchingSquare(move.fromRow!, move.fromCol!).toLowerCase();
  return { from, to, piece, promote: move.promote === true, drop: false };
}

function pickForwardPawnMove(wire: MatchingGameState, role: PlayerSide): BattleMove | null {
  const forwardDelta = role === 'black' ? -1 : 1;
  const candidates: BattleMove[] = [];
  for (const [square, encoded] of Object.entries(wire.board)) {
    const decoded = decodeEncodedBoardPiece(encoded);
    if (decoded.serverSide !== role || decoded.promoted || decoded.code === 'OU') continue;
    const { row, col } = parseMatchingSquare(square);
    const toRow = row + forwardDelta;
    if (toRow < 0 || toRow > 8) continue;
    const toSquare = formatMatchingSquare(toRow, col).toLowerCase();
    if (lookupWireBoardEncoded(wire.board, toSquare)) continue;
    candidates.push({
      fromRow: row,
      fromCol: col,
      toRow,
      toCol: col,
      pieceCode: decoded.code,
      promote: false,
      dropPieceCode: null,
      capturedPieceCode: null,
      notation: null,
    });
  }
  // 中央の歩を優先（7筋 = col 2）
  return candidates.find((m) => m.fromCol === 2) ?? candidates[0] ?? null;
}

function wireFromStateUpdated(
  message: Extract<WebSocketServerMessage, { type: 'game_state_updated' }>,
): MatchingGameState {
  return {
    version: message.version,
    turn: message.turn,
    board: message.board,
    hands: message.hands,
    skillState: message.skillState,
    lastMove: message.lastMove,
    lastSkillTriggered: message.lastSkillTriggered,
    canonicalState: message.canonicalState,
  };
}

async function playMoves(input: {
  black: WsClient;
  white: WsClient;
  matchId: string;
  blackUserId: string;
  whiteUserId: string;
  initialState: MatchingGameState;
  maxMoves: number;
}): Promise<number> {
  let wire = input.initialState;
  let movesPlayed = 0;

  for (let step = 0; step < input.maxMoves; step += 1) {
    const role: PlayerSide = wire.turn;
    const client = role === 'black' ? input.black : input.white;
    const userId = role === 'black' ? input.blackUserId : input.whiteUserId;

    const chosen = pickForwardPawnMove(wire, role);
    if (!chosen) {
      console.log(`[move-smoke] no forward pawn at v${wire.version} turn=${wire.turn}`);
      break;
    }

    const payload: MovePayload = battleMoveToServerPayload(chosen, role, wire);
    console.log(`[move-smoke] move ${step + 1}`, {
      role,
      version: wire.version,
      payload,
    });

    client.send({
      action: 'make_move',
      requestId: createRequestId(),
      userId,
      matchId: input.matchId,
      expectedVersion: wire.version,
      move: payload,
    });

    const expectedVersion = wire.version + 1;
    const blackUpdate = await input.black.waitFor('game_state_updated', {
      minVersion: expectedVersion,
    });
    const whiteUpdate = await input.white.waitFor('game_state_updated', {
      minVersion: expectedVersion,
    });
    if (blackUpdate.version !== whiteUpdate.version) {
      throw new Error(
        `version mismatch after move: ${blackUpdate.version} vs ${whiteUpdate.version}`,
      );
    }
    wire = wireFromStateUpdated(blackUpdate);
    movesPlayed += 1;
    console.log(`[move-smoke] applied v${wire.version} turn=${wire.turn}`);
  }

  return movesPlayed;
}

async function cleanup(admin: SupabaseScriptClient): Promise<void> {
  for (const userId of [...createdUserIds].reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.warn(`[cleanup] delete ${userId}: ${error.message}`);
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  const runId = new Date()
    .toISOString()
    .replace(/[^0-9]/g, '')
    .slice(0, 14);
  const apiBaseUrl = env('EXPO_PUBLIC_API_BASE_URL');
  const wsUrl = env('MOVE_SMOKE_WS_URL', env('EXPO_PUBLIC_MATCHING_SERVER_WS_URL'));
  const maxMoves = Number(process.env.MOVE_SMOKE_MAX_MOVES ?? '4');

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const userClient = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const boardLayout = await loadStandardBoardLayout(admin);
  const [userA, userB] = await Promise.all([
    createPreparedUser({ index: 1, runId, admin, userClient, apiBaseUrl, boardLayout }),
    createPreparedUser({ index: 2, runId, admin, userClient, apiBaseUrl, boardLayout }),
  ]);

  const clientA = new WsClient(userA.userId, userA.ticket.ticket, wsUrl);
  const clientB = new WsClient(userB.userId, userB.ticket.ticket, wsUrl);
  await Promise.all([clientA.open(), clientB.open()]);

  try {
    clientA.send({
      action: 'enter_queue',
      requestId: createRequestId(),
      userId: userA.userId,
      rating: userA.ticket.user.rating,
      displayName: userA.ticket.user.displayName,
      battleSetupId: userA.battleSetupId,
    });
    clientB.send({
      action: 'enter_queue',
      requestId: createRequestId(),
      userId: userB.userId,
      rating: userB.ticket.user.rating,
      displayName: userB.ticket.user.displayName,
      battleSetupId: userB.battleSetupId,
    });

    await Promise.all([clientA.waitFor('queue_entered'), clientB.waitFor('queue_entered')]);
    const foundA = await clientA.waitFor('match_found');
    const foundB = await clientB.waitFor('match_found');
    const startedA = await clientA.waitFor('game_started');
    await clientB.waitFor('game_started');

    console.log('[move-smoke] matched', {
      matchId: foundA.matchId,
      roles: { a: foundA.role, b: foundB.role },
      wsUrl,
      boardKeys: Object.keys(startedA.initialState.board).slice(0, 12),
      sampleBoard: Object.entries(startedA.initialState.board).slice(0, 5),
    });

    const black = foundA.role === 'black' ? clientA : clientB;
    const white = foundA.role === 'black' ? clientB : clientA;
    const blackUserId = foundA.role === 'black' ? userA.userId : userB.userId;
    const whiteUserId = foundA.role === 'black' ? userB.userId : userA.userId;

    const movesPlayed = await playMoves({
      black,
      white,
      matchId: foundA.matchId,
      blackUserId,
      whiteUserId,
      initialState: startedA.initialState,
      maxMoves,
    });

    if (movesPlayed < 1) {
      throw new Error('No moves were applied');
    }

    console.log(`[move-smoke] success: ${movesPlayed} move(s) applied without ILLEGAL_MOVE`);
  } finally {
    clientA.close();
    clientB.close();
    await cleanup(admin);
  }
}

void main().catch((error) => {
  console.error('[move-smoke] failed:', error);
  process.exitCode = 1;
});
