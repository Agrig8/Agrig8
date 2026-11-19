import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../../..");
const readRepoFile = (rel: string): string =>
  fs.readFileSync(path.join(repoRoot, rel), "utf8");

describe("CODE_OF_CONDUCT.md", () => {
  const conduct = readRepoFile("CODE_OF_CONDUCT.md");

  it("exists at the repository root with a top-level heading", () => {
    expect(conduct.startsWith("# Code of Conduct")).toBe(true);
  });

  it("describes standards, scope, reporting, and maintainer response", () => {
    for (const heading of [
      "## Our Standards",
      "## Scope",
      "## Reporting",
      "## Maintainer Response",
    ]) {
      expect(conduct).toContain(heading);
    }
  });

  it("states a concrete acknowledgement window", () => {
    expect(conduct).toMatch(/acknowledged within \*\*3 business days\*\*/);
  });

  it("points security reports to SECURITY.md instead of public issues", () => {
    expect(conduct).toContain("./SECURITY.md");
    expect(fs.existsSync(path.join(repoRoot, "SECURITY.md"))).toBe(true);
  });

  it("is linked from the README contributing section", () => {
    const readme = readRepoFile("README.md");
    expect(readme).toContain("(./CODE_OF_CONDUCT.md)");
  });
});
