# Trust Score Data Dictionary

Implementation: `backend/src/services/reputation.service.ts` (`getUserReputation`).
Wallet addresses are lowercased before every query.

## Inputs

| Field | Source | Meaning | Why it is used |
| --- | --- | --- | --- |
| `completedCount` | `Trade` with `status = COMPLETED`, buyer or seller | Successful trades | Main positive signal |
| `totalTrades` | All `Trade` rows for the wallet | Trade volume | Rewards sustained activity |
| `disputesInitiated` | `Dispute.initiator = wallet` | Disputes the wallet opened | Small penalty for conflict |
| `disputesLost` | Initiated disputes in `RESOLVED` or `CLOSED` | Disputes that reached a final state | Larger penalty; the code treats any final state as lost |

## Formula

```
score = 50
      + 5 * completedCount
      - 8 * disputesLost
      - 2 * disputesInitiated
      + volumeBonus            // +15 if totalTrades >= 50, +8 if >= 25, +5 if >= 10, else 0
score = clamp(score, 0, 100)
```

## Outputs and bounds

| Field | Type | Bounds |
| --- | --- | --- |
| `trustScore` | int | 0 to 100; new wallets start at 50 |
| `successRate` | float | 0 to 100, one decimal; 100 when `totalTrades = 0` |
| `history` | list | At most 20 events (5 completed trades, 5 disputes) |

## Decay

There is no time decay. Every trade and dispute counts equally regardless of age.
Each call stores a `ReputationScoreSnapshot` (`trustScore`, `totalTrades`,
`successRate`, `createdAt`), so score changes over time are visible through
`getReputationHistory` (page size 1 to 100, default 20).
