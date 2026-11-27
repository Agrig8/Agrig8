# Database Constraint Inventory

Source of truth: `backend/prisma/schema.prisma` and `backend/prisma/migrations/`.
The schema defines no SQL `CHECK` constraints. Value rules (loss ratios, status
transitions, amounts) are enforced in the service layer and the Soroban contract.

## Uniqueness

| Table | Constraint | Purpose |
| --- | --- | --- |
| `User` | `walletAddress` | One profile per wallet |
| `Trade` | `tradeId` | On-chain trade id maps to one row |
| `Dispute` | `tradeId` | At most one dispute per trade |
| `DeliveryManifest` | `tradeId` | One manifest per trade |
| `TradeEvidence` | `(tradeId, cid)` | Same IPFS file is not attached twice |
| `ProcessedEvent` | `(ledgerSequence, contractId, eventId)` | Replay-safe event ingestion |
| `ChainEventOutbox` | `(ledgerSequence, contractId, eventId)` | Outbox dedup |
| `EscrowReleaseMilestone` | `(tradeId, milestoneIndex)` | One row per milestone |
| `PayoutIntent` | `idempotencyKey` | Retry-safe payouts |
| `OrphanDeposit` | `txHash` | One record per deposit tx |
| `StreamClawbackEvent` | `(streamId, txHash)` | One clawback per tx |
| `UserWatchlist` | `(userAddress, tradeId)` | No duplicate watch entries |
| `TradeTemplate` | `(userAddress, name)` | Template names unique per user |

## Foreign keys

| Child | Parent | On delete |
| --- | --- | --- |
| `Trade.buyerAddress`, `Trade.sellerAddress` | `User.walletAddress` | RESTRICT |
| `Dispute.initiator` | `User.walletAddress` | RESTRICT |
| `Dispute.tradeId` | `Trade.tradeId` | CASCADE |
| `Dispute.categoryId` | `DisputeCategory.id` | SET NULL |
| `DeliveryManifest.tradeId`, `TradeEvidence.tradeId` | `Trade.tradeId` | CASCADE |
| `EscrowReleaseMilestone.tradeId`, `UserWatchlist.tradeId` | `Trade.tradeId` | CASCADE |
| `NotificationPreference.userAddress`, `TradeTemplate.userAddress` | `User.walletAddress` | CASCADE |
| `RefreshToken.userId`, `WebhookSubscription.userId` | `User.id` | CASCADE |
| `GoalContribution.goalId` | `Goal.goalId` | CASCADE |
