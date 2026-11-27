# Trade State Machine Recovery

This document describes how missed events and partial on-chain/off-chain state
updates are reconciled safely (issue #84).

---

## Overview

A trade in Amana moves through states that live in two places simultaneously:

| Layer | Source of truth |
|---|---|
| On-chain | Soroban contract — `TradeStatus` enum (`Created`, `Funded`, `Disputed`, …) |
| Off-chain | Backend database — `Trade.status` column mirroring the contract state |

A crash, network partition, or RPC timeout can leave these two out of sync.
Recovery ensures the database eventually reflects on-chain reality without
creating duplicate side-effects.

---

## State Transition Map

```
Created
  │  buyer deposits
  ▼
Funded
  │  delivery confirmed (buyer)       buyer initiates dispute
  ▼                                   ▼
Completed                          Disputed
                                      │  mediator rules
                                      ▼
                                   Resolved ──► Completed
                                              └► Cancelled
```

A trade may also reach `Cancelled` from `Created` (buyer cancels pre-funding)
or from `Funded` via `tryCancel` after expiry or clawback.

---

## Failure Scenarios and Recovery Steps

### 1. Backend processed the on-chain event but crashed before writing to the DB

**Symptom:** On-chain status is `Funded`; DB status is still `Created`.

**Detection:** `dailyReconciliation.service.ts` polls Soroban for the live
status of every non-terminal trade and flags mismatches.

**Recovery:**
1. The reconciliation job calls `contract.service.ts:reconcileTradeStatus()`.
2. It reads the current on-chain status and applies the missing transition
   (e.g. `Created → Funded`) to the DB without re-triggering side-effects
   (notifications, webhooks) that already fired, using `skipNotifications: true`.
3. The reconciliation audit trail records actor = `system/reconciliation`,
   action = `RECONCILE_TRADE`, targetReference = `tradeId`, and a note
   explaining the skipped-to status.

### 2. On-chain transaction confirmed but the event listener missed the event

**Symptom:** Backend event listener was restarting during the ledger that
carried the confirmation; DB still shows the previous status.

**Detection:** Same reconciliation job as above. Additionally,
`heartbeat-wrapper.ts` publishes a liveness ping; a gap in pings alerts on-call.

**Recovery:** Same as scenario 1.  Reconciliation is idempotent — running it
twice on an already-synced trade is a no-op because the on-chain and DB
statuses already match.

### 3. Partial on-chain write — transaction submitted but timed out before confirmation

**Symptom:** Backend submitted a settle/cancel transaction; RPC timed out
before it could confirm; DB may or may not have been updated.

**Detection:** `withRpcRetry` logs the RPC timeout with `traceId`. On retry,
the XDR is re-submitted with the same sequence number — Stellar deduplicates
it at the protocol level (same hash, same sequence → already applied or
expired).

**Recovery:**
1. `retryAsync` retries with exponential back-off.
2. If all retries are exhausted, the job moves to the dead-letter queue
   (`deadLetter.ts`). The DLQ replay runbook (see below) covers re-enqueuing.
3. After successful re-submission, the event listener picks up the confirmation
   and the reconciliation job catches any DB lag.

### 4. Disputed trade left unresolved after mediator timeout

**Symptom:** Trade is `Disputed` on-chain but no `resolve_dispute` transaction
has landed after the mediator deadline.

**Detection:** `tradeExpiryWorker` checks all disputed trades against their
`expires_at` / `dispute_deadline` timestamps.

**Recovery:**
1. The expiry worker triggers `tryCancel()` as the fallback, which moves the
   trade to `Cancelled` and returns funds to the buyer.
2. If `tryCancel` fails, the job moves to the DLQ with full context.

---

## DLQ Replay Runbook

When a job ends up in the dead-letter queue:

1. Check the alert: `GET /api/admin/dlq/<queueName>` returns current depth and
   job list.
2. Inspect the failed job:
   ```
   GET /api/admin/dlq/<queueName>?page=1&limit=10
   ```
   Identify `errorClass` and `errorMessage`.
3. Decide whether to replay:
   - **Transient** errors (RPC timeout, network blip): replay is safe.
   - **Permanent** errors (bad contract state, missing trade): investigate the
     root cause before replaying — replaying a permanent error re-fails
     immediately and re-DLQs the job.
4. Replay a specific job:
   ```
   POST /api/admin/dlq/<queueName>/<jobId>/replay
   ```
   This action is audited: `action = DLQ_REPLAY`, `actorAddress` = your wallet,
   `targetReference = <queueName>/<jobId>`.
5. Monitor the queue depth after replay. If it rises again, the error is likely
   permanent — stop replaying and open a hotfix incident.

---

## Invariants the Recovery Layer Must Never Violate

1. **No double-spend.** A `release_funds` or `resolve_dispute` transaction
   must never be submitted twice for the same trade. Idempotency is enforced by
   checking the on-chain status before submitting.
2. **No silent money loss.** If a reconciliation pass cannot determine the
   correct target status, it must alert and do nothing, not guess.
3. **Audit every system-initiated state change.** Reconciliation writes an
   `AdminActionAudit` row with `actorAddress = system/reconciliation` so the
   audit chain reflects automated transitions, not just manual ones.
4. **DLQ replay is always explicit.** No code path auto-replays from the DLQ;
   replay requires a human decision via the admin API.
