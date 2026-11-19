import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const GOVERNANCE_DIR = path.join(REPO_ROOT, "docs", "governance");

function read(name: string): string {
  return fs.readFileSync(path.join(GOVERNANCE_DIR, name), "utf8");
}

describe("issue label policy (docs/governance/label-policy.md)", () => {
  const doc = read("label-policy.md");

  it("defines the Type, Area, and Priority groups", () => {
    for (const heading of ["## Type", "## Area", "## Priority"]) {
      expect(doc).toContain(heading);
    }
  });

  it("uses only the documented prefixes for required labels", () => {
    const required = doc.match(/`(type|area|priority): [a-z0-9-]+`/g) ?? [];
    expect(required.length).toBeGreaterThan(0);
    for (const label of required) {
      expect(label).toMatch(/^`(type|area|priority): [a-z0-9-]+`$/);
    }
  });

  it("links to the related governance documents that exist", () => {
    const links = [...doc.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(fs.existsSync(path.resolve(GOVERNANCE_DIR, link))).toBe(true);
    }
  });

  it("points security reports away from public issues", () => {
    expect(doc).toMatch(/must \*\*not\*\* be filed as public issues/);
    expect(fs.existsSync(path.join(REPO_ROOT, "SECURITY.md"))).toBe(true);
  });
});
