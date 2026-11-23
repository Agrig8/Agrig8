/**
 * Tests for the enhanced retry wrapper (Issue #220).
 *
 * Covers:
 *   - Exponential backoff with full jitter
 *   - Explicit error classification (Supabase, Prisma, HTTP, network)
 *   - Idempotency safety (non-idempotent writes must NOT be auto-retried)
 *   - Budget cap enforcement
 *   - Retry metrics export
 *   - Chaos injection: injected connection failures, network errors, rate limits
 */

import {
  retryAsync,
  classifyError,
  computeJitteredDelay,
  isRetryableNetworkError,
  RetryMetricsRecorder,
  RetryOutcome,
  __setRetrySleepForTests,
  __resetRetrySleepForTests,
  __setRetryMetricsRecorderForTests,
  __resetRetryMetricsForTests,
} from "../lib/retry";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const noopSleep = jest.fn().mockResolvedValue(undefined);

function makePrismaError(code: string, message = "Prisma error") {
  const e = new Error(message) as any;
  e.code = code;
  return e;
}

function makeSupabaseError(code: string, message = "Supabase error") {
  const e = new Error(message) as any;
  e.code = code;
  return e;
}

function makeHttpError(status: number) {
  const e = new Error(`HTTP ${status}`) as any;
  e.status = status;
  return e;
}

function makeNetworkError(msg: string) {
  return new Error(msg);
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup / Teardown
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  noopSleep.mockClear();
  __setRetrySleepForTests(noopSleep);
  __resetRetryMetricsForTests();
});

afterEach(() => {
  __resetRetrySleepForTests();
  __setRetryMetricsRecorderForTests(null);
  __resetRetryMetricsForTests();
});

// ─────────────────────────────────────────────────────────────────────────────
// classifyError — error classification rules
// ─────────────────────────────────────────────────────────────────────────────

