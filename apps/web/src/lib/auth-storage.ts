/**
 * Stockage local des tokens JWT.
 *
 * NOTE sécurité : localStorage est suffisant pour un MVP en dev. Pour la
 * prod, basculer sur des cookies httpOnly + SameSite=Strict (nécessite un
 * proxy ou un endpoint /auth/exchange côté backend pour passer les tokens
 * en cookie). À adresser avant d'aller en prod.
 */

const ACCESS_KEY = "agri_qodo_access_token";
const REFRESH_KEY = "agri_qodo_refresh_token";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export function getStoredTokens(): AuthTokens | null {
  if (typeof window === "undefined") return null;
  const accessToken = window.localStorage.getItem(ACCESS_KEY);
  const refreshToken = window.localStorage.getItem(REFRESH_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function setStoredTokens(tokens: AuthTokens): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

export function clearStoredTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}
