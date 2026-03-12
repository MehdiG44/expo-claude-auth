import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { generatePKCE, generateState } from './pkce';
import { buildAuthUrl, exchangeCodeForTokens } from './auth';
import { saveTokens } from './tokens';
import { SAFARI_USER_AGENT } from './constants';
import { MAIN_INJECTED_JS, POPUP_INJECTED_JS } from './injectedScripts';
import type { ClaudeAuthConfig, ClaudeTokens, ClaudeProfile, PKCEPair } from './types';

// Optional: use Ionicons if @expo/vector-icons is installed
let LockIcon: React.ComponentType<{ size: number; color: string; style?: any }> | null = null;
try {
  const icons = require('@expo/vector-icons');
  if (icons.Ionicons) {
    LockIcon = (props: any) => {
      const Ionicons = icons.Ionicons;
      return <Ionicons name="lock-closed" {...props} />;
    };
  }
} catch {
  LockIcon = null;
}

// --- Public API ---

export interface ClaudeAuthSuccessResult {
  tokens: ClaudeTokens;
  profile: ClaudeProfile;
}

export interface ClaudeAuthProps {
  /** Show the auth modal. Set to true when your sign-in button is pressed. */
  visible: boolean;
  /** Called with tokens + profile after successful authentication. Tokens are already saved to Keychain. */
  onSuccess: (result: ClaudeAuthSuccessResult) => void;
  /** Called when user dismisses the auth sheet. */
  onCancel: () => void;
  /** Called on auth errors. */
  onError?: (error: string) => void;
  /** Optional config overrides. */
  config?: ClaudeAuthConfig;
}

/**
 * Claude Code OAuth component. Drop it anywhere in your tree.
 *
 * Renders a native iOS page sheet with a WKWebView when `visible` is true.
 * Handles PKCE, Google SSO popup, token exchange, and Keychain storage internally.
 *
 * ```tsx
 * const [showAuth, setShowAuth] = useState(false);
 *
 * <Button onPress={() => setShowAuth(true)} title="Sign in with Claude" />
 *
 * <ClaudeAuth
 *   visible={showAuth}
 *   onSuccess={({ tokens, profile }) => {
 *     setShowAuth(false);
 *     console.log(tokens.accessToken, profile.subscriptionType);
 *   }}
 *   onCancel={() => setShowAuth(false)}
 *   onError={(err) => console.warn(err)}
 * />
 * ```
 */
