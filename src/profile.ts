import { CLAUDE_PROFILE_URL } from './constants';
import type { ClaudeProfile, ClaudeAuthConfig } from './types';

/**
 * Fetch the user's OAuth profile to get subscription type and rate limit tier.
 * Claude Code uses this to determine billing mode (subscription vs API credits).
 */
export async function fetchOAuthProfile(
  accessToken: string,
  config?: ClaudeAuthConfig,
): Promise<ClaudeProfile | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(CLAUDE_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) return null;
    const data = await response.json();

    const orgType = data?.organization?.organization_type;
    let subscriptionType: ClaudeProfile['subscriptionType'] = null;
    switch (orgType) {
      case 'claude_max': subscriptionType = 'max'; break;
      case 'claude_pro': subscriptionType = 'pro'; break;
      case 'claude_enterprise': subscriptionType = 'enterprise'; break;
      case 'claude_team': subscriptionType = 'team'; break;
    }

    return {
      subscriptionType,
      rateLimitTier: data?.organization?.rate_limit_tier ?? null,
    };
  } catch (err) {
    config?.onError?.('oauth_profile', err, {
      error_message: (err as Error)?.message,
      error_name: (err as Error)?.name,
    });
    return null;
  }
}
