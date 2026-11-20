/**
 * Tests for story fixtures (issue #134).
 *
 * Validates that every fixture is structurally complete so a component
 * consuming it never encounters undefined required props.
 */
import {
  ALL_TRADE_LIST_FIXTURES,
  ALL_TRADE_DETAIL_FIXTURES,
  tradeListItemLoading,
  tradeListItemSuccess,
  tradeListItemDisputed,
  tradeListItemInTransit,
  tradeListItemTerminal,
  tradeDetailLoading,
  tradeDetailSuccess,
  tradeDetailDisputed,
  tradeDetailRefunded,
  tradeDetailTerminal,
} from '../storyFixtures';

const TRADE_STATUSES = ['PENDING', 'IN TRANSIT', 'SETTLED', 'DISPUTED', 'DRAFT'] as const;
const LIST_REQUIRED_KEYS: (keyof typeof tradeListItemLoading)[] = [
  'tradeId',
  'commodity',
  'counterparty',
  'amountCngn',
  'status',
  'createdAt',
  'onView',
];
const DETAIL_REQUIRED_KEYS: (keyof typeof tradeDetailLoading)[] = [
  'id',
  'commodity',
  'quantity',
  'status',
  'buyer',
  'seller',
  'vaultAmountLocked',
  'assetValue',
  'timeline',
];

describe('ALL_TRADE_LIST_FIXTURES', () => {
  it('contains five fixtures', () => {
    expect(ALL_TRADE_LIST_FIXTURES).toHaveLength(5);
  });

  it('covers all five status values', () => {
    const statuses = ALL_TRADE_LIST_FIXTURES.map((f) => f.status);
    for (const s of TRADE_STATUSES) {
      expect(statuses).toContain(s);
    }
  });

  it('every fixture has all required TradeListItem props', () => {
    for (const fixture of ALL_TRADE_LIST_FIXTURES) {
      for (const key of LIST_REQUIRED_KEYS) {
        expect(fixture[key]).toBeDefined();
      }
    }
  });

  it('every fixture has a unique tradeId', () => {
    const ids = ALL_TRADE_LIST_FIXTURES.map((f) => f.tradeId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('onView is callable on every fixture', () => {
    for (const fixture of ALL_TRADE_LIST_FIXTURES) {
      expect(() => fixture.onView()).not.toThrow();
    }
  });
});

describe('ALL_TRADE_DETAIL_FIXTURES', () => {
  it('contains five fixtures', () => {
    expect(ALL_TRADE_DETAIL_FIXTURES).toHaveLength(5);
  });

  it('every fixture has all required TradeDetail props', () => {
    for (const fixture of ALL_TRADE_DETAIL_FIXTURES) {
      for (const key of DETAIL_REQUIRED_KEYS) {
        expect(fixture[key]).toBeDefined();
      }
    }
  });

  it('every fixture has a non-empty timeline', () => {
    for (const fixture of ALL_TRADE_DETAIL_FIXTURES) {
      expect(fixture.timeline.length).toBeGreaterThan(0);
    }
  });

  it('every fixture has a unique id', () => {
    const ids = ALL_TRADE_DETAIL_FIXTURES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('buyer and seller walletAddress are non-empty strings', () => {
    for (const fixture of ALL_TRADE_DETAIL_FIXTURES) {
      expect(typeof fixture.buyer.walletAddress).toBe('string');
      expect(fixture.buyer.walletAddress.length).toBeGreaterThan(0);
      expect(typeof fixture.seller.walletAddress).toBe('string');
      expect(fixture.seller.walletAddress.length).toBeGreaterThan(0);
    }
  });
});

describe('individual fixtures — spot checks', () => {
  it('tradeListItemLoading has status PENDING', () => {
    expect(tradeListItemLoading.status).toBe('PENDING');
  });

  it('tradeListItemSuccess has status SETTLED', () => {
    expect(tradeListItemSuccess.status).toBe('SETTLED');
  });

  it('tradeListItemDisputed has status DISPUTED', () => {
    expect(tradeListItemDisputed.status).toBe('DISPUTED');
  });

  it('tradeListItemInTransit has status IN TRANSIT', () => {
    expect(tradeListItemInTransit.status).toBe('IN TRANSIT');
  });

  it('tradeListItemTerminal has status DRAFT', () => {
    expect(tradeListItemTerminal.status).toBe('DRAFT');
  });

  it('tradeDetailDisputed includes lossRatios', () => {
    expect(tradeDetailDisputed.lossRatios).toBeDefined();
    expect(tradeDetailDisputed.lossRatios!.length).toBeGreaterThan(0);
  });

  it('tradeDetailRefunded has zero vaultAmountLocked', () => {
    expect(tradeDetailRefunded.vaultAmountLocked).toBe(0);
  });

  it('tradeDetailTerminal has DRAFT status and zero vaultAmountLocked', () => {
    expect(tradeDetailTerminal.status).toBe('DRAFT');
    expect(tradeDetailTerminal.vaultAmountLocked).toBe(0);
  });

  it('tradeDetailSuccess has all timeline events completed', () => {
    for (const event of tradeDetailSuccess.timeline) {
      expect(event.status).toBe('completed');
    }
  });
});
