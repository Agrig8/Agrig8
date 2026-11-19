# Changelog Automation

Release changelog entries are drafted from merged pull requests and reviewed by a maintainer before release.

## Running a draft

1. Go to **Actions → Changelog Draft → Run workflow**.
2. Enter `since` (`YYYY-MM-DD`), the first merge date to include, and an optional `version` label.
3. Download the `changelog-draft` artifact (`CHANGELOG_DRAFT.md`) and review it.

The workflow only reads PRs and uploads an artifact. It does not commit, tag, or publish anything.

## Labels

| Label | Section |
|-------|---------|
| `breaking` / `breaking-change` | Breaking Changes |
| `feature` / `enhancement` | Added |
| `bug` / `fix` | Fixed |
| `docs` / `documentation` | Documentation |
| `ci` / `infra` / `chore` | Infrastructure & CI |
| `skip-changelog` | Omitted (counted in the footer) |

A PR with several category labels goes into the first matching section above. PRs with no category label appear under **Needs Review**. Label them, or remove them from the release, before publishing.

## Local use

```bash
gh pr list --state merged --limit 500 --json number,title,url,labels > prs.json
node scripts/generate-changelog.mjs prs.json --version 1.2.0 --out CHANGELOG_DRAFT.md
```

Tests: `pnpm test:scripts`.
