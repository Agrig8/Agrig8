/**
 * Tests for the dev seed script (issue #133).
 *
 * Uses an in-memory mock of PrismaClient to verify the seed upserts the
 * expected number of users, trades, and disputes without needing a real
 * database.
 */

const upsertMock = jest.fn().mockResolvedValue({});
const findFirstMock = jest.fn().mockResolvedValue(null);
const createMock = jest.fn().mockResolvedValue({});
const disconnectMock = jest.fn().mockResolvedValue(undefined);

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: { upsert: upsertMock },
    trade: { upsert: upsertMock },
    dispute: { findFirst: findFirstMock, create: createMock },
    $disconnect: disconnectMock,
  })),
}));

// Suppress console output during the test run.
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.clearAllMocks();
  findFirstMock.mockResolvedValue(null);
});

async function runSeed(): Promise<void> {
  // Dynamically import so the mock is in place before the module runs.
  const mod = await import('../seed-dev');
  // The module exports nothing (top-level IIFE); the import itself executes it.
  void mod;
}

describe('seed-dev (issue #133)', () => {
  it('upserts three users', async () => {
    // We re-import to trigger the main() call. Reset module registry per test.
    jest.resetModules();
    jest.mock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => ({
        user: { upsert: upsertMock },
        trade: { upsert: upsertMock },
        dispute: { findFirst: findFirstMock, create: createMock },
        $disconnect: disconnectMock,
      })),
    }));

    // Run the script's exported main indirectly by requiring after mock setup.
    // Because the script calls main() at module load time we just count calls.
    await runSeed();

    // 3 users + 5 trades = 8 total upsert calls
    const userUpserts = upsertMock.mock.calls.filter(
      (c) => (c[0] as { where?: { walletAddress?: unknown } })?.where?.walletAddress,
    );
    expect(userUpserts.length).toBeGreaterThanOrEqual(3);
  });

  it('upserts five trades', async () => {
    jest.resetModules();
    jest.mock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => ({
        user: { upsert: upsertMock },
        trade: { upsert: upsertMock },
        dispute: { findFirst: findFirstMock, create: createMock },
        $disconnect: disconnectMock,
      })),
    }));

    await runSeed();

    const tradeUpserts = upsertMock.mock.calls.filter(
      (c) => (c[0] as { where?: { tradeId?: unknown } })?.where?.tradeId,
    );
    expect(tradeUpserts.length).toBeGreaterThanOrEqual(5);
  });

  it('creates a dispute for the disputed trade when none exists', async () => {
    jest.resetModules();
    findFirstMock.mockResolvedValue(null);
    jest.mock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => ({
        user: { upsert: upsertMock },
        trade: { upsert: upsertMock },
        dispute: { findFirst: findFirstMock, create: createMock },
        $disconnect: disconnectMock,
      })),
    }));

    await runSeed();

    expect(createMock).toHaveBeenCalledTimes(1);
    const arg = createMock.mock.calls[0][0] as { data?: { tradeId?: string } };
    expect(arg.data?.tradeId).toBe('seed-trade-disputed-003');
  });

  it('skips dispute creation when dispute already exists', async () => {
    jest.resetModules();
    findFirstMock.mockResolvedValue({ id: 'existing' });
    jest.mock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => ({
        user: { upsert: upsertMock },
        trade: { upsert: upsertMock },
        dispute: { findFirst: findFirstMock, create: createMock },
        $disconnect: disconnectMock,
      })),
    }));

    await runSeed();

    expect(createMock).not.toHaveBeenCalled();
  });

  it('calls $disconnect after seeding', async () => {
    jest.resetModules();
    jest.mock('@prisma/client', () => ({
      PrismaClient: jest.fn().mockImplementation(() => ({
        user: { upsert: upsertMock },
        trade: { upsert: upsertMock },
        dispute: { findFirst: findFirstMock, create: createMock },
        $disconnect: disconnectMock,
      })),
    }));

    await runSeed();

    expect(disconnectMock).toHaveBeenCalledTimes(1);
  });
});
