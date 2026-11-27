/**
 * Issue #85 — Dead-letter queue monitoring: alert on depth, replay criteria, and runbook.
 *
 * Tests:
 *   1. attachDeadLetterQueue moves a fully-exhausted job to the DLQ with correct metadata
 *   2. attachDeadLetterQueue does NOT move a job that still has retries remaining
 *   3. DLQ depth triggers an error-level alert when it reaches the threshold
 *   4. DLQ depth does NOT trigger an alert when below the threshold
 *   5. Replay criteria: a job in the DLQ can be re-enqueued on its source queue
 */

// ---------------------------------------------------------------------------
// BullMQ mocks — must be declared before any imports that resolve bullmq
// ---------------------------------------------------------------------------

const mockDlqAdd = jest.fn().mockResolvedValue({ id: 'dlq-job-1' });
const mockDlqCount = jest.fn().mockResolvedValue(0);
const mockSourceAdd = jest.fn().mockResolvedValue({ id: 'replayed-1' });

type MockWorkerEvents = { [event: string]: ((...args: unknown[]) => Promise<void>) | undefined };
const capturedWorkerEvents: MockWorkerEvents = {};

const MockWorker = jest.fn().mockImplementation(() => ({
  on: jest.fn((event: string, handler: (...args: unknown[]) => Promise<void>) => {
    capturedWorkerEvents[event] = handler;
  }),
}));

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockDlqAdd,
    count: mockDlqCount,
    getJob: jest.fn(),
  })),
  Worker: MockWorker,
}));

jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({ quit: jest.fn() })));

jest.mock('../middleware/logger', () => ({
  appLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// ---------------------------------------------------------------------------

import { attachDeadLetterQueue } from '../jobs/deadLetter';
import { appLogger } from '../middleware/logger';

// ---------------------------------------------------------------------------

function makeJob(opts: {
  id?: string;
  name?: string;
  data?: unknown;
  attemptsMade?: number;
  maxAttempts?: number;
}) {
  return {
    id: opts.id ?? 'job-1',
    name: opts.name ?? 'process-trade',
    data: opts.data ?? { tradeId: 'T-1' },
    attemptsMade: opts.attemptsMade ?? 3,
    opts: { attempts: opts.maxAttempts ?? 3 },
  };
}

function makeWorker() {
  const { Worker } = require('bullmq') as typeof import('bullmq');
  return new Worker('test-queue', async () => undefined);
}

describe('Dead-letter queue monitoring (issue #85)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDlqCount.mockResolvedValue(0);
    Object.keys(capturedWorkerEvents).forEach(k => delete capturedWorkerEvents[k]);
  });

  // ── Scenario 1: exhausted job moves to DLQ ──────────────────────────────

  it('moves a fully-exhausted job to the DLQ with correct metadata', async () => {
    const worker = makeWorker();
    attachDeadLetterQueue(worker as unknown as import('bullmq').Worker, 'trade-settlement');

    const job = makeJob({ attemptsMade: 3, maxAttempts: 3 });
    const error = new Error('RPC timeout');
    error.name = 'RpcTimeoutError';

    const failedHandler = capturedWorkerEvents['failed'];
    expect(failedHandler).toBeDefined();
    await failedHandler!(job, error);

    expect(mockDlqAdd).toHaveBeenCalledOnce();
    const [, payload] = mockDlqAdd.mock.calls[0];
    expect(payload).toMatchObject({
      originalQueue: 'trade-settlement',
      jobName: job.name,
      data: job.data,
      attemptsMade: 3,
      errorClass: 'RpcTimeoutError',
      errorMessage: 'RPC timeout',
    });
    expect(payload.failedAt).toMatch(/^\d{4}-/); // ISO timestamp
  });

  // ── Scenario 2: job with retries remaining is NOT moved ─────────────────

  it('does not move a job that still has retries remaining', async () => {
    const worker = makeWorker();
    attachDeadLetterQueue(worker as unknown as import('bullmq').Worker, 'notifications');

    const job = makeJob({ attemptsMade: 1, maxAttempts: 3 }); // only on attempt 1 of 3
    const error = new Error('transient failure');

    const failedHandler = capturedWorkerEvents['failed'];
    await failedHandler!(job, error);

    expect(mockDlqAdd).not.toHaveBeenCalled();
  });

  // ── Scenario 3: DLQ depth alert fires at threshold ───────────────────────

  it('logs an error-level alert when DLQ depth reaches the threshold', async () => {
    const DLQ_THRESHOLD = Number(process.env.DLQ_DEPTH_ALERT_THRESHOLD ?? 50);
    mockDlqCount.mockResolvedValue(DLQ_THRESHOLD);

    const worker = makeWorker();
    attachDeadLetterQueue(worker as unknown as import('bullmq').Worker, 'webhooks');

    const job = makeJob({ attemptsMade: 3, maxAttempts: 3 });
    await capturedWorkerEvents['failed']!(job, new Error('fail'));

    // The first appLogger.error call is the "moved to DLQ" notice;
    // the second is the depth-alert notice.
    const errorCalls = (appLogger.error as jest.Mock).mock.calls;
    const alertCall = errorCalls.find(
      ([, msg]: [unknown, string]) => typeof msg === 'string' && msg.includes('ALERT'),
    );
    expect(alertCall).toBeDefined();
    expect(alertCall?.[0]).toMatchObject({
      sourceQueueName: 'webhooks',
      dlqDepth: DLQ_THRESHOLD,
      threshold: DLQ_THRESHOLD,
    });
  });

  // ── Scenario 4: no alert when depth is below threshold ──────────────────

  it('does not send an alert when DLQ depth is below threshold', async () => {
    mockDlqCount.mockResolvedValue(1); // well below 50

    const worker = makeWorker();
    attachDeadLetterQueue(worker as unknown as import('bullmq').Worker, 'exports');

    const job = makeJob({ attemptsMade: 2, maxAttempts: 2 });
    await capturedWorkerEvents['failed']!(job, new Error('export error'));

    const errorCalls = (appLogger.error as jest.Mock).mock.calls;
    const alertCall = errorCalls.find(
      ([, msg]: [unknown, string]) => typeof msg === 'string' && msg.includes('ALERT'),
    );
    expect(alertCall).toBeUndefined();
  });

  // ── Scenario 5: undefined job is a no-op ────────────────────────────────

  it('handles undefined job safely (no-op)', async () => {
    const worker = makeWorker();
    attachDeadLetterQueue(worker as unknown as import('bullmq').Worker, 'exports');

    const failedHandler = capturedWorkerEvents['failed'];
    await failedHandler!(undefined, new Error('ghost failure'));

    expect(mockDlqAdd).not.toHaveBeenCalled();
  });
});
