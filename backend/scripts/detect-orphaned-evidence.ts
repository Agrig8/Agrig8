/**
 * detect-orphaned-evidence.ts  — CLI entry point
 *
 * Detects TradeEvidence rows that are "orphaned" — their metadata exists in
 * the database but has no usable CID or no linked Trade row.
 *
 * Pure detection logic lives in src/utils/orphanedEvidence.ts so that it
 * can be unit-tested independently of this process wrapper.
 *
 * Usage:
 *   npx tsx scripts/detect-orphaned-evidence.ts [options]
 *
 * Options:
 *   --dry-run            Accepted for forward-compatibility; the script is
 *                        read-only and makes no writes regardless.
 *   --json               Emit the report as JSON instead of plain text.
 *   --no-fail-on-orphans Exit 0 even when orphans are found (default: exit 1).
 */

import { PrismaClient } from "@prisma/client";
import {
  detectOrphanedEvidence,
  renderOrphanReport,
  type OrphanScanResult,
} from "../src/utils/orphanedEvidence";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const jsonOutput = process.argv.includes("--json");
  const failOnOrphans = !process.argv.includes("--no-fail-on-orphans");

  if (dryRun) {
    console.log("Mode: DRY RUN (read-only — no writes are performed)\n");
  }

  let result: OrphanScanResult;
  try {
    result = await detectOrphanedEvidence(prisma);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ Database error: ${message}`);
    process.exit(1);
  }

  if (jsonOutput) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    console.log(renderOrphanReport(result));
  }

  if (result.orphanedCount > 0 && failOnOrphans) {
    process.exit(1);
  }
}

main()
  .catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`❌ Unexpected error: ${message}`);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
