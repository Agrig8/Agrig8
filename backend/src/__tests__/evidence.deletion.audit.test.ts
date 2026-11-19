/**
 * Evidence deletion audit tests (issue #149).
 *
 * Covers the authorized erasure path in privacy.service.eraseUserData:
 * only evidence uploaded by the requesting wallet is removed, the address is
 * normalized before lookup, missing users are rejected without side effects,
 * and a failure mid-erasure aborts the whole transaction.
 */

jest.mock("../lib/db", () => ({ prisma: {} }));

import { eraseUserData } from "../services/privacy.service";

type TxMock = {
  user: { findUnique: jest.Mock; delete: jest.Mock };
  tradeEvidence: { deleteMany: jest.Mock };
  trade: { deleteMany: jest.Mock };
};

function makeTx(overrides: Partial<{ user: unknown }> = {}): TxMock {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue(
        "user" in overrides ? overrides.user : { id: 1 },
      ),
      delete: jest.fn().mockResolvedValue({ id: 1 }),
    },
    tradeEvidence: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
    trade: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
}

function makePrisma(tx: TxMock) {
  return {
    $transaction: jest.fn(async (fn: (t: TxMock) => Promise<unknown>) => fn(tx)),
  } as any;
}

describe("eraseUserData evidence deletion audit", () => {
  it("deletes only evidence uploaded by the requesting wallet", async () => {
    const tx = makeTx();
    const result = await eraseUserData("0xABC", makePrisma(tx));

    expect(tx.tradeEvidence.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.tradeEvidence.deleteMany).toHaveBeenCalledWith({
      where: { uploadedBy: "0xabc" },
    });
    expect(result).toEqual({ erased: true, walletAddress: "0xabc" });
  });

  it("normalizes surrounding whitespace and casing before lookup", async () => {
    const tx = makeTx();
    await eraseUserData("  0xDeAdBeEf  ", makePrisma(tx));

    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { walletAddress: "0xdeadbeef" },
      select: { id: true },
    });
    expect(tx.tradeEvidence.deleteMany).toHaveBeenCalledWith({
      where: { uploadedBy: "0xdeadbeef" },
    });
  });

  it("rejects an unknown user with NOT_FOUND and performs no deletions", async () => {
    const tx = makeTx({ user: null });
    const prisma = makePrisma(tx);

    await expect(eraseUserData("0xmissing", prisma)).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
    expect(tx.tradeEvidence.deleteMany).not.toHaveBeenCalled();
    expect(tx.trade.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.delete).not.toHaveBeenCalled();
  });

  it("propagates failures so the erasure transaction is rolled back", async () => {
    const tx = makeTx();
    tx.user.delete.mockRejectedValue(new Error("db connection lost"));
    const prisma = makePrisma(tx);

    await expect(eraseUserData("0xabc", prisma)).rejects.toThrow("db connection lost");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Evidence deletion ran inside the same transaction that failed.
    expect(tx.tradeEvidence.deleteMany).toHaveBeenCalledTimes(1);
  });
});
