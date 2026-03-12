// Component (main API)
export { ClaudeAuth } from './useClaudeAuth';
export type { ClaudeAuthProps, ClaudeAuthSuccessResult } from './useClaudeAuth';

// Core utilities (headless — for advanced use)
export { generatePKCE, generateState } from './pkce';
export { buildAuthUrl, exchangeCodeForTokens, refreshAccessToken } from './auth';
export { fetchOAuthProfile } from './profile';
export { saveTokens, getTokens, deleteTokens, isAuthenticated, getValidCredentials } from './tokens';

// Types
export type {
  ClaudeTokens,
  ClaudeProfile,
  ClaudeAuthConfig,
  ClaudeAuthResponse,
  PKCEPair,
} from './types';

// Constants (for custom implementations)
export {
  CLAUDE_CLIENT_ID,
  CLAUDE_AUTH_URL,
  CLAUDE_TOKEN_URL,
  CLAUDE_PROFILE_URL,
  CLAUDE_REDIRECT_URI,
  CLAUDE_SCOPES,
} from './constants';
