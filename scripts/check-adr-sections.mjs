#!/usr/bin/env node
/**
 * Checks that ADR files contain every required section heading.
 *
 * Usage: node scripts/check-adr-sections.mjs <file.md> [...]
 * Exit codes: 0 = all files valid, 1 = missing sections, 2 = usage error.
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const REQUIRED_SECTIONS = [
  "Status",
  "Context",
  "Decision",
  "Alternatives Considered",
  "Consequences",
  "Security Review",
  "Migration",
  "Reversal",
  "References",
];

/** Returns the required sections missing from an ADR's markdown (level-2 headings). */
export function missingSections(markdown) {
  const headings = new Set(
    markdown
      .split("\n")
      .map((l) => l.match(/^##\s+(.+?)\s*$/))
      .filter(Boolean)
      .map((m) => m[1]),
  );
  return REQUIRED_SECTIONS.filter((s) => !headings.has(s));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("usage: check-adr-sections.mjs <file.md> [...]");
    process.exit(2);
  }
  let failed = false;
  for (const f of files) {
    const missing = missingSections(readFileSync(f, "utf8"));
    if (missing.length) {
      failed = true;
      console.error(`✗ ${f} is missing: ${missing.join(", ")}`);
    } else {
      console.log(`✓ ${f}`);
    }
  }
  process.exit(failed ? 1 : 0);
}
