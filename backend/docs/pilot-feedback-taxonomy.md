# Pilot feedback taxonomy

Issue #179. Source: `src/services/pilotFeedbackTaxonomy.ts`.

Pilot feedback is grouped into three categories so usability, logistics and
contract issues can be reported separately.

| Category | Matches (case-insensitive substrings) |
|---|---|
| `usability` | confus, unclear, hard to, difficult, navigat, button, screen, layout, label, usability, onboarding |
| `logistics` | delivery, shipment, shipping, pickup, pick-up, warehouse, transport, logistic, harvest, farm, storage, route |
| `contract` | escrow, contract, release, payout, dispute, clawback, deposit, refund, milestone, fees, payment |

## Rules

- An item can belong to more than one category.
- An item matching no category is reported as `uncategorized`. Review these
  and add keywords rather than dropping them.
- Matching runs over the item title and content together.
- `fees` is used instead of `fee` so that `feedback` is not classified as a
  contract item.

## Aggregate report

`aggregateFeedbackReport(items)` returns:

- `total`: number of items
- `byCategory`: count per category (multi-category items count in each)
- `uncategorized`: count of items with no category
- `itemIds`: item ids per category, for drill-down

## Changing the taxonomy

Edit `FEEDBACK_TAXONOMY` and add a test case in
`src/__tests__/pilotFeedbackTaxonomy.test.ts`. Keywords must stay lowercase.
