import { User } from "./queries/database";

export function computeAnalyticsConsent(user: typeof User): boolean | null {
  // User has never granted or denied consent
  if (
    user.analytics_consent_granted_at == null &&
    user.analytics_consent_revoked_at == null
  ) {
    return null;
  }

  if (user.analytics_consent_granted_at !== null) {
    // User has granted consent and never denied consent
    if (user.analytics_consent_revoked_at == null) {
      return true;
    }
    // User has granted consent at a later date than it was last denied
    if (user.analytics_consent_granted_at > user.analytics_consent_revoked_at) {
      return true;
    }
    // User has denied consent at a later date than it was last granted
    return false;
  }
  // user has never granted consent
  return false;
}
