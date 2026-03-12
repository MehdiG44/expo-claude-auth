# expo-claude-auth

Claude Code OAuth for React Native. PKCE, WKWebView, Google SSO, token refresh — all the hard parts solved.

[![npm](https://img.shields.io/npm/v/expo-claude-auth)](https://www.npmjs.com/package/expo-claude-auth)
[![license](https://img.shields.io/npm/l/expo-claude-auth)](./LICENSE)
![platform](https://img.shields.io/badge/platform-iOS-lightgrey)

<!-- TODO: Add GIF of auth flow here -->

## Install

```bash
npx expo install expo-claude-auth expo-crypto expo-secure-store react-native-webview
```

## Quick Start

```tsx
import { useState, useEffect } from 'react';
import { Button, View, Text } from 'react-native';
import { ClaudeAuth } from 'expo-claude-auth';

export default function LoginScreen() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button onPress={() => setShowAuth(true)} title="Sign in with Claude" />

      <ClaudeAuth
        visible={showAuth}
        onSuccess={({ tokens, profile }) => {
          setShowAuth(false);
          console.log('Authenticated!', profile.subscriptionType);
          // tokens.accessToken, tokens.refreshToken, tokens.expiresAt
          // profile.subscriptionType: 'pro' | 'max' | 'team' | 'enterprise'
          // profile.rateLimitTier
        }}
        onCancel={() => setShowAuth(false)}
        onError={(error) => {
          setShowAuth(false);
          console.warn(error);
        }}
      />
    </View>
  );
}
```

That's it. The component handles PKCE generation, WKWebView auth, Google SSO popup, token exchange, Keychain storage, and profile fetching internally. It renders a native iOS page sheet — identical to SFSafariViewController.

## Why This Exists

Claude's OAuth has undocumented quirks that break mobile apps. We found them building [Grass](https://github.com/mehdig44/claude-code-mobile-saas) so you don't have to.

- **Claude ignores `redirect_uri`** — hardcodes redirect to `platform.claude.com`. Standard mobile OAuth patterns don't work.
- **`window.opener` is null in WKWebView popups (iOS 17.5+)** — Google SSO breaks silently.
- **State parameter must be exactly ~43 chars** — shorter values cause unexplained 400 errors.
- **Sub-resource errors kill the WebView** — tracking pixels fire `onError`, crashing the auth flow.
- **Google One Tap hijacks the flow** — its iframe interferes with the popup auth pattern.

This package handles all of them.

## Hard Problems Solved

### 1. Claude Ignores `redirect_uri`

Claude hardcodes its OAuth redirect to `https://platform.claude.com/oauth/code/callback`, regardless of what you pass. You can't use custom URL schemes or deep links.

**Solution:** We use a WKWebView and intercept the redirect via `onShouldStartLoadWithRequest` before the browser navigates. The auth code is extracted from the URL and exchanged programmatically.

### 2. `window.opener` Is Null in WKWebView Popups

Since iOS 17.5, a WebKit bug causes `window.opener` to be `null` in popup windows opened from WKWebView. Google's OAuth uses `window.opener.postMessage()` to send the auth result back — so it fails silently.

**Solution:** We inject JavaScript that fakes `window.opener` with a `postMessage` bridge to React Native. The auth result is relayed via `ReactNativeWebView.postMessage()` and re-dispatched as a `MessageEvent` with `origin: 'https://accounts.google.com'` in the main WebView.

### 3. State Parameter Length

Claude's server rejects state parameters shorter than ~43 characters with a 400 error. This is undocumented.

**Solution:** `generateState()` always produces a 43-character base64url string from 32 random bytes.

### 4. Sub-Resource Errors vs Main Frame Errors

WKWebView's `onError` fires for everything — tracking pixels, iframe failures, sub-resource loads. The default behavior kills your auth flow on a tracking pixel 404.

**Solution:** We check `isMainFrame` (whether the failed URL matches the auth URL) and only surface main-frame errors. Sub-resource failures are passed to `onError` callback for logging but don't interrupt the flow.

### 5. Google One Tap Interference

Google One Tap injects an iframe (`#credential_picker_container`) that interferes with the popup auth flow we need for Google SSO.

**Solution:** CSS injection hides it before content loads. A `MutationObserver` removes it if it appears after initial render. Must use `injectedJavaScriptBeforeContentLoaded` — `injectedJavaScript` alone is too late.

## API

### `<ClaudeAuth />`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `visible` | `boolean` | Yes | Show/hide the auth modal |
| `onSuccess` | `(result) => void` | Yes | Called with `{ tokens, profile }` on success. Tokens are already saved to Keychain. |
| `onCancel` | `() => void` | Yes | Called when user dismisses the sheet |
| `onError` | `(error: string) => void` | No | Called on auth errors |
| `config` | `ClaudeAuthConfig` | No | Override client ID, scopes, error/event callbacks |

### `ClaudeAuthConfig`

```typescript
{
  clientId?: string;    // Defaults to Claude Code CLI's client ID
  scopes?: string;      // Defaults to Claude Code CLI's scopes
  onError?: (context: string, error: unknown, extra?: Record<string, unknown>) => void;
  onEvent?: (name: string, properties?: Record<string, unknown>) => void;
}
```

### Success Result

```typescript
{
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scopes: string[];
    subscriptionType: 'pro' | 'max' | 'enterprise' | 'team' | null;
    rateLimitTier: string | null;
  };
  profile: {
    subscriptionType: 'pro' | 'max' | 'enterprise' | 'team' | null;
    rateLimitTier: string | null;
  };
}
```

### Headless Utilities

For advanced use cases (custom UI, server-side token management):

```typescript
import {
  generatePKCE,        // Generate PKCE code verifier + challenge
  generateState,       // Generate 43-char state parameter
  buildAuthUrl,        // Build the OAuth authorization URL
  exchangeCodeForTokens, // Exchange auth code for tokens
  refreshAccessToken,  // Refresh an expired access token
  fetchOAuthProfile,   // Get subscription type + rate limit tier
  saveTokens,          // Save tokens to Keychain
  getTokens,           // Read tokens from Keychain
  deleteTokens,        // Clear tokens from Keychain
  isAuthenticated,     // Check if tokens exist
  getValidCredentials, // Get tokens, auto-refreshing if near expiry
} from 'expo-claude-auth';
```

## Token Management

Tokens are automatically saved to the iOS Keychain via `expo-secure-store`. Use the headless utilities to manage them:

```typescript
import { getValidCredentials, deleteTokens, isAuthenticated } from 'expo-claude-auth';

// Get tokens (auto-refreshes if expiring within 1 hour)
const credentials = await getValidCredentials();
if (credentials) {
  // Use credentials.accessToken
}

// Check auth status
const authed = await isAuthenticated();

// Sign out
await deleteTokens();
```

## Known Limitations

- **iOS only.** Claude's OAuth quirks are WebKit/WKWebView-specific. Android support would require a different approach.
- **Stale PKCE on account switch.** If a user switches Claude accounts mid-flow, the first code exchange may fail. Tapping your sign-in button again works immediately (fresh PKCE).
- **Geo-restricted countries.** Claude doesn't render its login page in restricted regions. Nothing we can do about this.

## Important Note

> Claude OAuth tokens are intended for use with Claude Code (the official CLI). This package authenticates users for Claude Code environments. Using OAuth tokens to call the Claude API directly from third-party applications may violate Anthropic's [Terms of Service](https://www.anthropic.com/legal/consumer-terms). For direct API access, use [API key authentication](https://docs.anthropic.com/en/api/getting-started) instead.

## License

MIT

---

Built by the team behind [Grass](https://github.com/mehdig44/claude-code-mobile-saas) — the mobile client for Claude Code.
