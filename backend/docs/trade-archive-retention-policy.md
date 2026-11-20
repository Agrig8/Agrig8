# Trade Archive Retention Policy (Issue #144)

Defines when terminal trade records move to archive storage, without breaking
audit or dispute access.

## When a trade is archivable

A trade is archivable when **all** of the following hold:

1. Its status is terminal: `COMPLETED`, `DISPUTED`, `CANCELLED`, or `EXPIRED`.
   Non-terminal trades (`PENDING_SIGNATURE`, `CREATED`, `FUNDED`, `DELIVERED`)
   are never archivable — they are still in the active lifecycle.
2. Its terminal timestamp (e.g. `completedAt` for `COMPLETED`; `createdAt` as
   fallback for terminal statuses without a canonical timestamp) is at least
   the retention window in the past.
3. It has **no open dispute** — `DISPUTED` trades with an unresolved dispute
   are excluded; archiving defers until the dispute resolves.

Archiving must not break audit or dispute access:

- Audit records stay readable via the trade audit endpoints
  (`GET /trades/:id/history` and the new `GET /trades/:id/history/export`).
- Disputes remain accessible: archiving defers while a dispute is open, so the
  mediator/parties can still see the trade via dispute-related endpoints.

The policy itself defines "when"; implementing the actual move to archive
storage is out of scope for this quick fix.

## Retention window

- Configurable via the `TRADE_ARCHIVE_RETENTION_DAYS` environment variable
  (default **730 days**, ≈ 2 years).
- See `backend/src/lib/tradeArchivePolicy.ts` for `isTradeArchivable(trade, now)`
  and the terminal status list.
