/**
 * Frontend environment validation (issue #132).
 *
 * Called once at module load in instrumentation.ts. On any missing required
 * variable, logs a concise list to the console and (in production) throws so
 * the build surfaces the problem before any user sees a broken page.
 *
 * NEXT_PUBLIC_* variables are inlined at build time, so this check is
 * meaningful both locally and in CI where the .env.example values are the
 * source of truth.
 */

export interface FrontendEnvIssue {
  key: string;
  message: string;
}

/**
 * Required NEXT_PUBLIC_* variables and a brief description of what breaks
 * when each is missing.
 */
const REQUIRED_VARS: { key: string; description: string }[] = [
  {
    key: 'NEXT_PUBLIC_STELLAR_NETWORK',
    description: 'Stellar network (testnet or public) — wallet and contract calls will fail',
  },
  {
    key: 'NEXT_PUBLIC_API_URL',
    description: 'Backend API base URL — all API calls will fail',
  },
];

/** Collect every missing or empty required variable. */
export function collectFrontendEnvIssues(): FrontendEnvIssue[] {
  const issues: FrontendEnvIssue[] = [];

  for (const { key, description } of REQUIRED_VARS) {
    const value = process.env[key];
    if (!value || value.trim() === '') {
      issues.push({ key, message: description });
    }
  }

  return issues;
}

/**
 * Validate the frontend environment and log a concise, actionable report when
 * variables are missing.
 *
 * In production (`NODE_ENV === 'production'`) missing variables throw so the
 * deployment fails fast rather than serving a broken app. In development the
 * report is printed and execution continues.
 */
export function validateFrontendEnv(): void {
  const issues = collectFrontendEnvIssues();
  if (issues.length === 0) return;

  const lines = issues.map((i) => `  - ${i.key}: ${i.message}`);
  const report =
    `[Amana] Missing required environment variables (${issues.length}):\n` +
    lines.join('\n') +
    '\n\nCopy frontend/.env.example → frontend/.env.local and fill in the values above.';

  if (process.env.NODE_ENV === 'production') {
    throw new Error(report);
  } else {
    // eslint-disable-next-line no-console
    console.warn(report);
  }
}
