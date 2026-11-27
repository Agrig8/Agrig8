# Audit Export Format (Issue #141)

`GET /trades/:id/history/export` returns the audit records for a trade in a
documented, machine-readable export format. Access rules match the trade
history endpoint (`GET /trades/:id/history`): the caller must be the buyer,
seller, dispute party, mediator (when a dispute exists), or an admin.

## Response shape

```json
{
  "format": "actor-action-target-timestamp",
  "tradeId": "trade-001",
  "entries": [
    {
      "actor": "GCBUYER0000000000000000000000000000000000000000000000000",
      "action": "CREATED",
      "target": "trade-001",
      "timestamp": "2026-03-01T10:00:00.000Z"
    },
    {
      "actor": "GCSELLER000000000000000000000000000000000000000000000000",
      "action": "COMPLETED",
      "target": "trade-001",
      "timestamp": "2026-03-03T10:00:00.000Z"
    }
  ]
}
```

## Entry fields

- `actor` — the address the audit event records as acting. For evidence records
  of already-expired PII this is `"redacted"` (same redaction rules as the
  history endpoint).
- `action` — the audit action: `CREATED`, `FUNDED`, `MANIFEST_SUBMITTED`,
  `EVIDENCE_SUBMITTED`, `VIDEO_SUBMITTED`, `DELIVERY_CONFIRMED`,
  `DISPUTE_INITIATED`, `RESOLVED`, `COMPLETED`.
- `target` — the audited target: the trade ID.
- `timestamp` — ISO 8601 timestamp of the action.

Entries are chronological, as in the history endpoint. No metadata is included
so the export format stays stable for downstream consumers.
