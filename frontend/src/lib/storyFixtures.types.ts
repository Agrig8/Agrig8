/**
 * Re-exports the types consumed by story fixtures so components and fixtures
 * share a single source of truth without creating circular import chains.
 */
export type { TradeDetail } from '@/types/trade';
export type { TradeListItemProps } from '@/components/trade/TradeListItem';
