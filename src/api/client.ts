import { Platform } from 'react-native';

import { getItem, setItem } from '@/lib/storage';
import type { ApiEnvelope, Paged, TokenPair } from './types';

export const REMOTE_API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://65-1-30-38.nip.io/api/v1';

// In the web dev server, go through the same-origin proxy in metro.config.js
// (the API doesn't allow browser CORS requests from localhost).
export const API_BASE_URL =
  Platform.OS === 'web' && __DEV__ ? '/__api/api/v1' : REMOTE_API_URL;

const ACCESS_KEY = 'cw.accessToken';
const REFRESH_KEY = 'cw.refreshToken';

export class ApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ---- token store -----------------------------------------------------------

let tokens: TokenPair | null = null;
let onSessionExpired: (() => void) | null = null;
let onPasswordChangeRequired: (() => void) | null = null;
let onCarWashBlocked: ((code: CarWashBlockedCode, message: string) => void) | null = null;

/** Why a signed-in user's car wash can't be used right now (see the API's CarWashNotActiveError). */
export type CarWashBlockedCode = 'CAR_WASH_PENDING' | 'CAR_WASH_SUSPENDED' | 'CAR_WASH_INACTIVE';

export function isCarWashBlockedCode(code: unknown): code is CarWashBlockedCode {
  return code === 'CAR_WASH_PENDING' || code === 'CAR_WASH_SUSPENDED' || code === 'CAR_WASH_INACTIVE';
}

export async function loadTokens(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([
    getItem(ACCESS_KEY),
    getItem(REFRESH_KEY),
  ]);
  tokens = accessToken && refreshToken ? { accessToken, refreshToken } : null;
  return tokens;
}

export async function saveTokens(next: TokenPair | null): Promise<void> {
  tokens = next;
  await Promise.all([
    setItem(ACCESS_KEY, next?.accessToken ?? null),
    setItem(REFRESH_KEY, next?.refreshToken ?? null),
  ]);
}

export function getRefreshToken(): string | null {
  return tokens?.refreshToken ?? null;
}

/** Called when a refresh fails, so the UI can drop back to the login screen. */
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

/** Called when the server says the user must change an admin-set password first. */
export function setPasswordChangeRequiredHandler(handler: (() => void) | null) {
  onPasswordChangeRequired = handler;
}

/** Called when the server says this user's car wash is pending, suspended or deactivated. */
export function setCarWashBlockedHandler(handler: ((code: CarWashBlockedCode, message: string) => void) | null) {
  onCarWashBlocked = handler;
}

// ---- refresh (single-flight: concurrent 401s share one refresh call) -------

type RefreshResult = 'ok' | 'rejected' | 'unavailable';
let refreshing: Promise<RefreshResult> | null = null;

async function refreshTokens(): Promise<RefreshResult> {
  const refreshToken = tokens?.refreshToken;
  if (!refreshToken) return 'rejected';
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (res.status === 403) {
      const err = (await res.json().catch(() => null))?.error;
      if (isCarWashBlockedCode(err?.code)) onCarWashBlocked?.(err.code, err.message);
      return 'rejected';
    }
    if (res.status === 400 || res.status === 401) return 'rejected';
    if (!res.ok) return 'unavailable';
    const body = (await res.json()) as ApiEnvelope<TokenPair>;
    await saveTokens({
      accessToken: body.data.accessToken,
      refreshToken: body.data.refreshToken,
    });
    return 'ok';
  } catch {
    return 'unavailable';
  }
}

function refreshOnce(): Promise<RefreshResult> {
  if (!refreshing) {
    refreshing = refreshTokens().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

// ---- data version ------------------------------------------------------------
// Bumped after every successful write so cached screens know to refetch.

let dataVersion = 0;
export const getDataVersion = () => dataVersion;

// ---- request ---------------------------------------------------------------

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

const NETWORK_MESSAGE = 'Could not reach the server. Check your connection.';
type Query = Record<string, string | number | undefined | null>;

type RequestOptions = {
  query?: Query;
  body?: unknown;
  auth?: boolean;
};

function buildUrl(path: string, query?: Query) {
  const params = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${API_BASE_URL}${path}${params ? `?${params}` : ''}`;
}

async function send(method: Method, path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.auth !== false && tokens?.accessToken) {
    headers.Authorization = `Bearer ${tokens.accessToken}`;
  }
  try {
    return await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', NETWORK_MESSAGE);
  }
}

async function parse<T>(res: Response, authenticated: boolean): Promise<ApiEnvelope<T>> {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON body
  }
  if (res.status === 429) {
    const wait = Number(res.headers.get('Retry-After'));
    const when = Number.isFinite(wait) && wait > 0 ? `in ${Math.max(1, Math.ceil(wait / 60))} min` : 'in a few minutes';
    throw new ApiError(429, 'RATE_LIMITED', `The server is busy (too many requests). Please try again ${when}.`);
  }
  if (body?.error?.code === 'PROXY_ERROR') {
    // The web dev proxy (metro.config.js) couldn't reach the API, e.g. DNS failure / offline.
    throw new ApiError(0, 'NETWORK_ERROR', NETWORK_MESSAGE);
  }
  if (res.status === 403 && body?.error?.code === 'PASSWORD_CHANGE_REQUIRED') {
    onPasswordChangeRequired?.();
  }
  // Mid-session (e.g. an admin suspended the car wash): sign out and say why.
  // A failed sign-in (auth: false) is handled by whoever called login.
  if (authenticated && res.status === 403 && isCarWashBlockedCode(body?.error?.code)) {
    await saveTokens(null);
    onCarWashBlocked?.(body.error.code, body.error.message);
  }
  if (!res.ok || body?.success === false) {
    const err = body?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'HTTP_ERROR',
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
    );
  }
  return body as ApiEnvelope<T>;
}

async function request<T>(method: Method, path: string, opts: RequestOptions = {}) {
  let res = await send(method, path, opts);
  if (res.status === 401 && opts.auth !== false && tokens?.refreshToken) {
    const result = await refreshOnce();
    if (result === 'ok') {
      res = await send(method, path, opts);
    } else if (result === 'rejected') {
      await saveTokens(null);
      onSessionExpired?.();
    }
    // 'unavailable' (rate-limited / offline): keep the session; the 401 surfaces as an error.
  }
  const body = await parse<T>(res, opts.auth !== false);
  if (method !== 'GET') dataVersion++;
  return body;
}

export const http = {
  async get<T>(path: string, query?: Query): Promise<T> {
    return (await request<T>('GET', path, { query })).data;
  },
  async list<T>(path: string, query?: Query): Promise<Paged<T>> {
    const body = await request<T[]>('GET', path, { query });
    return { items: body.data ?? [], pagination: body.pagination };
  },
  async post<T>(path: string, body?: unknown, opts?: { auth?: boolean }): Promise<T> {
    return (await request<T>('POST', path, { body: body ?? {}, auth: opts?.auth })).data;
  },
  async put<T>(path: string, body: unknown): Promise<T> {
    return (await request<T>('PUT', path, { body })).data;
  },
  async patch<T>(path: string, body: unknown): Promise<T> {
    return (await request<T>('PATCH', path, { body })).data;
  },
  async delete<T>(path: string): Promise<T> {
    return (await request<T>('DELETE', path)).data;
  },
};

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const details = e.details as any;
    // Validation errors may carry per-field messages
    if (Array.isArray(details) && details.length) {
      return details.map((d: any) => d?.message ?? String(d)).join('\n');
    }
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}
