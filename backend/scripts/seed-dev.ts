/**
 * Development seed command (issue #133).
 *
 * Creates deterministic local users, trades, and evidence records for UI and
 * integration development. Safe to run multiple times — every record is
 * upserted so a second run does not duplicate data.
 *
 * Usage:
 *   pnpm tsx scripts/seed-dev.ts
 *
 * The script reads the same DATABASE_URL as the application. Copy
 * backend/.env.example → backend/.env before running.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Deterministic fixture addresses (never real Stellar keys — dev only)
// ---------------------------------------------------------------------------

const USERS = [
  {
    walletAddress: 'gseed_seller_kano_grains_co_op_000000000000000000000000000',
    displayName: 'Seed Seller — Kano Grains Co-op',
  },
  {
    walletAddress: 'gseed_buyer_lagos_foods_ltd_000000000000000000000000000000',
    displayName: 'Seed Buyer — Lagos Foods Ltd',
  },
  {
    walletAddress: 'gseed_mediator_amana_000000000000000000000000000000000000',
    displayName: 'Seed Mediator',
  },
] as const;

const TRADES = [
  {
    tradeId: 'seed-trade-pending-001',
    buyerAddress: USERS[1].walletAddress,
    sellerAddress: USERS[0].walletAddress,
    amountUsdc: '450.0000000',
    status: 'PENDING' as const,
    buyerLossBps: 5000,
    sellerLossBps: 5000,
  },
  {
    tradeId: 'seed-trade-funded-002',
    buyerAddress: USERS[1].walletAddress,
    sellerAddress: USERS[0].walletAddress,
    amountUsdc: '180.0000000',
    status: 'FUNDED' as const,
    buyerLossBps: 7000,
    sellerLossBps: 3000,
  },
  {
    tradeId: 'seed-trade-disputed-003',
    buyerAddress: USERS[1].walletAddress,
    sellerAddress: USERS[0].walletAddress,
    amountUsdc: '310.0000000',
    status: 'DISPUTED' as const,
    buyerLossBps: 5000,
    sellerLossBps: 5000,
  },
  {
    tradeId: 'seed-trade-completed-004',
    buyerAddress: USERS[1].walletAddress,
    sellerAddress: USERS[0].walletAddress,
    amountUsdc: '95.0000000',
    status: 'COMPLETED' as const,
    buyerLossBps: 5000,
    sellerLossBps: 5000,
  },
  {
    tradeId: 'seed-trade-refunded-005',
    buyerAddress: USERS[1].walletAddress,
    sellerAddress: USERS[0].walletAddress,
    amountUsdc: '120.0000000',
    status: 'REFUNDED' as const,
    buyerLossBps: 5000,
    sellerLossBps: 5000,
  },
] as const;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('\n🌱 Amana dev seed — starting\n');

  // Users
  for (const user of USERS) {
    await prisma.user.upsert({
      where: { walletAddress: user.walletAddress },
      update: { displayName: user.displayName },
      create: user,
    });
  }
  console.log(`✓ Upserted ${USERS.length} users`);

  // Trades
  for (const trade of TRADES) {
    const { status, tradeId, buyerLossBps, sellerLossBps, ...rest } = trade;
    await prisma.trade.upsert({
      where: { tradeId },
      update: { status },
      create: { tradeId, status, buyerLossBps, sellerLossBps, ...rest },
    });
  }
  console.log(`✓ Upserted ${TRADES.length} trades`);

  // Evidence record attached to the disputed trade
  const disputedTradeId = 'seed-trade-disputed-003';
  const existingDispute = await prisma.dispute.findFirst({
    where: { tradeId: disputedTradeId },
  });
  if (!existingDispute) {
    await prisma.dispute.create({
      data: {
        tradeId: disputedTradeId,
        initiator: USERS[1].walletAddress,
        reason: 'Seed: 2 of 10 bags arrived with mold damage',
        status: 'UNDER_REVIEW',
      },
    });
    console.log('✓ Created dispute for seed-trade-disputed-003');
  } else {
    console.log('✓ Dispute for seed-trade-disputed-003 already exists — skipped');
  }

  console.log('\n✅ Dev seed complete\n');
  console.log('Seeded records:');
  console.log('  Users   :', USERS.map((u) => u.displayName).join(', '));
  console.log('  Trades  :', TRADES.map((t) => `${t.tradeId} (${t.status})`).join('\n            '));
}

main()
  .catch((err: unknown) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
