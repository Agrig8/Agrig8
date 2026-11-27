/**
 * Verifies docs/DEPRECATION_POLICY.md defines the required stages, notice
 * periods, removal criteria, and a register with valid stage values.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const doc = readFileSync(resolve(ROOT, "docs/DEPRECATION_POLICY.md"), "utf8");

const STAGES = ["active", "deprecated", "sunset", "removed"];

describe("deprecation policy", () => {
  it.each([
    "## Deprecation Stages",
    "## Notice Periods",
    "## Removal Criteria",
    "## Process",
    "## Surface Register",
  ])("contains section %s", (heading) => {
    expect(doc).toContain(heading);
  });

  it("documents every stage in the stages table", () => {
    for (const stage of STAGES) {
      expect(doc).toMatch(new RegExp(`\\|\\s*\`${stage}\`\\s*\\|`));
    }
  });

  it("states the notice period for each surface type", () => {
    expect(doc).toMatch(/Public API[^\n]*90 days/);
    expect(doc).toMatch(/Contract events[^\n]*release cycle/);
    expect(doc).toMatch(/Environment and configuration keys[^\n]*30 days/);
  });

  it("forbids skipping the deprecated stage", () => {
    expect(doc).toMatch(/may not skip `deprecated`/);
  });

  it("uses only valid stage values in the register rows", () => {
    const register = doc.slice(doc.indexOf("## Surface Register"));
    const rows = register
      .split("\n")
      .filter((l) => l.startsWith("| ") && !l.startsWith("| Surface") && !l.startsWith("|---"));
    for (const row of rows) {
      const cells = row.split("|").map((c) => c.trim());
      const stage = cells[3];
      if (stage === "—" || stage === "") continue;
      expect(STAGES).toContain(stage.replace(/`/g, ""));
    }
  });
});
