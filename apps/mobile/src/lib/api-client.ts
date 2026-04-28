/**
 * Client HTTP mobile avec rotation automatique du refresh token.
 * Logique identique au client web — adaptée pour AsyncStorage (asynchrone)
 * au lieu de localStorage (synchrone).
 */
import {
  type AuthTokens,
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
} from "./auth-storage";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

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
  skipAuth?: boolean;
}

let refreshPromise: Promise<AuthTokens> | null = null;

async function doRefresh(refreshToken: string): Promise<AuthTokens> {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) throw new AuthError();
  const tokens = (await res.json()) as AuthTokens;
  await setStoredTokens(tokens);
  return tokens;
}

async function refreshTokens(): Promise<AuthTokens> {
  if (refreshPromise) return refreshPromise;
  const tokens = await getStoredTokens();
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
    const tokens = await getStoredTokens();
    if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
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
      await clearStoredTokens();
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
