# OpenAPI ↔ Frontend Types Drift Check

## Purpose

The drift check script (`scripts/check-openapi-types-drift.mjs`) detects when
the hand-maintained frontend API types in `frontend/src/lib/api/types.ts` have
diverged from the OpenAPI contract in `backend/src/docs/openapi.json`.

Drift is defined as:

- A required field declared in an OpenAPI component schema is absent from the
  corresponding TypeScript interface.
- An enum field's set of allowed values differs between the OpenAPI spec and the
  TypeScript union literal.

## Running locally

```bash
# From the repository root
node scripts/check-openapi-types-drift.mjs

# With verbose output (shows each schema checked)
node scripts/check-openapi-types-drift.mjs --verbose

# Via npm script
pnpm check:openapi-types-drift
```

Exit code 0 means no drift. Exit code 1 means drift was detected and the
output describes the specific mismatches.

## CI integration

The check runs automatically in the **Frontend Required Gate** CI job whenever
either `frontend/**` or `backend/**` files change. It is placed after the build
and test steps so it only runs when those gates have already passed.

## Schema map

The script compares a curated set of schemas. Add new entries to `SCHEMA_MAP`
in `scripts/check-openapi-types-drift.mjs` when you introduce a new API
response type that has a hand-maintained frontend counterpart:

```js
const SCHEMA_MAP = {
  // OpenAPI schema name  →  TypeScript interface name
  AuthChallengeResponse: "ChallengeResponse",
  TradeSummary: "TradeResponse",
  // ...
};
```

Schemas marked `additionalProperties: true` with no concrete required fields or
properties are skipped automatically; they carry no structural contract to enforce.

## Fixing drift

When the check fails:

1. If the **backend changed** (new field added to a route): add or update the
   corresponding field in `frontend/src/lib/api/types.ts`.
2. If the **frontend added a type** that is not yet in the spec: update
   `backend/src/docs/openapi.json` to reflect the actual shape, or remove the
   stale field from the TypeScript interface.
3. For **enum drift**: ensure both sides agree on the full set of values. Use
   the OpenAPI spec as the source of truth — the backend enforces these values
   at runtime.
