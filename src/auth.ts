import {
  CLAUDE_CLIENT_ID,
  CLAUDE_AUTH_URL,
  CLAUDE_TOKEN_URL,
  CLAUDE_REDIRECT_URI,
  CLAUDE_SCOPES,
} from './constants';
import { fetchOAuthProfile } from './profile';
import type { ClaudeTokens, ClaudeAuthConfig } from './types';

/**
 * Build the authorization URL for Claude OAuth.
 * Opens this in a WebView to start the PKCE flow.
 */
export function buildAuthUrl(
  codeChallenge: string,
  state: string,
  config?: ClaudeAuthConfig,
): string {
  const params = new URLSearchParams({
    code: 'true',
    client_id: config?.clientId ?? CLAUDE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: CLAUDE_REDIRECT_URI,
    scope: config?.scopes ?? CLAUDE_SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });
  return `${CLAUDE_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for tokens.
 * Also fetches the user's subscription profile.
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string,
  state: string,
  config?: ClaudeAuthConfig,
): Promise<ClaudeTokens> {
  const payload = {
    grant_type: 'authorization_code',
    code,
    redirect_uri: CLAUDE_REDIRECT_URI,
    client_id: config?.clientId ?? CLAUDE_CLIENT_ID,
    code_verifier: codeVerifier,
    state,
  };

  const response = await fetch(CLAUDE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const expiresAt = Date.now() + data.expires_in * 1000;

  const profile = await fetchOAuthProfile(data.access_token, config);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    scopes: (data.scope || (config?.scopes ?? CLAUDE_SCOPES)).split(' '),
    subscriptionType: profile?.subscriptionType ?? null,
    rateLimitTier: profile?.rateLimitTier ?? null,
  };
}

/** Refresh an expired access token. */
export async function refreshAccessToken(
  refreshToken: string,
  config?: ClaudeAuthConfig,
): Promise<ClaudeTokens> {
  const response = await fetch(CLAUDE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: config?.clientId ?? CLAUDE_CLIENT_ID,
      refresh_token: refreshToken,
      // scope intentionally omitted — Claude's token endpoint rejects it with invalid_scope.
      // Per OAuth spec, omitting scope preserves the originally granted scopes.
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token refresh failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const expiresAt = Date.now() + data.expires_in * 1000;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt,
    scopes: (data.scope || (config?.scopes ?? CLAUDE_SCOPES)).split(' '),
    subscriptionType: null,
    rateLimitTier: null,
  };
}
