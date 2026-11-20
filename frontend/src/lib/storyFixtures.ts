/**
 * Frontend story fixtures (issue #134).
 *
 * Reusable trade objects covering the five visual states used by component
 * tests and Storybook stories: loading, success (settled), disputed, refunded,
 * and terminal (a fully-closed trade that cannot transition further).
 *
 * Fixtures are deterministic — the same field values every run — so snapshot
 * tests don't drift and UI development doesn't require a live backend.
 */

import type { TradeDetail, TradeListItemProps } from './storyFixtures.types';

// ---------------------------------------------------------------------------
// Shared parties — reused across fixtures to keep things consistent
// ---------------------------------------------------------------------------

export const FIXTURE_SELLER = {
  name: 'Kano Grains Co-op',
  walletAddress: 'GDEMO_SELLER_KANO_GRAINS_000000000000000000000000000000000',
  trustScore: 92,
};

export const FIXTURE_BUYER = {
  name: 'Lagos Foods Ltd',
  walletAddress: 'GDEMO_BUYER_LAGOS_FOODS_0000000000000000000000000000000000',
  trustScore: 87,
};

// ---------------------------------------------------------------------------
// TradeListItem fixtures — props for the flat list view
// ---------------------------------------------------------------------------

/** Trade currently being funded / awaiting deposit — loading state. */
export const tradeListItemLoading: TradeListItemProps = {
  tradeId: 'fixture-loading-001',
  commodity: 'Yellow Maize (20 Tons)',
  counterparty: { role: 'Buyer', address: FIXTURE_BUYER.walletAddress },
  amountCngn: '450,000',
  status: 'PENDING',
  createdAt: '2024-01-15',
  onView: () => {},
};

/** Successfully settled trade. */
export const tradeListItemSuccess: TradeListItemProps = {
  tradeId: 'fixture-success-001',
  commodity: 'Sesame Seed (5 Tons)',
  counterparty: { role: 'Seller', address: FIXTURE_SELLER.walletAddress },
  amountCngn: '180,000',
  status: 'SETTLED',
  createdAt: '2024-01-10',
  onView: () => {},
};

/** Trade under active dispute. */
export const tradeListItemDisputed: TradeListItemProps = {
  tradeId: 'fixture-disputed-001',
  commodity: 'Soybean Oil (10 Tons)',
  counterparty: { role: 'Buyer', address: FIXTURE_BUYER.walletAddress },
  amountCngn: '310,000',
  status: 'DISPUTED',
  createdAt: '2024-01-08',
  onView: () => {},
};

/** Trade in transit — goods dispatched, payment still locked. */
export const tradeListItemInTransit: TradeListItemProps = {
  tradeId: 'fixture-transit-001',
  commodity: 'Brown Beans (8 Tons)',
  counterparty: { role: 'Seller', address: FIXTURE_SELLER.walletAddress },
  amountCngn: '240,000',
  status: 'IN TRANSIT',
  createdAt: '2024-01-12',
  onView: () => {},
};

/** Terminal trade — draft that was never funded and has since expired. */
export const tradeListItemTerminal: TradeListItemProps = {
  tradeId: 'fixture-terminal-001',
  commodity: 'Groundnut (3 Tons)',
  counterparty: { role: 'Buyer', address: FIXTURE_BUYER.walletAddress },
  amountCngn: '95,000',
  status: 'DRAFT',
  createdAt: '2023-12-20',
  onView: () => {},
};

// ---------------------------------------------------------------------------
// TradeDetail fixtures — full detail objects for the trade detail panel
// ---------------------------------------------------------------------------

const BASE_TIMELINE = [
  {
    id: 'evt-1',
    type: 'escrow_funded' as const,
    title: 'Escrow Funded',
    timestamp: '2024-01-10T09:00:00Z',
    status: 'completed' as const,
  },
  {
    id: 'evt-2',
    type: 'inspection_passed' as const,
    title: 'Inspection Passed',
    timestamp: '2024-01-11T11:30:00Z',
    status: 'completed' as const,
  },
  {
    id: 'evt-3',
    type: 'dispatched' as const,
    title: 'Dispatched',
    timestamp: '2024-01-12T08:00:00Z',
    status: 'current' as const,
  },
  {
    id: 'evt-4',
    type: 'settlement' as const,
    title: 'Settlement',
    status: 'pending' as const,
  },
];

/** Full trade detail — PENDING / loading state (escrow not yet funded). */
export const tradeDetailLoading: TradeDetail = {
  id: 'fixture-loading-001',
  commodity: 'Yellow Maize',
  quantity: '20 Tons Non-GMO',
  category: 'Grains / Legumes',
  status: 'PENDING',
  initiatedAt: '2024-01-15T07:00:00Z',
  buyer: FIXTURE_BUYER,
  seller: FIXTURE_SELLER,
  vaultAmountLocked: 0,
  assetValue: 450000,
  platformFeePercent: 1,
  platformFee: 4500,
  networkGasEst: '~0.01 XLM',
  contractId: 'CFIX_LOADING_000000000000000000000000000000000000000000000',
  incoterms: 'DAP',
  originPort: 'Kano',
  destinationPort: 'Lagos',
  eta: '2024-01-20',
  carrier: 'GIG Logistics',
  timeline: BASE_TIMELINE.map((e) => ({ ...e, status: 'pending' as const })),
};

