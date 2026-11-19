/**
 * Tests for trace sampling budget metrics (issue #178).
 */
import { SpanKind, SamplingDecision } from "@opentelemetry/api";
import {
  CountingSpanExporter,
  TraceSamplingBudget,
  traceSamplingBudget,
} from "../lib/traceSamplingBudget";
import { TailBasedSampler, __resetSamplerForTests } from "../config/tracing";

describe("TraceSamplingBudget", () => {
  it("returns zeros and a 0 ratio before any decision", () => {
    const budget = new TraceSamplingBudget();
    expect(budget.snapshot()).toEqual({
      sampled: 0,
      dropped: 0,
      sampledRatio: 0,
      byRule: {},
      exported: 0,
      exportFailed: 0,
      unexportedGap: 0,
    });
  });

  it("counts decisions overall and per rule, with a rounded ratio", () => {
    const budget = new TraceSamplingBudget();
    budget.recordDecision("error", true);
    budget.recordDecision("baseline", false);
    budget.recordDecision("baseline", false);
    budget.recordDecision("baseline", true);

    const snap = budget.snapshot();
    expect(snap.sampled).toBe(2);
    expect(snap.dropped).toBe(2);
    expect(snap.sampledRatio).toBe(0.5);
    expect(snap.byRule).toEqual({
      baseline: { sampled: 1, dropped: 2 },
      error: { sampled: 1, dropped: 0 },
    });
  });

  it("rounds the sampled ratio to four decimal places", () => {
    const budget = new TraceSamplingBudget();
    budget.recordDecision("baseline", true);
    budget.recordDecision("baseline", false);
    budget.recordDecision("baseline", false);
    expect(budget.snapshot().sampledRatio).toBe(0.3333);
  });

  it("tracks exported spans, failures and the unexported gap", () => {
    const budget = new TraceSamplingBudget();
    budget.recordDecision("error", true);
    budget.recordDecision("error", true);
    budget.recordDecision("error", true);
    budget.recordExport(2, true);
    budget.recordExport(1, false);
    budget.recordExport(0, true);
    budget.recordExport(Number.NaN, true);

    const snap = budget.snapshot();
    expect(snap.exported).toBe(2);
    expect(snap.exportFailed).toBe(1);
    expect(snap.unexportedGap).toBe(1);
  });

  it("reset clears all counters", () => {
    const budget = new TraceSamplingBudget();
    budget.recordDecision("error", true);
    budget.recordExport(1, true);
    budget.reset();
    expect(budget.snapshot().sampled).toBe(0);
    expect(budget.snapshot().exported).toBe(0);
  });
});

describe("CountingSpanExporter", () => {
  const spans = [{}, {}, {}] as any[];

  function makeInner(code: number) {
    return {
      export: jest.fn((_s: any[], cb: (r: { code: number }) => void) => cb({ code })),
      shutdown: jest.fn(async () => undefined),
      forceFlush: jest.fn(async () => undefined),
    };
  }

  it("counts successful exports and forwards the result unchanged", () => {
    const budget = new TraceSamplingBudget();
    const inner = makeInner(0);
    const exporter = new CountingSpanExporter(inner as any, budget);
    const cb = jest.fn();

    exporter.export(spans, cb);

    expect(inner.export).toHaveBeenCalledWith(spans, expect.any(Function));
    expect(cb).toHaveBeenCalledWith({ code: 0 });
    expect(budget.snapshot().exported).toBe(3);
    expect(budget.snapshot().exportFailed).toBe(0);
  });

  it("counts failed exports without swallowing the failure", () => {
    const budget = new TraceSamplingBudget();
    const exporter = new CountingSpanExporter(makeInner(1) as any, budget);
    const cb = jest.fn();

    exporter.export(spans, cb);

    expect(cb).toHaveBeenCalledWith({ code: 1 });
    expect(budget.snapshot().exported).toBe(0);
    expect(budget.snapshot().exportFailed).toBe(3);
  });

  it("delegates shutdown and forceFlush", async () => {
    const inner = makeInner(0);
    const exporter = new CountingSpanExporter(inner as any, new TraceSamplingBudget());
    await exporter.shutdown();
    await exporter.forceFlush();
    expect(inner.shutdown).toHaveBeenCalledTimes(1);
    expect(inner.forceFlush).toHaveBeenCalledTimes(1);
  });

  it("resolves forceFlush when the wrapped exporter has none", async () => {
    const exporter = new CountingSpanExporter({
      export: jest.fn(),
      shutdown: jest.fn(async () => undefined),
    } as any, new TraceSamplingBudget());
    await expect(exporter.forceFlush()).resolves.toBeUndefined();
  });
});

describe("TailBasedSampler records decisions into the budget", () => {
  beforeEach(() => {
    __resetSamplerForTests();
    traceSamplingBudget.reset();
  });

  function sampleUrl(sampler: TailBasedSampler, url: string, attrs: Record<string, any> = {}) {
    return sampler.shouldSample(
      {} as any,
      "trace",
      url,
      SpanKind.SERVER,
      { "http.url": url, ...attrs },
    );
  }

  it("attributes kept and dropped spans to the deciding rule", () => {
    const sampler = new TailBasedSampler({ baselineRate: 0, routeOverrides: {} });

    expect(sampleUrl(sampler, "/trades/1/release").decision).toBe(SamplingDecision.RECORD_AND_SAMPLED);
    expect(sampleUrl(sampler, "/health/detail").decision).toBe(SamplingDecision.NOT_RECORD);
    expect(sampleUrl(sampler, "/api/v1/items", { "http.status_code": 500 }).decision)
      .toBe(SamplingDecision.RECORD_AND_SAMPLED);
    expect(sampleUrl(sampler, "/api/v1/items").decision).toBe(SamplingDecision.NOT_RECORD);

    const snap = traceSamplingBudget.snapshot();
    expect(snap.sampled).toBe(2);
    expect(snap.dropped).toBe(2);
    expect(snap.byRule).toEqual({
      baseline: { sampled: 0, dropped: 1 },
      error: { sampled: 1, dropped: 0 },
      high_value_route: { sampled: 1, dropped: 0 },
      never_sample: { sampled: 0, dropped: 1 },
    });
  });

  it("attributes route override drops to route_override", () => {
    const sampler = new TailBasedSampler({ baselineRate: 1, routeOverrides: { "/wallet": 0 } });
    expect(sampleUrl(sampler, "/wallet/balance").decision).toBe(SamplingDecision.NOT_RECORD);
    expect(traceSamplingBudget.snapshot().byRule).toEqual({
      route_override: { sampled: 0, dropped: 1 },
    });
  });
});
