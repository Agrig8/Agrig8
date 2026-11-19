import type { AnalyticsEvent, AnalyticsEventName } from "./analytics.service";

/**
 * Privacy-safe trade funnel helpers.
 *
 * Funnel output contains only aggregate counts per stage. It never includes
 * user identifiers, wallet addresses, or any per-trade detail.
 */

/** Ordered stages of the escrow trade funnel. */
export const TRADE_FUNNEL_STAGES = [
  "trade.created",
  "trade.funded",
  "trade.confirmed",
  "trade.resolved",
] as const satisfies readonly AnalyticsEventName[];

export type TradeFunnelStage = (typeof TRADE_FUNNEL_STAGES)[number];

export interface FunnelStageStat {
  stage: TradeFunnelStage;
  /** Number of distinct trades that reached this stage. */
  count: number;
  /** Share of the previous stage that reached this one (0–1). Null for the first stage. */
  conversionFromPrevious: number | null;
  /** Share of the first stage that reached this one (0–1). Null when the first stage is empty. */
  conversionFromStart: number | null;
}

/**
 * Metadata keys that may carry identifiers or personal data. Matching is
 * case-insensitive and applies to any key containing one of these fragments.
 */
const SENSITIVE_KEY_FRAGMENTS = [
  "address",
  "wallet",
  "email",
  "phone",
  "userid",
  "user_id",
  "buyer",
  "seller",
  "mediator",
  "ipaddress",
  "ip_address",
  "name",
  "secret",
  "token",
  "privatekey",
] as const;

const isSensitiveKey = (key: string): boolean => {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_FRAGMENTS.some((fragment) => lower.includes(fragment));
};

/**
 * Returns a copy of `metadata` with sensitive keys removed, recursively.
 * Returns undefined when nothing safe remains.
 */
export function sanitizeAnalyticsMetadata(
  metadata: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (metadata === undefined) return undefined;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (isSensitiveKey(key)) continue;

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const nested = sanitizeAnalyticsMetadata(value as Record<string, unknown>);
      if (nested !== undefined && Object.keys(nested).length > 0) out[key] = nested;
      continue;
    }

    out[key] = value;
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

const ratio = (part: number, whole: number): number | null =>
  whole > 0 ? Math.round((part / whole) * 10000) / 10000 : null;

/**
 * Builds aggregate funnel statistics. Each trade is counted once per stage,
 * even if it emitted the stage event several times. Events outside the
 * funnel stages are ignored.
 */
export function buildTradeFunnel(
  events: ReadonlyArray<Pick<AnalyticsEvent, "event" | "tradeId">>,
): FunnelStageStat[] {
  const tradesByStage = new Map<TradeFunnelStage, Set<string>>(
    TRADE_FUNNEL_STAGES.map((stage) => [stage, new Set<string>()]),
  );

  for (const { event, tradeId } of events) {
    if (tradeId === undefined) continue;
    const bucket = tradesByStage.get(event as TradeFunnelStage);
    if (bucket) bucket.add(tradeId);
  }

  const startCount = tradesByStage.get(TRADE_FUNNEL_STAGES[0])!.size;
  let previousCount: number | null = null;

  return TRADE_FUNNEL_STAGES.map((stage) => {
    const count = tradesByStage.get(stage)!.size;
    const stat: FunnelStageStat = {
      stage,
      count,
      conversionFromPrevious:
        previousCount === null ? null : ratio(count, previousCount),
      conversionFromStart: ratio(count, startCount),
    };
    previousCount = count;
    return stat;
  });
}
