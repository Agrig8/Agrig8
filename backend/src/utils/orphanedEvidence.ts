/**
 * orphanedEvidence.ts
 *
 * Pure logic for detecting orphaned TradeEvidence records.
 *
 * "Orphaned" means the record cannot be retrieved from IPFS or its parent
 * Trade no longer exists:
 *   1. `cid` is empty / whitespace.
 *   2. `cid` fails the basic CIDv0 / CIDv1 format check.
 *   3. The referenced `tradeId` has no matching Trade row.
 *
 * This module is imported by:
 *   - backend/scripts/detect-orphaned-evidence.ts (CLI entry point)
 *   - backend/src/__tests__/detect-orphaned-evidence.test.ts (unit tests)
 */

import type { PrismaClient } from "@prisma/client";

// ── CID validation ────────────────────────────────────────────────────────────

/**
 * Returns true if the value looks like a plausible IPFS CID.
 *
 * CIDv0: 46-character base58btc string starting with "Qm".
 * CIDv1: base32-encoded string starting with common go-ipfs / Kubo prefixes.
 *
 * This is a lightweight format check — it does not make network requests or
 * verify the multihash. Its purpose is to catch empty strings, GUIDs, and
 * garbage values that cannot possibly resolve on IPFS.
 */
export function isValidCid(cid: string): boolean {
  if (!cid || cid.trim() === "") return false;
  const trimmed = cid.trim();
  // CIDv0: exactly 46 chars, base58btc (no 0, O, I, l)
  if (/^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(trimmed)) return true;
  // CIDv1 base32 — most common prefixes in go-ipfs output
  if (/^(bafy|bafk|bafz|bafyb|bafkr)[a-z2-7]{50,}$/.test(trimmed)) return true;
  return false;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrphanedEvidenceRecord {
  id: number;
  tradeId: string;
  cid: string;
  filename: string;
  mimeType: string;
  uploadedBy: string;
  createdAt: Date;
  reasons: string[];
}

export interface OrphanScanResult {
  scannedAt: string;
  totalScanned: number;
  orphanedCount: number;
  orphans: OrphanedEvidenceRecord[];
}

// ── Minimal DB interface ───────────────────────────────────────────────────────

type EvidenceRow = {
  id: number;
  tradeId: string;
  cid: string;
  filename: string;
  mimeType: string;
  uploadedBy: string;
  createdAt: Date;
};

// We accept only the two model accessors we need so the function is easy to
// test with a plain mock without constructing a full PrismaClient.
type DetectDb = Pick<PrismaClient, "tradeEvidence" | "trade">;

// ── Core logic ────────────────────────────────────────────────────────────────

/**
 * Scans all TradeEvidence rows for orphan conditions and returns a structured
 * report. The function is read-only — it makes no writes to the database.
 */
export async function detectOrphanedEvidence(
  db: DetectDb,
): Promise<OrphanScanResult> {
  const allEvidence = (await db.tradeEvidence.findMany({
    select: {
      id: true,
      tradeId: true,
      cid: true,
      filename: true,
      mimeType: true,
      uploadedBy: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  })) as EvidenceRow[];

  // Single query for all distinct tradeIds referenced by evidence rows.
  const distinctTradeIds = [...new Set(allEvidence.map((e) => e.tradeId))];

  const existingTrades = (await db.trade.findMany({
    where: { tradeId: { in: distinctTradeIds } },
    select: { tradeId: true },
  })) as Array<{ tradeId: string }>;

  const existingTradeIdSet = new Set(existingTrades.map((t) => t.tradeId));

  const orphans: OrphanedEvidenceRecord[] = [];

  for (const ev of allEvidence) {
    const reasons: string[] = [];

    if (!ev.cid || ev.cid.trim() === "") {
      reasons.push("cid is empty or whitespace");
    } else if (!isValidCid(ev.cid)) {
      reasons.push(`cid "${ev.cid}" does not match CIDv0 or CIDv1 format`);
    }

    if (!existingTradeIdSet.has(ev.tradeId)) {
      reasons.push(
        `referenced tradeId "${ev.tradeId}" does not exist in the Trade table`,
      );
    }

    if (reasons.length > 0) {
      orphans.push({ ...ev, reasons });
    }
  }

  return {
    scannedAt: new Date().toISOString(),
    totalScanned: allEvidence.length,
    orphanedCount: orphans.length,
    orphans,
  };
}

// ── Report rendering ──────────────────────────────────────────────────────────

export function renderOrphanReport(result: OrphanScanResult): string {
  const lines: string[] = [
    "=== Orphaned Evidence Detection Report ===",
    `Scanned at:     ${result.scannedAt}`,
    `Total scanned:  ${result.totalScanned}`,
    `Orphaned found: ${result.orphanedCount}`,
    "",
  ];

  if (result.orphanedCount === 0) {
    lines.push("✅ No orphaned evidence records detected.");
    return lines.join("\n");
  }

  lines.push(`❌ ${result.orphanedCount} orphaned record(s):\n`);

  for (const orphan of result.orphans) {
    lines.push(
      `  id=${orphan.id}  tradeId=${orphan.tradeId}  cid="${orphan.cid}"`,
    );
    lines.push(
      `  filename=${orphan.filename}  uploadedBy=${orphan.uploadedBy}`,
    );
    lines.push(`  createdAt=${orphan.createdAt.toISOString()}`);
    for (const reason of orphan.reasons) {
      lines.push(`  ⚠  ${reason}`);
    }
    lines.push("");
  }

  lines.push(
    "Action: investigate each orphan. Rows with an invalid CID cannot be",
    "retrieved from IPFS and may need to be deleted or re-uploaded.",
    "Rows referencing a missing Trade are dangling metadata that should be",
    "cleaned up once the investigation is complete.",
  );

  return lines.join("\n");
}
