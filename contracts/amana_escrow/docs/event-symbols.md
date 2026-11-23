# Public Event Symbols

**Issue:** #55 — Document all public event symbols  
**Last updated:** 2026-11-23

This document lists every on-chain event the `amana_escrow` contract emits, its
topic symbol(s), payload field names (in declaration order), schema-version
stability, and migration compatibility.

The canonical source of truth for symbols and field names is
[`src/generated/event_schema.rs`](../src/generated/event_schema.rs), which is
regenerated from `schemas/events/amana_escrow.events.json`. The table below is
the human-readable view of the same data.

---

## Versioning

Two independent counters govern compatibility:

| Constant | File | Meaning |
|---|---|---|
| `CURRENT_SCHEMA_VERSION` | `src/lib.rs` | Persistent storage layout version |
| `EVENT_SCHEMA_VERSION` | `src/generated/event_schema.rs` | Event payload structure version |

**Rule for existing events:** fields are **never removed or reordered**. Only
new fields may be appended, and they always carry a trailing `schema_version: u32`
field so listeners can gate on the version rather than decoding blindly.

**Events predating `EVENT_SCHEMA_VERSION`** (all events whose struct name does
_not_ contain `schema_version`) have a **locked, immutable shape**. They will
never gain new fields.

---

## Event Table

### Trade Lifecycle

| Event | Topic Symbol | Payload Fields | Stable Shape |
|---|---|---|---|
| `InitializedEvent` | `amana`, `initialized` | `admin`, `fee_bps`, `timestamp` | Locked |
| `TradeCreatedEvent` | `TRDCRT` | `trade_id`, `buyer`, `seller`, `amount` | Locked |
| `TradeFundedEvent` | `TRDFND` | `trade_id`, `amount` | Locked |
| `TradeCancelledEvent` | `TRDCAN` | `trade_id`, `refund_amount`, `caller`, `timestamp` | Locked |
| `TradeCancelledByBuyerEvent` | `TCNBYR` | `trade_id`, `buyer` | Locked |
| `DeliveryConfirmedEvent` | `DELCNF` | `trade_id`, `delivered_at` | Locked |
| `FundsReleasedEvent` | `RELSD` | `trade_id`, `seller_amount`, `fee_amount` | Locked |
| `TradeExpiredEvent` | `TRDEXP` | `trade_id`, `refund_amount`, `caller` | Locked |
| `DeadlineExtendedEvent` | `DEDEXT` | `trade_id`, `old_deadline`, `new_deadline` | Locked |
| `ManifestSubmittedEvent` | `MNFST` | `trade_id`, `seller`, `driver_name_hash`, `driver_id_hash`, `timestamp` | Locked |

### Evidence & Dispute

| Event | Topic Symbol | Payload Fields | Stable Shape |
|---|---|---|---|
| `EvidenceSubmittedEvent` | `EVDSUB` | `trade_id`, `submitter`, `evidence_hash` | Locked |
| `DisputeInitiatedEvent` | `DISINI` | `trade_id`, `initiator`, `reason_hash` | Locked |
| `DisputeResolvedEvent` | `DISRES` | `trade_id`, `seller_payout`, `buyer_refund`, `mediator` | Locked |
| `VideoProofSubmittedEvent` | `VIDPRF` | `trade_id`, `submitter`, `ipfs_cid`, `timestamp` | Locked |
| `DisputeVoteCastEvent` | `DVOTE` | `trade_id`, `mediator`, `seller_gets_bps`, `weight`, `rationale_hash`, `outcome_weight`, `weight_to_quorum`, `voted_at`, `schema_version` | Versioned |
| `DisputeQuorumResolvedEvent` | `DQURES` | `trade_id`, `seller_gets_bps`, `outcome`, `winning_weight`, `total_weight`, `vote_count`, `schema_version` | Versioned |

### Admin & Governance

