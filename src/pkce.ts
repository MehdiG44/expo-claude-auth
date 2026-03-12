import * as Crypto from 'expo-crypto';

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Generate a PKCE code verifier + challenge (S256). */
export async function generatePKCE() {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  const codeVerifier = base64UrlEncode(randomBytes);
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 },
  );
  const codeChallenge = digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { codeVerifier, codeChallenge };
}

/**
 * Generate a random state parameter.
 * Must be ~43 chars (base64url of 32 random bytes) — Claude's server rejects shorter values with a 400.
 */
export async function generateState(): Promise<string> {
  const randomBytes = await Crypto.getRandomBytesAsync(32);
  return base64UrlEncode(randomBytes);
}
