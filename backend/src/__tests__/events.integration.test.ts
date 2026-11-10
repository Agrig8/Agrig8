const mockScValToNative = jest.fn((value: unknown) => value);

jest.mock("@stellar/stellar-sdk", () => ({
  rpc: {
    Server: jest.fn().mockImplementation(() => ({
      getEvents: jest.fn(),
    })),
  },
  scValToNative: (value: unknown) => mockScValToNative(value),
}));

jest.mock("../config/eventListener.config", () => ({
  getEventListenerConfig: jest.fn().mockReturnValue({
    rpcUrl: "https://soroban-testnet.stellar.org",
    contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    pollIntervalMs: 1000,
    backoffInitialMs: 100,
    backoffMaxMs: 5000,
    processedLedgersCacheSize: 100,
    outboxMaxAttempts: 5,
  }),
}));

jest.mock("../services/trade.watchlist.service", () => ({
  TradeWatchlistService: jest.fn().mockImplementation(() => ({
    notifyWatchers: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("../services/webhook.service", () => ({
  webhookService: { dispatch: jest.fn() },
}));

jest.mock("../lib/escrowAudit", () => ({ logEscrowEvent: jest.fn() }));
jest.mock("../lib/metrics", () => ({
  recordTradeFunnelEvent: jest.fn(),
  recordTimeToFund: jest.fn(),
  recordTimeToRelease: jest.fn(),
  recordTradeGmv: jest.fn(),
}));

import { EventListenerService } from "../services/eventListener.service";
import { EventType, EVENT_TO_STATUS, TradeStatus } from "../types/events";

type TradeRow = {
  tradeId: string;
  buyerAddress: string;
  sellerAddress: string;
  amountUsdc: string;
  status: TradeStatus;
  version: number;
};

function createMockPrisma() {
  const trades = new Map<string, TradeRow>();
  const processedEvents = new Set<string>();

  const trade = {
    findUnique: jest.fn(async ({ where }: { where: { tradeId: string } }) =>
      trades.get(where.tradeId) ?? null,
    ),
    create: jest.fn(async ({ data }: { data: TradeRow }) => {
      trades.set(data.tradeId, { ...data });
      return data;
    }),
    updateMany: jest.fn(
      async ({
        where,
        data,
      }: {
        where: { tradeId: string; status: TradeStatus; version: number };
        data: { status: TradeStatus; version: { increment: number } };
      }) => {
        const current = trades.get(where.tradeId);
        if (
          !current ||
          current.status !== where.status ||
          current.version !== where.version
        ) {
          return { count: 0 };
        }

        trades.set(where.tradeId, {
          ...current,
          status: data.status,
          version: current.version + data.version.increment,
        });
        return { count: 1 };
      },
    ),
  };

  const processedEvent = {
    findUnique: jest.fn(
      async ({
        where,
      }: {
        where: {
          ledgerSequence_contractId_eventId: {
            ledgerSequence: number;
            contractId: string;
            eventId: string;
          };
        };
      }) => {
        const key = where.ledgerSequence_contractId_eventId;
        return processedEvents.has(
          `${key.ledgerSequence}:${key.contractId}:${key.eventId}`,
        )
          ? { id: 1 }
          : null;
      },
    ),
    create: jest.fn(
      async ({
        data,
      }: {
        data: {
          ledgerSequence: number;
          contractId: string;
          eventId: string;
        };
      }) => {
        processedEvents.add(
          `${data.ledgerSequence}:${data.contractId}:${data.eventId}`,
        );
        return data;
      },
    ),
  };

  const streamClawbackEvent = {
    upsert: jest.fn().mockResolvedValue(undefined),
  };

  const prisma: any = {
    trade,
    processedEvent,
    streamClawbackEvent,
    $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) =>
      callback(prisma),
    ),
  };

  return { prisma, trades };
}

function buildRawSorobanEvent(
  ledger: number,
  eventSymbol: string,
  tradeId: string,
  eventData: Record<string, string> = {},
) {
  return {
    ledger,
    topic: [eventSymbol, tradeId],
    value: {
      type: "map",
      value: Object.entries(eventData).map(([key, value]) => ({
        key: { type: "symbol", value: key },
        val: { type: "string", value },
      })),
    },
    contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    id: `event-${ledger}`,
    type: "contract",
  } as any;
}

describe("Soroban event integration", () => {
  let eventListener: EventListenerService;
  let prismaState: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prismaState = createMockPrisma();
    eventListener = new EventListenerService(prismaState.prisma as any);
    mockScValToNative.mockClear();
  });

  afterEach(() => {
    eventListener.stop();
    jest.restoreAllMocks();
  });

  it("decodes generated TradeCreated topics and persists the trade payload", async () => {
    await eventListener.processEvent(
      buildRawSorobanEvent(100001, "TRDCRT", "trade-001", {
        buyer: "GABUYER",
        seller: "GASELLER",
        amount_usdc: "1000",
      }),
    );

    expect(prismaState.trades.get("trade-001")).toEqual({
      tradeId: "trade-001",
      buyerAddress: "GABUYER",
      sellerAddress: "GASELLER",
      amountUsdc: "1000",
      status: EVENT_TO_STATUS[EventType.TradeCreated],
      version: 1,
    });
    expect(prismaState.prisma.trade.create).toHaveBeenCalledTimes(1);
    expect(prismaState.prisma.processedEvent.create).toHaveBeenCalledTimes(1);
  });

  it("continues to decode legacy event topic aliases", async () => {
    await eventListener.processEvent(
      buildRawSorobanEvent(100002, "TradeCreated", "trade-legacy"),
    );

    expect(prismaState.trades.get("trade-legacy")?.status).toBe(
      TradeStatus.CREATED,
    );
  });

  it("decodes and persists generated stream clawback events", async () => {
    const event = buildRawSorobanEvent(100003, "CLWBCK", "stream-001", {
      stream_id: "stream-001",
      admin: "GAADMIN",
      amount: "250",
    });

    await eventListener.processEvent(event);

    expect(prismaState.prisma.streamClawbackEvent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          streamId_txHash: {
            streamId: "stream-001",
            txHash: "event-100003",
          },
        },
        create: expect.objectContaining({
          streamId: "stream-001",
          admin: "GAADMIN",
          amount: "250",
          txHash: "event-100003",
        }),
      }),
    );
    expect(prismaState.prisma.processedEvent.create).toHaveBeenCalledTimes(1);
  });

  it("applies a valid trade lifecycle in ledger order", async () => {
    const events = [
      ["TRDCRT", { buyer: "GABUYER", seller: "GASELLER", amount_usdc: "20" }],
      ["TRDFND", {}],
      ["DELCNF", {}],
      ["RELSD", {}],
    ] as const;

    for (const [index, [symbol, data]] of events.entries()) {
      await eventListener.processEvent(
        buildRawSorobanEvent(100010 + index, symbol, "trade-lifecycle", data),
      );
    }

    expect(prismaState.trades.get("trade-lifecycle")?.status).toBe(
      TradeStatus.COMPLETED,
    );
    expect(prismaState.prisma.trade.create).toHaveBeenCalledTimes(1);
    expect(prismaState.prisma.trade.updateMany).toHaveBeenCalledTimes(3);
    expect(prismaState.prisma.processedEvent.create).toHaveBeenCalledTimes(4);
  });

  it("applies a dispute lifecycle from funding through resolution", async () => {
    const events = [
      ["TRDCRT", { buyer: "GABUYER", seller: "GASELLER", amount_usdc: "20" }],
      ["TRDFND", {}],
      ["DISINI", { initiator: "GABUYER", reason: "damaged goods" }],
      ["DISRES", { resolver: "GAMEDIATOR", resolution: "refund" }],
    ] as const;

    for (const [index, [symbol, data]] of events.entries()) {
      await eventListener.processEvent(
        buildRawSorobanEvent(100015 + index, symbol, "trade-dispute", data),
      );
    }

    expect(prismaState.trades.get("trade-dispute")).toEqual({
      tradeId: "trade-dispute",
      buyerAddress: "GABUYER",
      sellerAddress: "GASELLER",
      amountUsdc: "20",
      status: TradeStatus.COMPLETED,
      version: 4,
    });
    expect(prismaState.prisma.trade.updateMany).toHaveBeenCalledTimes(3);
    expect(prismaState.prisma.processedEvent.create).toHaveBeenCalledTimes(4);
  });

  it("does not apply an out-of-order status transition", async () => {
    await eventListener.processEvent(
      buildRawSorobanEvent(100020, "TRDCRT", "trade-order"),
    );
    await eventListener.processEvent(
      buildRawSorobanEvent(100021, "RELSD", "trade-order"),
    );

    expect(prismaState.trades.get("trade-order")?.status).toBe(
      TradeStatus.CREATED,
    );
    expect(prismaState.prisma.trade.updateMany).not.toHaveBeenCalled();
  });

  it("deduplicates replayed events across listener restarts", async () => {
    const event = buildRawSorobanEvent(100030, "TRDCRT", "trade-replay");
    await eventListener.processEvent(event);

    eventListener.stop();
    eventListener = new EventListenerService(prismaState.prisma as any);
    await eventListener.processEvent(event);

    expect(prismaState.prisma.trade.create).toHaveBeenCalledTimes(1);
    expect(prismaState.prisma.processedEvent.create).toHaveBeenCalledTimes(1);
  });

  it("processes a batch of unique events without losing records", async () => {
    for (let index = 0; index < 25; index += 1) {
      await eventListener.processEvent(
        buildRawSorobanEvent(100100 + index, "TRDCRT", `trade-${index}`),
      );
    }

    expect(prismaState.trades.size).toBe(25);
    expect(prismaState.prisma.trade.create).toHaveBeenCalledTimes(25);
    expect(prismaState.prisma.processedEvent.create).toHaveBeenCalledTimes(25);
  });

  it("ignores unrecognized event symbols", async () => {
    await eventListener.processEvent(
      buildRawSorobanEvent(100200, "UNKNOWN", "trade-unknown"),
    );

    expect(prismaState.prisma.trade.create).not.toHaveBeenCalled();
    expect(prismaState.prisma.processedEvent.create).not.toHaveBeenCalled();
  });
});
