'use client';

// Potcha Ops — client API wrapper (relative paths only).
// Auth: session cookie (httpOnly) where the browser allows it, plus an
// Authorization: Bearer <token> fallback for browsers that block third-party
// cookies entirely (iOS Safari ITP inside cross-site iframes). The token is
// the same opaque session token the server issues on login/register; only
// its SHA-256 hash is stored server-side and it is revoked on logout.

export class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = 'potcha_session_token';

export function saveSessionToken(token: string) {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
}

export function clearSessionToken() {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
}

function bearerToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function authHeaders(hasBody: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (hasBody) headers['Content-Type'] = 'application/json';
  const token = bearerToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export async function api<T>(
  path: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? 'GET',
    headers: authHeaders(opts.body !== undefined),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  let data: unknown = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    if (res.status === 401) {
      // Session rejected (expired or revoked, e.g. demo reset) — drop any
      // stale bearer token and tell the app to fall back to the login
      // screen instead of silently rendering stale cached data.
      clearSessionToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('potcha:unauthorized'));
      }
    }
    const msg = (data as { error?: string }).error ?? `Request failed (${res.status})`;
    throw new ApiClientError(msg, res.status);
  }
  return data as T;
}

/** Triggers a browser download for CSV exports (cookie + bearer auth). */
export async function downloadFile(path: string, fallbackName: string) {
  const res = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: authHeaders(false),
  });
  if (!res.ok) {
    if (res.status === 401) clearSessionToken();
    let msg = `Export failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch { /* not json */ }
    throw new ApiClientError(msg, res.status);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const cd = res.headers.get('content-disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(cd);
  a.href = url;
  a.download = match?.[1] ?? fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
