/**
 * Dispute resolution duration metrics.
 *
 * Durations are measured from `createdAt` to `resolvedAt`. Only disputes that
 * have been resolved or closed contribute to duration statistics. Open and
 * under-review disputes are counted as pending.
 *
 * Grouping uses the dispute category name, because the Dispute model has no
 * severity field. Disputes without a category are grouped as "uncategorized".
 */

export type DisputeOutcome = "RESOLVED" | "CLOSED";

export interface DisputeDurationInput {
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "CLOSED";
  createdAt: Date;
  resolvedAt: Date | null;
  categoryName: string | null;
}

export interface DurationStats {
  count: number;
  minMs: number | null;
  maxMs: number | null;
  meanMs: number | null;
  medianMs: number | null;
  p90Ms: number | null;
}

export interface DisputeDurationGroup extends DurationStats {
  category: string;
  outcome: DisputeOutcome;
}

export interface DisputeResolutionReport {
  groups: DisputeDurationGroup[];
  /** Disputes that are still open or under review. */
  pendingCount: number;
  /** Completed disputes skipped because their timestamps are inconsistent. */
  invalidCount: number;
}

export const UNCATEGORIZED = "uncategorized";

const percentile = (sorted: number[], p: number): number => {
  // Nearest-rank method.
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
};

export function summarizeDurations(durationsMs: number[]): DurationStats {
  if (durationsMs.length === 0) {
    return { count: 0, minMs: null, maxMs: null, meanMs: null, medianMs: null, p90Ms: null };
  }
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    count: sorted.length,
    minMs: sorted[0],
    maxMs: sorted[sorted.length - 1],
    meanMs: Math.round(sum / sorted.length),
    medianMs: percentile(sorted, 50),
    p90Ms: percentile(sorted, 90),
  };
}

/** Builds resolution-duration statistics grouped by category and outcome. */
export function buildDisputeResolutionReport(
  disputes: ReadonlyArray<DisputeDurationInput>,
): DisputeResolutionReport {
  const buckets = new Map<string, { category: string; outcome: DisputeOutcome; durations: number[] }>();
  let pendingCount = 0;
  let invalidCount = 0;

  for (const dispute of disputes) {
    if (dispute.status === "OPEN" || dispute.status === "UNDER_REVIEW") {
      pendingCount += 1;
      continue;
    }

    const outcome: DisputeOutcome = dispute.status;
    const resolvedAt = dispute.resolvedAt;
    if (resolvedAt === null) {
      invalidCount += 1;
      continue;
    }

    const durationMs = resolvedAt.getTime() - dispute.createdAt.getTime();
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      invalidCount += 1;
      continue;
    }

    const category = dispute.categoryName?.trim() || UNCATEGORIZED;
    const key = `${category}\u0000${outcome}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { category, outcome, durations: [] };
      buckets.set(key, bucket);
    }
    bucket.durations.push(durationMs);
  }

  const groups: DisputeDurationGroup[] = [...buckets.values()]
    .sort((a, b) => a.category.localeCompare(b.category) || a.outcome.localeCompare(b.outcome))
    .map((b) => ({ category: b.category, outcome: b.outcome, ...summarizeDurations(b.durations) }));

  return { groups, pendingCount, invalidCount };
}
