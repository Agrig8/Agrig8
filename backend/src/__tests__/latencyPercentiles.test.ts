/**
 * Tests for API latency percentiles (issue #177).
 */
import {
  LatencyPercentileTracker,
  latencyTrackingMiddleware,
  percentile,
  routeCategory,
  statusClass,
  apiLatencyTracker,
} from "../lib/latencyPercentiles";
import { EventEmitter } from "events";

describe("routeCategory", () => {
  it("strips api and version prefixes", () => {
    expect(routeCategory("/api/v1/trades/42")).toBe("trades");
    expect(routeCategory("/trades/42/release")).toBe("trades");
  });

  it("ignores query strings and lowercases", () => {
    expect(routeCategory("/Admin/streams?limit=5")).toBe("admin");
  });

  it("returns root for empty paths and other for unsafe segments", () => {
    expect(routeCategory("/")).toBe("root");
    expect(routeCategory("/api/v1")).toBe("root");
    expect(routeCategory("/%2e%2e/secret")).toBe("other");
  });
});

describe("statusClass", () => {
  it.each([
    [200, "2xx"],
    [204, "2xx"],
    [301, "3xx"],
    [404, "4xx"],
    [503, "5xx"],
    [99, "other"],
    [600, "other"],
    [Number.NaN, "other"],
  ])("maps %p to %s", (code, expected) => {
    expect(statusClass(code)).toBe(expected);
  });
});

describe("percentile (nearest-rank)", () => {
  it("returns 0 for an empty window", () => {
    expect(percentile([], 50)).toBe(0);
  });

  it("computes nearest-rank values over sorted input", () => {
    const data = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(data, 50)).toBe(50);
    expect(percentile(data, 95)).toBe(95);
    expect(percentile(data, 99)).toBe(99);
    expect(percentile(data, 100)).toBe(100);
  });

  it("clamps p0 to the first element", () => {
    expect(percentile([7, 9], 0)).toBe(7);
  });
});

describe("LatencyPercentileTracker", () => {
  it("summarises p50/p95/p99 per category and status class", () => {
    const tracker = new LatencyPercentileTracker();
    for (let i = 1; i <= 100; i++) tracker.record("trades", "2xx", i);
    tracker.record("trades", "5xx", 500);

    const summaries = tracker.summaries();
    const ok = summaries.find((s) => s.routeCategory === "trades" && s.statusClass === "2xx");
    expect(ok).toEqual({
      routeCategory: "trades",
      statusClass: "2xx",
      count: 100,
      p50Ms: 50,
      p95Ms: 95,
      p99Ms: 99,
    });
    expect(summaries.find((s) => s.statusClass === "5xx")?.count).toBe(1);
  });

  it("ignores negative, NaN and infinite durations", () => {
    const tracker = new LatencyPercentileTracker();
    tracker.record("x", "2xx", -1);
    tracker.record("x", "2xx", Number.NaN);
    tracker.record("x", "2xx", Number.POSITIVE_INFINITY);
    expect(tracker.summaries()).toEqual([]);
  });

  it("keeps memory bounded by evicting the oldest samples", () => {
    const tracker = new LatencyPercentileTracker(10);
    for (let i = 0; i < 1000; i++) tracker.record("a", "2xx", 1);
    for (let i = 0; i < 10; i++) tracker.record("a", "2xx", 900);
    const [s] = tracker.summaries();
    expect(s.count).toBe(10);
    expect(s.p50Ms).toBe(900);
  });

  it("sorts summaries deterministically and resets", () => {
    const tracker = new LatencyPercentileTracker();
    tracker.record("trades", "5xx", 1);
    tracker.record("admin", "2xx", 1);
    tracker.record("trades", "2xx", 1);
    expect(tracker.summaries().map((s) => `${s.routeCategory}:${s.statusClass}`)).toEqual([
      "admin:2xx",
      "trades:2xx",
      "trades:5xx",
    ]);
    tracker.reset();
    expect(tracker.summaries()).toEqual([]);
  });
});

describe("latencyTrackingMiddleware", () => {
  beforeEach(() => apiLatencyTracker.reset());

  it("records duration and status class when the response finishes", () => {
    const res = Object.assign(new EventEmitter(), { statusCode: 404 });
    const req = { path: "/api/v1/trades/9", url: "/api/v1/trades/9" } as any;
    const next = jest.fn();

    latencyTrackingMiddleware(req, res as any, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(apiLatencyTracker.summaries()).toEqual([]);

    res.emit("finish");
    const [s] = apiLatencyTracker.summaries();
    expect(s).toMatchObject({ routeCategory: "trades", statusClass: "4xx", count: 1 });
    expect(s.p50Ms).toBeGreaterThanOrEqual(0);
  });
});
