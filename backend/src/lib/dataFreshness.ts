/**
 * Dashboard data freshness indicators (issue #180).
 *
 * Each data collector records its last successful run. A source is `stale`
 * when that run is older than its threshold, and `never` when it has never
 * succeeded. Dashboards read the report and show a warning for anything not
 * `fresh`.
 */

export type FreshnessStatus = "fresh" | "stale" | "never";

export interface FreshnessInput {
  source: string;
  lastSuccessAt: Date | string | number | null | undefined;
  now: Date;
  staleAfterMs: number;
}

export interface FreshnessResult {
  source: string;
  status: FreshnessStatus;
  lastSuccessAt: string | null;
  ageSeconds: number | null;
  staleAfterSeconds: number;
  warning: string | null;
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Classifies one source. A timestamp in the future (clock skew between the
 * collector and this process) is treated as age 0 rather than an error.
 */
export function evaluateFreshness(input: FreshnessInput): FreshnessResult {
  const staleAfterSeconds = Math.max(0, Math.round(input.staleAfterMs / 1000));
  const last = toDate(input.lastSuccessAt);

  if (!last) {
    return {
      source: input.source,
      status: "never",
      lastSuccessAt: null,
      ageSeconds: null,
      staleAfterSeconds,
      warning: `${input.source} has no successful collection on record.`,
    };
  }

  const ageMs = Math.max(0, input.now.getTime() - last.getTime());
  const ageSeconds = Math.floor(ageMs / 1000);
  const stale = ageMs > input.staleAfterMs;

  return {
    source: input.source,
    status: stale ? "stale" : "fresh",
    lastSuccessAt: last.toISOString(),
    ageSeconds,
    staleAfterSeconds,
    warning: stale
      ? `${input.source} last succeeded ${ageSeconds}s ago, beyond the ${staleAfterSeconds}s threshold. Data may be out of date.`
      : null,
  };
}

export interface FreshnessReport {
  generatedAt: string;
  /** Worst status across all sources: never > stale > fresh. */
  overall: FreshnessStatus;
  sources: FreshnessResult[];
}

const SEVERITY: Record<FreshnessStatus, number> = { fresh: 0, stale: 1, never: 2 };

export function buildFreshnessReport(inputs: FreshnessInput[], now: Date = new Date()): FreshnessReport {
  const sources = inputs.map(evaluateFreshness).sort((a, b) => a.source.localeCompare(b.source));
  const overall = sources.reduce<FreshnessStatus>(
    (worst, s) => (SEVERITY[s.status] > SEVERITY[worst] ? s.status : worst),
    "fresh",
  );
  return {
    generatedAt: now.toISOString(),
    overall,
    sources,
  };
}

interface RegisteredSource {
  staleAfterMs: number;
  lastSuccessAt: Date | null;
}

/** In-process registry: collectors call recordSuccess after each successful run. */
export class DataFreshnessRegistry {
  private readonly sources = new Map<string, RegisteredSource>();

  register(source: string, staleAfterMs: number): void {
    if (!Number.isFinite(staleAfterMs) || staleAfterMs <= 0) {
      throw new Error(`staleAfterMs must be a positive number for source "${source}"`);
    }
    const existing = this.sources.get(source);
    this.sources.set(source, { staleAfterMs, lastSuccessAt: existing?.lastSuccessAt ?? null });
  }

  recordSuccess(source: string, at: Date = new Date()): void {
    const entry = this.sources.get(source);
    if (!entry) {
      throw new Error(`Unregistered freshness source "${source}"`);
    }
    entry.lastSuccessAt = at;
  }

  report(now: Date = new Date()): FreshnessReport {
    return buildFreshnessReport(
      [...this.sources.entries()].map(([source, entry]) => ({
        source,
        lastSuccessAt: entry.lastSuccessAt,
        now,
        staleAfterMs: entry.staleAfterMs,
      })),
      now,
    );
  }

  reset(): void {
    this.sources.clear();
  }
}

export const dataFreshness = new DataFreshnessRegistry();