| Event | Topic Symbol | Payload Fields | Stable Shape |
|---|---|---|---|
| `ContractUpgradedEvent` | `UPGRAD` | `admin`, `new_wasm_hash` | Locked |
| `ContractUpgradeQueued` | `UPGQUE` | `operation_id`, `new_wasm_hash`, `queued_at`, `execute_after` | Locked |
| `AdminClawbackEvent` | `ADMCLW` | `trade_id`, `amount`, `admin`, `timestamp` | Locked |
| `ClawbackExecutedEvent` | `CLWBCK` | `trade_id`, `clawback_amount`, `remaining_amount`, `destination`, `admin`, `schema_version` | Versioned |
| `AdminTransferProposedEvent` | `ADMPRP` | `current_admin`, `pending_admin` | Locked |
| `AdminTransferAcceptedEvent` | `ADMACC` | `old_admin`, `new_admin` | Locked |

### Mediators

| Event | Topic Symbol | Payload Fields | Stable Shape |
|---|---|---|---|
| `MediatorAddedEvent` | `MEDADD` | `mediator` | Locked |
| `MediatorRemovedEvent` | `MEDREM` | `mediator` | Locked |
| `MediatorWeightUpdatedEvent` | `MEDWGT` | `mediator`, `weight`, `schema_version` | Versioned |

### Fees

| Event | Topic Symbol | Payload Fields | Stable Shape |
|---|---|---|---|
| `FeeRateUpdatedEvent` | `FEEUPD` | `old_fee_bps`, `new_fee_bps` | Locked |
| `FeesWithdrawnEvent` | `FEEWTH` | `amount`, `destination` | Locked |

### Path Payments

| Event | Topic Symbol | Payload Fields | Stable Shape |
|---|---|---|---|
| `PathPaymentInitiatedEvent` | `PTHINT` | `trade_id`, `buyer`, `source_token`, `source_amount`, `dest_min`, `path` | Locked |
| `PathPaymentExecutedEvent` | `PTHPAY` | `trade_id`, `buyer`, `source_token`, `source_amount`, `dest_token`, `dest_amount` | Locked |

### Timelock

| Event | Topic Symbol | Payload Fields | Stable Shape |
|---|---|---|---|
| `TimelockOperationQueued` | `TLKQUE` | `operation_id`, `operation_type`, `queued_at`, `execute_after`, `admin` | Locked |
| `TimelockOperationExecuted` | `TLKEXE` | `operation_id`, `executed_at` | Locked |
| `TimelockOperationCancelled` | `TLKCAN` | `operation_id`, `cancelled_at`, `admin` | Locked |

### Quorum Config

| Event | Topic Symbol | Payload Fields | Stable Shape |
|---|---|---|---|
| `QuorumConfigUpdatedEvent` | `QURCFG` | `enabled`, `value_threshold`, `required_weight`, `vote_window_secs`, `fallback_min_weight`, `schema_version` | Versioned |

### Deadline Extension

| Event | Topic Symbol | Payload Fields | Stable Shape |
|---|---|---|---|
| `DeadlineExtensionBudgetEvent` | `DEDBGT` | `trade_id`, `extensions_used`, `extensions_remaining`, `original_deadline`, `extended_by_secs`, `extension_secs_remaining`, `schema_version` | Versioned |
| `ExtensionPolicyUpdatedEvent` | `EXTPOL` | `max_extensions`, `max_total_extension_secs`, `schema_version` | Versioned |

---

## Indexer Integration Notes

1. **Subscribe by topic symbol** — the first topic element identifies the event
   type. For `InitializedEvent` both `amana` and `initialized` must be present;
   all others use a single 6-character symbol short.

2. **Decode positionally** — fields are encoded as a `ScVal::Map` or
   `ScVal::Vec` in declaration order. Append-only versioning means a listener
   written for schema version 1 may safely ignore trailing fields it does not
   recognise in version 2.

3. **Gate on `schema_version`** — versioned events include a trailing
   `schema_version: u32` field. If you encounter a version higher than your
   decoder was written for, treat new trailing fields as unknown rather than
   raising an error.

4. **Never mutate locked events** — events marked "Locked" above will never
   change. Treat them as a stable ABI.

---

## Regenerating the Schema

```
node scripts/codegen-events.mjs
```

CI re-runs this and fails the build on any diff to prevent accidental manual
edits. The authoritative JSON source is
`schemas/events/amana_escrow.events.json`.
