/**
 * Issue #46 — Tests for retryClassificationMiddleware.
 *
 * Verifies that ClassifiedServiceErrors get X-Retryable and, where appropriate,
 * Retry-After headers injected before the generic error handler fires, while
 * plain errors pass through without interference.
 */

import { Request, Response } from "express";
import {
  StellarError,
  IpfsError,
  DatabaseError,
  CacheError,
} from "../errors/service.errors";
import { retryClassificationMiddleware } from "../middleware/retryClassification.middleware";

function makeRes(): jest.Mocked<Partial<Response>> & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: jest.fn((key: string, value: string) => { headers[key] = value; }),
  } as any;
}

function makeNext() {
  return jest.fn();
}

// ── Stellar ───────────────────────────────────────────────────────────────────

describe("retryClassificationMiddleware — Stellar errors", () => {
  it("adds X-Retryable: true for a retryable Stellar error", () => {
    const err = new StellarError({ code: "STELLAR_BAD_SEQUENCE", message: "stale seq", httpStatus: 409, retryable: true });
    const res = makeRes();
    const next = makeNext();

    retryClassificationMiddleware(err, {} as Request, res as unknown as Response, next);

    expect(res.headers["x-retryable"]).toBe("true");
    expect(next).toHaveBeenCalledWith(err);
  });

  it("adds X-Retryable: false for a non-retryable Stellar error", () => {
    const err = new StellarError({ code: "STELLAR_INSUFFICIENT_BALANCE", message: "no funds", httpStatus: 402, retryable: false });
    const res = makeRes();
    const next = makeNext();

    retryClassificationMiddleware(err, {} as Request, res as unknown as Response, next);

    expect(res.headers["x-retryable"]).toBe("false");
    expect(res.headers["retry-after"]).toBeUndefined();
  });

  it("adds Retry-After for a 429 retryable Stellar error", () => {
    const err = new StellarError({ code: "STELLAR_RATE_LIMITED", message: "rate limit", httpStatus: 429, retryable: true });
    const res = makeRes();
    const next = makeNext();

    retryClassificationMiddleware(err, {} as Request, res as unknown as Response, next);

    expect(res.headers["x-retryable"]).toBe("true");
    expect(res.headers["retry-after"]).toBeDefined();
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
  });

  it("adds Retry-After for a 503 retryable error", () => {
    const err = new StellarError({ code: "STELLAR_TIMEOUT", message: "timeout", httpStatus: 503, retryable: true });
    const res = makeRes();
    const next = makeNext();

    retryClassificationMiddleware(err, {} as Request, res as unknown as Response, next);

    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("does NOT add Retry-After for a 409 retryable error", () => {
    const err = new StellarError({ code: "STELLAR_BAD_SEQUENCE", message: "stale seq", httpStatus: 409, retryable: true });
    const res = makeRes();
    const next = makeNext();

    retryClassificationMiddleware(err, {} as Request, res as unknown as Response, next);

    expect(res.headers["retry-after"]).toBeUndefined();
  });
});

// ── IPFS ─────────────────────────────────────────────────────────────────────

describe("retryClassificationMiddleware — IPFS errors", () => {
  it("adds X-Retryable: false for IPFS_NOT_FOUND (non-retryable)", () => {
    const err = new IpfsError({ code: "IPFS_NOT_FOUND", message: "not found", httpStatus: 404, retryable: false });
    const res = makeRes();
    const next = makeNext();

    retryClassificationMiddleware(err, {} as Request, res as unknown as Response, next);

    expect(res.headers["x-retryable"]).toBe("false");
  });

  it("adds X-Retryable: true for a 502 IPFS error (retryable)", () => {
    const err = new IpfsError({ code: "IPFS_UNKNOWN_ERROR", message: "gateway error", httpStatus: 502, retryable: true });
    const res = makeRes();
    const next = makeNext();

    retryClassificationMiddleware(err, {} as Request, res as unknown as Response, next);

    expect(res.headers["x-retryable"]).toBe("true");
  });
});

// ── Database ──────────────────────────────────────────────────────────────────

describe("retryClassificationMiddleware — Database errors", () => {
  it("adds X-Retryable: false for a unique-constraint violation", () => {
    const err = new DatabaseError({ code: "DATABASE_UNIQUE_CONSTRAINT", message: "duplicate", httpStatus: 409, retryable: false });
    const res = makeRes();
    const next = makeNext();

    retryClassificationMiddleware(err, {} as Request, res as unknown as Response, next);

    expect(res.headers["x-retryable"]).toBe("false");
    expect(next).toHaveBeenCalledWith(err);
  });
});

// ── Cache ─────────────────────────────────────────────────────────────────────

describe("retryClassificationMiddleware — Cache errors", () => {
  it("adds X-Retryable: true and Retry-After for a 503 cache error", () => {
    const err = new CacheError({ code: "CACHE_TIMEOUT", message: "redis timeout", httpStatus: 503, retryable: true });
    const res = makeRes();
    const next = makeNext();

    retryClassificationMiddleware(err, {} as Request, res as unknown as Response, next);

    expect(res.headers["x-retryable"]).toBe("true");
    expect(res.headers["retry-after"]).toBeDefined();
  });
});

// ── Non-ClassifiedServiceError passthrough ────────────────────────────────────

describe("retryClassificationMiddleware — passthrough for non-service errors", () => {
  it("forwards plain Error without touching headers", () => {
    const err = new Error("plain error");
    const res = makeRes();
    const next = makeNext();

    retryClassificationMiddleware(err, {} as Request, res as unknown as Response, next);

    expect(res.headers["x-retryable"]).toBeUndefined();
    expect(next).toHaveBeenCalledWith(err);
  });

  it("forwards null without touching headers", () => {
    const res = makeRes();
    const next = makeNext();

    retryClassificationMiddleware(null, {} as Request, res as unknown as Response, next);

    expect(res.headers["x-retryable"]).toBeUndefined();
    expect(next).toHaveBeenCalledWith(null);
  });
});