/** Full trade detail — SETTLED (success state). */
export const tradeDetailSuccess: TradeDetail = {
  id: 'fixture-success-001',
  commodity: 'Sesame Seed',
  quantity: '5 Tons Grade A',
  category: 'Oilseeds',
  status: 'SETTLED',
  initiatedAt: '2024-01-10T09:00:00Z',
  buyer: FIXTURE_BUYER,
  seller: FIXTURE_SELLER,
  vaultAmountLocked: 180000,
  assetValue: 180000,
  platformFeePercent: 1,
  platformFee: 1800,
  networkGasEst: '~0.01 XLM',
  contractId: 'CFIX_SUCCESS_000000000000000000000000000000000000000000000',
  incoterms: 'CIF',
  originPort: 'Kano',
  destinationPort: 'Lagos',
  eta: '2024-01-13',
  carrier: 'ABC Freight',
  timeline: BASE_TIMELINE.map((e) => ({ ...e, status: 'completed' as const })),
};

/** Full trade detail — DISPUTED. */
export const tradeDetailDisputed: TradeDetail = {
  id: 'fixture-disputed-001',
  commodity: 'Soybean Oil',
  quantity: '10 Tons',
  category: 'Oilseeds',
  status: 'DISPUTED',
  initiatedAt: '2024-01-08T10:00:00Z',
  buyer: FIXTURE_BUYER,
  seller: FIXTURE_SELLER,
  vaultAmountLocked: 310000,
  assetValue: 310000,
  platformFeePercent: 1,
  platformFee: 3100,
  networkGasEst: '~0.01 XLM',
  contractId: 'CFIX_DISPUTED_00000000000000000000000000000000000000000000',
  incoterms: 'FOB',
  originPort: 'Kano',
  destinationPort: 'Port Harcourt',
  eta: '2024-01-14',
  carrier: 'XYZ Haulage',
  timeline: [
    { ...BASE_TIMELINE[0], status: 'completed' as const },
    { ...BASE_TIMELINE[1], status: 'completed' as const },
    { ...BASE_TIMELINE[2], status: 'completed' as const },
    { ...BASE_TIMELINE[3], status: 'pending' as const },
  ],
  lossRatios: [
    { label: 'Buyer', value: 50 },
    { label: 'Seller', value: 50 },
  ],
};

/**
 * Full trade detail — refunded (SETTLED after dispute resolution returned
 * funds to the buyer; represented as SETTLED with zero seller proceeds).
 */
export const tradeDetailRefunded: TradeDetail = {
  id: 'fixture-refunded-001',
  commodity: 'Groundnut Oil',
  quantity: '4 Tons',
  category: 'Oilseeds',
  status: 'SETTLED',
  initiatedAt: '2023-12-18T08:00:00Z',
  buyer: FIXTURE_BUYER,
  seller: FIXTURE_SELLER,
  vaultAmountLocked: 0,
  assetValue: 120000,
  platformFeePercent: 1,
  platformFee: 1200,
  networkGasEst: '~0.01 XLM',
  contractId: 'CFIX_REFUNDED_0000000000000000000000000000000000000000000',
  incoterms: 'DAP',
  originPort: 'Ibadan',
  destinationPort: 'Abuja',
  eta: '2023-12-25',
  carrier: 'SafeMove Logistics',
  timeline: BASE_TIMELINE.map((e) => ({ ...e, status: 'completed' as const })),
};

/** Full trade detail — terminal DRAFT (never funded, no further transitions). */
export const tradeDetailTerminal: TradeDetail = {
  id: 'fixture-terminal-001',
  commodity: 'Groundnut',
  quantity: '3 Tons',
  category: 'Legumes',
  status: 'DRAFT',
  initiatedAt: '2023-12-20T14:00:00Z',
  buyer: FIXTURE_BUYER,
  seller: FIXTURE_SELLER,
  vaultAmountLocked: 0,
  assetValue: 95000,
  platformFeePercent: 1,
  platformFee: 950,
  networkGasEst: '~0.01 XLM',
  contractId: 'CFIX_TERMINAL_000000000000000000000000000000000000000000',
  incoterms: 'EXW',
  originPort: 'Kaduna',
  destinationPort: 'Lagos',
  eta: '—',
  carrier: '—',
  timeline: BASE_TIMELINE.map((e) => ({ ...e, status: 'pending' as const })),
};

// ---------------------------------------------------------------------------
// Convenience collection — all five states in display order
// ---------------------------------------------------------------------------

/** All five `TradeListItemProps` fixtures ordered by visual state. */
export const ALL_TRADE_LIST_FIXTURES = [
  tradeListItemLoading,
  tradeListItemInTransit,
  tradeListItemSuccess,
  tradeListItemDisputed,
  tradeListItemTerminal,
] as const;

/** All five `TradeDetail` fixtures ordered by visual state. */
export const ALL_TRADE_DETAIL_FIXTURES = [
  tradeDetailLoading,
  tradeDetailSuccess,
  tradeDetailDisputed,
  tradeDetailRefunded,
  tradeDetailTerminal,
] as const;
