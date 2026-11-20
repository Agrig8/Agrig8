# Migration Rollback Notes (Issue #142)

For every migration in `backend/prisma/migrations/` (incl. `pilot_feedback/`):
**Forward** = what `prisma migrate deploy` applies (`migration.sql`);
**Rollback** = the inverse of the forward statements. Migrations carrying an
inline `-- Rollback:` comment are marked. Verify rollbacks on a
disposable/staging database (`prisma validate` / `prisma migrate diff`) before
running them in production.

| Migration | Forward | Rollback |
|---|---|---|
| `20260324231720_init` | Initial schema: `User`, `Trade`, `Dispute`, `ProcessedLedger` tables + indexes/FKs | DROP the introduced tables/indexes/FKs (`DROP TABLE "User"; DROP TABLE "Trade"; DROP TABLE "Dispute"; DROP TABLE "ProcessedLedger";`) |
| `20260326000001_add_manifest_evidence` | TradeStatus `+= PENDING_SIGNATURE`; creates `DeliveryManifest`, `TradeEvidence` tables + indexes/FKs | DROP both tables/indexes/FKs; recreate `TradeStatus` without `PENDING_SIGNATURE` (Postgres cannot drop enum values) |
| `20260327000001_add_loss_bps_to_trade` | Adds `buyerLossBps`, `sellerLossBps` (INTEGER NOT NULL DEFAULT 5000) to `Trade` | `ALTER TABLE "Trade" DROP COLUMN "buyerLossBps"; ALTER TABLE "Trade" DROP COLUMN "sellerLossBps";` |
| `20260328000001_add_vault_and_goal_models` | Creates `Vault`, `Goal` tables + indexes/FKs | DROP both tables/indexes/FKs |
| `20260329000001_add_processed_event` | Drops `ProcessedLedger`; creates `ProcessedEvent` table + index | DROP `ProcessedEvent` + index; re-CREATE `ProcessedLedger` (per `init` schema) |
| `20260427000001_add_chain_event_outbox` | Creates `ChainEventOutbox` + status/ledgerSequence indexes | DROP `ChainEventOutbox` + both indexes |
| `20260428000001_add_canonical_trade_timestamps` | Adds `fundedAt`, `deliveredAt`, `completedAt` to `Trade` | `ALTER TABLE "Trade" DROP COLUMN "fundedAt";` etc. for all three |
| `20260527000001_add_dispute_category` | Creates `DisputeCategory`; adds `Dispute.categoryId` + index/FK | DROP `DisputeCategory`; `ALTER TABLE "Dispute" DROP COLUMN "categoryId"` |
| `20260528235959_add_trade_version` | Adds `version` to `Trade` | `ALTER TABLE "Trade" DROP COLUMN "version";` |
| `20260529000001_add_dispute_version` | Adds `version` to `Dispute` | `ALTER TABLE "Dispute" DROP COLUMN "version";` |
| `20260529000002_add_missing_indexes` | Creates ~15 `IF NOT EXISTS` indexes (Trade/Dispute/ChainEventOutbox/DeliveryManifest/TradeEvidence/Goal/User/AdminActionAudit) | DROP the created indexes (see `migration.sql`) |
| `20260624000000_add_refresh_token_rotation` | Creates `RefreshToken` table + indexes/FK | DROP `RefreshToken` + indexes/FK |
| `20260624000001_add_trade_templates_and_watchlist` | Creates `TradeTemplate`, `UserWatchlist` tables + indexes/FKs | DROP both tables + indexes/FKs |
| `20260625125416_add_webhook_subscription` | Creates `WebhookSubscription` + indexes/FK | DROP `WebhookSubscription` + indexes/FK |
| `20260625130000_add_notification_preferences_and_escrow_milestones` | Creates `NotificationPreference`, `EscrowReleaseMilestone` tables + indexes/FKs | DROP both tables + indexes/FKs |
| `20260728120000_add_admin_action_audit` | Creates `AdminActionAudit` + `action_createdAt`/`actorAddress` indexes | DROP `AdminActionAudit` + both indexes |
| `20260729235959_backfill_missing_tables` | Creates 9 tables (UserWallet, Webhook, WebhookDeliveryAttempt, InAppNotification, TradeNote, Stream, StreamClawbackEvent, OrphanDeposit, ContractPauseLog) + indexes/FKs | DROP the 9 tables + indexes/FKs |
| `20260730000000_add_stream_status_and_termination` | Adds `status`, `terminatedAt`, `terminatedBy`, `terminationReason` to `Stream` + `Stream_status_idx` | DROP the 4 columns + `Stream_status_idx` |
| `20260730000001_add_stream_lock_fields` | Adds `lockedAt`, `lockedBy`, `lockReason` to `Stream` | DROP the 3 columns |
| `20260730010000_add_stream_admin_tags` | Adds `Stream.adminTags` (TEXT[] NOT NULL DEFAULT '{}') | `ALTER TABLE "Stream" DROP COLUMN "adminTags";` |
| `20260801000000_add_payout_intent` | Creates `PayoutIntent` + indexes | DROP `PayoutIntent` + indexes |
| `20260828000000_add_audit_chain_hash` | Adds `prevHash`, `hash` to `AdminActionAudit` | DROP both columns |
| `20260829000001_add_job_heartbeat` | Creates `JobHeartbeat` + indexes | DROP `JobHeartbeat` + indexes |
| `20260829000002_add_escrow_audit` | Creates `EscrowAudit` + indexes | DROP `EscrowAudit` + indexes |
| `20260829140848_add_slow_query_composite_indexes` | Creates 4 composite indexes on Trade/TradeEvidence/AdminActionAudit | DROP the 4 indexes |
| `20260929000001_add_trade_buyer_created_at_index` | Adds `Trade_buyerAddress_createdAt_idx` (CONCURRENTLY) | Documented in `migration.sql`: `-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS "Trade_buyerAddress_createdAt_idx"` |
| `20260929000001_evidence_cid_unique` | Unique index `TradeEvidence_tradeId_cid_key` | `DROP INDEX "TradeEvidence_tradeId_cid_key";` |
| `20260929000002_add_trade_seller_created_at_index` | Adds `Trade_sellerAddress_createdAt_idx` (CONCURRENTLY) | Documented in `migration.sql`: `-- Rollback: DROP INDEX CONCURRENTLY IF EXISTS "Trade_sellerAddress_createdAt_idx"` |
| `20260929000002_dispute_evidence_requests` | Adds `Dispute.mediatorAddress`; creates `DisputeEvidenceRequest` + indexes/FK | DROP `DisputeEvidenceRequest` + indexes/FK; `ALTER TABLE "Dispute" DROP COLUMN "mediatorAddress"` |
| `20260929000003_refresh_token_family` | Adds `RefreshToken.familyId` (backfill + SET NOT NULL) + index | `DROP INDEX "RefreshToken_familyId_idx";` + `ALTER COLUMN "familyId" DROP NOT NULL;` + `DROP COLUMN "familyId"` |
| `20260930000000_add_outbox_scan_report` | Creates `OutboxScanReport` + index | DROP `OutboxScanReport` + index |
| `20260930000000_add_webhook_secret_rotation` | Adds `WebhookSubscription.previousSecretHash` (+ `previousSecretExpiresAt`) | DROP the added columns |
| `20261001000000_add_trade_note_audit` | Creates `TradeNoteAudit` + 2 indexes | DROP `TradeNoteAudit` + 2 indexes |
| `20261016000000_normalize_wallet_address_case` | Idempotent data migration: `UPDATE "User" SET walletAddress = LOWER(walletAddress)` (+ FK updates) | Not DDL-reversible — restore a pre-migration snapshot on a disposable DB (back up mixed-case rows first) |
| `20261016000001_add_reputation_snapshot_goal_contribution` | Creates `ReputationScoreSnapshot`, `GoalContribution` tables + indexes/FKs | DROP both tables + indexes/FKs |
| `pilot_feedback` | Creates `PilotFeedback` + 2 indexes | DROP `PilotFeedback` + 2 indexes |