export function ClaudeAuth({ visible, onSuccess, onCancel, onError, config }: ClaudeAuthProps) {
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [currentDomain, setCurrentDomain] = useState('claude.ai');
  const [popupUrl, setPopupUrl] = useState<string | null>(null);

  const pkceRef = useRef<PKCEPair | null>(null);
  const stateRef = useRef<string | null>(null);
  const codeExchangedRef = useRef(false);
  const webviewRef = useRef<WebView | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  // Generate fresh PKCE + auth URL every time visible becomes true
  useEffect(() => {
    if (!visible) {
      setAuthUrl(null);
      setPopupUrl(null);
      return;
    }

    (async () => {
      try {
        const pkce = await generatePKCE();
        pkceRef.current = pkce;
        const state = await generateState();
        stateRef.current = state;
        codeExchangedRef.current = false;
        const url = buildAuthUrl(pkce.codeChallenge, state, configRef.current);
        setAuthUrl(url);
        configRef.current?.onEvent?.('claude_auth_started');
      } catch (err) {
        configRef.current?.onError?.('pkce_setup', err);
        onError?.('Could not start authentication.');
      }
    })();
  }, [visible]);

  const handleExchange = useCallback(async (code: string) => {
    if (codeExchangedRef.current) return;
    codeExchangedRef.current = true;

    try {
      const tokens = await exchangeCodeForTokens(
        code,
        pkceRef.current!.codeVerifier,
        stateRef.current!,
        configRef.current,
      );
      await saveTokens(tokens, configRef.current);
      configRef.current?.onEvent?.('claude_auth_completed');
      onSuccess({
        tokens,
        profile: {
          subscriptionType: tokens.subscriptionType,
          rateLimitTier: tokens.rateLimitTier,
        },
      });
    } catch (err) {
      codeExchangedRef.current = false;
      configRef.current?.onError?.('token_exchange', err);
      const errStr = String((err as Error)?.message || err);
      const isInvalidGrant = /invalid_grant|Invalid ['"]?code/i.test(errStr);
      onError?.(
        isInvalidGrant
          ? 'The code may have expired. Please try again.'
          : 'Failed to complete authentication. Please try again.',
      );
    }
  }, [onSuccess, onError]);

  const handleCodeCapture = useCallback((url: string) => {
    if (codeExchangedRef.current) return;
    try {
      const parsed = new URL(url);
      const code = parsed.searchParams.get('code');
      if (code) {
        configRef.current?.onEvent?.('claude_auth_code_captured', { code_length: code.length });
        handleExchange(code);
      }
    } catch (err) {
      configRef.current?.onError?.('code_capture', err, { url: url?.slice(0, 200) });
    }
  }, [handleExchange]);

  const handleGoogleAuthComplete = useCallback((authResultJson: string) => {
    setTimeout(() => {
      webviewRef.current?.injectJavaScript(`
        (function() {
          try {
            var msg = JSON.parse(${JSON.stringify(authResultJson)});
            var evt = new MessageEvent('message', {
              data: msg,
              origin: 'https://accounts.google.com',
              source: null
            });
            window.dispatchEvent(evt);
          } catch(e) {}
        })();
        true;
      `);
    }, 500);
  }, []);

  const handleCancel = useCallback(() => {
    configRef.current?.onEvent?.('claude_auth_cancelled');
    setPopupUrl(null);
    onCancel();
  }, [onCancel]);

  if (!visible || !authUrl) return null;

  return (
    <Modal
      animationType="slide"
      presentationStyle="pageSheet"
      visible={true}
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={styles.sheetContainer}>
        <SheetHeader domain={currentDomain} onCancel={handleCancel} />

        <WebView
          ref={webviewRef}
          source={{ uri: authUrl }}
          style={{ flex: 1, backgroundColor: '#fff' }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          javaScriptCanOpenWindowsAutomatically={true}
          userAgent={SAFARI_USER_AGENT}
          injectedJavaScriptBeforeContentLoaded={MAIN_INJECTED_JS}
          injectedJavaScript={MAIN_INJECTED_JS}
          onOpenWindow={(syntheticEvent: any) => {
            const targetUrl = syntheticEvent.nativeEvent.targetUrl;
            if (targetUrl) {
              configRef.current?.onEvent?.('claude_auth_google_popup_opened');
              setPopupUrl(targetUrl);
            }
          }}
          onShouldStartLoadWithRequest={(req: any) => {
            if (req.url.includes('oauth/code/callback?code=')) {
              handleCodeCapture(req.url);
            }
            return true;
          }}
          onNavigationStateChange={(navState: any) => {
            if (navState.url.includes('oauth/code/callback?code=')) {
              handleCodeCapture(navState.url);
            }
            try { setCurrentDomain(new URL(navState.url).hostname); } catch {}
            if (!codeExchangedRef.current && navState.url.startsWith('https://claude.ai/new')) {
              handleCancel();
            }
          }}
          onError={(e: any) => {
            const { description, url: failedUrl, domain } = e.nativeEvent;
            const isMainFrame = !failedUrl || failedUrl === authUrl;
            configRef.current?.onError?.('webview_error', new Error(description || 'unknown'), {
              failed_url: failedUrl, main_url: authUrl, domain, is_main_frame: isMainFrame,
            });
            if (isMainFrame) {
              onError?.('Could not load Claude. Please try again.');
            }
          }}
          onHttpError={(e: any) => {
            const { statusCode, url: errorUrl } = e.nativeEvent;
            if (statusCode >= 400 && errorUrl?.includes('claude.ai/oauth')) {
              configRef.current?.onError?.('webview_http_error', new Error(`HTTP ${statusCode}`), {
                url: errorUrl, statusCode,
              });
              onError?.('Could not load Claude. Please try again.');
            }
          }}
        />

        {/* Google SSO popup — nested page sheet */}
        {popupUrl && (
          <Modal
            animationType="slide"
            presentationStyle="pageSheet"
            visible={true}
            onRequestClose={() => setPopupUrl(null)}
          >
            <SafeAreaView style={styles.sheetContainer}>
              <SheetHeader domain="accounts.google.com" onCancel={() => setPopupUrl(null)} />
              <WebView
                source={{ uri: popupUrl }}
                style={{ flex: 1, backgroundColor: '#fff' }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                userAgent={SAFARI_USER_AGENT}
                injectedJavaScriptBeforeContentLoaded={POPUP_INJECTED_JS}
                injectedJavaScript={POPUP_INJECTED_JS}
                onMessage={(event: any) => {
                  const data = event.nativeEvent.data;
                  if (data.startsWith('OPENER_MSG:')) {
                    const msgJson = data.substring('OPENER_MSG:'.length).trim();
                    configRef.current?.onEvent?.('claude_auth_google_popup_completed');
                    setPopupUrl(null);
                    setTimeout(() => handleGoogleAuthComplete(msgJson), 500);
                  }
                  if (data === 'WINDOW_CLOSE') {
                    setPopupUrl(null);
                  }
                }}
                onError={() => setPopupUrl(null)}
              />
            </SafeAreaView>
          </Modal>
        )}
      </SafeAreaView>
    </Modal>
  );
}

// --- Internal: native iOS sheet header ---

function SheetHeader({ domain, onCancel }: { domain: string; onCancel: () => void }) {
  return (
    <View style={styles.sheetHeader}>
      <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.sheetCancel}>Cancel</Text>
      </TouchableOpacity>
      <View style={styles.sheetUrlBar}>
        {LockIcon ? (
          <LockIcon size={12} color="#48484a" style={{ marginRight: 4 }} />
        ) : (
          <Text style={{ fontSize: 10, marginRight: 4, color: '#48484a' }}>🔒</Text>
        )}
        <Text style={styles.sheetDomain} numberOfLines={1}>{domain}</Text>
      </View>
      <View style={{ minWidth: 60 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheetContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f2f2f7',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#c6c6c8',
  },
  sheetCancel: {
    fontSize: 17,
    color: '#007aff',
    minWidth: 60,
  },
  sheetUrlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginHorizontal: 8,
  },
  sheetDomain: {
    fontSize: 13,
    color: '#48484a',
    fontWeight: '500',
  },
});
