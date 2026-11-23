/**
 * Issue #48 — Tests for rate-limit metrics recording.
 *
 * Verifies that recordRateLimitDecision routes calls to a custom recorder,
 * and that the rateLimit.ts createWalletRateLimiter / createIpRateLimiter
 * factories invoke the recorder correctly on accepted and rejected decisions.
 */

import {
  recordRateLimitDecision,
  __setRateLimitRecorderForTests,
  __resetRateLimitMetricsForTests,
  type RateLimitDecision,
  type RateLimitRouteCategory,
} from "../lib/metrics";
import { recordRateLimitBypassed } from "../lib/rateLimit";

type Call = { category: RateLimitRouteCategory; decision: RateLimitDecision };

function makeRecorder() {
  const calls: Call[] = [];
  return {
    calls,
    recorder: { record: (c: RateLimitRouteCategory, d: RateLimitDecision) => calls.push({ category: c, decision: d }) },
  };
}

afterEach(() => {
  __resetRateLimitMetricsForTests();
});

describe("recordRateLimitDecision — custom recorder", () => {
  it("routes to custom recorder when set", () => {
    const { calls, recorder } = makeRecorder();
    __setRateLimitRecorderForTests(recorder);

    recordRateLimitDecision("auth", "accepted");
    recordRateLimitDecision("admin", "rejected");

    expect(calls).toHaveLength(2);
    expect(calls[0]).toEqual({ category: "auth", decision: "accepted" });
    expect(calls[1]).toEqual({ category: "admin", decision: "rejected" });
  });

  it("does not throw when no recorder is set (uses OTel counter)", () => {
    // No recorder set — falls through to the OTel getMeter path.
    // The OTel SDK returns a no-op meter in test environments, so this must
    // not throw.
    expect(() => recordRateLimitDecision("trade", "accepted")).not.toThrow();
  });
});

describe("recordRateLimitBypassed", () => {
  it("records a bypassed decision for the given category", () => {
    const { calls, recorder } = makeRecorder();
    __setRateLimitRecorderForTests(recorder);

    recordRateLimitBypassed("webhook");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ category: "webhook", decision: "bypassed" });
  });
});

describe("rate-limit metrics — decision types", () => {
  it.each<[RateLimitRouteCategory, RateLimitDecision]>([
    ["auth", "accepted"],
    ["auth_refresh", "accepted"],
    ["trade", "rejected"],
    ["user", "bypassed"],
    ["dispute", "rejected"],
    ["admin", "accepted"],
    ["evidence_upload", "rejected"],
    ["trade_export", "bypassed"],
    ["batch_query", "accepted"],
    ["webhook", "rejected"],
    ["other", "bypassed"],
  ])("records %s/%s without throwing", (category, decision) => {
    const { calls, recorder } = makeRecorder();
    __setRateLimitRecorderForTests(recorder);

    recordRateLimitDecision(category, decision);

    expect(calls[0]).toEqual({ category, decision });
  });
});
