import { NextFunction, Request, Response } from "express";

/**
 * API latency percentiles by route category and status class (issue #177).
 *
 * Samples are kept in a bounded ring buffer per (routeCategory, statusClass)
 * key so memory stays constant under load. Percentiles use the nearest-rank
 * method over the retained window.
 */

export const LATENCY_WINDOW_SIZE = 1000;

export type StatusClass = "2xx" | "3xx" | "4xx" | "5xx" | "other";

export interface LatencySummary {
  routeCategory: string;
  statusClass: StatusClass;
  count: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

/** Maps a request path to a coarse category, e.g. `/api/v1/trades/1` → `trades`. */
export function routeCategory(path: string): string {
  const segments = path
    .split("?")[0]
    .split("/")
    .filter((s) => s.length > 0);
  // Strip an optional API version prefix such as `api` and `v1`.
  let i = 0;
  if (segments[i] === "api") i++;
  if (/^v\d+$/.test(segments[i] ?? "")) i++;
  const category = segments[i];
  if (!category) return "root";
  return /^[a-z][a-z0-9-]*$/i.test(category) ? category.toLowerCase() : "other";
}

export function statusClass(statusCode: number): StatusClass {
  if (!Number.isInteger(statusCode)) return "other";
  if (statusCode >= 200 && statusCode < 300) return "2xx";
  if (statusCode >= 300 && statusCode < 400) return "3xx";
  if (statusCode >= 400 && statusCode < 500) return "4xx";
  if (statusCode >= 500 && statusCode < 600) return "5xx";
  return "other";
}

/** Nearest-rank percentile over an already-sorted ascending array. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  const index = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[index];
}

class RingBuffer {
  private readonly values: number[] = [];
  private next = 0;

  constructor(private readonly capacity: number) {}

  push(value: number): void {
    if (this.values.length < this.capacity) {
      this.values.push(value);
    } else {
      this.values[this.next] = value;
      this.next = (this.next + 1) % this.capacity;
    }
  }

  snapshot(): number[] {
    return [...this.values];
  }
}

export class LatencyPercentileTracker {
  private readonly buckets = new Map<string, { category: string; status: StatusClass; ring: RingBuffer }>();

  constructor(private readonly windowSize: number = LATENCY_WINDOW_SIZE) {}

  /** Records one completed request. Non-finite or negative durations are ignored. */
  record(category: string, status: StatusClass, durationMs: number): void {
    if (!Number.isFinite(durationMs) || durationMs < 0) return;
    const key = `${category}|${status}`;
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { category, status, ring: new RingBuffer(this.windowSize) };
      this.buckets.set(key, bucket);
    }
    bucket.ring.push(durationMs);
  }

  summaries(): LatencySummary[] {
    const out: LatencySummary[] = [];
    for (const { category, status, ring } of this.buckets.values()) {
      const sorted = ring.snapshot().sort((a, b) => a - b);
      out.push({
        routeCategory: category,
        statusClass: status,
        count: sorted.length,
        p50Ms: round(percentile(sorted, 50)),
        p95Ms: round(percentile(sorted, 95)),
        p99Ms: round(percentile(sorted, 99)),
      });
    }
    return out.sort((a, b) =>
      a.routeCategory === b.routeCategory
        ? a.statusClass.localeCompare(b.statusClass)
        : a.routeCategory.localeCompare(b.routeCategory),
    );
  }

  reset(): void {
    this.buckets.clear();
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export const apiLatencyTracker = new LatencyPercentileTracker();

/** Records request duration on response finish. Uses a monotonic clock. */
export function latencyTrackingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = process.hrtime.bigint();
  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    apiLatencyTracker.record(routeCategory(req.path || req.url), statusClass(res.statusCode), durationMs);
  });
  next();
}
