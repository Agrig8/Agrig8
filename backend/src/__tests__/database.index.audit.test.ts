/**
 * Database index audit tests (issue #150).
 *
 * Guards the hot-path indexes that trade and evidence queries depend on by
 * reading the Prisma schema directly. If an index used by a list or lookup
 * query is dropped, these tests fail before the regression reaches production.
 */

import { readFileSync } from "fs";
import { join } from "path";

const schema = readFileSync(join(__dirname, "../../prisma/schema.prisma"), "utf8");

function modelBody(name: string): string {
  const match = schema.match(new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, "m"));
  if (!match) throw new Error(`model ${name} not found in schema`);
  return match[1];
}

function indexes(model: string): string[] {
  return [...modelBody(model).matchAll(/@@index\(\[([^\]]+)\]\)/g)].map((m) =>
    m[1].split(",").map((s) => s.trim()).join(","),
  );
}

describe("database index audit", () => {
  describe("Trade", () => {
    const trade = () => indexes("Trade");

    it("indexes tradeId for direct lookups", () => {
      expect(trade()).toContain("tradeId");
    });

    it("indexes buyer and seller addresses for party listings", () => {
      expect(trade()).toEqual(expect.arrayContaining(["buyerAddress", "sellerAddress"]));
    });

    it("covers party + status + createdAt for filtered, ordered listings", () => {
      expect(trade()).toEqual(
        expect.arrayContaining([
          "buyerAddress,status,createdAt",
          "sellerAddress,status,createdAt",
        ]),
      );
    });
  });

  describe("TradeEvidence", () => {
    const evidence = () => indexes("TradeEvidence");

    it("indexes tradeId for evidence-by-trade reads", () => {
      expect(evidence()).toContain("tradeId");
    });

    it("covers tradeId + createdAt for the ordered evidence listing", () => {
      expect(evidence()).toContain("tradeId,createdAt");
    });

    it("indexes cid for content-address lookups", () => {
      expect(evidence()).toContain("cid");
    });

    it("enforces one record per (tradeId, cid) pair", () => {
      expect(modelBody("TradeEvidence")).toMatch(/@@unique\(\[tradeId, cid\]\)/);
    });
  });
});
