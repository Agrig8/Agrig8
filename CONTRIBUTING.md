# Contribution Welcome Guide

Thanks for helping improve innov8! This guide shows first-time contributors
where to start, how to pick a path that matches your skills, and what a good
pull request looks like here.

Please also read the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Choose a First-Contribution Path

| Path | Good first tasks | Start here |
| --- | --- | --- |
| Documentation | Fix broken links, clarify setup steps, add examples | [`docs/`](./docs) and [`README.md`](./README.md) |
| Tests | Add missing unit cases for helpers and services | [`backend/src/__tests__`](./backend/src/__tests__) |
| UI (frontend) | Small component fixes, accessibility, copy | [`frontend/src`](./frontend/src) |
| Backend | Validation, metrics helpers, read-only endpoints | [`backend/src`](./backend/src) and [`backend/docs`](./backend/docs) |
| Mobile | Responsive layout and screen tests | [`mobile`](./mobile) |
| Contracts | Docs, test coverage, error-code references | [`contracts`](./contracts) and [`docs/contract-error-codes.md`](./docs/contract-error-codes.md) |

Contract changes carry extra review requirements (storage layout, event
compatibility, upgrade safety, and money-math invariants). Start with
documentation or tests in that area before changing contract logic.

## Set Up Locally

1. Fork the repository and clone your fork.
2. Install dependencies for the area you are working on (for example
   `cd backend && npm install`).
3. Copy environment examples only where documented. Never commit real
   secrets; see [`docs/secrets-policy.md`](./docs/secrets-policy.md).
4. Run the tests for your area before you open a pull request.

## Find an Issue

- Look for issues labelled as good first issues or contributor roadmap tasks.
- Comment on the issue to say you are working on it, so others do not
  duplicate the effort.
- If the scope is unclear, ask a question on the issue before writing code.

## Make Your Change

- Keep each pull request focused on one issue.
- Follow the patterns in nearby code and tests rather than introducing new ones.
- Add or update tests for any new behaviour.
- Update documentation when behaviour, configuration, or setup changes.
- Do not include secrets, private keys, wallet addresses, or personal data in
  code, fixtures, logs, or analytics payloads.

## Commit and Open a Pull Request

1. Create a branch, for example `docs/contributing-guide`.
2. Make small, descriptive commits.
3. Run `git diff --check` and the relevant test suite.
4. Open a pull request against `main` and fill in the
   [pull request template](./.github/pull_request_template.md).
5. Link the issue with `Closes #<issue-number>` in the description.

## Review Process

- A maintainer reviews within a few business days.
- Expect requests for changes. They are part of the normal process, not a
  rejection.
- Continuous integration must pass before a pull request is merged.

## Getting Help

If you are stuck, comment on your issue or pull request and describe what you
tried. For security problems, do not open a public issue; follow
[SECURITY.md](./SECURITY.md).
