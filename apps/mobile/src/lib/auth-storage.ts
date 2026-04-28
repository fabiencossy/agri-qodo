/**
 * Stockage des tokens JWT côté mobile.
 *
 * MVP : AsyncStorage (compatible Expo Go).
 * Avant prod : basculer sur expo-secure-store (Keychain iOS / Keystore
 * Android) — ne marche pas dans Expo Go, exige un dev client / build natif.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_KEY = "agri_qodo_access_token";
const REFRESH_KEY = "agri_qodo_refresh_token";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export async function getStoredTokens(): Promise<AuthTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    AsyncStorage.getItem(ACCESS_KEY),
    AsyncStorage.getItem(REFRESH_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function setStoredTokens(tokens: AuthTokens): Promise<void> {
  await Promise.all([
    AsyncStorage.setItem(ACCESS_KEY, tokens.accessToken),
    AsyncStorage.setItem(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function clearStoredTokens(): Promise<void> {
  await Promise.all([AsyncStorage.removeItem(ACCESS_KEY), AsyncStorage.removeItem(REFRESH_KEY)]);
}
