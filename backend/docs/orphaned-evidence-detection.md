# Orphaned Evidence Detection

## Purpose

The `detect-orphaned-evidence` script identifies `TradeEvidence` rows whose
metadata exists in the database but cannot be resolved to usable content.

A record is **orphaned** when any of the following holds:

| Condition | Meaning |
|-----------|---------|
| `cid` is empty or whitespace | The CID was never written or was wiped. |
| `cid` fails CIDv0 / CIDv1 format check | The value stored is not a valid IPFS CID and cannot be fetched. |
| `tradeId` has no matching `Trade` row | The parent trade was deleted but the evidence row persisted (e.g. via raw SQL bypassing the CASCADE constraint). |

## Running locally

```bash
# From backend/
npx tsx scripts/detect-orphaned-evidence.ts

# Dry run (read-only, same as default — flag accepted for scripted pipelines)
npx tsx scripts/detect-orphaned-evidence.ts --dry-run

# JSON output (suitable for log aggregation / alerting)
npx tsx scripts/detect-orphaned-evidence.ts --json

# Do not exit non-zero when orphans are found (use in reporting-only mode)
npx tsx scripts/detect-orphaned-evidence.ts --no-fail-on-orphans

# Via npm scripts
pnpm detect:orphaned-evidence
pnpm detect:orphaned-evidence:json
```

Exit code 0 means no orphans. Exit code 1 means orphans were found (or a
database error occurred).

## Architecture

The core detection logic is in `src/utils/orphanedEvidence.ts`, which exports:

- `isValidCid(cid)` — format check for IPFS CIDs (CIDv0 and CIDv1 base32).
- `detectOrphanedEvidence(db)` — scans the database and returns a structured
  `OrphanScanResult`.
- `renderOrphanReport(result)` — formats the result as a human-readable string.

The CLI entry point (`scripts/detect-orphaned-evidence.ts`) imports from
`src/utils/orphanedEvidence.ts`, making the logic unit-testable without a real
database connection.

## Responding to orphans

When orphans are found:

1. **Invalid CID** — the file cannot be retrieved from IPFS. If the original
   upload is still available, re-upload it and update the `cid` column. If the
   file is lost, delete the row and notify the affected trade parties.

2. **Missing Trade row** — the parent record was removed. Verify whether the
   deletion was intentional. If so, delete the orphaned evidence rows. If the
   trade deletion was erroneous, restore the trade from a backup before cleaning
   up evidence.

> This script is **read-only** — it reports but does not modify or delete any
> records. Remediation requires a manual intervention or a separate migration
> script.

## CID validation rules

| Format | Pattern |
|--------|---------|
| CIDv0  | Starts with `Qm`, exactly 46 base58btc characters (no `0`, `O`, `I`, `l`). |
| CIDv1  | Starts with `bafy`, `bafk`, `bafz`, `bafyb`, or `bafkr`, followed by ≥50 base32 characters. |

The check is intentionally lightweight — it validates format only, not
multihash integrity or IPFS availability.
