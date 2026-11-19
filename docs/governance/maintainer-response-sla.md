# Maintainer Response SLA

These targets describe how quickly maintainers respond to contributor activity.
They are goals for business days (Monday to Friday, UTC), not guarantees.

## Response targets

| Activity | First response | Next action |
|----------|---------------|-------------|
| New issue | 3 business days (triage: label, area, priority) | Acceptance or request for more detail |
| New pull request | 3 business days (first review or status comment) | Full review within 5 business days |
| Follow-up on a pull request | 2 business days | Review of the updated diff |
| Security report (via [SECURITY.md](../../SECURITY.md)) | 1 business day acknowledgement | Triage within 3 business days; fix plan communicated |
| Pull request with no activity from the author | Stale label after 14 days; closed after 30 days of silence | — |
| Mentor question on a `good first issue` | 2 business days | — |

## Stale handling

- A pull request with no commits or comments for 14 days receives a `stale` label and a comment asking for an update.
- A `stale` pull request with no response for a further 16 days may be closed. The author may reopen it at any time.
- Security reports are never closed as stale.

## Escalation

If a target is missed, any contributor may comment with `@`-mention of the
on-call maintainer listed in the [review ownership](pr-review-ownership.md) document.
Missed security targets are escalated to the repository owner the same day.

## Measurement

- Maintainers review response times in the monthly review logged in
  [slo-review-log.md](../slo-review-log.md).
- Targets are revised only through a pull request that edits this file.
