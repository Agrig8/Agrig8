# Pull Request Review Ownership

This document defines who reviews changes to each part of the repository. The
ownership rules are encoded in [`.github/CODEOWNERS`](../../.github/CODEOWNERS).
When this document and CODEOWNERS disagree, update both in the same pull request.

## Ownership by path

| Path | Owner team | Extra review required |
|------|-----------|----------------------|
| `backend/` | backend maintainers | Admin routes need a second backend maintainer |
| `frontend/` | frontend maintainers | — |
| `mobile/` | mobile maintainers | — |
| `contracts/` | contract maintainers | Admin functions, storage layout, events (see below) |
| `contracts/amana_escrow/src/` | contract security | Required for any change to `src/` |
| `infra/`, `.github/` | infra maintainers | Workflow changes need a second infra maintainer |
| `docs/governance/`, `SECURITY.md` | governance maintainers | — |

## Review expectations by change type

### Contract (`contracts/`)

- Two approvals: one contract maintainer and one contract security reviewer.
- Changes to admin functions, storage layout, or events must complete the
  [security review checklist](../../contracts/amana_escrow/docs/security-review-checklist.md)
  and the [safe upgrade guide](../../contracts/amana_escrow/docs/safe-upgrade-guide.md).
- Money-math changes must be checked against the
  [money-math invariant catalog](../money-math-invariant-catalog.md).

### Security (`SECURITY.md`, auth, key handling, secrets)

- Two approvals, at least one from contract security or backend maintainers.
- Never discuss unpatched vulnerabilities in public review threads. Use the
  process in [SECURITY.md](../../SECURITY.md).

### Frontend, backend, mobile

- One approval from the owning team.
- Backend changes that touch admin routes, controllers, middleware, or services
  must include regression tests under `backend/src/__tests__/`.

### Infrastructure and CI (`infra/`, `.github/`)

- One approval from an infra maintainer. Workflow permission changes need two.
- Do not add secrets or credentials to workflow files.

### Cross-cutting changes

- A pull request that touches more than one owned path needs approval from every
  owning team it touches.
- The author may not approve their own pull request.

## Keeping ownership current

- When a team changes, update [`.github/CODEOWNERS`](../../.github/CODEOWNERS) through a pull request reviewed by governance maintainers.
- Review ownership each quarter. Remove paths that no longer exist.
- Response targets for reviews are defined in the [maintainer response SLA](maintainer-response-sla.md).

## Related

- [Issue label policy](label-policy.md)
- [Good-first-issue rubric](good-first-issue-rubric.md)
