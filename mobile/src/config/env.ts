/**
 * Mobile environment validation (issue #132).
 *
 * EXPO_PUBLIC_* variables are inlined at build time by the Expo bundler.
 * This module validates the required subset at startup and logs a concise,
 * actionable report when any are missing so contributors see exactly what to
 * set rather than a confusing runtime crash later.
 *
 * Call `validateMobileEnv()` near the top of App.tsx (before the first
 * render) so a misconfigured build surfaces the problem immediately.
 */

export interface MobileEnvIssue {
  key: string;
  message: string;
}

/**
 * Required EXPO_PUBLIC_* variables. These must be present (non-empty) for the
 * app to function. The description explains what breaks when each is missing.
 */
const REQUIRED_VARS: { key: string; description: string }[] = [
  {
    key: 'EXPO_PUBLIC_API_URL',
    description: 'Backend API base URL — all API calls will fail',
  },
  {
    key: 'EXPO_PUBLIC_STELLAR_NETWORK',
    description: 'Stellar network (testnet or public) — wallet operations will fail',
  },
];

/** Collect every missing or empty required variable. */
export function collectMobileEnvIssues(): MobileEnvIssue[] {
  const issues: MobileEnvIssue[] = [];

  for (const { key, description } of REQUIRED_VARS) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      issues.push({ key, message: description });
    }
  }

  return issues;
}

/**
 * Validate the mobile environment at startup.
 *
 * Logs a concise, actionable report to the console when required variables
 * are missing. Never throws — a boot-time throw in a React Native app shows
 * the red error screen, which is worse than a visible console warning.
 *
 * Returns `true` when the environment is valid, `false` when issues exist
 * (so callers can render a user-visible warning if desired).
 */
export function validateMobileEnv(): boolean {
  const issues = collectMobileEnvIssues();
  if (issues.length === 0) return true;

  const lines = issues.map((i) => `  - ${i.key}: ${i.message}`);
  const report =
    `[Amana] Missing required environment variables (${issues.length}):\n` +
    lines.join('\n') +
    '\n\nCopy mobile/.env.example → mobile/.env.local and fill in the values above.';

  // Use console.error so the message appears prominently in the Expo log.
  // eslint-disable-next-line no-console
  console.error(report);

  return false;
}
