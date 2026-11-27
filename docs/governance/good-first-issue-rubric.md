# Good-First-Issue Rubric

A `good first issue` label tells newcomers an issue is safe to start without deep
context. An issue qualifies only when **all** of the following hold.

## Required criteria

1. **Bounded scope** — the change touches one module or one document, and the
   expected diff is small (guideline: under 150 changed lines).
2. **Clear acceptance criteria** — the issue lists checkable outcomes, not open
   questions about product direction.
3. **Testable** — a unit, integration, or documentation check can confirm the
   change. The issue names the command to run.
4. **Mentor available** — a maintainer is named in the issue and commits to
   answering questions within the [response SLA](maintainer-response-sla.md).
5. **No security-sensitive surface** — the issue does not touch access control,
   key handling, contract admin functions, or money math. Those need experienced
   reviewers.
6. **Existing pattern to copy** — the issue points to a nearby implementation or
   test a newcomer can follow.

## Disqualifiers

- Requires a contract upgrade, storage-layout change, or new event schema.
- Requires access to staging secrets or private infrastructure.
- Spans more than two areas (see [label policy](label-policy.md)).
- Is a bug with no reproduction steps.

## Process

1. Triage: a maintainer checks the issue against the rubric before adding the label.
2. Audit: a maintainer re-checks open `good first issue` labels each release. Labels that fail the rubric are removed.
3. Claiming: a contributor comments to claim the issue. Claims expire after 7 days without a linked draft pull request.
4. Review: pull requests for these issues follow the normal [review ownership](pr-review-ownership.md) rules.

## Issue template checklist

- [ ] Summary is one or two sentences.
- [ ] Acceptance criteria are listed as checkboxes.
- [ ] Validation command is given.
- [ ] Mentor is named.
- [ ] Starting file or test is linked.
