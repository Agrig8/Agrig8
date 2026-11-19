import type { Trade } from "@/lib/validation/schemas";

/**
 * Trade receipts are generated client-side from trade data that is already
 * loaded for the viewer. Only whitelisted fields are copied so that any
 * additional (possibly personal) fields on the source object never leak into
 * an exported file. Wallet addresses are masked; the digest makes any later
 * edit to the exported body detectable.
 */

export const RECEIPT_VERSION = 1 as const;

export interface ReceiptTradeDetails {
  tradeId: string;
  buyerAddress: string;
  sellerAddress: string;
  amountCngn: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface TradeReceiptBody {
  version: typeof RECEIPT_VERSION;
  generatedAt: string;
  trade: ReceiptTradeDetails;
}

export interface TradeReceipt extends TradeReceiptBody {
  digest: string;
}

/** Masks a wallet address to `ABCDEF…WXYZ`. Short values are fully masked. */
export function maskAddress(address: string): string {
  const value = address.trim();
  if (value.length <= 12) return "…";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

/** Recursively sorts object keys so JSON serialization is deterministic. */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto is unavailable; cannot compute receipt digest");
  }
  const bytes = new TextEncoder().encode(input);
  const hash = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Builds the receipt body with whitelisted, masked trade details. */
export function buildTradeReceiptBody(
  trade: Trade,
  generatedAt: Date = new Date(),
): TradeReceiptBody {
  return {
    version: RECEIPT_VERSION,
    generatedAt: generatedAt.toISOString(),
    trade: {
      tradeId: trade.tradeId,
      buyerAddress: maskAddress(trade.buyerAddress),
      sellerAddress: maskAddress(trade.sellerAddress),
      amountCngn: trade.amountCngn,
      status: trade.status,
      createdAt: trade.createdAt,
      updatedAt: trade.updatedAt,
    },
  };
}

/** Computes the SHA-256 digest of a receipt body. */
export async function computeReceiptDigest(body: TradeReceiptBody): Promise<string> {
  return sha256Hex(canonicalJson(body));
}

/** Builds a complete, digest-stamped receipt for a trade. */
export async function buildTradeReceipt(
  trade: Trade,
  generatedAt: Date = new Date(),
): Promise<TradeReceipt> {
  const body = buildTradeReceiptBody(trade, generatedAt);
  const digest = await computeReceiptDigest(body);
  return { ...body, digest };
}

/**
 * Returns true only if the receipt's digest matches its body. Unknown extra
 * fields change the canonical form and therefore fail verification.
 */
export async function verifyTradeReceipt(receipt: TradeReceipt): Promise<boolean> {
  const { digest, ...body } = receipt;
  if (typeof digest !== "string" || digest.length !== 64) return false;
  return (await computeReceiptDigest(body as TradeReceiptBody)) === digest;
}

/** Renders a human-readable receipt suitable for a .txt download. */
export function renderTradeReceiptText(receipt: TradeReceipt): string {
  const t = receipt.trade;
  return [
    "Amana Trade Receipt",
    "===================",
    `Receipt version : ${receipt.version}`,
    `Generated at    : ${receipt.generatedAt}`,
    "",
    `Trade ID        : ${t.tradeId}`,
    `Status          : ${t.status}`,
    `Amount (cNGN)   : ${t.amountCngn}`,
    `Buyer           : ${t.buyerAddress}`,
    `Seller          : ${t.sellerAddress}`,
    `Created at      : ${t.createdAt}`,
    `Last updated    : ${t.updatedAt}`,
    "",
    `Digest (SHA-256): ${receipt.digest}`,
    "",
  ].join("\n");
}

export function receiptFilename(receipt: TradeReceipt, extension: "json" | "txt"): string {
  const safeId = receipt.trade.tradeId.replace(/[^A-Za-z0-9_-]/g, "_");
  return `trade-receipt-${safeId}.${extension}`;
}

/** Triggers a browser download of the receipt as JSON or text. */
export function downloadTradeReceipt(
  receipt: TradeReceipt,
  format: "json" | "txt" = "json",
): void {
  const content =
    format === "json"
      ? JSON.stringify(receipt, null, 2)
      : renderTradeReceiptText(receipt);
  const type = format === "json" ? "application/json" : "text/plain";
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = receiptFilename(receipt, format);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
