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

describe("good-first-issue rubric (docs/governance/good-first-issue-rubric.md)", () => {
  const doc = read("good-first-issue-rubric.md");

  it("lists the required criteria, disqualifiers, and process", () => {
    for (const heading of ["## Required criteria", "## Disqualifiers", "## Process"]) {
      expect(doc).toContain(heading);
    }
  });

  it("requires a bounded scope, acceptance criteria, tests, and a mentor", () => {
    for (const phrase of ["Bounded scope", "Clear acceptance criteria", "Testable", "Mentor available"]) {
      expect(doc).toContain(phrase);
    }
  });

  it("links to governance documents that exist", () => {
    const links = [...doc.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(fs.existsSync(path.resolve(GOVERNANCE_DIR, link))).toBe(true);
    }
  });
});

describe("maintainer response SLA (docs/governance/maintainer-response-sla.md)", () => {
  const doc = read("maintainer-response-sla.md");

  it("sets a first-response target for issues, pull requests, and security reports", () => {
    for (const activity of ["New issue", "New pull request", "Security report"]) {
      expect(doc).toMatch(new RegExp(`\\| ${activity}[^|]*\\|[^|]*(business day)`));
    }
  });

  it("defines stale handling and never closes security reports as stale", () => {
    expect(doc).toContain("## Stale handling");
    expect(doc).toMatch(/Security reports are never closed as stale/);
  });

  it("links to governance and SLO documents that exist", () => {
    const links = [...doc.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1]);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(fs.existsSync(path.resolve(GOVERNANCE_DIR, link))).toBe(true);
    }
  });
});

describe("good-first-issue rubric cross-links", () => {
  it("links to the maintainer response SLA", () => {
    expect(read("good-first-issue-rubric.md")).toContain("(maintainer-response-sla.md)");
  });
});
