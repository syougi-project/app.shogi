import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

type SupabaseScriptClient = any;

type BattleSetupPlacement = {
  row: number;
  col: number;
  pieceId: number;
  pieceCode: string;
};

type TicketResponse = {
  ticket: string;
  expiresAt: string;
  user: {
    userId: string;
    displayName: string;
    rating: number;
  };
};

type TestUser = {
  index: number;
  userId: string;
  email: string;
  password: string;
  displayName: string;
  accessToken: string;
  battleSetupId: string;
  ticket: TicketResponse;
};

type PlayerSide = 'black' | 'white';

type MatchingGameState = {
  version: number;
  turn: PlayerSide;
  board: Record<string, string>;
  hands: Record<PlayerSide, Record<string, number>>;
};

type ServerMessage = {
  type: string;
  matchId?: string;
  role?: PlayerSide;
  initialState?: MatchingGameState;
  version?: number;
  turn?: PlayerSide;
  board?: Record<string, string>;
  hands?: Record<PlayerSide, Record<string, number>>;
  code?: string;
  message?: string;
};

type Scenario = 'matchmaking' | 'spike' | 'gameplay' | 'reconnect' | 'soak';

type LoadClient = {
  user: TestUser;
  ws: WebSocket;
  messages: ServerMessage[];
  messageCursor: number;
  matchId: string | null;
  role: PlayerSide | null;
  gameState: MatchingGameState | null;
  queueSentAt: number | null;
  closed: boolean;
};

type LoadMetrics = {
  observe(name: string, elapsedMs: number): void;
  count(name: string, amount?: number): void;
  print(): void;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const bffRoot = path.resolve(appRoot, '../bff.shogi');

const createdUserIds: string[] = [];
const sockets = new Set<WebSocket>();
const activeClients = new Set<LoadClient>();
let cleanupStarted = false;

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
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

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return Math.floor(parsed);
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowMs(): number {
  return performance.now();
}

function createMetrics(): LoadMetrics {
  const timings = new Map<string, number[]>();
  const counters = new Map<string, number>();

  const percentile = (values: number[], p: number): number => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
    return sorted[index] ?? 0;
  };

  const formatMs = (value: number) => `${Math.round(value)}ms`;

  return {
    observe(name, elapsedMs) {
      const values = timings.get(name) ?? [];
      values.push(elapsedMs);
      timings.set(name, values);
    },
    count(name, amount = 1) {
      counters.set(name, (counters.get(name) ?? 0) + amount);
    },
    print() {
      for (const [name, value] of [...counters.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        console.log(`[metric] ${name} count=${value}`);
      }
      for (const [name, values] of [...timings.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const max = values.reduce((acc, value) => Math.max(acc, value), 0);
        console.log(
          `[metric] ${name} samples=${values.length} p50=${formatMs(
            percentile(values, 50),
          )} p95=${formatMs(percentile(values, 95))} p99=${formatMs(
            percentile(values, 99),
          )} max=${formatMs(max)}`,
        );
      }
    },
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '');
  }
  return String(error);
}

function isRateLimitError(error: unknown): boolean {
  return /rate limit|too many requests/i.test(errorMessage(error));
}

async function retryRateLimited<T>(
  label: string,
  attempts: number,
  baseDelayMs: number,
  maxDelayMs: number,
  task: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error) || attempt === attempts) break;
      const delayMs = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitterMs = Math.floor(Math.random() * Math.min(1000, delayMs));
      console.warn(
        `[prepare] ${label} rate limited; retrying in ${delayMs + jitterMs}ms (${attempt}/${attempts})`,
      );
      await sleep(delayMs + jitterMs);
    }
  }
  throw lastError;
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

function parseCliArgs(): Map<string, string> {
  const args = new Map<string, string>();
  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (!arg.startsWith('--')) continue;
    const separator = arg.indexOf('=');
    if (separator > 0) {
      args.set(arg.slice(2, separator), arg.slice(separator + 1));
      continue;
    }
    args.set(arg.slice(2), process.argv[index + 1] ?? 'true');
    index += 1;
  }
  return args;
}

function cliEnv(
  args: Map<string, string>,
  cliName: string,
  envName: string,
  fallback?: string,
): string {
  const cliValue = args.get(cliName)?.trim();
  if (cliValue) return cliValue;
  return env(envName, fallback);
}

function cliInt(
  args: Map<string, string>,
  cliName: string,
  envName: string,
  fallback: number,
): number {
  const raw = args.get(cliName)?.trim() ?? process.env[envName]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`--${cliName} / ${envName} must be a non-negative number`);
  }
  return Math.floor(parsed);
}

