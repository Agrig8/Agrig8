# Contract Upgrade Migration Notes

Companion to `upgrade-considerations.md` — this document records the
concrete storage-layout, ABI, event, and rollback notes for each
significant upgrade of the Amana Escrow contract.

---

## How to Add an Entry

When you are about to upgrade the deployed contract, add a section below
**before** you deploy. Include:

| Field | What to record |
|---|---|
| **Target schema version** | The new `CURRENT_SCHEMA_VERSION` value |
| **Storage changes** | New keys, removed keys, type changes — with `DataKey` variant names |
| **ABI changes** | Added/removed/renamed public functions and their argument types |
| **Event changes** | New event types, removed topics, changed field names |
| **Migration path** | The gate condition (`version < N`) and what the migration block does |
| **Rollback plan** | How to restore the previous WASM hash if the upgrade fails |

---

## v1 → v2 (Template — fill before deploying)

**Target schema version:** 2

### Storage layout changes

_No storage changes in this upgrade. Update this section when changes land._

New keys added to `DataKey`:
- _(none)_

Removed keys:
- _(none)_

Type changes on existing keys:
- _(none)_

**Rule:** append new `DataKey` variants at the end of the enum. Never reorder
or rename existing variants — the XDR encoding is positional, and reordering
silently corrupts reads of existing persistent-storage entries.

### ABI changes

New public functions:
- _(none)_

Removed public functions:
- _(none)_

Argument or return-type changes:
- _(none)_

**Rule:** existing callers (TypeScript SDK, frontend, automated bots) must
continue to compile without changes. If a function signature must change,
add a new function and deprecate the old one for at least one upgrade cycle.

### Event changes

New event types:
- _(none)_

Removed event types:
- _(none)_

Field renames in existing events:
- _(none)_

**Rule:** off-chain indexers subscribe to event topic hashes. Renaming a topic
field breaks all listeners silently. When a field must change, emit both old
and new keys during a transition upgrade cycle.

### Migration logic

```rust
let version: u32 = env
    .storage()
    .instance()
    .get(&DataKey::SchemaVersion)
    .unwrap_or(1u32);

if version < 2 {
    // Add migration steps here — e.g.:
    //   env.storage().instance().set(&DataKey::NewField, &default_value);
}

env.storage().instance().set(&DataKey::SchemaVersion, &2u32);
```

Gate: runs once on the first call after upgrade; idempotent thereafter
because the version guard short-circuits.

### Rollback plan

1. Note the previous WASM hash before uploading the new binary
   (`stellar contract info --id <CONTRACT_ID>`).
2. If the upgrade fails or causes unexpected behaviour, call
   `upgrade(previous_wasm_hash)` from the admin keypair.
3. No storage rollback is needed unless the migration block already ran —
   if it did, manually revert each changed storage key via an admin
   helper function before re-downgrading.

### Pre-deploy checklist

- [ ] `CURRENT_SCHEMA_VERSION` bumped in `lib.rs`
- [ ] `upgrade-migration-notes.md` section filled in
- [ ] Migration logic tested in `upgrade_tests.rs`
- [ ] Previous WASM hash recorded in internal ops doc
- [ ] Off-chain indexer updated for any event-schema changes
- [ ] TypeScript SDK regenerated and published if ABI changed

---

## Upgrade History

| Version | Date | Summary |
|---|---|---|
| v1 | _initial deployment_ | Initial schema; no prior version |
