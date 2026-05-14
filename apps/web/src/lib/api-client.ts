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

/**
 * Préfixe d'URL pour construire des URLs absolues (ex : `<img src=…>`
 * vers un endpoint qui sert du binaire). En relatif côté Vercel.
 */
export function getApiBaseUrl(): string {
  return API_URL;
}

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

/**
 * Extrait le message le plus utile d'une erreur API/JS pour l'afficher
 * à l'utilisateur. Prend en charge :
 *   - ApiError → body.message (NestJS BadRequestException) ; si tableau
 *     de messages class-validator, joint par "; ".
 *   - Error standard → err.message.
 *   - autres → null (laisse le caller mettre un fallback générique).
 */
export function extractApiErrorMessage(err: unknown): string | null {
  if (!err) return null;
  if (err instanceof ApiError) {
    const body = err.body as { message?: string | string[] } | null;
    if (body && body.message) {
      return Array.isArray(body.message) ? body.message.join(" · ") : body.message;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return null;
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

  // Pour FormData (upload multipart), on laisse le browser positionner
  // Content-Type avec son boundary — sinon le backend ne parse pas.
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const headers: Record<string, string> = {};
  if (!isFormData) headers["Content-Type"] = "application/json";

  if (!skipAuth) {
    const tokens = getStoredTokens();
    if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
    const activeTenantId = getActiveTenantId();
    if (activeTenantId) headers["X-Active-Tenant-Id"] = activeTenantId;
  }

  const url = `${API_URL}${path}`;
  const init: RequestInit = { method, headers };
  if (body != null) init.body = isFormData ? (body as FormData) : JSON.stringify(body);

  let res = await fetch(url, init);

  if (res.status === 401 && !skipAuth) {
    try {
      const newTokens = await refreshTokens();
      headers.Authorization = `Bearer ${newTokens.accessToken}`;
      res = await fetch(url, init);
      // Si la 2e tentative retourne aussi 401 → le refresh JWT est valide
      // mais le user/tenant n'existe plus en DB (ex: tenant purgé). On
      // force le logout pour éviter une boucle.
      if (res.status === 401) {
        clearStoredTokens();
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
          window.location.assign("/login");
        }
        throw new AuthError("Session invalide — tenant introuvable");
      }
    } catch (err) {
      if (err instanceof AuthError) throw err;
      clearStoredTokens();
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.assign("/login");
      }
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