function cliBool(
  args: Map<string, string>,
  cliName: string,
  envName: string,
  fallback: boolean,
): boolean {
  const raw = args.get(cliName)?.trim().toLowerCase() ?? process.env[envName]?.trim().toLowerCase();
  if (!raw) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw);
}

function parseScenario(raw: string): Scenario {
  if (
    raw === 'matchmaking' ||
    raw === 'spike' ||
    raw === 'gameplay' ||
    raw === 'reconnect' ||
    raw === 'soak'
  ) {
    return raw;
  }
  throw new Error(`Unknown scenario: ${raw}`);
}

function createRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

const RANKS = 'abcdefghi';

function parseMatchingSquare(square: string): { row: number; col: number } {
  const normalized = square.trim().toLowerCase();
  if (!/^[1-9][a-i]$/.test(normalized)) {
    throw new Error(`invalid square: ${square}`);
  }
  const file = Number.parseInt(normalized[0] ?? '', 10);
  const rank = normalized[1] ?? '';
  return { row: RANKS.indexOf(rank), col: 9 - file };
}

function formatMatchingSquare(row: number, col: number): string {
  return `${9 - col}${RANKS[row]}`;
}

function decodeBoardPiece(encoded: string): {
  side: PlayerSide;
  code: string;
  promoted: boolean;
} {
  const [sideRaw, restRaw] = encoded.split(':');
  const rest = (restRaw ?? '').trim();
  const promoted = rest.endsWith('+');
  return {
    side: sideRaw === 'white' ? 'white' : 'black',
    code: (promoted ? rest.slice(0, -1) : rest).toUpperCase(),
    promoted,
  };
}

function lookupBoardPiece(board: Record<string, string>, square: string): string | undefined {
  const normalized = square.trim().toLowerCase();
  if (board[normalized]) return board[normalized];
  for (const [key, value] of Object.entries(board)) {
    if (key.trim().toLowerCase() === normalized) return value;
  }
  return undefined;
}

function pickForwardMove(state: MatchingGameState): {
  from: string;
  to: string;
  piece: string;
  promote: boolean;
  drop: boolean;
} | null {
  const role = state.turn;
  const forwardDelta = role === 'black' ? -1 : 1;
  const candidates: Array<{ from: string; to: string; piece: string; col: number }> = [];

  for (const [square, encoded] of Object.entries(state.board)) {
    const decoded = decodeBoardPiece(encoded);
    if (decoded.side !== role || decoded.promoted || decoded.code === 'OU') continue;
    const { row, col } = parseMatchingSquare(square);
    const toRow = row + forwardDelta;
    if (toRow < 0 || toRow > 8) continue;
    const to = formatMatchingSquare(toRow, col).toLowerCase();
    if (lookupBoardPiece(state.board, to)) continue;
    candidates.push({
      from: formatMatchingSquare(row, col).toLowerCase(),
      to,
      piece: decoded.code,
      col,
    });
  }

  const chosen =
    candidates.find((candidate) => candidate.piece === 'FU' && candidate.col === 2) ??
    candidates.find((candidate) => candidate.piece === 'FU') ??
    candidates[0] ??
    null;
  if (!chosen) return null;
  return {
    from: chosen.from,
    to: chosen.to,
    piece: chosen.piece,
    promote: false,
    drop: false,
  };
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
  const text = await response.text();
  const json = JSON.parse(text) as ApiEnvelope<T>;
  if (!response.ok || !json.ok) {
    const message = json.ok
      ? `HTTP ${response.status}`
      : `${json.error.code}: ${json.error.message}`;
    throw new Error(`${url} failed: ${message}`);
  }
  return json.data;
}

