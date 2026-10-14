import type { AuthResponse, ErrorEnvelope } from './types';

/**
 * Typed client for the NestJS API. Every mutation goes through here, so the
 * API stays the single enforcement point (§3). The access token lives in
 * memory only; the refresh token is an httpOnly cookie the browser sends to
 * `/api/v1/auth/*` on its own.
 */

export const API_BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

type Listener = (token: string | null) => void;

let accessToken: string | null = null;
const listeners = new Set<Listener>();
let refreshing: Promise<AuthResponse | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  for (const l of listeners) l(token);
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function onAccessToken(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/**
 * Rotates the refresh cookie. Single-flight: concurrent 401s share one
 * refresh, because presenting a rotated token twice revokes the family (AC3).
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', credentials: 'same-origin' });
      if (!res.ok) {
        setAccessToken(null);
        return null;
      }
      const body = (await res.json()) as AuthResponse;
      setAccessToken(body.accessToken);
      return body;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Partial<ErrorEnvelope>;
    if (body.error) return new ApiError(res.status, body.error.code, body.error.message, body.error.details ?? {});
  } catch {
    // Non-JSON error body (proxy, crash) — fall through.
  }
  return new ApiError(res.status, 'unknown', res.statusText || 'Request failed');
}

export interface RequestOptions {
  /** JSON-encoded, unless a `FormData` (multipart upload; the browser sets the boundary). */
  body?: unknown;
  /** Skip the automatic refresh-and-retry on 401 (auth endpoints). */
  noRetry?: boolean;
  signal?: AbortSignal;
}

async function send(method: string, path: string, opts: RequestOptions): Promise<Response> {
  const form = opts.body instanceof FormData;
  const attempt = () =>
    fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'same-origin',
      signal: opts.signal,
      headers: {
        ...(opts.body !== undefined && !form ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: form ? (opts.body as FormData) : opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

  let res = await attempt();
  if (res.status === 401 && !opts.noRetry) {
    const session = await refreshSession();
    if (session) res = await attempt();
  }
  if (!res.ok) throw await toError(res);
  return res;
}

export async function request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(method, path, opts);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Saves an authenticated file response (e.g. `report.csv`). A plain link
 * cannot carry the in-memory bearer token, so fetch it and hand the browser a blob.
 */
export async function download(path: string, filename: string): Promise<void> {
  const blob = await (await send('GET', path, {})).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>('GET', path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  del: <T = void>(path: string) => request<T>('DELETE', path),
};

/** Human message for a failed request; never leaks a raw stack to the UI. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong.';
}
