/**
 * Tests for the ADR template, review checklist, and scripts/check-adr-sections.mjs.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { REQUIRED_SECTIONS, missingSections } from "../check-adr-sections.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const template = readFileSync(resolve(ROOT, "docs/adr/TEMPLATE.md"), "utf8");
const checklist = readFileSync(resolve(ROOT, "docs/adr/REVIEW_CHECKLIST.md"), "utf8");

describe("ADR template", () => {
  it("contains every required section", () => {
    expect(missingSections(template)).toEqual([]);
  });
});

describe("missingSections", () => {
  const full = REQUIRED_SECTIONS.map((s) => `## ${s}\n\nbody\n`).join("\n");

  it("returns nothing for a complete ADR", () => {
    expect(missingSections(full)).toEqual([]);
  });

  it("reports each missing section", () => {
    const withoutSecurity = full.replace("## Security Review\n\nbody\n", "");
    expect(missingSections(withoutSecurity)).toEqual(["Security Review"]);
  });

  it("ignores headings at other levels", () => {
    const wrongLevel = full.replace("## Reversal", "### Reversal");
    expect(missingSections(wrongLevel)).toEqual(["Reversal"]);
  });
});

describe("review checklist", () => {
  it("requires alternatives, security, migration and reversal review", () => {
    expect(checklist).toMatch(/At least two alternatives/);
    expect(checklist).toMatch(/Security Review/);
    expect(checklist).toMatch(/Migration/);
    expect(checklist).toMatch(/Reversal/);
  });

  it("points to the validator script", () => {
    expect(checklist).toContain("scripts/check-adr-sections.mjs");
  });
});
