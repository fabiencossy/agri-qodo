/**
 * Client HTTP avec rotation automatique du refresh token.
 *
 * Comportement :
 *   - Joint le `Authorization: Bearer <accessToken>` sur chaque requête authentifiée.
 *   - Sur 401 : tente un refresh une fois, puis rejoue la requête.
 *   - Si le refresh échoue → vide les tokens et throw `AuthError` (à
 *     intercepter pour redirect vers /login).
 */
import { getActiveTenantId } from "./active-tenant";
import {
  type AuthTokens,
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
} from "./auth-storage";

// En prod (Vercel) : NEXT_PUBLIC_API_URL est vide, les requêtes partent en
// relatif (`/api/...`) et next.config.ts proxie vers le backend Railway.
// En dev local : pointe directement sur le backend Nest sur localhost:3001.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export class AuthError extends Error {
  constructor(message = "Authentification expirée") {
    super(message);
    this.name = "AuthError";
  }
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `HTTP ${status}`);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Si true, n'attache pas le Bearer (login, refresh). */
  skipAuth?: boolean;
}

let refreshPromise: Promise<AuthTokens> | null = null;

async function doRefresh(refreshToken: string): Promise<AuthTokens> {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    throw new AuthError();
  }
  const tokens = (await res.json()) as AuthTokens;
  setStoredTokens(tokens);
  return tokens;
}

async function refreshTokens(): Promise<AuthTokens> {
  // Single-flight : si plusieurs requêtes 401 arrivent en parallèle, on
  // ne refresh qu'une seule fois.
  if (refreshPromise) return refreshPromise;
  const tokens = getStoredTokens();
  if (!tokens) throw new AuthError();
  refreshPromise = doRefresh(tokens.refreshToken).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, skipAuth = false } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!skipAuth) {
    const tokens = getStoredTokens();
    if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
    const activeTenantId = getActiveTenantId();
    if (activeTenantId) headers["X-Active-Tenant-Id"] = activeTenantId;
  }

  const url = `${API_URL}${path}`;
  const init: RequestInit = { method, headers };
  if (body != null) init.body = JSON.stringify(body);

  let res = await fetch(url, init);

  if (res.status === 401 && !skipAuth) {
    try {
      const newTokens = await refreshTokens();
      headers.Authorization = `Bearer ${newTokens.accessToken}`;
      res = await fetch(url, init);
    } catch {
      clearStoredTokens();
      throw new AuthError();
    }
  }

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as unknown;
    throw new ApiError(res.status, errorBody);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
