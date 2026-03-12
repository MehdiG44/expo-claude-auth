/**
 * Injected into the main Claude auth WebView.
 *
 * 1. Hides Google One Tap (#credential_picker_container) — it uses iframes that break our popup flow.
 *    Must run via injectedJavaScriptBeforeContentLoaded AND injectedJavaScript because
 *    One Tap can render before DOMContentLoaded. Style is appended to document.documentElement
 *    since document.head doesn't exist yet at injection time.
 *
 * 2. Auto-accepts Claude's cookie consent banner ([data-testid="consent-accept"]).
 */
export const MAIN_INJECTED_JS = `
  (function() {
    var css = '#credential_picker_container, iframe[src*="accounts.google.com/gsi"] { display: none !important; height: 0 !important; }';
    var style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    var obs = new MutationObserver(function() {
      var el = document.getElementById('credential_picker_container');
      if (el) { el.style.display = 'none'; el.remove(); }
      var cookie = document.querySelector('[data-testid="consent-accept"]');
      if (cookie) { cookie.click(); }
    });
    if (document.body) {
      obs.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        obs.observe(document.body, { childList: true, subtree: true });
      });
    }
  })();
  true;
`;

/**
 * Injected into the Google popup WebView.
 *
 * Fakes window.opener (null in WKWebView popups since iOS 17.5 — WebKit bug).
 * Google's auth code calls window.opener.postMessage() to send the auth result
 * back to the parent window. We intercept it and relay via ReactNativeWebView.postMessage.
 *
 * Also intercepts window.close() so the popup doesn't try to close itself (no-op in RN).
 */
export const POPUP_INJECTED_JS = `
  (function() {
    window.opener = {
      postMessage: function(msg, origin) {
        window.ReactNativeWebView.postMessage('OPENER_MSG: ' + JSON.stringify(msg));
      }
    };
    window.close = function() {
      window.ReactNativeWebView.postMessage('WINDOW_CLOSE');
    };
  })();
  true;
`;
