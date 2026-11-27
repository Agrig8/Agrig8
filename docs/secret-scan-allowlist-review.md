# Secret Scan Allowlist Review Process

This document describes how allowlist entries in `.gitleaks.toml` are added, reviewed, and retired. Every entry must remain narrow and time-bounded — a broad or permanent allowlist defeats the purpose of secret scanning.

## Allowlist types

The repo uses three kinds of allowlist entries, each with different review requirements:

| Type | TOML key | When to use |
|---|---|---|
| Path-based | `paths` | Test fixtures and example files whose secrets are intentionally fake |
| Commit-based | `commits` | A specific historical commit that cannot be rewritten (e.g. pre-public history) |
| Regex-based | `regexes` | A known false-positive pattern that is structurally indistinguishable from a real secret |

## Adding an entry

1. Open a PR that **only** adds the gitleaks allowlist entry — do not bundle it with feature work.
2. In the PR description, fill out the allowlist justification template below.
3. The PR requires review from a maintainer with `CODEOWNER` access to `.gitleaks.toml`.
4. Add a `# review-by: YYYY-MM-DD` comment next to the entry, set to 90 days from today.

### Justification template

```
**Allowlist type**: path | commit | regex
**Entry added**: YYYY-MM-DD
**Review-by date**: YYYY-MM-DD (≤ 90 days)
**False-positive reason**: <why the scanner flags this in error>
**Scope justification**: <why this path/commit/pattern and not a broader one>
**Sensitive-data check**: <confirm no real secret is present in the matched content>
```

## Reviewing an entry

Every 90 days (or on a security-review rotation, whichever comes first), audit each entry:

1. Run `git log --follow -- <path>` for path entries to confirm the matched files are still test-only.
2. For commit entries, `git show <sha> | grep -E '<regex>'` to confirm no real secret was present.
3. For regex entries, run `gitleaks detect --config .gitleaks.toml --verbose` locally and confirm the suppressed findings are genuine false positives.
4. If the entry is still needed, update its `review-by` date and document why in a brief PR comment.
5. If the entry is no longer needed, remove it immediately.

## Retiring an entry

An entry **must** be removed if:

- The file or commit it covers no longer exists in the working tree.
- The false-positive pattern was fixed upstream (e.g. a dependency renamed its config key).
- The original author cannot confirm the entry was not covering a real secret.

Open a PR to remove the entry and reference this document as the removal justification.

## Current allowlist entries

See `.gitleaks.toml` for the authoritative list. Each entry has an inline `# review-by:` comment. Entries without a review date must be audited immediately.

### Existing entries (as of 2026-11-23)

| Entry | Type | Review-by | Status |
|---|---|---|---|
| `".env.*.example", "docs/", "*.md"` | path | Rolling — examples never contain real secrets | Active |
| `"backend/src/__tests__/**", "**/*.test.ts", "**/*.spec.ts"` | path | Rolling — test fixtures use fake keys | Active |
| `"backend/prisma/migrations/"` | path | Rolling — migration SQL contains no secrets | Active |
| `3c1383c9…`, `3f109294…` | commit | 2027-02-23 | Active — pre-CI commits with false-positive JWT format strings |
| `TEST_PUBLIC_KEY_FOR_MOCK`, `postgresql://localhost:5432/test` | regex | 2027-02-23 | Active — test literal that matches the DB URL pattern |

## CI enforcement

Gitleaks runs in CI on every push and pull request via `.github/workflows/secret-scan.yml`. A failing scan blocks merge. Allowlist entries take effect in CI automatically — no additional workflow changes are needed when adding an entry.
