/**
 * Unit tests for scripts/detect-orphaned-evidence.ts
 *
 * Tests the pure logic exported by the script:
 *   - isValidCid: format validation for IPFS CIDs
 *   - detectOrphanedEvidence: orphan classification against a mock Prisma client
 *
 * No real database connection is required; Prisma is fully mocked.
 */

import { isValidCid, detectOrphanedEvidence } from "../utils/orphanedEvidence";
import type { OrphanedEvidenceRecord } from "../utils/orphanedEvidence";

// ── isValidCid ────────────────────────────────────────────────────────────────

describe("isValidCid", () => {
  describe("valid CIDs", () => {
    it("accepts a CIDv0 string (starts with Qm, 46 chars)", () => {
      // Real-looking CIDv0 fixture
      expect(isValidCid("QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG")).toBe(true);
    });

    it("accepts a CIDv1 bafy... string", () => {
      expect(isValidCid("bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi")).toBe(true);
    });

    it("accepts a CIDv1 bafk... string", () => {
      expect(isValidCid("bafkreigh2akiscaildcqabab4atvcec22okvmv3uonf7wes73a6dsslmam")).toBe(true);
    });
  });

  describe("invalid CIDs", () => {
    it("rejects an empty string", () => {
      expect(isValidCid("")).toBe(false);
    });

    it("rejects a whitespace-only string", () => {
      expect(isValidCid("   ")).toBe(false);
    });

    it("rejects a UUID-style string that is not a CID", () => {
      expect(isValidCid("3f6e7d1b-1a2b-4c3d-9e8f-123456789abc")).toBe(false);
    });

    it("rejects a short nonsense string", () => {
      expect(isValidCid("abc123")).toBe(false);
    });

    it("rejects a CIDv0 that is too short", () => {
      expect(isValidCid("QmYwAP")).toBe(false);
    });

    it("rejects a string that starts with Qm but contains invalid base58 chars", () => {
      // '0', 'O', 'I', 'l' are not valid base58 characters
      expect(isValidCid("QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnP000")).toBe(false);
    });

    it("rejects a path-like value sometimes mistakenly stored", () => {
      expect(isValidCid("/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG")).toBe(false);
    });
  });
});

// ── detectOrphanedEvidence ────────────────────────────────────────────────────

const VALID_CID_V0 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
const VALID_CID_V1 = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

function makeEvidence(overrides: Partial<{
  id: number;
  tradeId: string;
  cid: string;
  filename: string;
  mimeType: string;
  uploadedBy: string;
  createdAt: Date;
}> = {}) {
  return {
    id: overrides.id ?? 1,
    tradeId: overrides.tradeId ?? "trade-001",
    cid: overrides.cid ?? VALID_CID_V0,
    filename: overrides.filename ?? "photo.jpg",
    mimeType: overrides.mimeType ?? "image/jpeg",
    uploadedBy: overrides.uploadedBy ?? "GCBUYER000000000000000000000000000000000000000000000000",
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00Z"),
  };
}

function makeMockDb(
  evidenceRows: ReturnType<typeof makeEvidence>[],
  existingTradeIds: string[],
) {
  return {
    tradeEvidence: {
      findMany: jest.fn().mockResolvedValue(evidenceRows),
    },
    trade: {
      findMany: jest.fn().mockResolvedValue(
        existingTradeIds.map((tradeId) => ({ tradeId })),
      ),
    },
  };
}