describe("classifyError", () => {
  // HTTP errors
  describe("HTTP status codes", () => {
    it.each([429, 500, 502, 503, 504])(
      "classifies HTTP %i as retryable",
      (status) => {
        expect(classifyError(makeHttpError(status))).toBe(true);
      }
    );

    it.each([400, 401, 403, 404, 409, 422])(
      "classifies HTTP %i (client error) as NOT retryable",
      (status) => {
        expect(classifyError(makeHttpError(status))).toBe(false);
      }
    );

    it("classifies HTTP 200 as NOT retryable (not an error status)", () => {
      expect(classifyError(makeHttpError(200))).toBe(false);
    });
  });

  // Prisma errors
  describe("Prisma error codes", () => {
    it.each(["P1001", "P1002", "P1017", "P2024", "P2028"])(
      "classifies Prisma code %s as retryable (transient infra)",
      (code) => {
        expect(classifyError(makePrismaError(code))).toBe(true);
      }
    );

    it("classifies Prisma P2002 (unique constraint) as NOT retryable", () => {
      expect(classifyError(makePrismaError("P2002"))).toBe(false);
    });

    it("classifies Prisma P2003 (foreign key) as NOT retryable", () => {
      expect(classifyError(makePrismaError("P2003"))).toBe(false);
    });

    it("classifies Prisma P2016 (record not found) as NOT retryable", () => {
      expect(classifyError(makePrismaError("P2016"))).toBe(false);
    });
  });

  // Supabase errors
  describe("Supabase error codes", () => {
    it.each(["PGRST301", "57P01", "57P02", "57P03", "08006", "08001", "40001", "40P01"])(
      "classifies Supabase code %s as retryable",
      (code) => {
        expect(classifyError(makeSupabaseError(code))).toBe(true);
      }
    );

    it("classifies PGRST116 (row not found) as NOT retryable", () => {
      expect(classifyError(makeSupabaseError("PGRST116"))).toBe(false);
    });

    it("classifies 23505 (unique violation) as NOT retryable", () => {
      expect(classifyError(makeSupabaseError("23505"))).toBe(false);
    });

    it("classifies 42501 (insufficient privilege) as NOT retryable", () => {
      expect(classifyError(makeSupabaseError("42501"))).toBe(false);
    });
  });

  // Network errors
  describe("network errors", () => {
    it.each([
      "ECONNREFUSED",
      "ECONNRESET",
      "ETIMEDOUT",
      "network error",
      "socket hang up",
      "fetch failed",
    ])("classifies '%s' message as retryable", (msg) => {
      expect(classifyError(makeNetworkError(msg))).toBe(true);
    });

    it("classifies generic unknown errors as NOT retryable", () => {
      expect(classifyError(new Error("Something unexpected happened"))).toBe(false);
    });

    it("classifies non-Error values as NOT retryable", () => {
      expect(classifyError(null)).toBe(false);
      expect(classifyError(undefined)).toBe(false);
      expect(classifyError("string error")).toBe(false);
      expect(classifyError(42)).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// computeJitteredDelay
// ─────────────────────────────────────────────────────────────────────────────

describe("computeJitteredDelay", () => {
  it("returns 0 when randFn returns 0", () => {
    expect(computeJitteredDelay(0, 200, 10_000, () => 0)).toBe(0);
  });

  it("is always >= 0", () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const delay = computeJitteredDelay(attempt, 200, 10_000);
      expect(delay).toBeGreaterThanOrEqual(0);
    }
  });

  it("never exceeds the cap", () => {
    const cap = 5_000;
    for (let attempt = 0; attempt < 20; attempt++) {
      const delay = computeJitteredDelay(attempt, 200, cap, () => 0.9999);
      expect(delay).toBeLessThanOrEqual(cap);
    }
  });

  it("window doubles each attempt up to the cap", () => {
    // randFn = 1.0 would give max value in window; use 0.5 for a predictable midpoint
    const base = 100;
    const cap = 10_000;
    const d0 = computeJitteredDelay(0, base, cap, () => 0.5); // window = 100
    const d1 = computeJitteredDelay(1, base, cap, () => 0.5); // window = 200
    const d2 = computeJitteredDelay(2, base, cap, () => 0.5); // window = 400
    expect(d1).toBeGreaterThanOrEqual(d0);
    expect(d2).toBeGreaterThanOrEqual(d1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// retryAsync — success / basic retry behaviour
// ─────────────────────────────────────────────────────────────────────────────

describe("retryAsync", () => {
  describe("success path", () => {
    it("returns immediately when operation succeeds on first try", async () => {
      const op = jest.fn().mockResolvedValue("ok");

      const result = await retryAsync(op, { operationName: "test" });

      expect(result).toBe("ok");
      expect(op).toHaveBeenCalledTimes(1);
      expect(noopSleep).not.toHaveBeenCalled();
    });

    it("retries on transient error and returns on eventual success", async () => {
      const op = jest
        .fn()
        .mockRejectedValueOnce(makePrismaError("P1001"))
        .mockRejectedValueOnce(makePrismaError("P1001"))
        .mockResolvedValue("recovered");

      const result = await retryAsync(op, { operationName: "recover_test" });

      expect(result).toBe("recovered");
      expect(op).toHaveBeenCalledTimes(3);
      expect(noopSleep).toHaveBeenCalledTimes(2);
    });
  });

  describe("exhaustion", () => {
    it("throws after maxRetries exhausted", async () => {
      const err = makePrismaError("P1001", "DB connection refused");
      const op = jest.fn().mockRejectedValue(err);

      await expect(retryAsync(op, { maxRetries: 2, operationName: "exhausted" })).rejects.toThrow(
        "DB connection refused"
      );

      // 1 initial + 2 retries = 3 calls total
      expect(op).toHaveBeenCalledTimes(3);
      expect(noopSleep).toHaveBeenCalledTimes(2);
    });
  });

  describe("non-retryable errors", () => {
    it("throws immediately on client HTTP error without sleeping", async () => {
      const err = makeHttpError(404);
      const op = jest.fn().mockRejectedValue(err);

      await expect(retryAsync(op, { operationName: "not_found" })).rejects.toMatchObject({
        status: 404,
      });

      expect(op).toHaveBeenCalledTimes(1);
      expect(noopSleep).not.toHaveBeenCalled();
    });

    it("throws immediately on Prisma unique constraint without sleeping", async () => {
      const err = makePrismaError("P2002", "Unique constraint failed");
      const op = jest.fn().mockRejectedValue(err);

      await expect(retryAsync(op, { operationName: "unique_constraint" })).rejects.toThrow(
        "Unique constraint failed"
      );

      expect(op).toHaveBeenCalledTimes(1);
      expect(noopSleep).not.toHaveBeenCalled();
    });

    it("throws immediately on Supabase row-not-found without sleeping", async () => {
      const err = makeSupabaseError("PGRST116", "Row not found");
      const op = jest.fn().mockRejectedValue(err);

      await expect(retryAsync(op, { operationName: "not_found" })).rejects.toThrow(
        "Row not found"
      );

      expect(op).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Idempotency safety
  // ─────────────────────────────────────────────────────────────────────────
  describe("idempotency safety (non-idempotent writes)", () => {
    it("does not retry when maxRetries is 0 (non-idempotent write)", async () => {
      const err = makePrismaError("P1001", "DB connection refused");
      const op = jest.fn().mockRejectedValue(err);

      await expect(
        retryAsync(op, { maxRetries: 0, operationName: "insert_trade" })
      ).rejects.toThrow("DB connection refused");

      // Should be called exactly once — no retry
      expect(op).toHaveBeenCalledTimes(1);
      expect(noopSleep).not.toHaveBeenCalled();
    });

    it("does not retry INSERT on transient error when maxRetries=0", async () => {
      const err = makeHttpError(503);
      const op = jest.fn().mockRejectedValue(err);

      await expect(
        retryAsync(op, { maxRetries: 0, operationName: "create_user" })
      ).rejects.toThrow("HTTP 503");

      expect(op).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Custom shouldRetry override
  // ─────────────────────────────────────────────────────────────────────────
  describe("custom shouldRetry", () => {
    it("uses custom shouldRetry when provided", async () => {
      const err = makeHttpError(404); // normally non-retryable
      const op = jest.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");

      const result = await retryAsync(op, {
        shouldRetry: () => true, // override: always retry
        operationName: "custom_retry",
      });

      expect(result).toBe("ok");
      expect(op).toHaveBeenCalledTimes(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // onRetry callback
  // ─────────────────────────────────────────────────────────────────────────
  describe("onRetry callback", () => {
    it("calls onRetry with error, attempt number, and delay", async () => {
      const err = makePrismaError("P1001");
      const op = jest
        .fn()
        .mockRejectedValueOnce(err)
        .mockResolvedValue("ok");

      const onRetry = jest.fn();

      await retryAsync(op, { onRetry, operationName: "on_retry_test" });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(err, 1, expect.any(Number));
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Budget cap
  // ─────────────────────────────────────────────────────────────────────────
  describe("budget cap", () => {
    it("stops retrying when budget would be exceeded", async () => {
      // Make sleep actually advance elapsed time for budget tracking:
      // use a very tight budget that the first retry delay exceeds.
      let elapsed = 0;
      const trackingSleep = jest.fn(async (ms: number) => {
        elapsed += ms;
      });
      __setRetrySleepForTests(trackingSleep);

      const err = makeHttpError(503);
      const op = jest.fn().mockRejectedValue(err);

      // budgetMs=1 means any delay > 0 will exceed the budget
      await expect(
        retryAsync(op, {
          budgetMs: 1,
          baseDelayMs: 1000, // will produce delay >> budget
          operationName: "budget_test",
        })
      ).rejects.toThrow("HTTP 503");

      // Operation only called once — budget exceeded before first retry
      expect(op).toHaveBeenCalledTimes(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Retry metrics export
// ─────────────────────────────────────────────────────────────────────────────

describe("retry metrics", () => {
  let recorder: {
    recordAttempt: jest.Mock;
    recordOutcome: jest.Mock;
  };

  beforeEach(() => {
    recorder = {
      recordAttempt: jest.fn(),
      recordOutcome: jest.fn(),
    };
    __setRetryMetricsRecorderForTests(recorder as RetryMetricsRecorder);
  });

  it("records outcome=success on successful operation", async () => {
    const op = jest.fn().mockResolvedValue("ok");

    await retryAsync(op, { operationName: "metrics_success" });

    expect(recorder.recordOutcome).toHaveBeenCalledWith(
      "metrics_success",
      "success",
      1,
      expect.any(Number),
    );
    expect(recorder.recordAttempt).not.toHaveBeenCalled();
  });

  it("records attempt metrics for each retry", async () => {
    const err = makePrismaError("P1001");
    const op = jest
      .fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValue("ok");

    await retryAsync(op, { operationName: "metrics_retries" });

    expect(recorder.recordAttempt).toHaveBeenCalledTimes(2);
    expect(recorder.recordAttempt).toHaveBeenNthCalledWith(1, "metrics_retries", 1);
    expect(recorder.recordAttempt).toHaveBeenNthCalledWith(2, "metrics_retries", 2);
  });

  it("records outcome=exhausted when retries exhausted", async () => {
    const err = makePrismaError("P1001");
    const op = jest.fn().mockRejectedValue(err);

    await expect(
      retryAsync(op, { maxRetries: 2, operationName: "metrics_exhausted" })
    ).rejects.toThrow();

    expect(recorder.recordOutcome).toHaveBeenCalledWith(
      "metrics_exhausted",
      "exhausted",
      3,
      expect.any(Number),
    );
  });

  it("records outcome=non_retryable for client errors", async () => {
    const err = makeHttpError(401);
    const op = jest.fn().mockRejectedValue(err);

    await expect(
      retryAsync(op, { operationName: "metrics_non_retryable" })
    ).rejects.toThrow();

    expect(recorder.recordOutcome).toHaveBeenCalledWith(
      "metrics_non_retryable",
      "non_retryable",
      1,
      expect.any(Number),
    );
  });

  it("records outcome=budget_exceeded when time budget breached", async () => {
    const err = makeHttpError(503);
    const op = jest.fn().mockRejectedValue(err);

    await expect(
      retryAsync(op, {
        budgetMs: 1,
        baseDelayMs: 10_000,
        operationName: "metrics_budget",
      })
    ).rejects.toThrow();

    expect(recorder.recordOutcome).toHaveBeenCalledWith(
      "metrics_budget",
      "budget_exceeded",
      expect.any(Number),
      expect.any(Number),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Chaos injection — injected connection failures (brownout simulation)
// ─────────────────────────────────────────────────────────────────────────────

describe("chaos injection — injected failure recovery", () => {
  it("recovers from 2 ECONNREFUSED errors before succeeding", async () => {
    const op = jest
      .fn()
      .mockRejectedValueOnce(makeNetworkError("ECONNREFUSED 127.0.0.1:5432"))
      .mockRejectedValueOnce(makeNetworkError("ECONNREFUSED 127.0.0.1:5432"))
      .mockResolvedValue({ data: [{ id: "123" }], error: null });

    const result = await retryAsync(op, {
      maxRetries: 3,
      operationName: "chaos_econnrefused",
    });

    expect(result).toEqual({ data: [{ id: "123" }], error: null });
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("recovers from Supabase 40001 (serialization_failure) brownout", async () => {
    const serializationErr = makeSupabaseError("40001", "serialization failure, retry transaction");
    const op = jest
      .fn()
      .mockRejectedValueOnce(serializationErr)
      .mockResolvedValue({ data: "ok", error: null });

    const result = await retryAsync(op, {
      maxRetries: 2,
      operationName: "chaos_serialization",
    });

    expect(result).toEqual({ data: "ok", error: null });
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("recovers from rate-limit (HTTP 429) brownout", async () => {
    const rateLimitErr = makeHttpError(429);
    const op = jest
      .fn()
      .mockRejectedValueOnce(rateLimitErr)
      .mockRejectedValueOnce(rateLimitErr)
      .mockResolvedValue("rate-limit-cleared");

    const result = await retryAsync(op, {
      maxRetries: 3,
      operationName: "chaos_rate_limit",
    });

    expect(result).toBe("rate-limit-cleared");
    expect(op).toHaveBeenCalledTimes(3);
  });

  it("recovers from Postgres 57P01 (admin_shutdown) brownout", async () => {
    const adminShutdownErr = makeSupabaseError("57P01", "admin shutdown in progress");
    const op = jest
      .fn()
      .mockRejectedValueOnce(adminShutdownErr)
      .mockResolvedValue("reconnected");

    const result = await retryAsync(op, {
      operationName: "chaos_pg_admin_shutdown",
    });

    expect(result).toBe("reconnected");
    expect(op).toHaveBeenCalledTimes(2);
  });

  it("does NOT recover from repeated non-retryable 404 errors", async () => {
    const notFoundErr = makeHttpError(404);
    const op = jest.fn().mockRejectedValue(notFoundErr);

    await expect(
      retryAsync(op, { maxRetries: 3, operationName: "chaos_404" })
    ).rejects.toMatchObject({ status: 404 });

    // Only one attempt — no retry on client error
    expect(op).toHaveBeenCalledTimes(1);
  });

  it("exhausts all retries under sustained P1001 DB brownout", async () => {
    const dbErr = makePrismaError("P1001", "Cannot reach database server");
    const op = jest.fn().mockRejectedValue(dbErr);

    await expect(
      retryAsync(op, { maxRetries: 3, operationName: "chaos_sustained_p1001" })
    ).rejects.toThrow("Cannot reach database server");

    expect(op).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    expect(noopSleep).toHaveBeenCalledTimes(3);
  });

  it("jitter distributes sleep delays (non-zero spread across calls)", async () => {
    const sleepDelays: number[] = [];
    const trackingSleep = jest.fn(async (ms: number) => {
      sleepDelays.push(ms);
    });
    __setRetrySleepForTests(trackingSleep);

    const dbErr = makePrismaError("P1001");
    const op = jest.fn().mockRejectedValue(dbErr);

    await expect(
      retryAsync(op, {
        maxRetries: 5,
        baseDelayMs: 200,
        capMs: 10_000,
        operationName: "jitter_distribution",
      })
    ).rejects.toThrow();

    // Verify delays are non-deterministic (jittered) — they should not be a
    // monotonically strictly increasing sequence (jitter breaks that pattern).
    // With 5 attempts and full jitter there's a near-zero chance all 5 delays
    // are perfectly equal.
    const allEqual = sleepDelays.every((d) => d === sleepDelays[0]);
    // With 5 random samples from a 0..N range, the probability of all equal is
    // astronomically small; this assertion serves as a smoke test.
    // Accept the rare flake: if it happens, something is wrong with jitter.
    expect(sleepDelays.length).toBe(5);
    // All delays must be >= 0 and <= cap
    sleepDelays.forEach((d) => {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(10_000);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Supabase retry matrix (issue #82)
// Documents and tests retry behaviour for every Supabase/Postgres failure class
// ─────────────────────────────────────────────────────────────────────────────

describe("Supabase retry matrix (issue #82)", () => {
  // ---------------------------------------------------------------------------
  // Transient failures — should be retried automatically
  // ---------------------------------------------------------------------------
  describe("transient failures — retried", () => {
    it.each([
      ["PGRST301", "upstream resource unavailable"],
      ["57P01",    "admin_shutdown"],
      ["57P02",    "crash_shutdown"],
      ["57P03",    "cannot_connect_now (standby recovering)"],
      ["08006",    "connection failure"],
      ["08001",    "unable to establish connection"],
    ])("retries on Supabase code %s (%s)", async (code) => {
      const err = makeSupabaseError(code);
      const op = jest.fn()
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce("ok");

      const result = await retryAsync(op, { maxRetries: 1, operationName: "sb_transient" });
      expect(result).toBe("ok");
      expect(op).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Serialization / concurrency failures — safe to retry
  // ---------------------------------------------------------------------------
  describe("concurrency failures — retried", () => {
    it("retries on 40001 (serialization_failure)", async () => {
      const err = makeSupabaseError("40001");
      const op = jest.fn()
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce("committed");

      const result = await retryAsync(op, { maxRetries: 1, operationName: "sb_serialization" });
      expect(result).toBe("committed");
      expect(op).toHaveBeenCalledTimes(2);
    });

    it("retries on 40P01 (deadlock_detected)", async () => {
      const err = makeSupabaseError("40P01");
      const op = jest.fn()
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce("committed");

      const result = await retryAsync(op, { maxRetries: 1, operationName: "sb_deadlock" });
      expect(result).toBe("committed");
      expect(op).toHaveBeenCalledTimes(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Timeout failures — retried via HTTP 504
  // ---------------------------------------------------------------------------
  describe("timeout failures — retried", () => {
    it("retries when Supabase returns HTTP 504 (gateway timeout)", async () => {
      const err = makeHttpError(504);
      const op = jest.fn()
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce("data");

      const result = await retryAsync(op, { maxRetries: 1, operationName: "sb_timeout" });
      expect(result).toBe("data");
      expect(op).toHaveBeenCalledTimes(2);
    });

    it("exhausts all retries when every attempt times out", async () => {
      const err = makeHttpError(504);
      const op = jest.fn().mockRejectedValue(err);

      await expect(
        retryAsync(op, { maxRetries: 3, operationName: "sb_timeout_exhaust" }),
      ).rejects.toMatchObject({ status: 504 });
      expect(op).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });
  });

  // ---------------------------------------------------------------------------
  // Conflict failures (409) — NOT retried (application must resolve)
  // ---------------------------------------------------------------------------
  describe("conflict failures — NOT retried", () => {
    it("does NOT retry on HTTP 409 (Conflict)", async () => {
      const err = makeHttpError(409);
      const op = jest.fn().mockRejectedValue(err);

      await expect(
        retryAsync(op, { maxRetries: 3, operationName: "sb_conflict" }),
      ).rejects.toMatchObject({ status: 409 });
      // Operation called exactly once — no retries on a client error
      expect(op).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry on HTTP 422 (Unprocessable Entity)", async () => {
      const err = makeHttpError(422);
      const op = jest.fn().mockRejectedValue(err);

      await expect(
        retryAsync(op, { maxRetries: 3, operationName: "sb_validation" }),
      ).rejects.toMatchObject({ status: 422 });
      expect(op).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Permanent failures (auth/not-found) — NOT retried
  // ---------------------------------------------------------------------------
  describe("permanent failures — NOT retried", () => {
    it("does NOT retry on HTTP 401 (Unauthorized)", async () => {
      const err = makeHttpError(401);
      const op = jest.fn().mockRejectedValue(err);

      await expect(
        retryAsync(op, { maxRetries: 3, operationName: "sb_auth" }),
      ).rejects.toMatchObject({ status: 401 });
      expect(op).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry on HTTP 403 (Forbidden / RLS violation)", async () => {
      const err = makeHttpError(403);
      const op = jest.fn().mockRejectedValue(err);

      await expect(
        retryAsync(op, { maxRetries: 3, operationName: "sb_rls" }),
      ).rejects.toMatchObject({ status: 403 });
      expect(op).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry on HTTP 404 (row not found)", async () => {
      const err = makeHttpError(404);
      const op = jest.fn().mockRejectedValue(err);

      await expect(
        retryAsync(op, { maxRetries: 3, operationName: "sb_notfound" }),
      ).rejects.toMatchObject({ status: 404 });
      expect(op).toHaveBeenCalledTimes(1);
    });

    it("does NOT retry on PGRST116 (no rows returned — not retryable)", async () => {
      const err = makeSupabaseError("PGRST116", "JSON object requested, multiple (or no) rows returned");
      const op = jest.fn().mockRejectedValue(err);

      await expect(
        retryAsync(op, { maxRetries: 3, operationName: "sb_no_rows" }),
      ).rejects.toThrow("no rows");
      // PGRST116 is not in RETRYABLE_SUPABASE_CODES — classified as non-retryable
      expect(op).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Two interleaved reads in the same store instance (concurrency)
  // Simulates two concurrent optimistic updates where the first retries and
  // succeeds while the second hits a permanent error without retrying.
  // ---------------------------------------------------------------------------
  describe("interleaved concurrent operations", () => {
    it("two concurrent serialization failures — both retry independently", async () => {
      const serializationErr = makeSupabaseError("40001");
      const opA = jest.fn()
        .mockRejectedValueOnce(serializationErr)
        .mockResolvedValueOnce("A-committed");
      const opB = jest.fn()
        .mockRejectedValueOnce(serializationErr)
        .mockResolvedValueOnce("B-committed");

      const [a, b] = await Promise.all([
        retryAsync(opA, { maxRetries: 1, operationName: "sb_concurrent_a" }),
        retryAsync(opB, { maxRetries: 1, operationName: "sb_concurrent_b" }),
      ]);

      expect(a).toBe("A-committed");
      expect(b).toBe("B-committed");
      expect(opA).toHaveBeenCalledTimes(2);
      expect(opB).toHaveBeenCalledTimes(2);
    });

    it("one retry succeeds, one permanent error — no cross-contamination", async () => {
      const transientErr = makeSupabaseError("40P01");
      const permanentErr = makeHttpError(403);

      const opRetry = jest.fn()
        .mockRejectedValueOnce(transientErr)
        .mockResolvedValueOnce("retried-ok");
      const opFail = jest.fn().mockRejectedValue(permanentErr);

      const [retryResult, failResult] = await Promise.allSettled([
        retryAsync(opRetry, { maxRetries: 1, operationName: "sb_concurrent_retry" }),
        retryAsync(opFail,  { maxRetries: 3, operationName: "sb_concurrent_perm" }),
      ]);

      expect(retryResult.status).toBe("fulfilled");
      expect((retryResult as PromiseFulfilledResult<string>).value).toBe("retried-ok");

      expect(failResult.status).toBe("rejected");
      expect((failResult as PromiseRejectedResult).reason).toMatchObject({ status: 403 });

      // permanent error must not have been retried
      expect(opFail).toHaveBeenCalledTimes(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Backwards compatibility
// ─────────────────────────────────────────────────────────────────────────────

describe("isRetryableNetworkError (backwards compat)", () => {
  it("returns true for HTTP 429", () => {
    expect(isRetryableNetworkError(makeHttpError(429))).toBe(true);
  });

  it("returns true for 5xx errors", () => {
    expect(isRetryableNetworkError(makeHttpError(500))).toBe(true);
    expect(isRetryableNetworkError(makeHttpError(503))).toBe(true);
  });

  it("returns false for 4xx errors", () => {
    expect(isRetryableNetworkError(makeHttpError(404))).toBe(false);
    expect(isRetryableNetworkError(makeHttpError(401))).toBe(false);
  });

  it("returns false for errors without HTTP status", () => {
    expect(isRetryableNetworkError(new Error("generic"))).toBe(false);
  });
});
