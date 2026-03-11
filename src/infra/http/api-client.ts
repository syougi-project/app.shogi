export type ApiError = {
  code: string;
  message: string;
};

type ApiEnvelope<T> = { ok: true; data: T } | { ok: false; error: ApiError };

export class ApiClientError extends Error {
  readonly code: string;
  readonly status?: number;

  constructor(error: ApiError, status?: number) {
    super(error.message);
    this.name = 'ApiClientError';
    this.code = error.code;
    this.status = status;
  }
}

let hasLoggedApiBase = false;

function baseUrl() {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  const normalized = raw.replace(/\/+$/, '');
  if (!hasLoggedApiBase) {
    hasLoggedApiBase = true;
    console.log('[api-client] EXPO_PUBLIC_API_BASE_URL =', normalized);
  }
  return normalized;
}

function buildInvalidJsonMessage(rawText: string, status: number, url: string): string {
  const trimmed = rawText.trim();
  const isHtml = trimmed.startsWith('<');
  const preview = trimmed.slice(0, 120).replace(/\s+/g, ' ');
  if (isHtml) {
    return `Expected JSON but received HTML (status: ${status}) from ${url}. Check EXPO_PUBLIC_API_BASE_URL and API route.`;
  }
  return `Expected JSON response (status: ${status}) from ${url}. Preview: ${preview}`;
}

async function parseEnvelope<T>(response: Response, url: string): Promise<T> {
  const rawText = await response.text();
  let json: ApiEnvelope<T> | null = null;

  if (rawText.length > 0) {
    try {
      json = JSON.parse(rawText) as ApiEnvelope<T>;
    } catch {
      json = null;
    }
  }

  if (!json) {
    throw new ApiClientError(
      {
        code: 'INVALID_JSON_RESPONSE',
        message: buildInvalidJsonMessage(rawText, response.status, url),
      },
      response.status,
    );
  }

  if (!response.ok) {
    if ('ok' in json && json.ok === false) {
      throw new ApiClientError(json.error, response.status);
    }
    throw new ApiClientError(
      { code: 'HTTP_ERROR', message: `HTTP ${response.status}` },
      response.status,
    );
  }

  if ('ok' in json && json.ok === true) {
    return json.data;
  }

  if ('ok' in json && json.ok === false) {
    throw new ApiClientError(json.error, response.status);
  }

  throw new ApiClientError(
    { code: 'INVALID_RESPONSE', message: 'Unexpected API response' },
    response.status,
  );
}

type RequestOptions = {
  token?: string;
};

function authHeaders(token?: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getJson<T>(path: string, opts?: RequestOptions): Promise<T> {
  const url = `${baseUrl()}${path}`;
  console.log('[api-client] GET', url);
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', ...authHeaders(opts?.token) },
  });

  return parseEnvelope<T>(response, url);
}

export async function postJson<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  const url = `${baseUrl()}${path}`;
  console.log('[api-client] POST', url);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders(opts?.token),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return parseEnvelope<T>(response, url);
}

export async function putJson<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
  const url = `${baseUrl()}${path}`;
  console.log('[api-client] PUT', url);
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...authHeaders(opts?.token),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return parseEnvelope<T>(response, url);
}

export async function deleteJson<T>(path: string, opts?: RequestOptions): Promise<T> {
  const url = `${baseUrl()}${path}`;
  console.log('[api-client] DELETE', url);
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Accept: 'application/json', ...authHeaders(opts?.token) },
  });

  return parseEnvelope<T>(response, url);
}