async function loadStandardBoardLayout(
  admin: SupabaseScriptClient,
): Promise<BattleSetupPlacement[]> {
  const { data, error } = await admin
    .schema('master')
    .from('m_piece')
    .select('piece_id,piece_code,kanji,name')
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
    if (!piece) throw new Error(`Missing standard piece in master.m_piece: ${kanji}`);
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
  supabaseUrl: string;
  anonKey: string;
  apiBaseUrl: string;
  boardLayout: BattleSetupPlacement[];
  authRetryAttempts: number;
  authRetryBaseDelayMs: number;
  authRetryMaxDelayMs: number;
  authStaggerMs: number;
  authJitterMs: number;
  authBatchSize: number;
  authBatchIntervalMs: number;
  authScheduleStartedAtMs: number;
}): Promise<TestUser> {
  const email = `matching-load-${input.runId}-${input.index}@example.com`;
  const password = `LoadTest-${input.runId}-${input.index}-Aa1!`;
  const displayName = `負荷${String(input.index).padStart(3, '0')}`;

  const { data: created, error: createError } = await retryRateLimited(
    `createUser ${email}`,
    input.authRetryAttempts,
    input.authRetryBaseDelayMs,
    input.authRetryMaxDelayMs,
    async () => {
      const result = await input.admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          purpose: 'matching-load-test',
          runId: input.runId,
          index: input.index,
        },
      });
      if (result.error) throw result.error;
      return result;
    },
  );
  if (createError || !created.user) {
    throw new Error(`Failed to create ${email}: ${createError?.message ?? 'missing user'}`);
  }

  const userId = created.user.id;
  createdUserIds.push(userId);

  const { error: profileError } = await input.admin.from('players').upsert({
    id: userId,
    display_name: displayName,
    rating: 1500,
  });
  if (profileError) throw new Error(`Failed to upsert player ${userId}: ${profileError.message}`);

  const authOffsetMs =
    input.authBatchSize > 0
      ? Math.floor((input.index - 1) / input.authBatchSize) * input.authBatchIntervalMs +
        ((input.index - 1) % input.authBatchSize) * input.authStaggerMs
      : input.authStaggerMs * (input.index - 1);
  const signInTargetAtMs =
    input.authScheduleStartedAtMs +
    authOffsetMs +
    (input.authJitterMs > 0 ? Math.floor(Math.random() * input.authJitterMs) : 0);
  const signInDelayMs = Math.max(0, signInTargetAtMs - Date.now());
  if (signInDelayMs > 0) await sleep(signInDelayMs);

  const userClient = createClient(input.supabaseUrl, input.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: session } = await retryRateLimited(
    `signIn ${email}`,
    input.authRetryAttempts,
    input.authRetryBaseDelayMs,
    input.authRetryMaxDelayMs,
    async () => {
      const result = await userClient.auth.signInWithPassword({
        email,
        password,
      });
      if (result.error) throw result.error;
      return result;
    },
  );
  const accessToken = session.session?.access_token;
  if (!accessToken) {
    throw new Error(`Failed to sign in ${email}: missing access token`);
  }

  const createdSetup = await postJson<{ battleSetupId: string; status: string }>(
    input.apiBaseUrl,
    '/api/v1/online-match/battle-setup',
    accessToken,
    {
      name: `matching-load-${input.runId}`,
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
  const locked = await postJson<{ battleSetupId: string; status: string }>(
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
    index: input.index,
    userId,
    email,
    password,
    displayName,
    accessToken,
    battleSetupId: locked.battleSetupId,
    ticket,
  };
}

async function connectClient(input: {
  user: TestUser;
  wsUrl: string;
  timeoutMs: number;
  matchId?: string;
  metrics: LoadMetrics;
}): Promise<LoadClient> {
  const url = new URL(input.wsUrl);
  url.searchParams.set('ticket', input.user.ticket.ticket);
  if (input.matchId) url.searchParams.set('matchId', input.matchId);

  return new Promise((resolve, reject) => {
    let settled = false;
    const startedAt = nowMs();
    const ws = new WebSocket(url.toString());
    const client: LoadClient = {
      user: input.user,
      ws,
      messages: [],
      messageCursor: 0,
      matchId: input.matchId ?? null,
      role: null,
      gameState: null,
      queueSentAt: null,
      closed: false,
    };
    sockets.add(ws);
    activeClients.add(client);

    const timeout = setTimeout(() => {
      finish(() => reject(new Error(`${input.user.email} timed out connecting websocket`)), true);
    }, input.timeoutMs);

    const finish = (callback: () => void, closeSocket: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (
        closeSocket &&
        (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)
      ) {
        ws.close();
      }
      callback();
    };

    ws.addEventListener('open', () => {
      input.metrics.observe(
        input.matchId ? 'reconnect_open_ms' : 'connect_open_ms',
        nowMs() - startedAt,
      );
      finish(() => resolve(client), false);
    });

    ws.addEventListener('message', (event) => {
      const parsed = JSON.parse(String(event.data)) as ServerMessage;
      client.messages.push(parsed);
      if (parsed.type === 'match_found') {
        client.matchId = parsed.matchId ?? client.matchId;
        client.role = parsed.role ?? client.role;
      }
      if (parsed.type === 'game_started') {
        client.matchId = parsed.matchId ?? client.matchId;
        client.gameState = parsed.initialState ?? client.gameState;
      }
      if (
        parsed.type === 'game_state_updated' &&
        parsed.version !== undefined &&
        parsed.turn &&
        parsed.board &&
        parsed.hands
      ) {
        client.gameState = {
          version: parsed.version,
          turn: parsed.turn,
          board: parsed.board,
          hands: parsed.hands,
        };
      }
      if (parsed.type === 'error') {
        console.error(
          `${input.user.email} server error: ${parsed.code ?? ''} ${parsed.message ?? ''}`,
        );
      }
    });

    ws.addEventListener('error', (event) => {
      const message =
        event && typeof event === 'object' && 'message' in event
          ? String((event as { message?: unknown }).message ?? '')
          : '';
      finish(
        () =>
          reject(new Error(`${input.user.email} websocket error${message ? `: ${message}` : ''}`)),
        true,
      );
    });

    ws.addEventListener('close', (event) => {
      sockets.delete(ws);
      activeClients.delete(client);
      client.closed = true;
      if (!settled) {
        const details =
          event && typeof event === 'object'
            ? ` code=${(event as CloseEvent).code ?? 'unknown'} reason=${
                (event as CloseEvent).reason ?? ''
              }`
            : '';
        finish(
          () => reject(new Error(`${input.user.email} websocket closed before open${details}`)),
          false,
        );
      }
    });
  });
}

function sendJson(client: LoadClient, payload: unknown): boolean {
  if (client.ws.readyState !== WebSocket.OPEN) return false;
  client.ws.send(JSON.stringify(payload));
  return true;
}

function enterQueue(client: LoadClient): boolean {
  return sendJson(client, {
    action: 'enter_queue',
    requestId: createRequestId(),
    userId: client.user.userId,
    rating: client.user.ticket.user.rating,
    displayName: client.user.ticket.user.displayName,
    battleSetupId: client.user.battleSetupId,
  });
}

function cancelQueue(client: LoadClient): boolean {
  return sendJson(client, {
    action: 'cancel_queue',
    requestId: createRequestId(),
    userId: client.user.userId,
  });
}

function resign(client: LoadClient): boolean {
  if (!client.matchId) return false;
  return sendJson(client, {
    action: 'resign',
    requestId: createRequestId(),
    userId: client.user.userId,
    matchId: client.matchId,
  });
}

function signalBattleReady(client: LoadClient): boolean {
  if (!client.matchId) return false;
  return sendJson(client, {
    action: 'signal_battle_ready',
    requestId: createRequestId(),
    userId: client.user.userId,
    matchId: client.matchId,
  });
}

async function waitForMessage(
  client: LoadClient,
  type: string,
  timeoutMs: number,
  options?: { minVersion?: number; metrics?: LoadMetrics; metricName?: string; startedAt?: number },
): Promise<ServerMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    while (client.messageCursor < client.messages.length) {
      const message = client.messages[client.messageCursor];
      client.messageCursor += 1;
      if (
        message.type === type &&
        (options?.minVersion === undefined ||
          (typeof message.version === 'number' && message.version >= options.minVersion))
      ) {
        if (options?.metrics && options.metricName && options.startedAt !== undefined) {
          options.metrics.observe(options.metricName, nowMs() - options.startedAt);
        }
        return message;
      }
      if (message.type === 'error') {
        throw new Error(
          `${client.user.email} server error: ${message.code ?? ''} ${message.message ?? ''}`,
        );
      }
    }
    await sleep(25);
  }
  throw new Error(`${client.user.email} timed out waiting for ${type}`);
}

