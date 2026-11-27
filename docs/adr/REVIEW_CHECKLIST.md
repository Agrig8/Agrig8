# ADR Review Checklist

Use this checklist when opening or reviewing an ADR. Start new ADRs from [TEMPLATE.md](./TEMPLATE.md).
`scripts/check-adr-sections.mjs` enforces the required section headings in CI-friendly form.

## Author

- [ ] The ADR starts from `TEMPLATE.md` and keeps every required section heading.
- [ ] Status is set (`Proposed` until accepted).
- [ ] Context states the problem without assuming the solution.
- [ ] At least two alternatives are listed, each with a rejection reason.
- [ ] Consequences include negative outcomes and follow-up work.
- [ ] Security Review names trust boundaries, secrets/PII, and authn/authz impact, or justifies "No security impact".
- [ ] Migration gives the ordering and verification steps, or justifies "None".
- [ ] Reversal describes a concrete rollback, including any data recovery.

## Reviewer

- [ ] The decision is consistent with existing ADRs in `docs/adr/`, or the ADR supersedes the one it conflicts with.
- [ ] Contract changes consider storage layout, event compatibility, and upgrade safety.
- [ ] Money-math invariants are preserved, or the ADR explains why they are not affected.
- [ ] The Reversal section is realistic: someone could execute it under incident pressure.
- [ ] Links in References resolve.

## Acceptance

- [ ] `node scripts/check-adr-sections.mjs docs/adr/<file>.md` exits 0.
- [ ] `pnpm test:scripts` passes.
