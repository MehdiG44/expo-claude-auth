import * as SecureStore from 'expo-secure-store';
import { STORE_KEYS } from './constants';
import { refreshAccessToken } from './auth';
import type { ClaudeTokens, ClaudeAuthConfig } from './types';

/** Save tokens to the iOS Keychain via expo-secure-store. */
export async function saveTokens(tokens: ClaudeTokens, config?: ClaudeAuthConfig): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORE_KEYS.accessToken, tokens.accessToken);
    await SecureStore.setItemAsync(STORE_KEYS.refreshToken, tokens.refreshToken);
    await SecureStore.setItemAsync(STORE_KEYS.tokenData, JSON.stringify({
      expiresAt: tokens.expiresAt,
      scopes: tokens.scopes,
      subscriptionType: tokens.subscriptionType ?? null,
      rateLimitTier: tokens.rateLimitTier ?? null,
    }));
  } catch (err) {
    config?.onError?.('keychain_save', err);
    throw err;
  }
}

/** Read tokens from the Keychain. Returns null if not stored. */
export async function getTokens(config?: ClaudeAuthConfig): Promise<ClaudeTokens | null> {
  try {
    const accessToken = await SecureStore.getItemAsync(STORE_KEYS.accessToken);
    const refreshToken = await SecureStore.getItemAsync(STORE_KEYS.refreshToken);
    const dataStr = await SecureStore.getItemAsync(STORE_KEYS.tokenData);

    if (!accessToken || !refreshToken || !dataStr) return null;

    const data = JSON.parse(dataStr);
    return {
      accessToken,
      refreshToken,
      expiresAt: data.expiresAt,
      scopes: data.scopes,
      subscriptionType: data.subscriptionType ?? null,
      rateLimitTier: data.rateLimitTier ?? null,
    };
  } catch (err) {
    config?.onError?.('keychain_read', err);
    return null;
  }
}

/** Delete all stored tokens from the Keychain. */
export async function deleteTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEYS.accessToken);
  await SecureStore.deleteItemAsync(STORE_KEYS.refreshToken);
  await SecureStore.deleteItemAsync(STORE_KEYS.tokenData);
}

/** Check if Claude tokens exist in the Keychain. */
export async function isAuthenticated(config?: ClaudeAuthConfig): Promise<boolean> {
  const tokens = await getTokens(config);
  return tokens !== null;
}

/**
 * Get valid credentials, auto-refreshing if the token expires within 1 hour.
 * Returns null if refresh fails (caller should re-auth).
 */
export async function getValidCredentials(config?: ClaudeAuthConfig): Promise<ClaudeTokens | null> {
  const tokens = await getTokens(config);
  if (!tokens) return null;

  const expiresAt = Number(tokens.expiresAt);
  const oneHourFromNow = Date.now() + 60 * 60 * 1000;

  if (expiresAt > oneHourFromNow) {
    return tokens;
  }

  try {
    const refreshed = await refreshAccessToken(tokens.refreshToken, config);
    // Preserve subscription info from original tokens since refresh doesn't re-fetch profile
    refreshed.subscriptionType = tokens.subscriptionType;
    refreshed.rateLimitTier = tokens.rateLimitTier;
    await saveTokens(refreshed, config);
    return refreshed;
  } catch (err) {
    config?.onError?.('token_refresh', err);
    await deleteTokens();
    return null;
  }
}