async function waitForAnyMessage(
  client: LoadClient,
  types: string[],
  timeoutMs: number,
  options?: { metrics?: LoadMetrics; metricName?: string; startedAt?: number },
): Promise<ServerMessage> {
  const accepted = new Set(types);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    while (client.messageCursor < client.messages.length) {
      const message = client.messages[client.messageCursor];
      client.messageCursor += 1;
      if (accepted.has(message.type)) {
        if (options?.metrics && options.metricName && options.startedAt !== undefined) {
          options.metrics.observe(options.metricName, nowMs() - options.startedAt);
        }
        return message;
      }
      if (message.type === 'error') {
        throw new Error(
          `${client.user.email} server error: ${message.code ?? ''} ${message.message ?? ''}`,
        );
      }
    }
    await sleep(25);
  }
  throw new Error(`${client.user.email} timed out waiting for ${types.join(' or ')}`);
}

async function connectWave(input: {
  users: TestUser[];
  wsUrl: string;
  startConcurrency: number;
  staggerMs: number;
  jitterMs: number;
  timeoutMs: number;
  wsRetryAttempts: number;
  wsRetryBaseDelayMs: number;
  wsRetryMaxDelayMs: number;
  metrics: LoadMetrics;
}): Promise<LoadClient[]> {
  return mapLimit(input.users, input.startConcurrency, async (user, userIndex) => {
    const delayMs = userIndex * input.staggerMs + Math.floor(Math.random() * (input.jitterMs + 1));
    await sleep(delayMs);
    let lastError: unknown;
    for (let attempt = 1; attempt <= input.wsRetryAttempts; attempt += 1) {
      try {
        return await connectClient({
          user,
          wsUrl: input.wsUrl,
          timeoutMs: input.timeoutMs,
          metrics: input.metrics,
        });
      } catch (error) {
        lastError = error;
        if (attempt >= input.wsRetryAttempts) break;
        const retryDelayMs = Math.min(
          input.wsRetryMaxDelayMs,
          input.wsRetryBaseDelayMs * 2 ** (attempt - 1),
        );
        const retryJitterMs = Math.floor(Math.random() * Math.min(1000, retryDelayMs));
        console.warn(
          `[load] ${user.email} websocket failed; retrying in ${retryDelayMs + retryJitterMs}ms (${attempt}/${input.wsRetryAttempts})`,
        );
        await sleep(retryDelayMs + retryJitterMs);
      }
    }
    throw lastError;
  });
}

