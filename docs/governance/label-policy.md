# Issue Label Policy

This policy defines the labels used to triage issues in this repository. Every
issue should carry exactly one label from each of the **Type**, **Area**, and
**Priority** groups. **Security impact** and **Contributor experience** labels
are applied when they apply.

## Type (exactly one)

| Label | Use when |
|-------|----------|
| `type: bug` | Behavior differs from documented or expected behavior. |
| `type: feature` | New capability or user-facing behavior. |
| `type: docs` | Documentation-only change. |
| `type: chore` | Refactors, dependency updates, or tooling with no behavior change. |
| `type: governance` | Contributor process, policy, or repository-management work. |

## Area (exactly one)

| Label | Path scope |
|-------|------------|
| `area: contracts` | `contracts/` (Soroban `amana_escrow`) |
| `area: backend` | `backend/` |
| `area: frontend` | `frontend/` |
| `area: mobile` | `mobile/` |
| `area: infra` | `infra/`, `docker-compose.yml`, deployment and terraform |
| `area: ci` | `.github/workflows/`, CI scripts |
| `area: docs` | `docs/`, `README.md`, and other markdown outside `.github/` |
| `area: governance` | `.github/` policy files, CODEOWNERS, templates |

## Priority (exactly one)

| Label | Meaning |
|-------|---------|
| `priority: p0` | Funds at risk, security vulnerability, or main branch broken. Fix immediately. |
| `priority: p1` | Blocks a release or a documented user flow. |
| `priority: p2` | Important, scheduled in the current cycle. |
| `priority: p3` | Nice to have; take when capacity allows. |

## Security impact (optional)

- `security: high` — exploitable issue or a change to access control, key handling, or money math.
- `security: low` — hardening with no known exploit path.

Security reports must **not** be filed as public issues. Follow [SECURITY.md](../../SECURITY.md).

## Contributor experience (optional)

- `good first issue` — meets the [good-first-issue rubric](good-first-issue-rubric.md).
- `help wanted` — maintainers welcome outside contributions.
- `Stellar Wave` — issue belongs to the Stellar Wave program.

## Rules

1. Maintainers apply labels during triage. Contributors may suggest labels.
2. An issue missing a Type, Area, or Priority label is not considered triaged.
3. Do not create new labels in an ad hoc way. Propose a new label in an issue that links this policy and update this file in the same pull request.
4. Re-label an issue when its scope changes; do not leave stale area labels.

## Related

- [Good-first-issue rubric](good-first-issue-rubric.md)
- [Maintainer response SLA](maintainer-response-sla.md)
