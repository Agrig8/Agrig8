import {
  buildTradeFunnel,
  sanitizeAnalyticsMetadata,
  TRADE_FUNNEL_STAGES,
} from "../analyticsFunnel";

describe("sanitizeAnalyticsMetadata", () => {
  it("returns undefined when no metadata is given", () => {
    expect(sanitizeAnalyticsMetadata(undefined)).toBeUndefined();
  });

  it("keeps non-sensitive fields unchanged", () => {
    expect(sanitizeAnalyticsMetadata({ amount: 100, currency: "USDC" })).toEqual({
      amount: 100,
      currency: "USDC",
    });
  });

  it("removes wallet, address, user, and personal-data keys", () => {
    const result = sanitizeAnalyticsMetadata({
      amount: 5,
      buyerAddress: "GABC",
      sellerAddress: "GDEF",
      walletAddress: "GXYZ",
      userId: "user-1",
      user_id: "user-2",
      email: "a@example.com",
      phone: "+100",
      ipAddress: "10.0.0.1",
      secretKey: "S...",
    });
    expect(result).toEqual({ amount: 5 });
  });

  it("removes sensitive keys nested inside objects, recursively", () => {
    expect(
      sanitizeAnalyticsMetadata({
        trade: { id: "t-1", sellerAddress: "GDEF", meta: { email: "x" } },
      }),
    ).toEqual({ trade: { id: "t-1" } });
  });

  it("does not mutate the input", () => {
    const input = { buyerAddress: "GABC", amount: 1 };
    sanitizeAnalyticsMetadata(input);
    expect(input).toEqual({ buyerAddress: "GABC", amount: 1 });
  });

  it("returns undefined when every key is sensitive", () => {
    expect(sanitizeAnalyticsMetadata({ userId: "u" })).toBeUndefined();
  });

  it("keeps keys that only contain short fragments like 'ip' or 'key'", () => {
    expect(
      sanitizeAnalyticsMetadata({ description: "d", keyword: "k", shipping: 1 }),
    ).toEqual({ description: "d", keyword: "k", shipping: 1 });
  });

  it("keeps arrays as values", () => {
    expect(sanitizeAnalyticsMetadata({ tags: ["a", "b"] })).toEqual({ tags: ["a", "b"] });
  });
});

describe("buildTradeFunnel", () => {
  const ev = (event: string, tradeId?: string) => ({
    event: event as never,
    tradeId,
  });

  it("returns every funnel stage in order, even with no events", () => {
    const funnel = buildTradeFunnel([]);
    expect(funnel.map((s) => s.stage)).toEqual([...TRADE_FUNNEL_STAGES]);
    expect(funnel.every((s) => s.count === 0)).toBe(true);
    expect(funnel[0].conversionFromStart).toBeNull();
    expect(funnel[1].conversionFromPrevious).toBeNull();
  });

  it("counts distinct trades per stage, not raw events", () => {
    const funnel = buildTradeFunnel([
      ev("trade.created", "t1"),
      ev("trade.created", "t1"),
      ev("trade.created", "t2"),
      ev("trade.funded", "t1"),
      ev("trade.funded", "t1"),
    ]);
    expect(funnel[0].count).toBe(2);
    expect(funnel[1].count).toBe(1);
  });

  it("computes conversion from previous stage and from start", () => {
    const funnel = buildTradeFunnel([
      ev("trade.created", "t1"),
      ev("trade.created", "t2"),
      ev("trade.created", "t3"),
      ev("trade.created", "t4"),
      ev("trade.funded", "t1"),
      ev("trade.funded", "t2"),
      ev("trade.confirmed", "t1"),
    ]);
    expect(funnel[1]).toMatchObject({ count: 2, conversionFromPrevious: 0.5, conversionFromStart: 0.5 });
    expect(funnel[2]).toMatchObject({ count: 1, conversionFromPrevious: 0.5, conversionFromStart: 0.25 });
    expect(funnel[3]).toMatchObject({ count: 0, conversionFromPrevious: 0, conversionFromStart: 0 });
  });

  it("returns null conversion when the previous stage is empty", () => {
    const funnel = buildTradeFunnel([ev("trade.funded", "t1")]);
    expect(funnel[1].conversionFromPrevious).toBeNull();
    expect(funnel[1].conversionFromStart).toBeNull();
  });

  it("ignores events that are not funnel stages or have no trade id", () => {
    const funnel = buildTradeFunnel([
      ev("trade.disputed", "t1"),
      ev("user.registered", "t1"),
      ev("trade.created"),
    ]);
    expect(funnel.every((s) => s.count === 0)).toBe(true);
  });

  it("output contains only stage names and aggregate numbers", () => {
    const funnel = buildTradeFunnel([ev("trade.created", "GABC-trade")]);
    const serialized = JSON.stringify(funnel);
    expect(serialized).not.toContain("GABC-trade");
    for (const stat of funnel) {
      expect(Object.keys(stat).sort()).toEqual(
        ["conversionFromPrevious", "conversionFromStart", "count", "stage"],
      );
    }
  });
});
