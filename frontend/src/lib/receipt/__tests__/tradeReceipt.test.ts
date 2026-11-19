import { webcrypto } from "crypto";
import { TextEncoder as NodeTextEncoder } from "util";
import type { Trade } from "@/lib/validation/schemas";
import {
  buildTradeReceipt,
  buildTradeReceiptBody,
  canonicalJson,
  maskAddress,
  receiptFilename,
  renderTradeReceiptText,
  verifyTradeReceipt,
} from "../tradeReceipt";

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
  }
  if (typeof globalThis.TextEncoder === "undefined") {
    Object.defineProperty(globalThis, "TextEncoder", { value: NodeTextEncoder, configurable: true });
  }
});

const BUYER = "GBUYERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWXYZ";
const SELLER = "GSELLERBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBQRST";

const trade: Trade & { privateNote?: string; email?: string } = {
  tradeId: "trade-42",
  buyerAddress: BUYER,
  sellerAddress: SELLER,
  amountCngn: "1500.50",
  buyerLossBps: 0,
  sellerLossBps: 0,
  status: "settled",
  createdAt: "2026-01-02T10:00:00.000Z",
  updatedAt: "2026-01-05T12:30:00.000Z",
  // Extra fields that must never reach the receipt.
  privateNote: "call me at night",
  email: "buyer@example.com",
};

const FIXED_DATE = new Date("2026-01-06T08:00:00.000Z");

describe("maskAddress", () => {
  it("keeps a short prefix and suffix", () => {
    expect(maskAddress(BUYER)).toBe(`${BUYER.slice(0, 6)}…${BUYER.slice(-4)}`);
  });

  it("fully masks short values", () => {
    expect(maskAddress("abc")).toBe("…");
  });
});

describe("buildTradeReceiptBody", () => {
  it("includes only whitelisted fields and masks wallet addresses", () => {
    const body = buildTradeReceiptBody(trade, FIXED_DATE);
    const serialized = JSON.stringify(body);

    expect(body.trade).toEqual({
      tradeId: "trade-42",
      buyerAddress: maskAddress(BUYER),
      sellerAddress: maskAddress(SELLER),
      amountCngn: "1500.50",
      status: "settled",
      createdAt: "2026-01-02T10:00:00.000Z",
      updatedAt: "2026-01-05T12:30:00.000Z",
    });
    expect(serialized).not.toContain("call me at night");
    expect(serialized).not.toContain("buyer@example.com");
    expect(serialized).not.toContain(BUYER);
    expect(body.generatedAt).toBe("2026-01-06T08:00:00.000Z");
    expect(body.version).toBe(1);
  });
});

describe("canonicalJson", () => {
  it("is independent of key insertion order", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonicalJson({ a: { c: 3, d: 2 }, b: 1 }),
    );
  });
});

describe("buildTradeReceipt / verifyTradeReceipt", () => {
  it("produces a 64-char hex digest that verifies", async () => {
    const receipt = await buildTradeReceipt(trade, FIXED_DATE);
    expect(receipt.digest).toMatch(/^[0-9a-f]{64}$/);
    await expect(verifyTradeReceipt(receipt)).resolves.toBe(true);
  });

  it("is deterministic for identical input", async () => {
    const a = await buildTradeReceipt(trade, FIXED_DATE);
    const b = await buildTradeReceipt(trade, FIXED_DATE);
    expect(a.digest).toBe(b.digest);
  });

  it("detects a tampered amount", async () => {
    const receipt = await buildTradeReceipt(trade, FIXED_DATE);
    const tampered = { ...receipt, trade: { ...receipt.trade, amountCngn: "9999" } };
    await expect(verifyTradeReceipt(tampered)).resolves.toBe(false);
  });

  it("detects an injected extra field", async () => {
    const receipt = await buildTradeReceipt(trade, FIXED_DATE);
    const injected = { ...receipt, trade: { ...receipt.trade, note: "x" } } as typeof receipt;
    await expect(verifyTradeReceipt(injected)).resolves.toBe(false);
  });

  it("rejects a missing or malformed digest", async () => {
    const receipt = await buildTradeReceipt(trade, FIXED_DATE);
    await expect(verifyTradeReceipt({ ...receipt, digest: "" })).resolves.toBe(false);
  });
});

describe("renderTradeReceiptText", () => {
  it("renders the key fields and digest in a readable layout", async () => {
    const receipt = await buildTradeReceipt(trade, FIXED_DATE);
    const text = renderTradeReceiptText(receipt);
    expect(text).toContain("Amana Trade Receipt");
    expect(text).toContain("Trade ID        : trade-42");
    expect(text).toContain("Amount (cNGN)   : 1500.50");
    expect(text).toContain(`Digest (SHA-256): ${receipt.digest}`);
    expect(text).not.toContain(BUYER);
  });
});

describe("receiptFilename", () => {
  it("sanitizes the trade id for use in a filename", async () => {
    const receipt = await buildTradeReceipt({ ...trade, tradeId: "a/b c" }, FIXED_DATE);
    expect(receiptFilename(receipt, "json")).toBe("trade-receipt-a_b_c.json");
  });
});