async function enterQueueWave(input: {
  clients: LoadClient[];
  startConcurrency: number;
  staggerMs: number;
  jitterMs: number;
  timeoutMs: number;
  metrics: LoadMetrics;
}): Promise<void> {
  await mapLimit(input.clients, input.startConcurrency, async (client, clientIndex) => {
    const delayMs =
      clientIndex * input.staggerMs + Math.floor(Math.random() * (input.jitterMs + 1));
    await sleep(delayMs);
    const sentAt = nowMs();
    if (!enterQueue(client)) {
      throw new Error(`${client.user.email} websocket is not open for enter_queue`);
    }
    client.queueSentAt = sentAt;
    const message = await waitForAnyMessage(
      client,
      ['queue_entered', 'game_started'],
      input.timeoutMs,
      {
        metrics: input.metrics,
        metricName: 'queue_entered_ms',
        startedAt: sentAt,
      },
    );
    if (message.type === 'game_started') input.metrics.count('game_started_before_queue_entered');
  });
}

async function enterAndWaitStarted(input: {
  clients: LoadClient[];
  startConcurrency: number;
  staggerMs: number;
  jitterMs: number;
  timeoutMs: number;
  metrics: LoadMetrics;
}): Promise<void> {
  const startedAt = Date.now();
  await enterQueueWave(input);
  await Promise.all(
    input.clients.map((client) => {
      if (client.matchId && client.gameState) return Promise.resolve();
      return waitForMessage(client, 'game_started', input.timeoutMs, {
        metrics: input.metrics,
        metricName: 'queue_to_game_started_ms',
        startedAt: client.queueSentAt ?? nowMs(),
      });
    }),
  );
  const uniqueMatches = new Set(input.clients.map((client) => client.matchId).filter(Boolean));
  console.log(
    `[result] game_started users=${input.clients.length}/${input.clients.length} matches=${uniqueMatches.size} elapsedMs=${Date.now() - startedAt}`,
  );
}

async function runMatchmakingScenario(input: {
  clients: LoadClient[];
  startConcurrency: number;
  staggerMs: number;
  jitterMs: number;
  timeoutMs: number;
  metrics: LoadMetrics;
}): Promise<void> {
  await enterAndWaitStarted(input);
}

function clientsByMatch(clients: LoadClient[]): Array<{ black: LoadClient; white: LoadClient }> {
  const byMatch = new Map<string, LoadClient[]>();
  for (const client of clients) {
    if (!client.matchId) continue;
    const pair = byMatch.get(client.matchId) ?? [];
    pair.push(client);
    byMatch.set(client.matchId, pair);
  }

  return [...byMatch.values()].map((pair) => {
    const black = pair.find((client) => client.role === 'black');
    const white = pair.find((client) => client.role === 'white');
    if (!black || !white) {
      throw new Error(
        `match pair is incomplete: ${pair.map((client) => client.user.email).join(',')}`,
      );
    }
    return { black, white };
  });
}

