# CLAUDE.md

## What This Is

`expo-claude-auth` — an open-source npm package that handles Claude Code OAuth for React Native / Expo apps. Extracted from Grass, the mobile client for Claude Code.

One component, one import. Handles PKCE, WKWebView, Google SSO popup, token exchange, Keychain storage, and profile fetching.

## Architecture

**Single component API:** `<ClaudeAuth visible={...} onSuccess={...} onCancel={...} />`

Internally renders a native iOS page sheet (`Modal presentationStyle="pageSheet"`) with WKWebView. No Provider, no Context, no hook gymnastics.

**Also exports headless utilities** for advanced users who want to build their own UI or manage tokens server-side.

### File Structure

```
src/
  index.ts              # Public API surface (re-exports)
  useClaudeAuth.tsx     # <ClaudeAuth /> component + internal SheetHeader
  pkce.ts               # PKCE generation (S256)
  auth.ts               # buildAuthUrl, exchangeCodeForTokens, refreshAccessToken
  profile.ts            # fetchOAuthProfile (subscription type + rate limit tier)
  tokens.ts             # Keychain storage via expo-secure-store
  constants.ts          # Client ID, URLs, scopes, store keys
  types.ts              # TypeScript types
  injectedScripts.ts    # JS injected into WebViews (One Tap, cookie banner, window.opener)
```

### Key Technical Decisions

1. **Component over hook** — hooks can't render, and we need a Modal + WebView in the React tree. A `visible` prop is the simplest, most React Native-idiomatic pattern.

2. **Fresh PKCE every `visible=true`** — avoids stale code_verifier when user retries. No pre-generation needed.

3. **`@expo/vector-icons` is optional** — lock icon falls back to emoji if not installed. Listed in `peerDependenciesMeta` as optional.

4. **Sentry/analytics replaced with callbacks** — `config.onError(context, error, extra)` and `config.onEvent(name, properties)`. Users plug in their own.

5. **Store keys are namespaced** — `expo_claude_auth_*` to avoid collisions with app-level Keychain entries.

### Claude OAuth Quirks (why this package exists)

These are undocumented behaviors discovered through production testing:

- **Claude ignores `redirect_uri`** — always redirects to `platform.claude.com/oauth/code/callback`. We intercept via `onShouldStartLoadWithRequest`.
- **`window.opener` null since iOS 17.5** — WebKit bug breaks Google popup auth. We inject fake `window.opener` with postMessage bridge.
- **State must be ~43 chars** — base64url of 32 random bytes. Shorter = 400 error.
- **`onError` fires for sub-resources** — tracking pixels, iframes. Only main-frame errors should kill the flow.
- **Google One Tap iframe** — must hide via CSS injection *before* content loads (injectedJavaScriptBeforeContentLoaded).
- **Cookie consent banner** — auto-accepted via `[data-testid="consent-accept"]` click in MutationObserver.
- **Safari UA required** — Google blocks embedded WebView User-Agents. We spoof Safari.
- **`code=true` in authorize URL params** — matches Claude Code CLI format exactly.

### Testing

This package doesn't have automated tests (OAuth flows require real WebView interaction). Test manually:

1. `npx expo install expo-claude-auth` in a fresh Expo app
2. Render `<ClaudeAuth visible={true} ... />`
3. Verify: auth sheet opens, Google SSO works, tokens returned, Keychain populated

### Building

```bash
npm run build    # tsc → dist/
npm run clean    # rm -rf dist/
```

### Publishing

```bash
npm version patch  # or minor/major
npm publish
```

## Peer Dependencies

- `expo-crypto` — PKCE generation (getRandomBytesAsync, digestStringAsync)
- `expo-secure-store` — iOS Keychain token storage
- `react-native-webview` — WKWebView for OAuth flow
- `@expo/vector-icons` — optional, lock icon in sheet header

## Origin

Production-hardened over months of beta testing with 64+ users.
