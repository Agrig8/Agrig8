/**
 * Issue #42 — Idempotency key support for trade creation.
 *
 * Verifies that:
 *  - A second POST /trades with the same Idempotency-Key replays the first
 *    response without creating a second pending trade.
 *  - A second POST with the same key but a different request body is rejected
 *    with 409 Conflict.
 *  - A POST without an Idempotency-Key proceeds normally (idempotency is opt-in).
 *  - A POST with a key that is already in-flight returns 409 with Retry-After.
 */

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-at-least-32-characters-long";
process.env.JWT_ISSUER = "amana";
process.env.JWT_AUDIENCE = "amana-api";
process.env.DATABASE_URL = "postgres://dummy";
process.env.AMANA_ESCROW_CONTRACT_ID = "C123";
process.env.USDC_CONTRACT_ID = "C456";

import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import * as StellarSdk from "@stellar/stellar-sdk";
import { tradeRoutes } from "../routes/trade.routes";
import { ContractService } from "../services/contract.service";
import { TradeService } from "../services/trade.service";
import { AuthService } from "../services/auth.service";
import { errorHandler } from "../middleware/errorHandler";

// ── Mock heavy deps ──────────────────────────────────────────────────────────

jest.mock("../services/contract.service");
jest.mock("../services/trade.service");
jest.mock("../services/auth.service", () => ({
  AuthService: {
    validateToken: jest.fn(async (token: string) => {
      const { decode } = require("jsonwebtoken");
      return decode(token);
    }),
    isTokenRevoked: jest.fn().mockResolvedValue(false),
  },
}));
jest.mock("../services/alert.service", () => ({
  alertService: { dispatch: jest.fn().mockResolvedValue(undefined) },
}));

// ── Redis mock — controls cache state per test ───────────────────────────────

const redisMock = {
  get: jest.fn<Promise<string | null>, [string]>().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(1),
};

jest.mock("../lib/redis", () => ({ redis: redisMock }));
jest.mock("ioredis", () => jest.fn().mockImplementation(() => redisMock));

// ── Test app ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.use("/trades", tradeRoutes);
app.use(errorHandler);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const buyerAddress = StellarSdk.Keypair.random().publicKey();
const sellerAddress = StellarSdk.Keypair.random().publicKey();
const otherSeller = StellarSdk.Keypair.random().publicKey();

const secret = process.env.JWT_SECRET!;
const now = Math.floor(Date.now() / 1000);
const token = jwt.sign(
  {
    walletAddress: buyerAddress,
    jti: "idempotency-test-jti",
    iss: "amana",
    aud: "amana-api",
    nbf: now - 1,
  },
  secret,
  { algorithm: "HS256" },
);

const validBody = {
  sellerAddress,
  amountUsdc: "100.0000000",
  buyerLossBps: 5000,
  sellerLossBps: 5000,
};

const cachedResponse = {
  status: 201,
  body: { tradeId: "trade-cached-abc", status: "PENDING_SIGNATURE" },
  headers: { "content-type": "application/json" },
  requestBodyHash: "placeholder", // overridden per test
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupContractMock(tradeId = "trade-new-xyz") {
  (ContractService.prototype.buildCreateTradeTx as jest.Mock).mockResolvedValue({
    unsignedXdr: "AAAA",
    tradeId,
  });
  (TradeService.prototype.createPendingTrade as jest.Mock).mockResolvedValue({
    tradeId,
    status: "PENDING_SIGNATURE",
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /trades idempotency", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redisMock.get.mockResolvedValue(null);
    redisMock.set.mockResolvedValue("OK");
    redisMock.del.mockResolvedValue(1);
  });

  it("creates a new trade when no Idempotency-Key header is sent", async () => {
    setupContractMock("trade-no-key");

    const res = await request(app)
      .post("/trades")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(TradeService.prototype.createPendingTrade).toHaveBeenCalledTimes(1);
  });

  it("creates a new trade on the first request with an Idempotency-Key", async () => {
    setupContractMock("trade-first");
    // Cache miss — no prior response stored.
    redisMock.get.mockResolvedValue(null);

    const res = await request(app)
      .post("/trades")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "key-first-trade")
      .send(validBody);

    expect(res.status).toBe(201);
    expect(TradeService.prototype.createPendingTrade).toHaveBeenCalledTimes(1);
  });

  it("replays cached response on a duplicate request with the same Idempotency-Key", async () => {
    // Simulate a cache hit: Redis returns a stored successful response.
    const import_ = require("crypto");
    const bodyHash = import_.createHash("sha256")
      .update(JSON.stringify(validBody))
      .digest("hex");

    const cached = { ...cachedResponse, requestBodyHash: bodyHash };
    redisMock.get.mockResolvedValue(JSON.stringify(cached));

    const res = await request(app)
      .post("/trades")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "key-duplicate")
      .send(validBody);

    // Should replay — no service call, header indicates cache hit.
    expect(res.status).toBe(201);
    expect(TradeService.prototype.createPendingTrade).not.toHaveBeenCalled();
    expect(res.headers["x-idempotency-cache"]).toBe("HIT");
  });

  it("returns 409 when the same key is reused with a different request body", async () => {
    // Stored body was for `validBody`; now send a different seller.
    const import_ = require("crypto");
    const originalHash = import_.createHash("sha256")
      .update(JSON.stringify(validBody))
      .digest("hex");

    const cached = { ...cachedResponse, requestBodyHash: originalHash };
    redisMock.get.mockResolvedValue(JSON.stringify(cached));

    const differentBody = { ...validBody, sellerAddress: otherSeller };
    const res = await request(app)
      .post("/trades")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "key-body-mismatch")
      .send(differentBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/different request body/i);
    expect(TradeService.prototype.createPendingTrade).not.toHaveBeenCalled();
  });

  it("returns 409 with Retry-After when the key is already in-flight", async () => {
    // First get() = null (no cached result), set() on the lock returns null
    // (another worker holds the lock), second get() = null (not done yet).
    redisMock.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    redisMock.set.mockResolvedValueOnce(null as unknown as "OK"); // lock not acquired

    const res = await request(app)
      .post("/trades")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", "key-in-flight")
      .send(validBody);

    expect(res.status).toBe(409);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(res.headers["x-idempotency-cache"]).toBe("IN_PROGRESS");
    expect(TradeService.prototype.createPendingTrade).not.toHaveBeenCalled();
  });
});
