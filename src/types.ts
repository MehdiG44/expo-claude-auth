/** Tokens returned from a successful Claude OAuth flow. */
export interface ClaudeTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
  subscriptionType: 'pro' | 'max' | 'enterprise' | 'team' | null;
  rateLimitTier: string | null;
}

/** Profile data fetched from Claude's OAuth profile endpoint. */
export interface ClaudeProfile {
  subscriptionType: ClaudeTokens['subscriptionType'];
  rateLimitTier: string | null;
}

/** PKCE challenge pair for OAuth. */
export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

/** Configuration for the auth flow. All fields optional — defaults to Claude Code CLI values. */
export interface ClaudeAuthConfig {
  /** OAuth client ID. Defaults to Claude Code CLI's client ID. */
  clientId?: string;
  /** OAuth scopes. Defaults to Claude Code CLI's scopes. */
  scopes?: string;
  /** Error callback. Called with (context, error, extra) for every caught error. Plug in Sentry, Bugsnag, console, etc. */
  onError?: (context: string, error: unknown, extra?: Record<string, unknown>) => void;
  /** Event callback. Called with (name, properties) for auth flow events. Plug in your analytics. */
  onEvent?: (name: string, properties?: Record<string, unknown>) => void;
}

/** Response from the useClaudeAuth hook after promptAsync() resolves. */
export type ClaudeAuthResponse =
  | { type: 'success'; tokens: ClaudeTokens; profile: ClaudeProfile }
  | { type: 'error'; error: string }
  | { type: 'cancel' }
  | null;
