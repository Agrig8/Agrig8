import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";

type ExportResult = Parameters<SpanExporter["export"]>[1] extends (r: infer R) => void ? R : never;

/** OpenTelemetry ExportResultCode.SUCCESS (0). Compared numerically to avoid an undeclared import. */
const EXPORT_RESULT_SUCCESS = 0;

/**
 * Trace sampling budget metrics (issue #178).
 *
 * Tracks how many spans the sampler kept or dropped (broken down by the rule
 * that decided), and how many spans the exporter successfully shipped. The
 * gap between "sampled" and "exported" surfaces observability loss, and the
 * sampled ratio shows whether the budget is being spent as configured.
 */

export interface RuleCounts {
  sampled: number;
  dropped: number;
}

export interface SamplingBudgetSnapshot {
  sampled: number;
  dropped: number;
  /** sampled / (sampled + dropped), 0 when no decisions have been made. */
  sampledRatio: number;
  byRule: Record<string, RuleCounts>;
  exported: number;
  exportFailed: number;
  /** sampled - exported: spans that were kept but never reached the backend. */
  unexportedGap: number;
}

export class TraceSamplingBudget {
  private sampled = 0;
  private dropped = 0;
  private exported = 0;
  private exportFailed = 0;
  private readonly byRule = new Map<string, RuleCounts>();

  recordDecision(rule: string, keep: boolean): void {
    const bucket = this.byRule.get(rule) ?? { sampled: 0, dropped: 0 };
    if (keep) {
      this.sampled++;
      bucket.sampled++;
    } else {
      this.dropped++;
      bucket.dropped++;
    }
    this.byRule.set(rule, bucket);
  }

  recordExport(spanCount: number, ok: boolean): void {
    if (!Number.isFinite(spanCount) || spanCount <= 0) return;
    if (ok) this.exported += spanCount;
    else this.exportFailed += spanCount;
  }

  snapshot(): SamplingBudgetSnapshot {
    const total = this.sampled + this.dropped;
    const byRule: Record<string, RuleCounts> = {};
    for (const [rule, counts] of [...this.byRule.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      byRule[rule] = { ...counts };
    }
    return {
      sampled: this.sampled,
      dropped: this.dropped,
      sampledRatio: total === 0 ? 0 : round(this.sampled / total),
      byRule,
      exported: this.exported,
      exportFailed: this.exportFailed,
      unexportedGap: this.sampled - this.exported,
    };
  }

  reset(): void {
    this.sampled = 0;
    this.dropped = 0;
    this.exported = 0;
    this.exportFailed = 0;
    this.byRule.clear();
  }
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export const traceSamplingBudget = new TraceSamplingBudget();

/**
 * Wraps a span exporter so successful and failed exports are counted.
 * Delegates every call to the wrapped exporter unchanged.
 */
export class CountingSpanExporter implements SpanExporter {
  constructor(
    private readonly inner: SpanExporter,
    private readonly budget: TraceSamplingBudget = traceSamplingBudget,
  ) {}

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this.inner.export(spans, (result) => {
      this.budget.recordExport(spans.length, result.code === EXPORT_RESULT_SUCCESS);
      resultCallback(result);
    });
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }

  forceFlush(): Promise<void> {
    return this.inner.forceFlush?.() ?? Promise.resolve();
  }
}
