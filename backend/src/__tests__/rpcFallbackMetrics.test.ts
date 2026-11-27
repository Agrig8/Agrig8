/**
 * Issue #83 — Tests for Stellar RPC fallback metrics.
 */

import {
  recordRpcProviderSelection,
  recordRpcFallback,
  recordRpcProviderFailure,
  __setRpcFallbackRecorderForTests,
  __resetRpcFallbackMetricsForTests,
  type RpcProviderSelection,
  type RpcFallbackReason,
} from "../lib/metrics";

type SelectionCall = { provider: RpcProviderSelection; endpoint: string; latencyMs: number };
type FallbackCall = { reason: RpcFallbackReason; primaryEndpoint: string; fallbackEndpoint: string };
type FailureCall = { provider: RpcProviderSelection; endpoint: string };

function makeRecorder() {
  const selections: SelectionCall[] = [];
  const fallbacks: FallbackCall[] = [];
  const failures: FailureCall[] = [];
  return {
    selections, fallbacks, failures,
    recorder: {
      recordProviderSelection: (p: RpcProviderSelection, e: string, l: number) =>
        selections.push({ provider: p, endpoint: e, latencyMs: l }),
      recordFallback: (r: RpcFallbackReason, pe: string, fe: string) =>
        fallbacks.push({ reason: r, primaryEndpoint: pe, fallbackEndpoint: fe }),
      recordProviderFailureRate: (p: RpcProviderSelection, e: string) =>
        failures.push({ provider: p, endpoint: e }),
    },
  };
}

afterEach(() => {
  __resetRpcFallbackMetricsForTests();
});

describe("recordRpcProviderSelection", () => {
  it("routes primary selection to recorder", () => {
    const { selections, recorder } = makeRecorder();
    __setRpcFallbackRecorderForTests(recorder);

    recordRpcProviderSelection("primary", "https://rpc.example.com", 42);

    expect(selections).toHaveLength(1);
    expect(selections[0]).toMatchObject({ provider: "primary", endpoint: "https://rpc.example.com", latencyMs: 42 });
  });

  it("routes fallback selection to recorder", () => {
    const { selections, recorder } = makeRecorder();
    __setRpcFallbackRecorderForTests(recorder);

    recordRpcProviderSelection("fallback", "https://fallback.example.com", 180);

    expect(selections[0]).toMatchObject({ provider: "fallback" });
  });

  it("does not throw without a recorder (OTel no-op)", () => {
    expect(() => recordRpcProviderSelection("primary", "https://rpc.example.com", 10)).not.toThrow();
  });
});

describe("recordRpcFallback", () => {
  it("records primary_error fallback with both endpoints", () => {
    const { fallbacks, recorder } = makeRecorder();
    __setRpcFallbackRecorderForTests(recorder);

    recordRpcFallback("primary_error", "https://primary.example.com", "https://fallback.example.com");

    expect(fallbacks[0]).toMatchObject({
      reason: "primary_error",
      primaryEndpoint: "https://primary.example.com",
      fallbackEndpoint: "https://fallback.example.com",
    });
  });

  it.each<RpcFallbackReason>(["primary_error", "primary_timeout", "circuit_open"])(
    "records fallback reason %s",
    (reason) => {
      const { fallbacks, recorder } = makeRecorder();
      __setRpcFallbackRecorderForTests(recorder);

      recordRpcFallback(reason, "prim", "fall");

      expect(fallbacks[0].reason).toBe(reason);
    },
  );
});

describe("recordRpcProviderFailure", () => {
  it("records failure for primary provider", () => {
    const { failures, recorder } = makeRecorder();
    __setRpcFallbackRecorderForTests(recorder);

    recordRpcProviderFailure("primary", "https://rpc.example.com");

    expect(failures[0]).toMatchObject({ provider: "primary", endpoint: "https://rpc.example.com" });
  });

  it("records failure for fallback provider", () => {
    const { failures, recorder } = makeRecorder();
    __setRpcFallbackRecorderForTests(recorder);

    recordRpcProviderFailure("fallback", "https://fallback.example.com");

    expect(failures[0].provider).toBe("fallback");
  });
});
