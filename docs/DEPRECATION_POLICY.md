# Deprecation Policy

This policy governs how APIs, events, and configuration are deprecated and removed.
It applies to the public REST API (`backend/src/routes/publicApi.router.ts`), contract
events (`docs/event-schema.md`), and environment/configuration keys (`docs/env-reference.md`).

Related: [API versioning](./api-versioning.md), [shared schemas](./shared-schemas.md).

## Deprecation Stages

Every deprecated surface moves through these stages, in order:

| Stage       | Meaning                                                                 | Required signal                                           |
|-------------|-------------------------------------------------------------------------|-----------------------------------------------------------|
| `active`    | Supported and recommended.                                              | None.                                                     |
| `deprecated`| Still works; a replacement exists and the surface will be removed.      | Documented replacement + `Deprecation` / `Sunset` headers for APIs, a log warning for config keys, a `deprecated` flag in the event schema. |
| `sunset`    | Still works, but the removal date is fixed and no longer extended.      | Same signals as `deprecated`, with the removal date stated. |
| `removed`   | No longer accepted. Requests or config produce a clear error.           | Entry in the release notes under "Removed".               |

A surface may not skip `deprecated`. Going straight from `active` to `removed` is not allowed.

## Notice Periods

- **Public API endpoints and response fields:** minimum **90 days** from the `deprecated` announcement to `removed`, and never removed within a minor API version.
- **Contract events:** minimum **one full release cycle** and a registry entry in `docs/event-schema.md`. Indexers must be able to consume both old and new shapes during the window.
- **Environment and configuration keys:** minimum **30 days**. The key must keep working, with a startup warning, until removal.
- **Security-driven removals:** may shorten these periods. The shortened period, the reason, and the approving reviewer must be recorded in the pull request.

## Removal Criteria

A surface may move to `removed` only when all of the following are true:

1. The notice period above has elapsed, measured from the first release that carried the `deprecated` signal.
2. The replacement is documented and shipped in the same or an earlier release.
3. Usage has been checked: API access logs or the event consumer list show no active production caller, or each remaining caller has been contacted and agreed to migrate.
4. The change is listed under "Removed" in the release notes, with the migration path.
5. Tests cover both the removal behavior (clear error, not silent acceptance) and the replacement path.

## Process

1. Open an issue labelled `deprecation` that names the surface, the replacement, and the target removal date.
2. Add the deprecation signal in a pull request. Update this policy's surface list if the surface type is new.
3. Record the stage change in the release notes.
4. Remove only in a later pull request that links the original issue and satisfies the removal criteria.

## Surface Register

Keep this table current. The test in `scripts/__tests__/deprecation-policy.test.mjs` checks that every row uses a valid stage.

| Surface | Type | Stage | Replacement | Removal date |
|---------|------|-------|-------------|--------------|
| _None currently deprecated_ | — | — | — | — |
