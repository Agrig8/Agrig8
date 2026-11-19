/**
 * Tests for dashboard data freshness indicators (issue #180).
 */
import {
  buildFreshnessReport,
  DataFreshnessRegistry,
  evaluateFreshness,
} from "../lib/dataFreshness";

const NOW = new Date("2026-11-19T12:00:00.000Z");
const MIN = 60 * 1000;

describe("evaluateFreshness", () => {
  it("reports fresh when the last success is within the threshold", () => {
    const r = evaluateFreshness({
      source: "trades",
      lastSuccessAt: new Date(NOW.getTime() - 4 * MIN),
      now: NOW,
      staleAfterMs: 5 * MIN,
    });
    expect(r).toEqual({
      source: "trades",
      status: "fresh",
      lastSuccessAt: "2026-11-19T11:56:00.000Z",
      ageSeconds: 240,
      staleAfterSeconds: 300,
      warning: null,
    });
  });

  it("is stale once the age strictly exceeds the threshold", () => {
    const atLimit = evaluateFreshness({
      source: "s",
      lastSuccessAt: new Date(NOW.getTime() - 5 * MIN),
      now: NOW,
      staleAfterMs: 5 * MIN,
    });
    expect(atLimit.status).toBe("fresh");

    const over = evaluateFreshness({
      source: "s",
      lastSuccessAt: new Date(NOW.getTime() - 5 * MIN - 1000),
      now: NOW,
      staleAfterMs: 5 * MIN,
    });
    expect(over.status).toBe("stale");
    expect(over.warning).toMatch(/s last succeeded 301s ago/);
  });

  it("reports never when there is no successful collection", () => {
    for (const lastSuccessAt of [null, undefined, "", "not-a-date"]) {
      const r = evaluateFreshness({ source: "pricing", lastSuccessAt, now: NOW, staleAfterMs: MIN });
      expect(r.status).toBe("never");
      expect(r.ageSeconds).toBeNull();
      expect(r.lastSuccessAt).toBeNull();
      expect(r.warning).toMatch(/no successful collection/);
    }
  });

  it("accepts ISO strings and epoch numbers", () => {
    const iso = evaluateFreshness({ source: "a", lastSuccessAt: "2026-11-19T11:59:30.000Z", now: NOW, staleAfterMs: MIN });
    const epoch = evaluateFreshness({ source: "a", lastSuccessAt: NOW.getTime() - 10_000, now: NOW, staleAfterMs: MIN });
    expect(iso.ageSeconds).toBe(30);
    expect(epoch.ageSeconds).toBe(10);
  });

  it("treats a timestamp in the future as age 0", () => {
    const r = evaluateFreshness({
      source: "a",
      lastSuccessAt: new Date(NOW.getTime() + 60_000),
      now: NOW,
      staleAfterMs: MIN,
    });
    expect(r.status).toBe("fresh");
    expect(r.ageSeconds).toBe(0);
  });
});

describe("buildFreshnessReport", () => {
  it("reports fresh overall for an empty source list", () => {
    expect(buildFreshnessReport([], NOW)).toEqual({
      generatedAt: NOW.toISOString(),
      overall: "fresh",
      sources: [],
    });
  });

  it("sorts sources and takes the worst status overall", () => {
    const report = buildFreshnessReport([
      { source: "zeta", lastSuccessAt: NOW, now: NOW, staleAfterMs: MIN },
      { source: "alpha", lastSuccessAt: null, now: NOW, staleAfterMs: MIN },
      { source: "mid", lastSuccessAt: new Date(NOW.getTime() - 2 * MIN), now: NOW, staleAfterMs: MIN },
    ], NOW);
    expect(report.sources.map((s) => s.source)).toEqual(["alpha", "mid", "zeta"]);
    expect(report.overall).toBe("never");
    expect(report.generatedAt).toBe(NOW.toISOString());
  });

  it("is stale overall when the worst source is stale", () => {
    const report = buildFreshnessReport([
      { source: "a", lastSuccessAt: NOW, now: NOW, staleAfterMs: MIN },
      { source: "b", lastSuccessAt: new Date(NOW.getTime() - 2 * MIN), now: NOW, staleAfterMs: MIN },
    ], NOW);
    expect(report.overall).toBe("stale");
  });
});

describe("DataFreshnessRegistry", () => {
  it("rejects non-positive thresholds", () => {
    const registry = new DataFreshnessRegistry();
    expect(() => registry.register("x", 0)).toThrow(/positive number/);
    expect(() => registry.register("x", Number.NaN)).toThrow(/positive number/);
  });

  it("requires registration before recording a success", () => {
    const registry = new DataFreshnessRegistry();
    expect(() => registry.recordSuccess("missing")).toThrow(/Unregistered/);
  });

  it("tracks successes and keeps them when a source is re-registered", () => {
    const registry = new DataFreshnessRegistry();
    registry.register("ingest", 5 * MIN);
    registry.recordSuccess("ingest", new Date(NOW.getTime() - MIN));
    registry.register("ingest", 10 * MIN);

    const report = registry.report(NOW);
    expect(report.sources).toEqual([
      expect.objectContaining({ source: "ingest", status: "fresh", ageSeconds: 60, staleAfterSeconds: 600 }),
    ]);
  });

  it("reports stale once time passes the threshold without a success", () => {
    const registry = new DataFreshnessRegistry();
    registry.register("ingest", 5 * MIN);
    registry.recordSuccess("ingest", NOW);
    expect(registry.report(new Date(NOW.getTime() + 6 * MIN)).overall).toBe("stale");
  });

  it("reset clears registered sources", () => {
    const registry = new DataFreshnessRegistry();
    registry.register("a", MIN);
    registry.reset();
    expect(registry.report(NOW).sources).toEqual([]);
  });
});