async function playMatchMoves(input: {
  black: LoadClient;
  white: LoadClient;
  movesPerMatch: number;
  timeoutMs: number;
  metrics: LoadMetrics;
}): Promise<number> {
  let moves = 0;
  for (let index = 0; index < input.movesPerMatch; index += 1) {
    const state = input.black.gameState ?? input.white.gameState;
    if (!state) throw new Error(`missing game state for match ${input.black.matchId}`);

    const actor = state.turn === 'black' ? input.black : input.white;
    const opponent = state.turn === 'black' ? input.white : input.black;
    const move = pickForwardMove(state);
    if (!move) {
      input.metrics.count('gameplay_no_move');
      break;
    }

    const sentAt = nowMs();
    const expectedVersion = state.version + 1;
    const ok = sendJson(actor, {
      action: 'make_move',
      requestId: createRequestId(),
      userId: actor.user.userId,
      matchId: actor.matchId,
      expectedVersion: state.version,
      move,
    });
    if (!ok) throw new Error(`${actor.user.email} websocket is not open for make_move`);

    await Promise.all([
      waitForMessage(actor, 'game_state_updated', input.timeoutMs, {
        minVersion: expectedVersion,
        metrics: input.metrics,
        metricName: 'move_actor_ack_ms',
        startedAt: sentAt,
      }),
      waitForMessage(opponent, 'game_state_updated', input.timeoutMs, {
        minVersion: expectedVersion,
        metrics: input.metrics,
        metricName: 'move_opponent_broadcast_ms',
        startedAt: sentAt,
      }),
    ]);
    moves += 1;
  }
  return moves;
}

async function runGameplayScenario(input: {
  clients: LoadClient[];
  startConcurrency: number;
  staggerMs: number;
  jitterMs: number;
  timeoutMs: number;
  movesPerMatch: number;
  metrics: LoadMetrics;
}): Promise<void> {
  await enterAndWaitStarted(input);
  const readyStartedAt = nowMs();
  for (const client of input.clients) signalBattleReady(client);
  await Promise.all(
    input.clients.map((client) =>
      waitForMessage(client, 'battle_ready_ack', input.timeoutMs, {
        metrics: input.metrics,
        metricName: 'battle_ready_ack_ms',
        startedAt: readyStartedAt,
      }),
    ),
  );

  const pairs = clientsByMatch(input.clients);
  const startedAt = Date.now();
  const played = await Promise.all(
    pairs.map((pair) =>
      playMatchMoves({
        ...pair,
        movesPerMatch: input.movesPerMatch,
        timeoutMs: input.timeoutMs,
        metrics: input.metrics,
      }),
    ),
  );
  const totalMoves = played.reduce((sum, count) => sum + count, 0);
  input.metrics.count('moves_applied', totalMoves);
  console.log(`[result] move_acked moves=${totalMoves} elapsedMs=${Date.now() - startedAt}`);
}

async function runReconnectScenario(input: {
  clients: LoadClient[];
  wsUrl: string;
  startConcurrency: number;
  staggerMs: number;
  jitterMs: number;
  timeoutMs: number;
  metrics: LoadMetrics;
}): Promise<void> {
  await enterAndWaitStarted(input);
  const whiteClients = input.clients.filter((client) => client.role === 'white');
  const startedAt = Date.now();
  const reconnectStartedAt = nowMs();
  for (const client of whiteClients) {
    if (client.ws.readyState === WebSocket.OPEN) client.ws.close();
  }
  await sleep(500);
  const reconnected = await Promise.all(
    whiteClients.map((client) =>
      connectClient({
        user: client.user,
        wsUrl: input.wsUrl,
        timeoutMs: input.timeoutMs,
        matchId: client.matchId ?? undefined,
        metrics: input.metrics,
      }),
    ),
  );
  await Promise.all(
    reconnected.map((client) =>
      waitForMessage(client, 'game_state_updated', input.timeoutMs, {
        metrics: input.metrics,
        metricName: 'reconnect_resync_ms',
        startedAt: reconnectStartedAt,
      }),
    ),
  );
  console.log(
    `[result] reconnected users=${reconnected.length} elapsedMs=${Date.now() - startedAt}`,
  );
}

function closeClient(client: LoadClient): void {
  if (client.ws.readyState === WebSocket.OPEN || client.ws.readyState === WebSocket.CONNECTING) {
    client.ws.close();
  }
}

