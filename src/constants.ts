/** Claude Code CLI's OAuth client ID. */
export const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';

/** Claude OAuth authorization URL. */
export const CLAUDE_AUTH_URL = 'https://claude.ai/oauth/authorize';

/** Claude OAuth token exchange URL. */
export const CLAUDE_TOKEN_URL = 'https://platform.claude.com/v1/oauth/token';

/** Claude OAuth profile URL (subscription type + rate limit tier). */
export const CLAUDE_PROFILE_URL = 'https://api.anthropic.com/api/oauth/profile';

/**
 * Claude hardcodes redirect to this URL — ignores any redirect_uri you pass.
 * We intercept it in the WebView via onShouldStartLoadWithRequest.
 */
export const CLAUDE_REDIRECT_URI = 'https://platform.claude.com/oauth/code/callback';

/** Scopes matching Claude Code CLI desktop (verified from macOS Keychain). */
export const CLAUDE_SCOPES = 'user:profile user:inference user:sessions:claude_code user:mcp_servers';

/** SecureStore keys for token persistence. */
export const STORE_KEYS = {
  accessToken: 'expo_claude_auth_access_token',
  refreshToken: 'expo_claude_auth_refresh_token',
  tokenData: 'expo_claude_auth_token_data',
} as const;

/** Safari User-Agent to bypass Google's embedded WebView block. */
export const SAFARI_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