describe("detectOrphanedEvidence", () => {
  describe("clean database", () => {
    it("returns zero orphans when all records are valid", async () => {
      const ev1 = makeEvidence({ id: 1, tradeId: "trade-001", cid: VALID_CID_V0 });
      const ev2 = makeEvidence({ id: 2, tradeId: "trade-002", cid: VALID_CID_V1 });
      const db = makeMockDb([ev1, ev2], ["trade-001", "trade-002"]);

      const result = await detectOrphanedEvidence(db as any);

      expect(result.orphanedCount).toBe(0);
      expect(result.orphans).toHaveLength(0);
      expect(result.totalScanned).toBe(2);
    });

    it("sets scannedAt to a valid ISO timestamp", async () => {
      const db = makeMockDb([], []);
      const result = await detectOrphanedEvidence(db as any);
      expect(() => new Date(result.scannedAt)).not.toThrow();
      expect(new Date(result.scannedAt).toISOString()).toBe(result.scannedAt);
    });
  });

  describe("empty CID", () => {
    it("flags a record with an empty cid", async () => {
      const ev = makeEvidence({ cid: "" });
      const db = makeMockDb([ev], ["trade-001"]);

      const result = await detectOrphanedEvidence(db as any);

      expect(result.orphanedCount).toBe(1);
      const orphan = result.orphans[0];
      expect(orphan.id).toBe(ev.id);
      expect(orphan.reasons.some((r) => r.includes("empty"))).toBe(true);
    });

    it("flags a record with a whitespace-only cid", async () => {
      const ev = makeEvidence({ cid: "   " });
      const db = makeMockDb([ev], ["trade-001"]);

      const result = await detectOrphanedEvidence(db as any);

      expect(result.orphanedCount).toBe(1);
      expect(result.orphans[0].reasons.some((r) => r.includes("empty"))).toBe(true);
    });
  });

  describe("invalid CID format", () => {
    it("flags a record with a UUID-style cid", async () => {
      const ev = makeEvidence({ cid: "3f6e7d1b-1a2b-4c3d-9e8f-123456789abc" });
      const db = makeMockDb([ev], ["trade-001"]);

      const result = await detectOrphanedEvidence(db as any);

      expect(result.orphanedCount).toBe(1);
      expect(result.orphans[0].reasons.some((r) => r.includes("CIDv0 or CIDv1"))).toBe(true);
    });

    it("flags a record with a path-prefixed cid", async () => {
      const ev = makeEvidence({ cid: `/ipfs/${VALID_CID_V0}` });
      const db = makeMockDb([ev], ["trade-001"]);

      const result = await detectOrphanedEvidence(db as any);

      expect(result.orphanedCount).toBe(1);
    });
  });

  describe("missing Trade row", () => {
    it("flags a record whose tradeId has no matching Trade", async () => {
      const ev = makeEvidence({ tradeId: "trade-deleted", cid: VALID_CID_V0 });
      const db = makeMockDb([ev], []); // no trades in DB

      const result = await detectOrphanedEvidence(db as any);

      expect(result.orphanedCount).toBe(1);
      expect(result.orphans[0].reasons.some((r) => r.includes("does not exist"))).toBe(true);
    });

    it("does not flag records for trades that do exist", async () => {
      const ev = makeEvidence({ tradeId: "trade-001", cid: VALID_CID_V0 });
      const db = makeMockDb([ev], ["trade-001"]);

      const result = await detectOrphanedEvidence(db as any);
      expect(result.orphanedCount).toBe(0);
    });
  });

  describe("multiple reasons on a single record", () => {
    it("accumulates multiple reasons when both cid and tradeId are invalid", async () => {
      const ev = makeEvidence({ cid: "", tradeId: "trade-missing" });
      const db = makeMockDb([ev], []); // trade-missing does not exist

      const result = await detectOrphanedEvidence(db as any);

      expect(result.orphanedCount).toBe(1);
      const orphan = result.orphans[0];
      expect(orphan.reasons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("mixed records", () => {
    it("only flags the orphaned records, not the clean ones", async () => {
      const clean1 = makeEvidence({ id: 1, tradeId: "trade-001", cid: VALID_CID_V0 });
      const clean2 = makeEvidence({ id: 2, tradeId: "trade-002", cid: VALID_CID_V1 });
      const orphan1 = makeEvidence({ id: 3, tradeId: "trade-001", cid: "" });
      const orphan2 = makeEvidence({ id: 4, tradeId: "trade-missing", cid: VALID_CID_V0 });

      const db = makeMockDb([clean1, clean2, orphan1, orphan2], ["trade-001", "trade-002"]);

      const result = await detectOrphanedEvidence(db as any);

      expect(result.totalScanned).toBe(4);
      expect(result.orphanedCount).toBe(2);

      const orphanIds = result.orphans.map((o: OrphanedEvidenceRecord) => o.id);
      expect(orphanIds).toContain(3);
      expect(orphanIds).toContain(4);
      expect(orphanIds).not.toContain(1);
      expect(orphanIds).not.toContain(2);
    });
  });

  describe("empty database", () => {
    it("handles zero evidence rows gracefully", async () => {
      const db = makeMockDb([], []);
      const result = await detectOrphanedEvidence(db as any);
      expect(result.totalScanned).toBe(0);
      expect(result.orphanedCount).toBe(0);
    });
  });

  describe("de-duplication of tradeId lookup", () => {
    it("only queries the Trade table once even when many evidence rows share a tradeId", async () => {
      const rows = Array.from({ length: 5 }, (_, i) =>
        makeEvidence({ id: i + 1, tradeId: "trade-shared", cid: VALID_CID_V0 }),
      );
      const db = makeMockDb(rows, ["trade-shared"]);

      await detectOrphanedEvidence(db as any);

      // findMany on trade is called once regardless of how many evidence rows exist
      expect(db.trade.findMany).toHaveBeenCalledTimes(1);
      // The query should have used the de-duplicated set
      const call = (db.trade.findMany as jest.Mock).mock.calls[0][0];
      expect(call.where.tradeId.in).toEqual(["trade-shared"]);
    });
  });
});