async function cleanup(admin: SupabaseScriptClient, keepUsers: boolean): Promise<void> {
  if (cleanupStarted) return;
  cleanupStarted = true;

  const resignedMatchIds = new Set<string>();
  for (const client of activeClients) {
    if (client.ws.readyState !== WebSocket.OPEN) continue;
    if (client.matchId) {
      if (resignedMatchIds.has(client.matchId)) continue;
      resignedMatchIds.add(client.matchId);
      resign(client);
    } else {
      cancelQueue(client);
    }
  }
  await sleep(500);
  for (const client of activeClients) closeClient(client);
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
  }
  activeClients.clear();
  sockets.clear();

  if (keepUsers) {
    console.log(`[cleanup] LOAD_MATCHING_KEEP_USERS=true, keeping ${createdUserIds.length} users`);
    return;
  }

  const ids = [...createdUserIds].reverse();
  console.log(`[cleanup] deleting ${ids.length} Supabase auth users`);
  await mapLimit(ids, 8, async (userId) => {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.error(`[cleanup] failed to delete ${userId}: ${error.message}`);
  });
  createdUserIds.splice(0, createdUserIds.length);
}

async function main(): Promise<void> {
  loadLocalEnv();

  const args = parseCliArgs();
  const scenario = parseScenario(cliEnv(args, 'scenario', 'LOAD_MATCHING_SCENARIO', 'matchmaking'));
  const userCount = cliInt(args, 'users', 'LOAD_MATCHING_USER_COUNT', 100);
  const prepareConcurrency = cliInt(
    args,
    'prepare-concurrency',
    'LOAD_MATCHING_PREPARE_CONCURRENCY',
    1,
  );
  const startConcurrencyDefault = scenario === 'spike' ? userCount : userCount;
  const startConcurrency = cliInt(
    args,
    'start-concurrency',
    'LOAD_MATCHING_START_CONCURRENCY',
    startConcurrencyDefault,
  );
  const staggerMsDefault = scenario === 'spike' ? 0 : 20;
  const staggerMs = cliInt(args, 'stagger-ms', 'LOAD_MATCHING_STAGGER_MS', staggerMsDefault);
  const jitterMsDefault = scenario === 'spike' ? 0 : 250;
  const jitterMs = cliInt(args, 'jitter-ms', 'LOAD_MATCHING_JITTER_MS', jitterMsDefault);
  const timeoutMs = cliInt(args, 'timeout-ms', 'LOAD_MATCHING_TIMEOUT_MS', 60_000);
  const durationSeconds = cliInt(args, 'duration-seconds', 'LOAD_MATCHING_DURATION_SECONDS', 300);
  const movesPerMatch = cliInt(args, 'moves-per-match', 'LOAD_MATCHING_MOVES_PER_MATCH', 4);
  const authRetryAttempts = cliInt(
    args,
    'auth-retry-attempts',
    'LOAD_MATCHING_AUTH_RETRY_ATTEMPTS',
    8,
  );
  const authRetryBaseDelayMs = cliInt(
    args,
    'auth-retry-base-delay-ms',
    'LOAD_MATCHING_AUTH_RETRY_BASE_DELAY_MS',
    2_000,
  );
  const authRetryMaxDelayMs = cliInt(
    args,
    'auth-retry-max-delay-ms',
    'LOAD_MATCHING_AUTH_RETRY_MAX_DELAY_MS',
    30_000,
  );
  const authStaggerMs = cliInt(args, 'auth-stagger-ms', 'LOAD_MATCHING_AUTH_STAGGER_MS', 100);
  const authJitterMs = cliInt(args, 'auth-jitter-ms', 'LOAD_MATCHING_AUTH_JITTER_MS', 250);
  const authBatchSize = cliInt(args, 'auth-batch-size', 'LOAD_MATCHING_AUTH_BATCH_SIZE', 0);
  const authBatchIntervalMs = cliInt(
    args,
    'auth-batch-interval-ms',
    'LOAD_MATCHING_AUTH_BATCH_INTERVAL_MS',
    60_000,
  );
  const wsRetryAttempts = cliInt(args, 'ws-retry-attempts', 'LOAD_MATCHING_WS_RETRY_ATTEMPTS', 3);
  const wsRetryBaseDelayMs = cliInt(
    args,
    'ws-retry-base-delay-ms',
    'LOAD_MATCHING_WS_RETRY_BASE_DELAY_MS',
    1_000,
  );
  const wsRetryMaxDelayMs = cliInt(
    args,
    'ws-retry-max-delay-ms',
    'LOAD_MATCHING_WS_RETRY_MAX_DELAY_MS',
    5_000,
  );
  const keepUsers = cliBool(args, 'keep-users', 'LOAD_MATCHING_KEEP_USERS', false);
  const runId = env(
    'LOAD_MATCHING_RUN_ID',
    new Date()
      .toISOString()
      .replace(/[^0-9]/g, '')
      .slice(0, 14),
  );
  const supabaseUrl = env('SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const apiBaseUrl = cliEnv(
    args,
    'api-base-url',
    'LOAD_MATCHING_API_BASE_URL',
    env('EXPO_PUBLIC_API_BASE_URL', 'http://localhost:3000'),
  );
  const wsUrl = cliEnv(
    args,
    'ws-url',
    'LOAD_MATCHING_WS_URL',
    env('EXPO_PUBLIC_MATCHING_SERVER_WS_URL', 'ws://localhost:3010/ws'),
  );
  if (userCount % 2 !== 0) {
    throw new Error('--users / LOAD_MATCHING_USER_COUNT must be even for matching load scenarios');
  }
  if (scenario === 'gameplay' && movesPerMatch < 1) {
    throw new Error('--moves-per-match / LOAD_MATCHING_MOVES_PER_MATCH must be at least 1');
  }
  if (authBatchSize > 0 && authBatchIntervalMs <= 0) {
    throw new Error(
      '--auth-batch-interval-ms / LOAD_MATCHING_AUTH_BATCH_INTERVAL_MS must be positive when auth batching is enabled',
    );
  }

  const metrics = createMetrics();

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stop = async (signal: string) => {
    console.log(`\n[signal] ${signal} received`);
    await cleanup(admin, keepUsers);
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', () => void stop('SIGINT'));
  process.once('SIGTERM', () => void stop('SIGTERM'));

  try {
    console.log(
      `[prepare] scenario=${scenario} users=${userCount} api=${apiBaseUrl} ws=${wsUrl} authBatchSize=${authBatchSize} authBatchInterval=${authBatchIntervalMs}ms authStagger=${authStaggerMs}ms authJitter=${authJitterMs}ms stagger=${staggerMs}ms jitter=${jitterMs}ms movesPerMatch=${movesPerMatch} runId=${runId}`,
    );
    const boardLayout = await loadStandardBoardLayout(admin);
    const prepareUsers = async (cycleRunId: string) => {
      const authScheduleStartedAtMs = Date.now();
      return mapLimit(
        Array.from({ length: userCount }, (_, index) => index + 1),
        prepareConcurrency,
        async (index) => {
          const user = await createPreparedUser({
            index,
            runId: cycleRunId,
            admin,
            supabaseUrl,
            anonKey,
            apiBaseUrl,
            boardLayout,
            authRetryAttempts,
            authRetryBaseDelayMs,
            authRetryMaxDelayMs,
            authStaggerMs,
            authJitterMs,
            authBatchSize,
            authBatchIntervalMs,
            authScheduleStartedAtMs,
          });
          if (index % 10 === 0 || index === userCount)
            console.log(`[prepare] ${index}/${userCount}`);
          return user;
        },
      );
    };

    const connectPreparedUsers = (users: TestUser[]) =>
      connectWave({
        users,
        wsUrl,
        startConcurrency,
        staggerMs,
        jitterMs,
        timeoutMs,
        wsRetryAttempts,
        wsRetryBaseDelayMs,
        wsRetryMaxDelayMs,
        metrics,
      });

    if (scenario === 'soak') {
      const stopAt = Date.now() + durationSeconds * 1000;
      let cycle = 0;
      while (Date.now() < stopAt) {
        cycle += 1;
        console.log(`[soak] cycle=${cycle}`);
        const users = await prepareUsers(`${runId}-${cycle}`);
        const clients = await connectPreparedUsers(users);
        await runMatchmakingScenario({
          clients,
          startConcurrency,
          staggerMs,
          jitterMs,
          timeoutMs,
          metrics,
        });
        await cleanup(admin, keepUsers);
        cleanupStarted = false;
      }
      metrics.print();
      return;
    }

    const users = await prepareUsers(runId);
    const clients = await connectPreparedUsers(users);
    if (scenario === 'matchmaking' || scenario === 'spike') {
      await runMatchmakingScenario({
        clients,
        startConcurrency,
        staggerMs,
        jitterMs,
        timeoutMs,
        metrics,
      });
    } else if (scenario === 'gameplay') {
      await runGameplayScenario({
        clients,
        startConcurrency,
        staggerMs,
        jitterMs,
        timeoutMs,
        movesPerMatch,
        metrics,
      });
    } else {
      await runReconnectScenario({
        clients,
        wsUrl,
        startConcurrency,
        staggerMs,
        jitterMs,
        timeoutMs,
        metrics,
      });
    }
    metrics.print();
  } finally {
    await cleanup(admin, keepUsers);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
